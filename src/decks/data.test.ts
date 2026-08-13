import { describe, expect, it } from 'vitest'
import { decks } from './data'

describe('official decks', () => {
  it('provides 480 official words offline', () => {
    expect(decks.reduce((total, deck) => total + deck.words.length, 0)).toBe(480)
  })

  it('provides at least 80 words in every deck and keeps metadata synchronized', () => {
    for (const deck of decks) {
      expect(deck.words.length).toBeGreaterThanOrEqual(80)
      expect(deck.wordCount).toBe(deck.words.length)
    }
  })

  it('does not repeat a word inside the same deck', () => {
    for (const deck of decks) {
      const normalized = deck.words.map((word) => (typeof word === 'string' ? word : word.text)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase())
      expect(new Set(normalized).size).toBe(normalized.length)
    }
  })
})
