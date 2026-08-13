import type { GameConfig, GameSession, Team, WordStatus } from '../game/domain/types'

export type RoomStatus = 'WAITING' | 'READY' | 'IN_GAME' | 'FINISHED' | 'CLOSED'
export type RoomMode = 'TEAMS' | 'DUEL'
export type DuelVariant = 'ALTERNATING' | 'DUEL'
export type PresenceStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'
export type MultiplayerPhase = 'LOBBY' | 'ROUND_READY' | 'ROUND_ACTIVE' | 'REVIEW' | 'BETWEEN_ROUNDS' | 'FINISHED' | 'PAUSED'

export interface RoomPlayer {
  id: string
  name: string
  sessionToken: string
  ready: boolean
  presence: PresenceStatus
  joinedAt: number
  lastSeenAt: number
  teamId: string | null
}

export interface ReviewDispute {
  wordId: string
  openedBy: string
  proposedStatus: WordStatus
  votes: Record<string, 'COUNT' | 'DONT_COUNT'>
  resolvedStatus: WordStatus | null
}

export interface RoundReview {
  roundId: string
  confirmations: Record<string, number>
  disputes: Record<string, ReviewDispute>
  status: 'OPEN' | 'RESOLVED' | 'CLOSED'
  startedAt: number
  expiresAt: number
}

export interface GameRoom {
  id: string
  code: string
  hostId: string
  status: RoomStatus
  phase: MultiplayerPhase
  mode: RoomMode
  duelVariant: DuelVariant
  createdAt: number
  updatedAt: number
  expiresAt: number
  maxPlayers: number
  players: RoomPlayer[]
  teams: Team[]
  gameConfig: GameConfig
  currentGameId: string | null
  game: GameSession | null
  explainerId: string | null
  roundEndsAt: number | null
  pausedRemainingMs: number | null
  review: RoundReview | null
  stateVersion: number
  processedActionIds: string[]
}

export interface PublicRoomPlayer extends Omit<RoomPlayer, 'sessionToken'> {}

export interface RoomSnapshot extends Omit<GameRoom, 'players' | 'processedActionIds' | 'game'> {
  players: PublicRoomPlayer[]
  game: GameSession | null
  canSeeCard: boolean
  serverNow: number
}

export interface RoomCredentials {
  roomCode: string
  playerId: string
  sessionToken: string
}

export type ClientCommand =
  | { type: 'ROOM_CREATE'; actionId: string; name: string; mode: RoomMode; duelVariant?: DuelVariant; maxPlayers?: number }
  | { type: 'ROOM_JOIN'; actionId: string; code: string; name: string }
  | { type: 'ROOM_RESUME'; actionId: string; code: string; playerId: string; sessionToken: string }
  | { type: 'PLAYER_READY'; actionId: string; ready: boolean }
  | { type: 'PLAYER_MOVE'; actionId: string; playerId: string; teamId: string }
  | { type: 'PLAYER_REMOVE'; actionId: string; playerId: string }
  | { type: 'ROOM_CONFIG_UPDATE'; actionId: string; config: Partial<Pick<GameConfig, 'durationSeconds' | 'wordsPerCard' | 'passLimit' | 'passPenalty' | 'roundLimit'>> }
  | { type: 'ROOM_DISTRIBUTE'; actionId: string; strategy: 'BALANCED' | 'RANDOM' }
  | { type: 'GAME_START'; actionId: string }
  | { type: 'ROUND_READY'; actionId: string }
  | { type: 'ROUND_ABORT'; actionId: string }
  | { type: 'WORD_MARK'; actionId: string; wordId: string; status: Extract<WordStatus, 'correct' | 'passed'> }
  | { type: 'REVIEW_CONFIRM'; actionId: string }
  | { type: 'REVIEW_DISPUTE'; actionId: string; wordId: string; proposedStatus: WordStatus }
  | { type: 'REVIEW_VOTE'; actionId: string; wordId: string; vote: 'COUNT' | 'DONT_COUNT' }
  | { type: 'REVIEW_HOST_RESOLVE'; actionId: string; wordId: string; status: WordStatus }
  | { type: 'REVIEW_FORCE_FINALIZE'; actionId: string }
  | { type: 'NEXT_ROUND'; actionId: string }
  | { type: 'SYNC_STATE'; actionId: string }
  | { type: 'ROOM_CLOSE'; actionId: string }
  | { type: 'ROOM_LEAVE'; actionId: string }

export type ServerMessage =
  | { type: 'ROOM_STATE'; version: number; snapshot: RoomSnapshot; credentials?: RoomCredentials }
  | { type: 'ROOM_PATCH'; version: number; patch: Partial<RoomSnapshot> }
  | { type: 'ROOM_EVENT'; version: number; event: string; payload?: unknown }
  | { type: 'ERROR'; code: string; message: string; actionId?: string }
