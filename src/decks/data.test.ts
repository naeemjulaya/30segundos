import { describe, expect, it } from 'vitest'
import { decks } from './data'

describe('official decks', () => {
  it('provides at least 50 words in every deck and keeps metadata synchronized', () => {
    for (const deck of decks) {
      expect(deck.words.length).toBeGreaterThanOrEqual(50)
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
