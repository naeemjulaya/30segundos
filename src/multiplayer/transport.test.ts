// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRoomCredentials, saveRoomCredentials, WebSocketTransport } from './transport'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('multiplayer transport exit', () => {
  it('clears the local session immediately and sends a keepalive leave request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)
    saveRoomCredentials({ roomCode: 'ABCD', playerId: 'player-1', sessionToken: 'token-1' })

    new WebSocketTransport().leave()

    expect(loadRoomCredentials()).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/rooms/ABCD/leave', expect.objectContaining({
      method: 'POST',
      keepalive: true,
      body: JSON.stringify({ playerId: 'player-1', sessionToken: 'token-1' }),
    }))
  })

  it('does not restore credentials from a room message received after leaving', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)
    class SocketMock {
      static OPEN = 1
      static CONNECTING = 0
      static instance: SocketMock
      readyState = SocketMock.OPEN
      listeners = new Map<string, (event: MessageEvent) => void>()
      constructor() { SocketMock.instance = this }
      addEventListener(type: string, listener: (event: MessageEvent) => void) { this.listeners.set(type, listener) }
      close() {}
      send() {}
    }
    vi.stubGlobal('WebSocket', SocketMock)
    const credentials = { roomCode: 'ABCD', playerId: 'player-1', sessionToken: 'token-1' }
    saveRoomCredentials(credentials)
    const transport = new WebSocketTransport()
    transport.connect()

    transport.leave()
    SocketMock.instance.listeners.get('message')?.({ data: JSON.stringify({
      type: 'ROOM_STATE', version: 1, snapshot: {}, credentials,
    }) } as MessageEvent)

    expect(loadRoomCredentials()).toBeNull()
  })
})
