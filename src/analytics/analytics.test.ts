// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_EMAIL, clearStoredAdmin, getStoredAdmin, isAdminEmail, loadAnalytics, registerVisit, storeAdmin,
} from './analytics'

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => vi.unstubAllGlobals())

describe('MVP analytics and admin access', () => {
  it('normalizes the configured admin email and rejects every other email', () => {
    expect(isAdminEmail(` ${ADMIN_EMAIL.toUpperCase()} `)).toBe(true)
    expect(isAdminEmail('another@example.com')).toBe(false)
    expect(storeAdmin('another@example.com')).toBe(false)
    expect(getStoredAdmin()).toBeNull()
  })

  it('persists and clears the MVP admin session', () => {
    expect(storeAdmin(ADMIN_EMAIL)).toBe(true)
    expect(getStoredAdmin()).toBe(ADMIN_EMAIL)
    clearStoredAdmin()
    expect(getStoredAdmin()).toBeNull()
  })

  it('registers one anonymous visit per browser tab session', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, json: async () => ({ uniqueVisitors: 1, totalVisits: 1, lastVisit: 100 }) } as Response))
    vi.stubGlobal('fetch', fetchMock)
    expect(await registerVisit()).toMatchObject({ uniqueVisitors: 1, totalVisits: 1 })
    expect(await registerVisit()).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).visitorId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('loads the central analytics summary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ uniqueVisitors: 7, totalVisits: 10, lastVisit: 200 }) } as Response)))
    await expect(loadAnalytics()).resolves.toEqual({ uniqueVisitors: 7, totalVisits: 10, lastVisit: 200 })
  })
})
