import { EventEmitter } from 'node:events'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { decks } from '../src/decks/data'
import { allWordsProcessed, confirmRound, createRound, createSession, createTeams, defaultConfig, passesUsed } from '../src/game/domain/engine'
import type { GameSession, WordStatus } from '../src/game/domain/types'
import type { ClientCommand, DuelVariant, GameRoom, RoomCredentials, RoomMode, RoomSnapshot } from '../src/multiplayer/types'
import { generateId } from '../src/shared/generateId'

const ROOM_LIFETIME = 6 * 60 * 60 * 1000
const REVIEW_TIMEOUT = 30_000
const HOST_GRACE = 15_000
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export class MultiplayerError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

export class MultiplayerService extends EventEmitter {
  private rooms = new Map<string, GameRoom>()
  private saveQueue = Promise.resolve()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private filePath: string | null = null, private now = () => Date.now(), private scheduleTimers = true) { super() }

  restoreRoom(room: GameRoom) { this.rooms.set(room.code, room); return room }

  async load() {
    if (!this.filePath) return
    try {
      const values = JSON.parse(await readFile(this.filePath, 'utf8')) as GameRoom[]
      for (const room of values) {
        if (room.expiresAt <= this.now() || room.status === 'CLOSED') continue
        room.pausedRemainingMs ??= null
        room.players.forEach(player => { player.presence = 'DISCONNECTED' })
        this.rooms.set(room.code, room)
        if (room.phase === 'ROUND_ACTIVE' && room.roundEndsAt) {
          room.pausedRemainingMs = Math.max(0, room.roundEndsAt - this.now())
          room.roundEndsAt = null
          room.phase = 'PAUSED'
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Não foi possível carregar salas:', error)
    }
  }

  createRoom(name: string, mode: RoomMode, duelVariant: DuelVariant = 'ALTERNATING', maxPlayers = 8, preferredCode?: string) {
    const now = this.now(); const player = this.player(name, now); const code = preferredCode ?? this.code()
    if (this.rooms.has(code)) throw new MultiplayerError('ROOM_EXISTS', 'Esta sala já existe.')
    const room: GameRoom = {
      id: generateId(), code, hostId: player.id, status: 'WAITING', phase: 'LOBBY', mode, duelVariant,
      createdAt: now, updatedAt: now, expiresAt: now + ROOM_LIFETIME, maxPlayers: mode === 'DUEL' ? 2 : Math.max(2, Math.min(12, maxPlayers)),
      players: [player], teams: [], gameConfig: { ...defaultConfig(), registerPlayerNames: true }, currentGameId: null,
      game: null, explainerId: null, roundEndsAt: null, pausedRemainingMs: null, review: null, stateVersion: 1, processedActionIds: [],
    }
    this.rooms.set(code, room); this.persist();
    return { room, credentials: this.credentials(room, player.id) }
  }

  joinRoom(codeInput: string, name: string) {
    const room = this.room(codeInput)
    if (room.status !== 'WAITING' && room.status !== 'READY') throw new MultiplayerError('ROOM_STARTED', 'A partida já começou.')
    if (room.players.length >= room.maxPlayers) throw new MultiplayerError('ROOM_FULL', 'A sala está cheia.')
    const player = this.player(name, this.now()); room.players.push(player); this.touch(room, 'room:joined', { playerId: player.id })
    return { room, credentials: this.credentials(room, player.id) }
  }

  resumeRoom(code: string, playerId: string, token: string) {
    const room = this.room(code); const player = room.players.find(value => value.id === playerId && value.sessionToken === token)
    if (!player) throw new MultiplayerError('INVALID_SESSION', 'Não foi possível recuperar esta sessão.')
    const host = room.players.find(value => value.id === room.hostId)
    if (host && host.id !== playerId && host.presence === 'DISCONNECTED' && this.now() - host.lastSeenAt >= HOST_GRACE) room.hostId = playerId
    player.presence = 'CONNECTED'; player.lastSeenAt = this.now()
    if (room.explainerId === playerId && room.phase === 'PAUSED' && room.pausedRemainingMs !== null) {
      room.roundEndsAt = this.now() + room.pausedRemainingMs; room.pausedRemainingMs = null; room.phase = 'ROUND_ACTIVE'; this.scheduleRoundEnd(room)
    }
    this.touch(room, 'player:reconnected', { playerId })
    return { room, credentials: this.credentials(room, playerId) }
  }

  command(code: string, playerId: string, command: Exclude<ClientCommand, { type: 'ROOM_CREATE' | 'ROOM_JOIN' | 'ROOM_RESUME' }>) {
    const room = this.room(code); const player = this.requirePlayer(room, playerId)
    if (room.processedActionIds.includes(command.actionId)) return room
    room.processedActionIds = [...room.processedActionIds.slice(-199), command.actionId]
    switch (command.type) {
      case 'PLAYER_READY': player.ready = command.ready; room.status = room.players.filter(value => value.presence === 'CONNECTED').every(value => value.ready) ? 'READY' : 'WAITING'; break
      case 'PLAYER_MOVE': this.requireHost(room, playerId); this.movePlayer(room, command.playerId, command.teamId); break
      case 'PLAYER_REMOVE': this.requireHost(room, playerId); this.removePlayer(room, command.playerId); break
      case 'ROOM_CONFIG_UPDATE': this.requireHost(room, playerId); this.updateConfig(room, command.config); break
      case 'ROOM_DISTRIBUTE': this.requireHost(room, playerId); this.distribute(room, command.strategy); break
      case 'GAME_START': this.requireHost(room, playerId); this.startGame(room); break
      case 'ROUND_READY': this.startRound(room, playerId); break
      case 'ROUND_ABORT': this.abortPausedRound(room, playerId); break
      case 'WORD_MARK': this.markWord(room, playerId, command.wordId, command.status); break
      case 'REVIEW_CONFIRM': this.confirmReview(room, playerId); break
      case 'REVIEW_DISPUTE': this.dispute(room, playerId, command.wordId, command.proposedStatus); break
      case 'REVIEW_VOTE': this.vote(room, playerId, command.wordId, command.vote); break
      case 'REVIEW_HOST_RESOLVE': this.requireHost(room, playerId); this.hostResolveDispute(room, command.wordId, command.status); break
      case 'REVIEW_FORCE_FINALIZE': this.requireHost(room, playerId); this.forceFinalizeReview(room); break
      case 'NEXT_ROUND': this.requireHost(room, playerId); this.prepareRound(room); break
      case 'ROOM_CLOSE': this.requireHost(room, playerId); room.status = 'CLOSED'; break
      case 'ROOM_LEAVE': this.removePlayer(room, playerId, true); break
      case 'SYNC_STATE': return room
    }
    this.touch(room, command.type.toLocaleLowerCase().replaceAll('_', ':'), { playerId })
    return room
  }

  disconnect(code: string, playerId: string) {
    const room = this.rooms.get(code); const player = room?.players.find(value => value.id === playerId)
    if (!room || !player) return
    player.presence = 'DISCONNECTED'; player.lastSeenAt = this.now()
    if (room.explainerId === playerId && room.phase === 'ROUND_ACTIVE') {
      room.pausedRemainingMs = Math.max(0, (room.roundEndsAt ?? this.now()) - this.now()); room.roundEndsAt = null; room.phase = 'PAUSED'
    }
    this.touch(room, 'player:disconnected', { playerId })
    if (!this.scheduleTimers) return
    const key = `${code}:${playerId}`; clearTimeout(this.timers.get(key))
    this.timers.set(key, setTimeout(() => {
      const current = this.rooms.get(code); const missing = current?.players.find(value => value.id === playerId)
      if (!current || !missing || missing.presence === 'CONNECTED') return
      if (current.hostId === playerId) {
        const successor = current.players.filter(value => value.id !== playerId && value.presence === 'CONNECTED').sort((a, b) => a.joinedAt - b.joinedAt)[0]
        if (successor) current.hostId = successor.id
      }
      this.touch(current, 'room:updated', { hostId: current.hostId })
    }, HOST_GRACE))
  }

  snapshot(room: GameRoom, playerId: string): RoomSnapshot {
    const canSeeCard = room.explainerId === playerId || room.phase === 'REVIEW' || room.phase === 'FINISHED'
    const game = room.game ? structuredClone(room.game) : null
    if (game?.round && !canSeeCard) game.round.words = []
    const { players: _players, processedActionIds: _actions, game: _game, ...publicRoom } = structuredClone(room)
    return { ...publicRoom, players: room.players.map(({ sessionToken: _, ...player }) => player), game, canSeeCard, serverNow: this.now() }
  }

  getRoom(code: string) { const key = code.trim().toUpperCase(); const room = this.rooms.get(key); if (room && room.expiresAt <= this.now()) { this.rooms.delete(key); return null } return room ?? null }
  listRooms() { return [...this.rooms.values()] }
  cleanupExpired() { const now = this.now(); for (const [code, room] of this.rooms) if (room.expiresAt <= now || room.status === 'CLOSED') this.rooms.delete(code); this.persist() }

  processDue(room: GameRoom) {
    let changed = false
    if (room.phase === 'ROUND_ACTIVE' && room.roundEndsAt !== null && room.roundEndsAt <= this.now()) { this.endRound(room); changed = true }
    const host = room.players.find(player => player.id === room.hostId)
    if (host?.presence === 'DISCONNECTED' && this.now() - host.lastSeenAt >= HOST_GRACE) {
      const successor = room.players.filter(player => player.id !== host.id && player.presence === 'CONNECTED').sort((a, b) => a.joinedAt - b.joinedAt)[0]
      if (successor) { room.hostId = successor.id; changed = true }
    }
    if (room.expiresAt <= this.now()) { room.status = 'CLOSED'; changed = true }
    if (changed) this.touch(room, 'room:updated')
    return changed
  }

  nextDeadline(room: GameRoom) {
    const deadlines = [room.expiresAt]
    if (room.phase === 'ROUND_ACTIVE' && room.roundEndsAt !== null) deadlines.push(room.roundEndsAt)
    const host = room.players.find(player => player.id === room.hostId)
    if (host?.presence === 'DISCONNECTED') deadlines.push(host.lastSeenAt + HOST_GRACE)
    return Math.min(...deadlines.filter(value => value > this.now()))
  }

  private player(name: string, now: number) {
    const normalized = name.trim().slice(0, 30)
    if (!normalized) throw new MultiplayerError('INVALID_NAME', 'Indica o teu nome.')
    return { id: generateId(), name: normalized, sessionToken: `${generateId()}${generateId()}`, ready: false, presence: 'CONNECTED' as const, joinedAt: now, lastSeenAt: now, teamId: null }
  }

  private code() { let value = ''; do { value = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('') } while (this.rooms.has(value)); return value }
  private room(code: string) { const room = this.getRoom(code); if (!room || room.status === 'CLOSED') throw new MultiplayerError('ROOM_NOT_FOUND', 'Código de sala inválido.'); return room }
  private requirePlayer(room: GameRoom, id: string) { const player = room.players.find(value => value.id === id); if (!player) throw new MultiplayerError('NOT_IN_ROOM', 'Jogador não pertence à sala.'); player.lastSeenAt = this.now(); return player }
  private requireHost(room: GameRoom, id: string) { if (room.hostId !== id) throw new MultiplayerError('HOST_ONLY', 'Apenas o host pode executar esta acção.') }
  private credentials(room: GameRoom, playerId: string): RoomCredentials { const player = this.requirePlayer(room, playerId); return { roomCode: room.code, playerId, sessionToken: player.sessionToken } }

  private distribute(room: GameRoom, strategy: 'BALANCED' | 'RANDOM') {
    if (room.mode === 'DUEL') {
      room.teams = createTeams(2, 1).map((team, index) => ({ ...team, name: room.players[index]?.name ?? team.name, players: room.players[index] ? [room.players[index].name] : [] }))
      room.players.forEach((player, index) => { player.teamId = room.teams[index]?.id ?? null }); return
    }
    const count = Math.max(2, Math.min(6, Math.ceil(room.players.length / 2))); room.teams = createTeams(count, 1)
    const players = strategy === 'RANDOM' ? [...room.players].sort(() => Math.random() - .5) : room.players
    players.forEach((player, index) => { const team = room.teams[index % count]; player.teamId = team.id; team.players.push(player.name); team.playerCount = team.players.length })
  }

  private movePlayer(room: GameRoom, targetId: string, teamId: string) {
    if (room.phase !== 'LOBBY') throw new MultiplayerError('LOBBY_ONLY', 'Só é possível organizar jogadores no lobby.')
    if (!room.teams.length) this.distribute(room, 'BALANCED')
    const player = this.requirePlayer(room, targetId); const target = room.teams.find(team => team.id === teamId)
    if (!target) throw new MultiplayerError('INVALID_TEAM', 'Equipa inválida.')
    for (const team of room.teams) { team.players = team.players.filter(name => name !== player.name); team.playerCount = Math.max(1, team.players.length) }
    player.teamId = target.id; target.players.push(player.name); target.playerCount = target.players.length
    room.players.forEach(value => { value.ready = false }); room.status = 'WAITING'
  }

  private removePlayer(room: GameRoom, targetId: string, self = false) {
    if (!self && room.phase !== 'LOBBY') throw new MultiplayerError('LOBBY_ONLY', 'Só é possível remover jogadores no lobby.')
    if (!self && targetId === room.hostId) throw new MultiplayerError('CANNOT_REMOVE_HOST', 'O host não pode remover-se desta forma.')
    const target = this.requirePlayer(room, targetId)
    room.players = room.players.filter(player => player.id !== targetId)
    for (const team of room.teams) { team.players = team.players.filter(name => name !== target.name); team.playerCount = Math.max(1, team.players.length) }
    if (room.hostId === targetId) room.hostId = room.players.filter(player => player.presence === 'CONNECTED').sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? ''
    if (!room.players.length) room.status = 'CLOSED'
  }

  private updateConfig(room: GameRoom, patch: Partial<GameRoom['gameConfig']>) {
    if (room.phase !== 'LOBBY') throw new MultiplayerError('LOBBY_ONLY', 'A configuração só pode ser alterada no lobby.')
    const next = { ...room.gameConfig }
    if (patch.durationSeconds !== undefined) next.durationSeconds = Math.max(15, Math.min(90, patch.durationSeconds))
    if (patch.wordsPerCard !== undefined) next.wordsPerCard = Math.max(4, Math.min(8, patch.wordsPerCard))
    if (patch.passLimit !== undefined) next.passLimit = Math.max(0, Math.min(99, patch.passLimit))
    if (patch.passPenalty !== undefined) next.passPenalty = patch.passPenalty
    if (patch.roundLimit !== undefined) next.roundLimit = Math.max(1, Math.min(10, patch.roundLimit))
    room.gameConfig = next; room.players.forEach(player => { player.ready = false }); room.status = 'WAITING'
  }

  private startGame(room: GameRoom) {
    const connected = room.players.filter(player => player.presence === 'CONNECTED')
    if (connected.length < 2 || connected.some(player => !player.ready)) throw new MultiplayerError('NOT_READY', 'Todos os jogadores ligados devem estar prontos.')
    if (room.mode === 'DUEL' && connected.length !== 2) throw new MultiplayerError('DUEL_PLAYERS', 'O duelo exige exactamente dois jogadores.')
    if (!room.teams.length || room.players.some(player => !player.teamId)) this.distribute(room, 'BALANCED')
    const duelRoundsPerPlayer = room.duelVariant === 'DUEL' ? 2 : 1
    room.game = createSession(room.teams, { ...room.gameConfig, victoryMode: 'rounds', roundLimit: room.mode === 'DUEL' ? duelRoundsPerPlayer : room.gameConfig.roundLimit })
    room.currentGameId = room.game.id; room.status = 'IN_GAME'; this.prepareRound(room)
  }

  private prepareRound(room: GameRoom) {
    if (!room.game) throw new MultiplayerError('NO_GAME', 'A partida ainda não começou.')
    if (room.game.status === 'finished') { room.status = 'FINISHED'; room.phase = 'FINISHED'; return }
    const round = createRound({ ...room.game, round: null }, decks)
    room.game = { ...room.game, status: 'ready', round }
    const activeTeam = room.game.teams[room.game.activeTeamIndex]
    const candidates = room.players.filter(player => player.teamId === activeTeam.id && player.presence === 'CONNECTED')
    room.explainerId = candidates[activeTeam.nextExplainerIndex % Math.max(1, candidates.length)]?.id ?? candidates[0]?.id ?? null
    room.roundEndsAt = null; room.pausedRemainingMs = null; room.review = null; room.phase = 'ROUND_READY'
  }

  private startRound(room: GameRoom, playerId: string) {
    if (room.explainerId !== playerId || room.phase !== 'ROUND_READY' || !room.game?.round) throw new MultiplayerError('EXPLAINER_ONLY', 'Apenas o explicador pode iniciar esta ronda.')
    const startedAt = this.now(); room.roundEndsAt = startedAt + room.game.config.durationSeconds * 1000
    room.game = { ...room.game, status: 'playing', round: { ...room.game.round, startedAt } }; room.phase = 'ROUND_ACTIVE'
    this.scheduleRoundEnd(room)
  }

  private abortPausedRound(room: GameRoom, playerId: string) {
    this.requireHost(room, playerId)
    const explainer = room.players.find(player => player.id === room.explainerId)
    if (room.phase !== 'PAUSED' || !explainer) throw new MultiplayerError('ROUND_NOT_PAUSED', 'Esta ronda não está pausada.')
    if (this.now() - explainer.lastSeenAt < HOST_GRACE) throw new MultiplayerError('PLAYER_GRACE_ACTIVE', 'Aguarda o período de reconexão do explicador.')
    room.pausedRemainingMs = null
    this.endRound(room)
  }

  private scheduleRoundEnd(room: GameRoom) {
    if (!this.scheduleTimers || !room.roundEndsAt) return
    const key = `${room.code}:round`; clearTimeout(this.timers.get(key))
    this.timers.set(key, setTimeout(() => { const current = this.rooms.get(room.code); if (current?.phase === 'ROUND_ACTIVE') { this.endRound(current); this.touch(current, 'round:ended') } }, Math.max(0, room.roundEndsAt - this.now()) + 50))
  }

  private markWord(room: GameRoom, playerId: string, wordId: string, status: 'correct' | 'passed') {
    if (room.explainerId !== playerId) throw new MultiplayerError('EXPLAINER_ONLY', 'Apenas o explicador pode marcar palavras.')
    if (room.phase !== 'ROUND_ACTIVE' || !room.game?.round || !room.roundEndsAt || this.now() > room.roundEndsAt) throw new MultiplayerError('ROUND_CLOSED', 'A ronda já terminou.')
    const word = room.game.round.words.find(value => value.id === wordId); if (!word) throw new MultiplayerError('INVALID_WORD', 'A palavra não pertence ao cartão.')
    if (status === 'passed' && word.status !== 'passed' && room.game.config.passLimit < 99 && passesUsed(room.game.round) >= room.game.config.passLimit) throw new MultiplayerError('PASS_LIMIT', 'O limite de passes foi atingido.')
    word.status = word.status === status ? 'pending' : status
    if (allWordsProcessed(room.game.round)) this.endRound(room)
  }

  private endRound(room: GameRoom) {
    if (!room.game?.round || room.phase === 'REVIEW') return
    room.game.round.words.forEach(word => { if (word.status === 'pending') word.status = 'wrong' })
    room.game.status = 'review'; room.phase = 'REVIEW'; room.roundEndsAt = this.now()
    room.review = { roundId: room.game.round.id, confirmations: {}, disputes: {}, status: 'OPEN', startedAt: this.now(), expiresAt: this.now() + REVIEW_TIMEOUT }
  }

  private confirmReview(room: GameRoom, playerId: string) {
    if (room.phase !== 'REVIEW' || !room.review) throw new MultiplayerError('NO_REVIEW', 'Não existe revisão activa.')
    if (Object.values(room.review.disputes).some(dispute => !dispute.resolvedStatus)) throw new MultiplayerError('DISPUTE_PENDING', 'Resolve as contestações antes de confirmar.')
    room.review.confirmations[playerId] = this.now(); this.maybeFinalize(room)
  }

  private dispute(room: GameRoom, playerId: string, wordId: string, proposedStatus: WordStatus) {
    if (room.phase !== 'REVIEW' || !room.review || !room.game?.round?.words.some(word => word.id === wordId)) throw new MultiplayerError('INVALID_DISPUTE', 'Não é possível contestar esta palavra.')
    room.review.disputes[wordId] = { wordId, openedBy: playerId, proposedStatus, votes: {}, resolvedStatus: null }
    room.review.confirmations = {}
  }

  private vote(room: GameRoom, playerId: string, wordId: string, vote: 'COUNT' | 'DONT_COUNT') {
    const dispute = room.review?.disputes[wordId]; if (!dispute || dispute.resolvedStatus) throw new MultiplayerError('NO_DISPUTE', 'A contestação não está activa.')
    if (room.mode === 'TEAMS' && playerId === room.explainerId) throw new MultiplayerError('EXPLAINER_CANNOT_VOTE', 'O explicador não participa nesta votação.')
    dispute.votes[playerId] = vote
    const eligible = room.players.filter(player => player.presence === 'CONNECTED' && (room.mode === 'DUEL' || player.id !== room.explainerId))
    if (eligible.every(player => dispute.votes[player.id])) {
      const count = Object.values(dispute.votes).filter(value => value === 'COUNT').length
      const reject = Object.values(dispute.votes).length - count
      if (count !== reject) this.resolveDispute(room, wordId, count > reject ? 'correct' : 'wrong')
      else if (room.mode === 'DUEL') this.resolveDispute(room, wordId, 'wrong')
    }
  }

  private resolveDispute(room: GameRoom, wordId: string, status: WordStatus) {
    const dispute = room.review?.disputes[wordId]; const word = room.game?.round?.words.find(value => value.id === wordId)
    if (!dispute || !word) throw new MultiplayerError('NO_DISPUTE', 'A contestação não está activa.')
    dispute.resolvedStatus = status; word.status = status
  }

  private hostResolveDispute(room: GameRoom, wordId: string, status: WordStatus) {
    const dispute = room.review?.disputes[wordId]
    if (!dispute || room.mode !== 'TEAMS') throw new MultiplayerError('HOST_RESOLUTION_UNAVAILABLE', 'Este desempate não está disponível.')
    const eligible = room.players.filter(player => player.presence === 'CONNECTED' && player.id !== room.explainerId)
    if (!eligible.every(player => dispute.votes[player.id])) throw new MultiplayerError('VOTES_PENDING', 'A votação ainda não terminou.')
    const count = Object.values(dispute.votes).filter(value => value === 'COUNT').length
    if (count !== Object.values(dispute.votes).length - count) throw new MultiplayerError('NOT_TIED', 'O host só resolve empates.')
    this.resolveDispute(room, wordId, status)
  }

  private forceFinalizeReview(room: GameRoom) {
    if (!room.review || !room.game || this.now() < room.review.expiresAt) throw new MultiplayerError('REVIEW_TIMEOUT_ACTIVE', 'O tempo de confirmação ainda não terminou.')
    for (const dispute of Object.values(room.review.disputes)) {
      if (dispute.resolvedStatus) continue
      const count = Object.values(dispute.votes).filter(value => value === 'COUNT').length
      const reject = Object.values(dispute.votes).length - count
      this.resolveDispute(room, dispute.wordId, count > reject ? 'correct' : 'wrong')
    }
    for (const player of room.players.filter(value => value.presence === 'CONNECTED')) room.review.confirmations[player.id] ??= this.now()
    this.maybeFinalize(room)
  }

  private maybeFinalize(room: GameRoom) {
    if (!room.review || !room.game) return
    const required = room.players.filter(player => player.presence === 'CONNECTED')
    if (!required.every(player => room.review!.confirmations[player.id])) return
    room.review.status = 'CLOSED'; room.game = confirmRound(room.game); room.teams = room.game.teams
    if (room.game.status === 'finished') { room.status = 'FINISHED'; room.phase = 'FINISHED' }
    else room.phase = 'BETWEEN_ROUNDS'
  }

  private touch(room: GameRoom, event: string, payload?: unknown) {
    room.updatedAt = this.now(); room.expiresAt = room.updatedAt + ROOM_LIFETIME; room.stateVersion += 1
    this.persist(); this.emit('update', room, event, payload)
  }

  private persist() {
    if (!this.filePath) return
    this.saveQueue = this.saveQueue.then(async () => {
      await mkdir(path.dirname(this.filePath!), { recursive: true }); const temp = `${this.filePath}.${process.pid}.tmp`
      await writeFile(temp, JSON.stringify(this.listRooms().filter(room => room.status !== 'CLOSED'), null, 2)); await rename(temp, this.filePath!)
    }).catch(error => console.error('Não foi possível guardar salas:', error))
  }
}
