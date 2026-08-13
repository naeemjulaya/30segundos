import { describe, expect, it } from 'vitest'
import {
  allWordsProcessed, confirmRound, createRound, createSession, createTeams, defaultConfig,
  explainerLabel, normalizeSession, passesUsed, remainingSeconds, rematch, scoreRound,
} from './engine'
import type { Deck, Round } from './types'
import { generateId } from '../../shared/generateId'

function round(teamIndex: number, statuses: Round['words'][number]['status'][], isTiebreak = false): Round {
  return {
    id: generateId(), number: 1, teamIndex, startedAt: 1_000,
    confirmed: false, score: 0, isTiebreak, reusedWords: false,
    words: statuses.map((status, index) => ({ id: String(index), text: `Palavra ${index}`, difficulty: 'normal', status })),
  }
}

describe('game engine', () => {
  const deck: Deck = { id: 'test', name: 'Teste', icon: 'T', wordCount: 12, availableOffline: true, selected: true, words: Array.from({ length: 12 }, (_, index) => `Palavra ${index}`) }

  it('limits team creation to the supported range and initializes every team', () => {
    expect(createTeams(1)).toHaveLength(2)
    expect(createTeams(20)).toHaveLength(6)
    expect(createTeams(3, 7).every((team) => team.playerCount === 7 && team.score === 0)).toBe(true)
  })

  it('creates an independent default session with the documented game defaults', () => {
    const first = createSession()
    const second = createSession()
    expect(first.id).not.toBe(second.id)
    expect(first.status).toBe('setup')
    expect(first.teams).toHaveLength(3)
    expect(first.config).toMatchObject({ durationSeconds: 30, wordsPerCard: 5, passLimit: 2, targetScore: 40 })
  })

  it('counts correct words and applies an optional pass penalty without going negative', () => {
    const value = round(0, ['correct', 'passed', 'wrong'])
    expect(scoreRound(value)).toBe(1)
    expect(scoreRound(value, { ...defaultConfig(), passPenalty: true })).toBe(0)
  })

  it('does not confirm the same round twice', () => {
    const session = createSession(createTeams(2))
    session.round = round(0, ['correct'])
    const once = confirmRound(session)
    expect(confirmRound(once).teams[0].score).toBe(1)
  })

  it('uses timestamps for the timer', () => {
    expect(remainingSeconds(round(0, []), 30, 11_100)).toBe(20)
  })

  it('does not start the timer before the handoff and never returns negative time', () => {
    const pending = round(0, [])
    pending.startedAt = null
    expect(remainingSeconds(pending, 30, 99_000)).toBe(30)
    expect(remainingSeconds(round(0, []), 30, 99_000)).toBe(0)
  })

  it('counts passes and detects when the complete card was processed', () => {
    expect(passesUsed(round(0, ['passed', 'correct', 'passed']))).toBe(2)
    expect(allWordsProcessed(round(0, ['passed', 'correct', 'wrong']))).toBe(true)
    expect(allWordsProcessed(round(0, ['correct', 'pending']))).toBe(false)
  })

  it('gives every team the same number of turns before declaring a points winner', () => {
    const session = createSession(createTeams(3), { ...defaultConfig(), targetScore: 1 })
    session.round = round(0, ['correct'])
    const first = confirmRound(session)
    expect(first.status).toBe('between-rounds')
    expect(first.finishingCycle).toBe(true)
    first.round = round(2, ['wrong'])
    const last = confirmRound(first)
    expect(last.status).toBe('finished')
    expect(last.winnerTeamId).toBe(last.teams[0].id)
  })

  it('closes an equal-turn cycle correctly when the first team is not index zero', () => {
    const session = createSession(createTeams(3), { ...defaultConfig(), targetScore: 1, startingTeamIndex: 2 })
    session.round = round(2, ['correct'])
    const trigger = confirmRound(session)
    expect(trigger.status).toBe('between-rounds')
    trigger.round = round(1, ['wrong'])
    const end = confirmRound(trigger)
    expect(end.status).toBe('finished')
    expect(end.winnerTeamId).toBe(end.teams[2].id)
  })

  it('runs a tiebreak without changing the historical team scores', () => {
    const session = createSession(createTeams(2), { ...defaultConfig(), victoryMode: 'rounds', roundLimit: 1 })
    session.roundNumber = 1
    session.round = round(1, ['wrong'])
    const tied = confirmRound(session)
    expect(tied.status).toBe('tiebreak')
    expect(tied.tiebreak?.teamIds).toHaveLength(2)

    tied.round = round(0, ['correct'], true)
    const afterFirst = confirmRound(tied)
    expect(afterFirst.teams.map((team) => team.score)).toEqual([0, 0])
    afterFirst.round = round(1, ['wrong'], true)
    const resolved = confirmRound(afterFirst)
    expect(resolved.status).toBe('finished')
    expect(resolved.winnerTeamId).toBe(resolved.teams[0].id)
    expect(resolved.teams.map((team) => team.score)).toEqual([0, 0])
  })

  it('rotates named and generic explainers independently', () => {
    const team = createTeams(2)[0]
    team.players = ['Ana', 'Mia']
    expect(explainerLabel(team, { ...defaultConfig(), registerPlayerNames: true })).toBe('Ana')
    team.nextExplainerIndex = 1
    expect(explainerLabel(team, { ...defaultConfig(), registerPlayerNames: true })).toBe('Mia')
    expect(explainerLabel(team, defaultConfig())).toBe('Jogador 2 de 4')
  })

  it('respects selected content, difficulty and recent-word preferences', () => {
    const session = createSession(createTeams(2), { ...defaultConfig(), selectedDeckIds: ['test'], wordsPerCard: 2, difficulty: 'easy' })
    const value = createRound(session, [deck], ['test:0'])
    expect(value.words).toHaveLength(2)
    expect(value.words.every((word) => word.id.startsWith('test:') && word.difficulty === 'easy')).toBe(true)
    expect(value.words.some((word) => word.id === 'test:0')).toBe(false)
  })

  it('marks a round when session content must be reused', () => {
    const session = createSession(createTeams(2), { ...defaultConfig(), selectedDeckIds: ['test'], wordsPerCard: 5 })
    session.usedWordIds = deck.words.map((_, index) => `test:${index}`)
    expect(createRound(session, [deck]).reusedWords).toBe(true)
  })

  it('rejects a round when selected content cannot fill the card', () => {
    const tinyDeck: Deck = { ...deck, words: ['Única'], wordCount: 1 }
    const session = createSession(createTeams(2), { ...defaultConfig(), selectedDeckIds: ['test'], wordsPerCard: 5 })
    expect(() => createRound(session, [tinyDeck])).toThrow('Conteúdo insuficiente')
  })

  it('deduplicates equivalent words across selected decks', () => {
    const duplicateDeck: Deck = { ...deck, id: 'duplicate', words: ['Árvore', 'arvore'], wordCount: 2 }
    const session = createSession(createTeams(2), { ...defaultConfig(), selectedDeckIds: ['duplicate'], wordsPerCard: 2 })
    expect(() => createRound(session, [duplicateDeck])).toThrow('Conteúdo insuficiente')
  })

  it('normalizes legacy sessions without changing their persisted scores', () => {
    const session = createSession(createTeams(2))
    session.teams[0].score = 8
    const legacy = {
      ...session,
      config: { ...session.config, vibrationEnabled: undefined },
      completedRounds: undefined,
      usedWordIds: undefined,
    } as unknown as Parameters<typeof normalizeSession>[0]
    const normalized = normalizeSession(legacy)
    expect(normalized.teams[0].score).toBe(8)
    expect(normalized.completedRounds).toEqual([])
    expect(normalized.usedWordIds).toEqual([])
    expect(normalized.config.vibrationEnabled).toBe(true)
  })

  it('keeps the explainer unchanged when automatic rotation is disabled', () => {
    const session = createSession(createTeams(2), { ...defaultConfig(), automaticRotation: false })
    session.round = round(0, ['correct'])
    const next = confirmRound(session)
    expect(next.teams[0].nextExplainerIndex).toBe(0)
    expect(explainerLabel(next.teams[0], next.config)).toBe('Escolham quem vai explicar')
  })

  it('finishes a fixed-round match only after every team has played', () => {
    const session = createSession(createTeams(2), { ...defaultConfig(), victoryMode: 'rounds', roundLimit: 1 })
    session.round = round(0, ['correct'])
    const first = confirmRound(session)
    expect(first.status).toBe('between-rounds')
    first.round = round(1, ['wrong'])
    expect(confirmRound(first).status).toBe('finished')
  })

  it('creates a genuinely new session for a rematch', () => {
    const session = createSession(createTeams(2))
    session.teams[0].score = 12
    const next = rematch(session)
    expect(next.id).not.toBe(session.id)
    expect(next.teams.map((team) => team.score)).toEqual([0, 0])
    expect(next.config).toEqual(session.config)
  })
})
