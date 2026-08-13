import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAnalyticsStore } from './server/analyticsStore.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const production = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? 5174)
const analyticsPath = process.env.ANALYTICS_DATA_PATH
  ? path.resolve(process.env.ANALYTICS_DATA_PATH)
  : path.join(root, '.data', 'analytics.json')
const store = createAnalyticsStore(analyticsPath)

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

server.listen(port, '0.0.0.0', () => {
  console.log(`Trinta Segundos disponível em http://localhost:${port}`)
})
