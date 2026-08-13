import { generateId } from '../shared/generateId'

export const ADMIN_EMAIL = 'naeemjulaya7@gmail.com'
const VISITOR_KEY = 'trinta-segundos:visitor-id'
const VISIT_RECORDED_KEY = 'trinta-segundos:visit-recorded'
const ADMIN_SESSION_KEY = 'trinta-segundos:admin-email'

export interface AnalyticsSummary {
  uniqueVisitors: number
  totalVisits: number
  lastVisit: number | null
}

function storage(type: 'localStorage' | 'sessionStorage'): Storage | null {
  try { return globalThis.window?.[type] ?? null } catch { return null }
}

export function isAdminEmail(email: string): boolean {
  return email.trim().toLocaleLowerCase() === ADMIN_EMAIL
}

export function getStoredAdmin(): string | null {
  const email = storage('localStorage')?.getItem(ADMIN_SESSION_KEY) ?? null
  return email && isAdminEmail(email) ? ADMIN_EMAIL : null
}

export function storeAdmin(email: string): boolean {
  if (!isAdminEmail(email)) return false
  storage('localStorage')?.setItem(ADMIN_SESSION_KEY, ADMIN_EMAIL)
  return true
}

export function clearStoredAdmin(): void {
  storage('localStorage')?.removeItem(ADMIN_SESSION_KEY)
}

function visitorId(): string {
  const local = storage('localStorage')
  const existing = local?.getItem(VISITOR_KEY)
  if (existing) return existing
  const created = generateId()
  local?.setItem(VISITOR_KEY, created)
  return created
}

export async function registerVisit(): Promise<AnalyticsSummary | null> {
  if (typeof globalThis.fetch !== 'function') return null
  const currentSession = storage('sessionStorage')
  if (currentSession?.getItem(VISIT_RECORDED_KEY)) return null
  currentSession?.setItem(VISIT_RECORDED_KEY, '1')
  try {
    const response = await fetch('/api/analytics/visit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId() }),
    })
    if (!response.ok) throw new Error('Não foi possível registar o acesso.')
    return await response.json() as AnalyticsSummary
  } catch (error) {
    currentSession?.removeItem(VISIT_RECORDED_KEY)
    throw error
  }
}

export async function loadAnalytics(): Promise<AnalyticsSummary> {
  const response = await fetch('/api/analytics/summary', { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error('Não foi possível carregar as estatísticas.')
  return await response.json() as AnalyticsSummary
}
