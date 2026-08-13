// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_EMAIL } from '../analytics/analytics'
import { App } from './App'

const repository = vi.hoisted(() => ({
  clearSession: vi.fn().mockResolvedValue(undefined),
  deleteCustomDeck: vi.fn().mockResolvedValue(undefined),
  loadCustomDecks: vi.fn().mockResolvedValue([]),
  loadHistory: vi.fn().mockResolvedValue([]),
  loadPreferences: vi.fn().mockResolvedValue(null),
  loadSession: vi.fn().mockResolvedValue(null),
  saveCustomDeck: vi.fn().mockResolvedValue(undefined),
  saveHistoryEntry: vi.fn().mockResolvedValue(undefined),
  savePreferences: vi.fn().mockResolvedValue(undefined),
  saveSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../game/infrastructure/sessionRepository', () => repository)

async function renderReadyApp() {
  render(<App />)
  await screen.findByRole('button', { name: 'Partida rápida' })
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ uniqueVisitors: 12, totalVisits: 31, lastVisit: 1_786_572_000_000 }),
  } as Response)))
  class SocketMock {
    static OPEN = 1
    readyState = 0
    addEventListener() {}
    close() {}
    send() {}
  }
  vi.stubGlobal('WebSocket', SocketMock)
  repository.loadCustomDecks.mockResolvedValue([])
  repository.loadHistory.mockResolvedValue([])
  repository.loadPreferences.mockResolvedValue(null)
  repository.loadSession.mockResolvedValue(null)
})

describe('application workflows', () => {
  it('loads the local data and presents every home entry point', async () => {
    await renderReadyApp()
    expect(repository.loadSession).toHaveBeenCalledOnce()
    expect(repository.loadCustomDecks).toHaveBeenCalledOnce()
    expect(repository.loadHistory).toHaveBeenCalledOnce()
    expect(repository.loadPreferences).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Personalizar partida' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Baralhos/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Histórico/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Como jogar/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Definições/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Jogar com vários telemóveis/ })).toBeTruthy()
  })

  it('opens multiplayer without changing the local quick-game entry point', async () => {
    await renderReadyApp()
    expect(screen.getByRole('button', { name: 'Partida rápida' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Jogar com vários telemóveis/ }))
    expect(screen.getByRole('heading', { name: /Jogar com vários telemóveis/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar numa sala' })).toBeTruthy()
  })

  it('completes quick setup and creates the first playable round', async () => {
    await renderReadyApp()
    fireEvent.click(screen.getByRole('button', { name: 'Partida rápida' }))
    expect(screen.getByText(/Quantas equipas/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Equipas' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nome da equipa 1'), { target: { value: 'Maputo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo' }))
    expect(screen.getByText(/3 equipas/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    expect(screen.getByRole('heading', { name: /Vez da equipa Maputo/ })).toBeTruthy()
    expect(screen.getByText('Maputo')).toBeTruthy()
  })

  it('supports the personalized path and persists changed preferences', async () => {
    await renderReadyApp()
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar partida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Configurar regras' }))
    fireEvent.change(screen.getByLabelText('Vitória'), { target: { value: 'rounds' } })
    fireEvent.change(screen.getByLabelText('Tempo'), { target: { value: '45' } })
    expect(screen.getByLabelText('Rondas por equipa')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Configurar equipas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Escolher baralhos' }))
    expect(screen.getByText(/seleccionados/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo' }))
    expect(screen.getByText('45s')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    await waitFor(() => expect(repository.savePreferences).toHaveBeenCalled())
  })

  it('saves incomplete custom content as a non-playable draft', async () => {
    await renderReadyApp()
    fireEvent.click(screen.getByRole('button', { name: /Baralhos/ }))
    fireEvent.click(screen.getByRole('button', { name: /Criar baralho/ }))
    fireEvent.change(screen.getByLabelText('Nome do baralho'), { target: { value: 'Meu baralho' } })
    const save = screen.getByRole('button', { name: 'Guardar rascunho' })
    expect((save as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(repository.saveCustomDeck).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Meu baralho', draft: true, words: [],
    })))
    expect(await screen.findByText('Meu baralho')).toBeTruthy()
  })

  it('renders history, instructions and changes local settings', async () => {
    await renderReadyApp()
    expect(screen.getByRole('button', { name: 'Abrir tutorial' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Histórico/ }))
    expect(screen.getByText('Ainda não há partidas')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir tutorial' }))
    expect(screen.getByText('Prepara a partida')).toBeTruthy()
    expect(screen.getByText(/explica sem dizer directamente/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Vários telemóveis/ }))
    expect(screen.getByText('Cria uma sala')).toBeTruthy()
    expect(screen.getByText('O cartão é privado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    fireEvent.click(screen.getByRole('button', { name: /Definições/ }))
    const toggles = screen.getAllByRole('button').filter((button) => button.classList.contains('switch'))
    fireEvent.click(toggles[0])
    await waitFor(() => expect(repository.savePreferences).toHaveBeenCalled())
  })

  it('rejects another email and opens the administrative dashboard for the configured email', async () => {
    await renderReadyApp()
    fireEvent.click(screen.getByRole('button', { name: /Administração/ }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'outra@conta.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByRole('alert').textContent).toContain('não possui acesso')

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: `  ${ADMIN_EMAIL.toUpperCase()} ` } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeTruthy()
    expect(await screen.findByText('12')).toBeTruthy()
    expect(screen.getByText('31')).toBeTruthy()
    expect(localStorage.getItem('trinta-segundos:admin-email')).toBe(ADMIN_EMAIL)
  })

  it('redirects a persisted administrator directly to the dashboard and supports logout', async () => {
    localStorage.setItem('trinta-segundos:admin-email', ADMIN_EMAIL)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sair do painel' }))
    expect(await screen.findByRole('button', { name: 'Partida rápida' })).toBeTruthy()
    expect(localStorage.getItem('trinta-segundos:admin-email')).toBeNull()
  })
})
