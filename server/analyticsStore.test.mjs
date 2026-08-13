import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAnalyticsStore } from './analyticsStore.mjs'

const directories = []
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))))

describe('analytics store', () => {
  it('counts unique devices separately from total visits and persists its data', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'trinta-segundos-analytics-'))
    directories.push(directory)
    const file = path.join(directory, 'analytics.json')
    const store = createAnalyticsStore(file)
    await Promise.all([
      store.recordVisit('visitor-one', 100),
      store.recordVisit('visitor-one', 200),
      store.recordVisit('visitor-two', 300),
    ])
    await expect(createAnalyticsStore(file).getSummary()).resolves.toEqual({
      uniqueVisitors: 2, totalVisits: 3, lastVisit: 300,
    })
  })

  it('rejects malformed visitor identifiers', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'trinta-segundos-analytics-'))
    directories.push(directory)
    await expect(createAnalyticsStore(path.join(directory, 'analytics.json')).recordVisit('x')).rejects.toThrow('inválido')
  })
})
