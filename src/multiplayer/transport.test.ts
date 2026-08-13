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
})
