const configuredOrigin = ((import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) || (import.meta.env.PROD ? 'https://trinta-segundos-multiplayer.mazzahub.workers.dev' : ''))?.replace(/\/$/, '')

export function backendOrigin() {
  return configuredOrigin || globalThis.location?.origin || ''
}

export function backendUrl(path: string) {
  return `${backendOrigin()}${path.startsWith('/') ? path : `/${path}`}`
}

export function backendWebSocketUrl(path: string) {
  const url = new URL(backendUrl(path))
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
