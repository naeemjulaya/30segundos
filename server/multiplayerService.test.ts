import { afterEach, describe, expect, it, vi } from 'vitest'
import { MultiplayerError, MultiplayerService } from './multiplayerService'
import type { ClientCommand, GameRoom } from '../src/multiplayer/types'

let sequence = 0
const action = <Command extends Omit<ClientCommand, 'actionId'>>(command: Command) => ({ ...command, actionId: `action-${++sequence}` }) as ClientCommand

function joinedRoom(mode: 'TEAMS' | 'DUEL' = 'TEAMS', count = mode === 'DUEL' ? 2 : 4, duelVariant: 'ALTERNATING' | 'DUEL' = 'ALTERNATING') {
  let now = 1_000
  const service = new MultiplayerService(null, () => now)
  const created = service.createRoom('Naeem', mode, duelVariant)
  const credentials = [created.credentials]
  for (let index = 1; index < count; index++) credentials.push(service.joinRoom(created.room.code, `Jogador ${index + 1}`).credentials)
  return { service, room: created.room, credentials, advance: (milliseconds: number) => { now += milliseconds } }
}

function start(room: GameRoom, service: MultiplayerService, credentials: Array<{ playerId: string }>) {
  for (const credential of credentials) service.command(room.code, credential.playerId, action({ type: 'PLAYER_READY', ready: true }) as never)
  service.command(room.code, credentials[0].playerId, action({ type: 'GAME_START' }) as never)
}

afterEach(() => { vi.useRealTimers(); sequence = 0 })

describe('authoritative multiplayer rooms', () => {
  it('creates short unique rooms, joins without accounts and rejects invalid codes', () => {
    const service = new MultiplayerService()
    const first = service.createRoom('Naeem', 'TEAMS')
    const second = service.createRoom('Ana', 'TEAMS')
    expect(first.room.code).toMatch(/^[23456789A-HJ-NP-Z]{4}$/)
    expect(second.room.code).not.toBe(first.room.code)
    expect(service.joinRoom(first.room.code.toLocaleLowerCase(), 'Carlos').room.players).toHaveLength(2)
    expect(() => service.joinRoom('XXXX', 'Pessoa')).toThrowError(MultiplayerError)
  })

  it('enforces room capacity', () => {
    const service = new MultiplayerService()
    const created = service.createRoom('A', 'TEAMS', 'ALTERNATING', 2)
    service.joinRoom(created.room.code, 'B')
    expect(() => service.joinRoom(created.room.code, 'C')).toThrow('sala está cheia')
  })

  it('lets a player leave and transfers the host to the oldest connected participant', () => {
    const { service, room, credentials } = joinedRoom('TEAMS', 3)
    service.command(room.code, credentials[0].playerId, action({ type: 'ROOM_LEAVE' }) as never)
    expect(room.players.map(player => player.id)).not.toContain(credentials[0].playerId)
    expect(room.hostId).toBe(credentials[1].playerId)
  })

  it('requires every connected player to be ready before the host starts', () => {
    const { service, room, credentials } = joinedRoom('TEAMS', 2)
    service.command(room.code, credentials[0].playerId, action({ type: 'PLAYER_READY', ready: true }) as never)
    expect(() => service.command(room.code, credentials[0].playerId, action({ type: 'GAME_START' }) as never)).toThrow('devem estar prontos')
    expect(() => service.command(room.code, credentials[1].playerId, action({ type: 'GAME_START' }) as never)).toThrow('Apenas o host')
  })

  it('lets the host configure, distribute, move and remove lobby players', () => {
    const { service, room, credentials } = joinedRoom('TEAMS', 4)
    service.command(room.code, credentials[0].playerId, action({ type: 'ROOM_CONFIG_UPDATE', config: { durationSeconds: 45, wordsPerCard: 6, passLimit: 1 } }) as never)
    expect(room.gameConfig).toMatchObject({ durationSeconds: 45, wordsPerCard: 6, passLimit: 1 })
    service.command(room.code, credentials[0].playerId, action({ type: 'ROOM_DISTRIBUTE', strategy: 'BALANCED' }) as never)
    expect(room.teams).toHaveLength(2)
    const moved = room.players[1]; const target = room.teams.find(team => team.id !== moved.teamId)!
    service.command(room.code, credentials[0].playerId, action({ type: 'PLAYER_MOVE', playerId: moved.id, teamId: target.id }) as never)
    expect(moved.teamId).toBe(target.id)
    service.command(room.code, credentials[0].playerId, action({ type: 'PLAYER_REMOVE', playerId: room.players[3].id }) as never)
    expect(room.players).toHaveLength(3)
  })

  it('distributes players, starts with the shared game engine and only exposes the card to the explainer', () => {
    const { service, room, credentials } = joinedRoom()
    start(room, service, credentials)
    expect(room.phase).toBe('ROUND_READY')
    expect(room.game?.round?.words).toHaveLength(8)
    const explainer = room.explainerId!
    const opponent = credentials.find(value => value.playerId !== explainer)!
    expect(service.snapshot(room, explainer).game?.round?.words).toHaveLength(8)
    expect(service.snapshot(room, opponent.playerId).game?.round?.words).toEqual([])
    expect('sessionToken' in service.snapshot(room, explainer).players[0]).toBe(false)
    expect('processedActionIds' in service.snapshot(room, explainer)).toBe(false)
  })

  it('uses authoritative timestamps and allows only the explainer to mark valid words', () => {
    const { service, room, credentials, advance } = joinedRoom()
    start(room, service, credentials)
    const explainer = room.explainerId!; const other = credentials.find(value => value.playerId !== explainer)!.playerId
    expect(() => service.command(room.code, other, action({ type: 'ROUND_READY' }) as never)).toThrow('Apenas o explicador')
    service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
    expect(room.roundEndsAt).toBe(31_000)
    const word = room.game!.round!.words[0]
    expect(() => service.command(room.code, other, action({ type: 'WORD_MARK', wordId: word.id, status: 'correct' }) as never)).toThrow('Apenas o explicador')
    advance(31_000)
    expect(() => service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: word.id, status: 'correct' }) as never)).toThrow('ronda já terminou')
  })

  it('deduplicates repeated actions and enforces the pass limit', () => {
    const { service, room, credentials } = joinedRoom()
    start(room, service, credentials); const explainer = room.explainerId!
    service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
    const words = room.game!.round!.words
    const repeated = action({ type: 'WORD_MARK', wordId: words[0].id, status: 'correct' })
    service.command(room.code, explainer, repeated as never); service.command(room.code, explainer, repeated as never)
    expect(words[0].status).toBe('correct')
    service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: words[1].id, status: 'passed' }) as never)
    service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: words[2].id, status: 'passed' }) as never)
    expect(() => service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: words[3].id, status: 'passed' }) as never)).toThrow('limite de passes')
  })

  it('closes collective review only after all active players confirm and scores exactly once', () => {
    const { service, room, credentials } = joinedRoom('TEAMS', 3)
    start(room, service, credentials); const explainer = room.explainerId!
    service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
    for (const word of room.game!.round!.words) service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: word.id, status: 'correct' }) as never)
    expect(room.phase).toBe('REVIEW')
    for (const credential of credentials.slice(0, -1)) service.command(room.code, credential.playerId, action({ type: 'REVIEW_CONFIRM' }) as never)
    expect(room.phase).toBe('REVIEW')
    service.command(room.code, credentials.at(-1)!.playerId, action({ type: 'REVIEW_CONFIRM' }) as never)
    expect(room.phase).toBe('BETWEEN_ROUNDS')
    expect(room.teams.reduce((sum, team) => sum + team.score, 0)).toBe(8)
    expect(room.game?.completedRounds).toHaveLength(1)
  })

  it('resolves team disputes by majority without allowing the explainer to vote', () => {
    const { service, room, credentials } = joinedRoom('TEAMS', 4)
    start(room, service, credentials); const explainer = room.explainerId!
    service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
    for (const word of room.game!.round!.words) service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: word.id, status: 'correct' }) as never)
    const word = room.game!.round!.words[0]
    service.command(room.code, credentials[1].playerId, action({ type: 'REVIEW_DISPUTE', wordId: word.id, proposedStatus: 'wrong' }) as never)
    expect(() => service.command(room.code, explainer, action({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'COUNT' }) as never)).toThrow('não participa')
    const voters = credentials.filter(value => value.playerId !== explainer)
    service.command(room.code, voters[0].playerId, action({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'DONT_COUNT' }) as never)
    service.command(room.code, voters[1].playerId, action({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'DONT_COUNT' }) as never)
    service.command(room.code, voters[2].playerId, action({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'COUNT' }) as never)
    expect(room.review?.disputes[word.id].resolvedStatus).toBe('wrong')
    expect(word.status).toBe('wrong')
  })

  it('annuls a disputed word after a one-versus-one voting tie', () => {
    const { service, room, credentials } = joinedRoom('DUEL', 2, 'DUEL')
    start(room, service, credentials); const explainer = room.explainerId!
    service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
    for (const word of room.game!.round!.words) service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: word.id, status: 'correct' }) as never)
    const word = room.game!.round!.words[0]
    service.command(room.code, credentials[0].playerId, action({ type: 'REVIEW_DISPUTE', wordId: word.id, proposedStatus: 'wrong' }) as never)
    service.command(room.code, credentials[0].playerId, action({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'COUNT' }) as never)
    service.command(room.code, credentials[1].playerId, action({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'DONT_COUNT' }) as never)
    expect(room.review?.disputes[word.id].resolvedStatus).toBe('wrong')
  })

  it('configures one turn per player in Alternado and two per player in Duelo', () => {
    const alternating = joinedRoom('DUEL', 2, 'ALTERNATING')
    start(alternating.room, alternating.service, alternating.credentials)
    expect(alternating.room.game?.config.roundLimit).toBe(1)
    const duel = joinedRoom('DUEL', 2, 'DUEL')
    start(duel.room, duel.service, duel.credentials)
    expect(duel.room.game?.config.roundLimit).toBe(2)
  })

  it('gives both duel players the same number of alternating rounds and determines a winner', () => {
    const { service, room, credentials } = joinedRoom('DUEL', 2, 'DUEL')
    service.command(room.code, credentials[0].playerId, action({ type: 'ROOM_CONFIG_UPDATE', config: { passLimit: 99 } }) as never)
    start(room, service, credentials)
    for (let roundIndex = 0; roundIndex < 4; roundIndex++) {
      const explainer = room.explainerId!
      service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
      for (const word of room.game!.round!.words) service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: word.id, status: roundIndex === 0 ? 'correct' : 'passed' }) as never)
      for (const credential of credentials) service.command(room.code, credential.playerId, action({ type: 'REVIEW_CONFIRM' }) as never)
      if (roundIndex < 3) service.command(room.code, room.hostId, action({ type: 'NEXT_ROUND' }) as never)
    }
    const turns = room.game!.completedRounds.reduce<Record<string, number>>((counts, round) => {
      counts[round.teamId] = (counts[round.teamId] ?? 0) + 1
      return counts
    }, {})
    expect(Object.values(turns)).toEqual([2, 2])
    expect(room.phase).toBe('FINISHED')
    expect(new Set(room.teams.map(team => team.score)).size).toBeGreaterThan(1)
  })

  it('reconnects with a session token and transfers host deterministically after grace period', async () => {
    vi.useFakeTimers()
    const { service, room, credentials } = joinedRoom('TEAMS', 3)
    const originalHost = credentials[0]
    service.disconnect(room.code, originalHost.playerId)
    await vi.advanceTimersByTimeAsync(15_001)
    expect(room.hostId).toBe(credentials[1].playerId)
    expect(service.resumeRoom(room.code, originalHost.playerId, originalHost.sessionToken).room.players[0].presence).toBe('CONNECTED')
    expect(() => service.resumeRoom(room.code, originalHost.playerId, 'wrong')).toThrow('recuperar')
  })

  it('pauses an active round when the explainer disconnects and resumes the remaining duration', () => {
    const { service, room, credentials, advance } = joinedRoom('TEAMS', 3)
    start(room, service, credentials); const explainerId = room.explainerId!
    const explainerCredentials = credentials.find(value => value.playerId === explainerId)!
    service.command(room.code, explainerId, action({ type: 'ROUND_READY' }) as never)
    advance(5_000); service.disconnect(room.code, explainerId)
    expect(room.phase).toBe('PAUSED'); expect(room.pausedRemainingMs).toBe(25_000); expect(room.roundEndsAt).toBeNull()
    advance(10_000); service.resumeRoom(room.code, explainerId, explainerCredentials.sessionToken)
    expect(room.phase).toBe('ROUND_ACTIVE'); expect(room.roundEndsAt).toBe(41_000)
  })

  it('allows the successor host to end a paused round after the reconnection grace period', async () => {
    vi.useFakeTimers()
    const { service, room, credentials, advance } = joinedRoom('TEAMS', 3)
    start(room, service, credentials); const explainerId = room.explainerId!
    service.command(room.code, explainerId, action({ type: 'ROUND_READY' }) as never)
    service.disconnect(room.code, explainerId)
    expect(() => service.command(room.code, room.hostId, action({ type: 'ROUND_ABORT' }) as never)).toThrow()
    advance(15_001); await vi.advanceTimersByTimeAsync(15_001)
    service.command(room.code, room.hostId, action({ type: 'ROUND_ABORT' }) as never)
    expect(room.phase).toBe('REVIEW')
  })

  it('lets the host finalize after review timeout without disconnected players blocking', () => {
    const { service, room, credentials, advance } = joinedRoom('TEAMS', 3)
    start(room, service, credentials); const explainer = room.explainerId!
    service.command(room.code, explainer, action({ type: 'ROUND_READY' }) as never)
    for (const word of room.game!.round!.words) service.command(room.code, explainer, action({ type: 'WORD_MARK', wordId: word.id, status: 'correct' }) as never)
    expect(() => service.command(room.code, credentials[0].playerId, action({ type: 'REVIEW_FORCE_FINALIZE' }) as never)).toThrow('ainda não terminou')
    service.disconnect(room.code, credentials[2].playerId); advance(30_001)
    service.command(room.code, credentials[0].playerId, action({ type: 'REVIEW_FORCE_FINALIZE' }) as never)
    expect(room.phase).toBe('BETWEEN_ROUNDS')
  })
})
