import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAnalyticsStore } from './server/analyticsStore.mjs'
import QRCode from 'qrcode'
import { WebSocketServer } from 'ws'
import { MultiplayerError, MultiplayerService } from './server/multiplayerService.ts'

const root = path.dirname(fileURLToPath(import.meta.url))
const production = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? 5174)
const analyticsPath = process.env.ANALYTICS_DATA_PATH
  ? path.resolve(process.env.ANALYTICS_DATA_PATH)
  : path.join(root, '.data', 'analytics.json')
const store = createAnalyticsStore(analyticsPath)
const multiplayerPath = process.env.MULTIPLAYER_DATA_PATH
  ? path.resolve(process.env.MULTIPLAYER_DATA_PATH)
  : path.join(root, '.data', 'rooms.json')
const multiplayer = new MultiplayerService(multiplayerPath)
await multiplayer.load()
setInterval(() => multiplayer.cleanupExpired(), 60_000).unref()

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 10_000) throw new Error('Pedido demasiado grande.')
  }
  return JSON.parse(body || '{}')
}

async function handleApi(request, response) {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const leaveMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]{4})\/leave$/)
  if (leaveMatch && request.method === 'POST') {
    const { playerId, sessionToken } = await readJson(request)
    const resumed = multiplayer.resumeRoom(leaveMatch[1], playerId, sessionToken)
    multiplayer.command(leaveMatch[1], playerId, { type: 'ROOM_LEAVE', actionId: `leave:${playerId}:${Date.now()}` })
    json(response, 200, { ok: Boolean(resumed.credentials) })
    return true
  }
  const qrMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]{4})\/qr\.svg$/)
  if (qrMatch && request.method === 'GET') {
    if (!multiplayer.getRoom(qrMatch[1])) return json(response, 404, { error: 'Sala não encontrada.' })
    const origin = `${request.headers['x-forwarded-proto'] ?? 'http'}://${request.headers.host}`
    const svg = await QRCode.toString(`${origin}/join/${qrMatch[1]}`, { type: 'svg', margin: 1, color: { dark: '#1a1a1a', light: '#fdfcf8' } })
    response.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' }); response.end(svg); return true
  }
  if (pathname === '/api/analytics/visit' && request.method === 'POST') {
    const { visitorId } = await readJson(request)
    json(response, 200, await store.recordVisit(visitorId))
    return true
  }
  if (pathname === '/api/analytics/summary' && request.method === 'GET') {
    json(response, 200, await store.getSummary())
    return true
  }
  if (pathname.startsWith('/api/')) {
    json(response, 404, { error: 'Endpoint não encontrado.' })
    return true
  }
  return false
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

async function serveProduction(request, response) {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const dist = path.join(root, 'dist')
  let target = path.resolve(dist, `.${pathname}`)
  if (!target.startsWith(`${dist}${path.sep}`) && target !== dist) return json(response, 403, { error: 'Acesso recusado.' })
  try {
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html')
  } catch {
    target = path.join(dist, 'index.html')
  }
  response.writeHead(200, { 'content-type': mimeTypes[path.extname(target)] ?? 'application/octet-stream' })
  createReadStream(target).pipe(response)
}

const vite = production ? null : await import('vite').then(({ createServer }) => createServer({ server: { middlewareMode: true } }))
const server = http.createServer(async (request, response) => {
  try {
    if (await handleApi(request, response)) return
    if (vite) return vite.middlewares(request, response, () => json(response, 404, { error: 'Página não encontrada.' }))
    await serveProduction(request, response)
  } catch (error) {
    console.error(error)
    if (!response.headersSent) json(response, 400, { error: error instanceof Error ? error.message : 'Erro inesperado.' })
    else response.end()
  }
})

const sockets = new WebSocketServer({ noServer: true, maxPayload: 10_000 })
const socketIdentity = new Map()
const lastSnapshots = new WeakMap()
const socketAlive = new WeakMap()

function send(socket, value) { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(value)) }
function sendState(socket, snapshot, credentials, force = false) {
  const previous = lastSnapshots.get(socket)
  if (force || !previous) send(socket, { type: 'ROOM_STATE', version: snapshot.stateVersion, snapshot, credentials })
  else {
    const patch = {}
    for (const [key, value] of Object.entries(snapshot)) if (JSON.stringify(previous[key]) !== JSON.stringify(value)) patch[key] = value
    send(socket, { type: 'ROOM_PATCH', version: snapshot.stateVersion, patch })
  }
  lastSnapshots.set(socket, snapshot)
}
function broadcastRoom(room, event, payload) {
  for (const client of sockets.clients) {
    const identity = socketIdentity.get(client)
    if (identity?.code !== room.code) continue
    sendState(client, multiplayer.snapshot(room, identity.playerId))
    send(client, { type: 'ROOM_EVENT', version: room.stateVersion, event, payload })
  }
}

multiplayer.on('update', broadcastRoom)

sockets.on('connection', (socket) => {
  socketAlive.set(socket, true)
  socket.on('pong', () => socketAlive.set(socket, true))
  socket.on('message', (buffer) => {
    let command
    try {
      command = JSON.parse(buffer.toString())
      if (command.type === 'ROOM_CREATE') {
        const result = multiplayer.createRoom(command.name, command.mode, command.duelVariant, command.maxPlayers)
        socketIdentity.set(socket, { code: result.room.code, playerId: result.credentials.playerId })
        sendState(socket, multiplayer.snapshot(result.room, result.credentials.playerId), result.credentials, true); return
      }
      if (command.type === 'ROOM_JOIN') {
        const result = multiplayer.joinRoom(command.code, command.name)
        socketIdentity.set(socket, { code: result.room.code, playerId: result.credentials.playerId })
        sendState(socket, multiplayer.snapshot(result.room, result.credentials.playerId), result.credentials, true); return
      }
      if (command.type === 'ROOM_RESUME') {
        const result = multiplayer.resumeRoom(command.code, command.playerId, command.sessionToken)
        socketIdentity.set(socket, { code: result.room.code, playerId: result.credentials.playerId })
        sendState(socket, multiplayer.snapshot(result.room, result.credentials.playerId), result.credentials, true); return
      }
      const identity = socketIdentity.get(socket)
      if (!identity) throw new MultiplayerError('IDENTITY_REQUIRED', 'Entra primeiro numa sala.')
      const room = multiplayer.command(identity.code, identity.playerId, command)
      sendState(socket, multiplayer.snapshot(room, identity.playerId), undefined, command.type === 'SYNC_STATE')
    } catch (error) {
      send(socket, { type: 'ERROR', code: error instanceof MultiplayerError ? error.code : 'INVALID_COMMAND', message: error instanceof Error ? error.message : 'Comando inválido.', actionId: command?.actionId })
    }
  })
  socket.on('close', () => { const identity = socketIdentity.get(socket); if (identity) multiplayer.disconnect(identity.code, identity.playerId); socketIdentity.delete(socket) })
})

setInterval(() => {
  for (const socket of sockets.clients) {
    if (!socketAlive.get(socket)) { socket.terminate(); continue }
    socketAlive.set(socket, false); socket.ping()
  }
}, 30_000).unref()

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  if (pathname !== '/ws') return socket.destroy()
  sockets.handleUpgrade(request, socket, head, client => sockets.emit('connection', client, request))
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Trinta Segundos disponível em http://localhost:${port}`)
})
