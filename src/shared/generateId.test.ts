import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateId } from './generateId'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('generateId', () => {
  it('uses crypto.randomUUID when the environment provides it', () => {
    const expected = '123e4567-e89b-42d3-a456-426614174000'
    const randomUUID = vi.fn(() => expected)
    vi.stubGlobal('crypto', { randomUUID })

    expect(generateId()).toBe(expected)
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('builds a UUID v4 with getRandomValues when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xab)
      return bytes
    })
    vi.stubGlobal('crypto', { getRandomValues })

    expect(generateId()).toMatch(UUID_V4)
    expect(getRandomValues).toHaveBeenCalledOnce()
  })

  it('remains available and produces distinct IDs without crypto', () => {
    vi.stubGlobal('crypto', undefined)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const first = generateId()
    const second = generateId()

    expect(first).toMatch(UUID_V4)
    expect(second).toMatch(UUID_V4)
    expect(second).not.toBe(first)
  })
})
