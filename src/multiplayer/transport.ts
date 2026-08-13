import type { ClientCommand, RoomCredentials, RoomSnapshot, ServerMessage } from './types'
import { generateId } from '../shared/generateId'
import { backendUrl, backendWebSocketUrl } from '../shared/backend'

export interface MultiplayerTransport {
  connect(): void
  send(command: CommandInput): void
  subscribe(listener: (message: ServerMessage) => void): () => void
  close(): void
}

export type CommandInput = ClientCommand extends infer Command
  ? Command extends { actionId: string } ? Omit<Command, 'actionId'> & { actionId?: string } : never
  : never

const CREDENTIALS_KEY = 'trinta-segundos:multiplayer-credentials'

export function loadRoomCredentials(): RoomCredentials | null {
  try { return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) ?? 'null') } catch { return null }
}

export function saveRoomCredentials(credentials: RoomCredentials) { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)) }
export function clearRoomCredentials() { localStorage.removeItem(CREDENTIALS_KEY) }

export class WebSocketTransport implements MultiplayerTransport {
  private socket: WebSocket | null = null
  private listeners = new Set<(message: ServerMessage) => void>()
  private queue: string[] = []
  private reconnectAttempt = 0
  private reconnectTimer: number | null = null
  private closed = false
  private bootstrapping = false

  connect() {
    this.closed = false
    const credentials = loadRoomCredentials()
    if (credentials) this.openSocket(credentials)
  }

  send(command: CommandInput) {
    if (command.type === 'ROOM_CREATE' || command.type === 'ROOM_JOIN') { void this.bootstrap(command); return }
    if (command.type === 'ROOM_RESUME') {
      saveRoomCredentials({ roomCode: command.code, playerId: command.playerId, sessionToken: command.sessionToken })
      this.openSocket(loadRoomCredentials()!); return
    }
    const message = JSON.stringify({ ...command, actionId: command.actionId ?? generateId() })
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(message)
    else this.queue.push(message)
  }

  subscribe(listener: (message: ServerMessage) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  close() { this.closed = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.socket?.close(); this.socket = null }

  private async bootstrap(command: Extract<CommandInput, { type: 'ROOM_CREATE' | 'ROOM_JOIN' }>) {
    if (this.bootstrapping) return
    this.bootstrapping = true
    try {
      const endpoint = command.type === 'ROOM_CREATE' ? '/api/rooms' : `/api/rooms/${command.code}/join`
      const body = command.type === 'ROOM_CREATE'
        ? { name: command.name, mode: command.mode, duelVariant: command.duelVariant, maxPlayers: command.maxPlayers }
        : { name: command.name }
      const response = await fetch(backendUrl(endpoint), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const value = await response.json() as { snapshot?: RoomSnapshot; credentials?: RoomCredentials; error?: string; code?: string }
      if (!response.ok || !value.snapshot || !value.credentials) throw new Error(value.error ?? 'Não foi possível entrar na sala.')
      if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
      const previousSocket = this.socket; this.socket = null; previousSocket?.close()
      saveRoomCredentials(value.credentials)
      this.emit({ type: 'ROOM_STATE', version: value.snapshot.stateVersion, snapshot: value.snapshot, credentials: value.credentials })
      this.openSocket(value.credentials)
    } catch (error) {
      this.emit({ type: 'ERROR', code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : 'Não foi possível ligar ao servidor.' })
    } finally { this.bootstrapping = false }
  }

  private openSocket(credentials: RoomCredentials) {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return
    const socket = new WebSocket(backendWebSocketUrl(`/ws/${credentials.roomCode}?playerId=${encodeURIComponent(credentials.playerId)}&token=${encodeURIComponent(credentials.sessionToken)}`))
    this.socket = socket
    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0
      for (const message of this.queue.splice(0)) socket.send(message)
    })
    socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage
        if (message.type === 'ROOM_STATE' && message.credentials) saveRoomCredentials(message.credentials)
        this.emit(message)
      } catch { this.emit({ type: 'ERROR', code: 'INVALID_MESSAGE', message: 'O servidor enviou uma resposta inválida.' }) }
    })
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return
      this.socket = null
      if (this.closed || !loadRoomCredentials()) return
      const delay = Math.min(10_000, 500 * 2 ** this.reconnectAttempt++)
      this.reconnectTimer = window.setTimeout(() => { const saved = loadRoomCredentials(); if (saved) this.openSocket(saved) }, delay)
    })
  }

  private emit(message: ServerMessage) { this.listeners.forEach(listener => listener(message)) }
}
