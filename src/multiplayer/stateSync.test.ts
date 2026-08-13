import { describe, expect, it } from 'vitest'
import { applyRoomUpdate } from './stateSync'
import type { RoomSnapshot } from './types'

const snapshot = { code: '7K4P', stateVersion: 4, serverNow: 1_100 } as RoomSnapshot

describe('applyRoomUpdate', () => {
  it('adopta um snapshot e calcula a diferença do relógio do servidor', () => {
    const result = applyRoomUpdate(null, 0, 0, { type: 'ROOM_STATE', version: 4, snapshot }, 1_000)
    expect(result).toMatchObject({ snapshot, version: 4, clockOffsetMs: 100, needsSync: false })
  })

  it('ignora mensagens duplicadas ou fora de ordem', () => {
    const result = applyRoomUpdate(snapshot, 4, 100, { type: 'ROOM_PATCH', version: 4, patch: { status: 'READY' } }, 1_000)
    expect(result).toMatchObject({ snapshot, version: 4, needsSync: false })
  })

  it('pede ressincronização quando detecta uma lacuna', () => {
    const result = applyRoomUpdate(snapshot, 4, 100, { type: 'ROOM_PATCH', version: 6, patch: { status: 'READY' } }, 1_000)
    expect(result).toMatchObject({ snapshot, version: 4, needsSync: true })
  })

  it('aplica o evento incremental seguinte e actualiza o relógio', () => {
    const result = applyRoomUpdate(snapshot, 4, 100, { type: 'ROOM_PATCH', version: 5, patch: { status: 'READY', serverNow: 1_250 } }, 1_100)
    expect(result.snapshot?.status).toBe('READY')
    expect(result).toMatchObject({ version: 5, clockOffsetMs: 150, needsSync: false })
  })
})
