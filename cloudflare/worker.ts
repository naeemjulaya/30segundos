import { DurableObject } from 'cloudflare:workers'
import QRCode from 'qrcode'
import { MultiplayerError, MultiplayerService } from '../server/multiplayerService'
import type { ClientCommand, GameRoom, RoomCredentials, RoomMode, RoomSnapshot } from '../src/multiplayer/types'

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

interface SocketAttachment { playerId: string }
interface RoomResult { snapshot: RoomSnapshot; credentials: RoomCredentials }

function roomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, value => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('')
}

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (!origin) return env.FRONTEND_ORIGIN
  const hostname = new URL(origin).hostname
  return origin === env.FRONTEND_ORIGIN || hostname === 'localhost' || hostname === '127.0.0.1' || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ? origin : env.FRONTEND_ORIGIN
}

function withCors(response: Response, request: Request, env: Env) {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', allowedOrigin(request, env))
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Vary', 'Origin')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function boundedJson<T>(request: Request): Promise<T> {
  if (Number(request.headers.get('content-length') ?? 0) > 10_000) throw new MultiplayerError('REQUEST_TOO_LARGE', 'Pedido demasiado grande.')
  return request.json<T>()
}

export class RoomDurableObject extends DurableObject<Env> {
  private service = new MultiplayerService(null, () => Date.now(), false)
  private room: GameRoom | null = null
  private snapshots = new WeakMap<WebSocket, RoomSnapshot>()
  private alarmAt: number | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)')
      const [stored, alarmAt] = await Promise.all([
        this.ctx.storage.get<GameRoom>('room'),
        this.ctx.storage.getAlarm(),
      ])
      const legacy = stored ? null : this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM room_state WHERE id = 1').toArray()[0]
      if (stored) this.room = this.service.restoreRoom(stored)
      else if (legacy) this.room = this.service.restoreRoom(JSON.parse(legacy.json) as GameRoom)
      this.alarmAt = alarmAt
    })
  }

  async exists() { return this.room !== null && this.room.status !== 'CLOSED' && this.room.expiresAt > Date.now() }

  async create(code: string, name: string, mode: RoomMode, duelVariant: 'ALTERNATING' | 'DUEL', maxPlayers: number): Promise<RoomResult> {
    if (await this.exists()) throw new MultiplayerError('ROOM_EXISTS', 'Esta sala já existe.')
    const result = this.service.createRoom(name, mode, duelVariant, maxPlayers, code)
    this.room = result.room
    await this.persist()
    return { snapshot: this.service.snapshot(result.room, result.credentials.playerId), credentials: result.credentials }
  }

  async join(name: string): Promise<RoomResult> {
    const room = this.requireRoom()
    const result = this.service.joinRoom(room.code, name)
    await this.persist(); this.broadcast()
    return { snapshot: this.service.snapshot(room, result.credentials.playerId), credentials: result.credentials }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Upgrade WebSocket obrigatório.', { status: 426 })
    const url = new URL(request.url); const playerId = url.searchParams.get('playerId') ?? ''; const token = url.searchParams.get('token') ?? ''
    try {
      const room = this.requireRoom(); const resumed = this.service.resumeRoom(room.code, playerId, token)
      const pair = new WebSocketPair(); const client = pair[0]; const server = pair[1]
      server.serializeAttachment({ playerId } satisfies SocketAttachment)
      this.ctx.acceptWebSocket(server)
      await this.persist()
      server.send(JSON.stringify({ type: 'ROOM_STATE', version: room.stateVersion, snapshot: this.service.snapshot(room, playerId), credentials: resumed.credentials }))
      this.broadcast(server)
      return new Response(null, { status: 101, webSocket: client })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Sessão inválida.' }, { status: 401 })
    }
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return socket.close(1008, 'Identidade inválida')
    try {
      if ((typeof raw === 'string' ? raw.length : raw.byteLength) > 10_000) throw new MultiplayerError('REQUEST_TOO_LARGE', 'Pedido demasiado grande.')
      const command = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientCommand
      if (command.type === 'ROOM_CREATE' || command.type === 'ROOM_JOIN' || command.type === 'ROOM_RESUME') throw new MultiplayerError('INVALID_COMMAND', 'Comando inválido neste canal.')
      const room = this.requireRoom(); this.service.command(room.code, attachment.playerId, command)
      await this.persist(); this.broadcast()
    } catch (error) {
      socket.send(JSON.stringify({ type: 'ERROR', code: error instanceof MultiplayerError ? error.code : 'INVALID_COMMAND', message: error instanceof Error ? error.message : 'Comando inválido.' }))
    }
  }

  async webSocketClose(socket: WebSocket) { await this.disconnect(socket) }
  async webSocketError(socket: WebSocket) { await this.disconnect(socket) }

  async alarm() {
    this.alarmAt = null
    const room = this.room
    if (!room) return
    this.service.processDue(room)
    if (room.status === 'CLOSED' || room.expiresAt <= Date.now()) {
      for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'Sala expirada')
      this.ctx.storage.sql.exec('DELETE FROM room_state')
      this.ctx.waitUntil(this.ctx.storage.delete('room', { allowUnconfirmed: true }).catch(error => this.logPersistenceError(error)))
      this.room = null
      return
    }
    await this.persist(); this.broadcast()
  }

  private requireRoom() {
    if (!this.room || this.room.status === 'CLOSED' || this.room.expiresAt <= Date.now()) throw new MultiplayerError('ROOM_NOT_FOUND', 'Código de sala inválido.')
    return this.room
  }

  private async disconnect(socket: WebSocket) {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null
    if (!attachment || !this.room) return
    this.service.disconnect(this.room.code, attachment.playerId)
    await this.persist(); this.broadcast()
  }

  private persist() {
    if (!this.room) return
    const snapshot = structuredClone(this.room)
    this.ctx.waitUntil(this.ctx.storage.put('room', snapshot, { allowUnconfirmed: true }).catch(error => this.logPersistenceError(error)))
    const deadline = this.service.nextDeadline(this.room)
    if (this.alarmAt === null || deadline < this.alarmAt) {
      this.alarmAt = deadline
      this.ctx.waitUntil(this.ctx.storage.setAlarm(deadline, { allowUnconfirmed: true }).catch(error => this.logPersistenceError(error)))
    }
  }

  private logPersistenceError(error: unknown) {
    console.error(JSON.stringify({ message: 'room_persistence_failed', roomCode: this.room?.code, error: error instanceof Error ? error.message : String(error) }))
  }

  private broadcast(except?: WebSocket) {
    if (!this.room) return
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue
      const attachment = socket.deserializeAttachment() as SocketAttachment | null
      if (!attachment) continue
      const snapshot = this.service.snapshot(this.room, attachment.playerId); const previous = this.snapshots.get(socket)
      if (!previous) socket.send(JSON.stringify({ type: 'ROOM_STATE', version: snapshot.stateVersion, snapshot }))
      else {
        const patch: Partial<RoomSnapshot> = {}
        for (const key of Object.keys(snapshot) as Array<keyof RoomSnapshot>) if (JSON.stringify(previous[key]) !== JSON.stringify(snapshot[key])) Object.assign(patch, { [key]: snapshot[key] })
        socket.send(JSON.stringify({ type: 'ROOM_PATCH', version: snapshot.stateVersion, patch }))
      }
      this.snapshots.set(socket, snapshot)
    }
  }
}

export class AnalyticsDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, first_visit INTEGER NOT NULL, last_visit INTEGER NOT NULL, visits INTEGER NOT NULL)')
  }

  record(visitorId: string) {
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(visitorId)) throw new Error('Identificador inválido.')
    const now = Date.now()
    this.ctx.storage.sql.exec('INSERT INTO visitors (id, first_visit, last_visit, visits) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET last_visit = excluded.last_visit, visits = visitors.visits + 1', visitorId, now, now)
    return this.summary()
  }

  summary() {
    const row = this.ctx.storage.sql.exec<{ uniqueVisitors: number; totalVisits: number; lastVisit: number | null }>('SELECT COUNT(*) AS uniqueVisitors, COALESCE(SUM(visits), 0) AS totalVisits, MAX(last_visit) AS lastVisit FROM visitors').one()
    return row
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request, env)
    const url = new URL(request.url)
    try {
      const createMatch = url.pathname === '/api/rooms' && request.method === 'POST'
      if (createMatch) {
        const body = await boundedJson<{ name: string; mode: RoomMode; duelVariant?: 'ALTERNATING' | 'DUEL'; maxPlayers?: number }>(request)
        for (let attempt = 0; attempt < 8; attempt++) {
          const code = roomCode(); const stub = env.ROOMS.getByName(code)
          try {
            return withCors(Response.json(await stub.create(code, body.name, body.mode, body.duelVariant ?? 'ALTERNATING', body.maxPlayers ?? 8)), request, env)
          } catch (error) {
            if (error instanceof Error && (error.message.includes('ROOM_EXISTS') || error.message.includes('já existe'))) continue
            throw error
          }
        }
        throw new Error('Não foi possível criar um código de sala.')
      }
      const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4})\/join$/)
      if (joinMatch && request.method === 'POST') {
        const body = await boundedJson<{ name: string }>(request)
        return withCors(Response.json(await env.ROOMS.getByName(joinMatch[1]).join(body.name)), request, env)
      }
      const wsMatch = url.pathname.match(/^\/ws\/([A-Z0-9]{4})$/)
      if (wsMatch) {
        const origin = request.headers.get('Origin')
        if (origin && allowedOrigin(request, env) !== origin) return Response.json({ error: 'Origem não autorizada.' }, { status: 403 })
        return env.ROOMS.getByName(wsMatch[1]).fetch(request)
      }
      const qrMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4})\/qr\.svg$/)
      if (qrMatch && request.method === 'GET') {
        const room = env.ROOMS.getByName(qrMatch[1]); if (!await room.exists()) return withCors(Response.json({ error: 'Sala não encontrada.' }, { status: 404 }), request, env)
        const svg = await QRCode.toString(`${env.FRONTEND_ORIGIN}/join/${qrMatch[1]}`, { type: 'svg', margin: 1, color: { dark: '#1a1a1a', light: '#fdfcf8' } })
        return withCors(new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' } }), request, env)
      }
      const analytics = env.ANALYTICS.getByName('global')
      if (url.pathname === '/api/analytics/visit' && request.method === 'POST') {
        const body = await boundedJson<{ visitorId: string }>(request)
        return withCors(Response.json(await analytics.record(body.visitorId)), request, env)
      }
      if (url.pathname === '/api/analytics/summary' && request.method === 'GET') return withCors(Response.json(await analytics.summary()), request, env)
      if (url.pathname === '/health') return withCors(Response.json({ ok: true, service: 'trinta-segundos-multiplayer' }), request, env)
      return withCors(Response.json({ error: 'Endpoint não encontrado.' }, { status: 404 }), request, env)
    } catch (error) {
      console.error(JSON.stringify({ message: 'request_failed', path: url.pathname, error: error instanceof Error ? error.message : String(error) }))
      const status = error instanceof MultiplayerError ? 400 : 500
      return withCors(Response.json({ code: error instanceof MultiplayerError ? error.code : 'INTERNAL_ERROR', error: error instanceof Error ? error.message : 'Erro inesperado.' }, { status }), request, env)
    }
  },
} satisfies ExportedHandler<Env>
