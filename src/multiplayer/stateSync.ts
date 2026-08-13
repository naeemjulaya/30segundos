import type { RoomSnapshot, ServerMessage } from './types'

export interface AppliedRoomUpdate {
  snapshot: RoomSnapshot | null
  version: number
  clockOffsetMs: number
  needsSync: boolean
}

export function applyRoomUpdate(
  snapshot: RoomSnapshot | null,
  version: number,
  clockOffsetMs: number,
  message: ServerMessage,
  clientNow = Date.now(),
): AppliedRoomUpdate {
  if (message.type === 'ROOM_STATE') {
    return {
      snapshot: message.snapshot,
      version: message.version,
      clockOffsetMs: message.snapshot.serverNow - clientNow,
      needsSync: false,
    }
  }

  if (message.type !== 'ROOM_PATCH' || message.version <= version) {
    return { snapshot, version, clockOffsetMs, needsSync: false }
  }

  if (!snapshot || (version > 0 && message.version > version + 1)) {
    return { snapshot, version, clockOffsetMs, needsSync: true }
  }

  return {
    snapshot: { ...snapshot, ...message.patch },
    version: message.version,
    clockOffsetMs: message.patch.serverNow === undefined ? clockOffsetMs : message.patch.serverNow - clientNow,
    needsSync: false,
  }
}
