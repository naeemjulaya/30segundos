import type { ClientCommand, RoomCredentials, ServerMessage } from './types'
import { generateId } from '../shared/generateId'

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

export function saveRoomCredentials(credentials: RoomCredentials) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
}

export function clearRoomCredentials() { localStorage.removeItem(CREDENTIALS_KEY) }

export class WebSocketTransport implements MultiplayerTransport {
  private socket: WebSocket | null = null
  private listeners = new Set<(message: ServerMessage) => void>()
  private queue: string[] = []
  private reconnectAttempt = 0
  private reconnectTimer: number | null = null
  private closed = false

  connect() {
    this.closed = false
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.socket = new WebSocket(`${protocol}//${location.host}/ws`)
    this.socket.addEventListener('open', () => {
      this.reconnectAttempt = 0
      const credentials = loadRoomCredentials()
      if (credentials) this.send({ type: 'ROOM_RESUME', code: credentials.roomCode, playerId: credentials.playerId, sessionToken: credentials.sessionToken })
      for (const message of this.queue.splice(0)) this.socket?.send(message)
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as ServerMessage
      if (message.type === 'ROOM_STATE' && message.credentials) saveRoomCredentials(message.credentials)
      this.listeners.forEach(listener => listener(message))
    })
    this.socket.addEventListener('close', () => {
      if (this.closed) return
      const delay = Math.min(10_000, 500 * 2 ** this.reconnectAttempt++)
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
    })
  }

  send(command: CommandInput) {
    const message = JSON.stringify({ ...command, actionId: command.actionId ?? generateId() })
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(message)
    else this.queue.push(message)
  }

  subscribe(listener: (message: ServerMessage) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  close() { this.closed = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.socket?.close() }
}
