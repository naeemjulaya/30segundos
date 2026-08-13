import type { Deck, DeckWord, GameConfig, GameSession, Round, RoundResult, RoundWord, Team } from './types'
import { generateId } from '../../shared/generateId'

const colors: Team['color'][] = ['cyan', 'red', 'green', 'amber', 'violet', 'pink']

export function createTeams(count: number, playerCount = 4): Team[] {
  const names = ['Azul', 'Vermelha', 'Verde', 'Dourada', 'Violeta', 'Rosa']
  return Array.from({ length: Math.max(2, Math.min(6, count)) }, (_, index) => ({
    id: generateId(),
    name: names[index],
    color: colors[index],
    playerCount,
    players: [],
    nextExplainerIndex: 0,
    score: 0,
  }))
}

export function defaultConfig(): GameConfig {
  return {
    composition: 'balanced', durationSeconds: 30, wordsPerCard: 8,
    passLimit: 2, passPenalty: false, targetScore: 40,
    victoryMode: 'points', roundLimit: 5, difficulty: 'mixed',
    selectedDeckIds: ['mocambique', 'futebol'],
    registerPlayerNames: false, automaticRotation: true,
    startingTeamIndex: 0, randomFirstTeam: false,
    soundEnabled: true, vibrationEnabled: true,
  }
}

export function createSession(teams = createTeams(3), config = defaultConfig()): GameSession {
  const now = Date.now()
  return {
    id: generateId(), status: 'setup', teams, config, round: null,
    completedRounds: [], roundNumber: 0, activeTeamIndex: config.startingTeamIndex, cycleStartTeamIndex: config.startingTeamIndex,
    finishingCycle: false, tiebreak: null, winnerTeamId: null,
    createdAt: now, updatedAt: now, usedWordIds: [],
  }
}

export function normalizeSession(value: GameSession): GameSession {
  const storedConfig = Object.fromEntries(
    Object.entries(value.config ?? {}).filter(([, storedValue]) => storedValue !== undefined),
  ) as Partial<GameConfig>
  const config = { ...defaultConfig(), ...storedConfig }
  return {
    ...value,
    config,
    teams: value.teams.map((team) => ({ ...team, nextExplainerIndex: team.nextExplainerIndex ?? 0, players: team.players ?? [] })),
    completedRounds: value.completedRounds ?? [],
    cycleStartTeamIndex: value.cycleStartTeamIndex ?? value.config?.startingTeamIndex ?? 0,
    finishingCycle: value.finishingCycle ?? false,
    tiebreak: value.tiebreak ?? null,
    winnerTeamId: value.winnerTeamId ?? null,
    usedWordIds: value.usedWordIds ?? [],
    round: value.round ? {
      ...value.round, isTiebreak: value.round.isTiebreak ?? false, reusedWords: value.round.reusedWords ?? false,
      words: value.round.words.map((word, index) => ({ ...word, difficulty: word.difficulty ?? 'normal', id: word.id ?? String(index) })),
    } : null,
  }
}

function wordEntry(word: string | DeckWord, index: number): DeckWord {
  if (typeof word !== 'string') return word
  const cycle: DeckWord['difficulty'][] = ['easy', 'normal', 'normal', 'hard']
  return { text: word, difficulty: cycle[index % cycle.length] }
}

export function createRound(session: GameSession, decks: Deck[], recentlyUsed: string[] = []): Round {
  const seenText = new Set<string>()
  const pool = decks
    .filter((deck) => session.config.selectedDeckIds.includes(deck.id))
    .flatMap((deck) => deck.words.map((value, index) => {
      const word = wordEntry(value, index)
      return { id: `${deck.id}:${index}`, ...word }
    }))
    .filter((word) => {
      const normalized = word.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase()
      if (seenText.has(normalized)) return false
      seenText.add(normalized)
      return true
    })
    .filter((word) => session.config.difficulty === 'mixed' || word.difficulty === session.config.difficulty)
  const unused = pool.filter((word) => !session.usedWordIds.includes(word.id))
  const fresh = unused.filter((word) => !recentlyUsed.includes(word.id))
  let source = fresh
  if (source.length < session.config.wordsPerCard) source = unused
  const reusedWords = source.length < session.config.wordsPerCard
  if (reusedWords) source = pool
  const shuffled = [...source].sort(() => Math.random() - 0.5)
  const words: RoundWord[] = shuffled.slice(0, session.config.wordsPerCard).map((word) => ({ ...word, status: 'pending' }))
  if (words.length < session.config.wordsPerCard) throw new Error('Conteúdo insuficiente para gerar o cartão.')
  return {
    id: generateId(), teamIndex: session.activeTeamIndex,
    number: session.roundNumber + 1, words, startedAt: null, confirmed: false, score: 0,
    isTiebreak: Boolean(session.tiebreak), reusedWords,
  }
}

export function scoreRound(round: Round, config?: GameConfig): number {
  const correct = round.words.filter((word) => word.status === 'correct').length
  const penalty = config?.passPenalty ? round.words.filter((word) => word.status === 'passed').length : 0
  return Math.max(0, correct - penalty)
}

export function passesUsed(round: Round): number {
  return round.words.filter((word) => word.status === 'passed').length
}

export function allWordsProcessed(round: Round): boolean {
  return round.words.every((word) => word.status !== 'pending')
}

export function remainingSeconds(round: Round, durationSeconds: number, now = Date.now()): number {
  if (!round.startedAt) return durationSeconds
  return Math.max(0, Math.ceil((round.startedAt + durationSeconds * 1000 - now) / 1000))
}

export function explainerLabel(team: Team, config: GameConfig): string {
  if (!config.automaticRotation) return 'Escolham quem vai explicar'
  if (config.registerPlayerNames && team.players.length) return team.players[team.nextExplainerIndex % team.players.length]
  return `Jogador ${(team.nextExplainerIndex % Math.max(1, team.playerCount)) + 1} de ${team.playerCount}`
}

function roundResult(session: GameSession, score: number): RoundResult {
  const round = session.round!
  const team = session.teams[round.teamIndex]
  return {
    id: round.id, number: round.number, teamId: team.id, teamName: team.name,
    score, isTiebreak: round.isTiebreak, completedAt: Date.now(),
    words: round.words.map((word) => ({ ...word })),
  }
}

function tiedLeaderIds(teams: Team[]): string[] {
  const best = Math.max(...teams.map((team) => team.score))
  return teams.filter((team) => team.score === best).map((team) => team.id)
}

export function confirmRound(session: GameSession): GameSession {
  if (!session.round || session.round.confirmed) return session
  const score = scoreRound(session.round, session.config)
  const result = roundResult(session, score)
  const completedRounds = [...session.completedRounds, result]
  const usedWordIds = [...session.usedWordIds, ...session.round.words.map((word) => word.id)]

  if (session.round.isTiebreak && session.tiebreak) {
    const currentTeam = session.teams[session.round.teamIndex]
    const scores = { ...session.tiebreak.scores, [currentTeam.id]: score }
    const nextIndex = session.tiebreak.currentIndex + 1
    if (nextIndex < session.tiebreak.teamIds.length) {
      const nextTeamId = session.tiebreak.teamIds[nextIndex]
      return {
        ...session, status: 'tiebreak', round: { ...session.round, confirmed: true, score },
        completedRounds, usedWordIds, roundNumber: session.roundNumber + 1,
        activeTeamIndex: session.teams.findIndex((team) => team.id === nextTeamId),
        tiebreak: { ...session.tiebreak, scores, currentIndex: nextIndex }, updatedAt: Date.now(),
      }
    }
    const best = Math.max(...session.tiebreak.teamIds.map((id) => scores[id] ?? 0))
    const winners = session.tiebreak.teamIds.filter((id) => scores[id] === best)
    if (winners.length > 1) {
      return {
        ...session, status: 'tiebreak', round: { ...session.round, confirmed: true, score },
        completedRounds, usedWordIds, roundNumber: session.roundNumber + 1,
        activeTeamIndex: session.teams.findIndex((team) => team.id === winners[0]),
        tiebreak: { teamIds: winners, scores: {}, currentIndex: 0, attempt: session.tiebreak.attempt + 1 },
        updatedAt: Date.now(),
      }
    }
    return {
      ...session, status: 'finished', round: { ...session.round, confirmed: true, score },
      completedRounds, usedWordIds, roundNumber: session.roundNumber + 1,
      tiebreak: null, winnerTeamId: winners[0], finishingCycle: false, updatedAt: Date.now(),
    }
  }

  const teams = session.teams.map((team, index) => {
    if (index !== session.round!.teamIndex) return team
    const rotationSize = session.config.registerPlayerNames && team.players.length ? team.players.length : team.playerCount
    return {
      ...team, score: team.score + score,
      nextExplainerIndex: session.config.automaticRotation ? (team.nextExplainerIndex + 1) % Math.max(1, rotationSize) : team.nextExplainerIndex,
    }
  })
  const nextRoundNumber = session.roundNumber + 1
  const pointsReached = session.config.victoryMode === 'points' && teams.some((team) => team.score >= session.config.targetScore)
  const finishingCycle = session.finishingCycle || pointsReached
  const cycleEndTeamIndex = (session.cycleStartTeamIndex + teams.length - 1) % teams.length
  const pointsCycleComplete = finishingCycle && session.round.teamIndex === cycleEndTeamIndex
  const fixedRoundsComplete = session.config.victoryMode === 'rounds' && nextRoundNumber >= session.config.roundLimit * teams.length
  const competitionComplete = pointsCycleComplete || fixedRoundsComplete

  if (competitionComplete) {
    const tied = tiedLeaderIds(teams)
    if (tied.length > 1) {
      return {
        ...session, teams, status: 'tiebreak', round: { ...session.round, confirmed: true, score },
        completedRounds, usedWordIds, roundNumber: nextRoundNumber,
        activeTeamIndex: teams.findIndex((team) => team.id === tied[0]),
        finishingCycle: false, tiebreak: { teamIds: tied, scores: {}, currentIndex: 0, attempt: 1 },
        updatedAt: Date.now(),
      }
    }
    return {
      ...session, teams, status: 'finished', round: { ...session.round, confirmed: true, score },
      completedRounds, usedWordIds, roundNumber: nextRoundNumber,
      activeTeamIndex: (session.activeTeamIndex + 1) % teams.length,
      finishingCycle: false, winnerTeamId: tied[0], updatedAt: Date.now(),
    }
  }

  return {
    ...session, teams, status: 'between-rounds', round: { ...session.round, confirmed: true, score },
    completedRounds, usedWordIds, roundNumber: nextRoundNumber,
    activeTeamIndex: (session.activeTeamIndex + 1) % teams.length,
    finishingCycle, updatedAt: Date.now(),
  }
}

export function rematch(session: GameSession): GameSession {
  return createSession(session.teams.map((team) => ({ ...team, score: 0, nextExplainerIndex: 0 })), session.config)
}
