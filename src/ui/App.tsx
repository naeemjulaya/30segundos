import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, ChevronLeft, CircleHelp, History, LogOut, Minus, Plus, RefreshCw, RotateCcw, Settings, ShieldCheck, Trash2, Users, Volume2, WifiOff, X } from 'lucide-react'
import {
  ADMIN_EMAIL, clearStoredAdmin, getStoredAdmin, isAdminEmail, loadAnalytics, registerVisit, storeAdmin,
} from '../analytics/analytics'
import type { AnalyticsSummary } from '../analytics/analytics'
import { decks as initialDecks } from '../decks/data'
import {
  allWordsProcessed, confirmRound, createRound, createSession, createTeams, defaultConfig,
  explainerLabel, normalizeSession, passesUsed, rematch, remainingSeconds, scoreRound,
} from '../game/domain/engine'
import type { Deck, GameConfig, GameHistoryEntry, GameSession, Team, WordStatus } from '../game/domain/types'
import {
  clearSession, deleteCustomDeck, loadCustomDecks, loadHistory, loadPreferences, loadSession,
  saveCustomDeck, saveHistoryEntry, savePreferences, saveSession,
} from '../game/infrastructure/sessionRepository'
import { generateId } from '../shared/generateId'

type Screen = 'home' | 'admin-login' | 'admin' | 'team-count' | 'composition' | 'rules' | 'teams' | 'players' | 'decks' | 'summary' | 'handoff' | 'countdown' | 'round' | 'time-up' | 'review' | 'board' | 'ranking' | 'tiebreak' | 'victory' | 'library' | 'create-deck' | 'history' | 'how-to' | 'settings'
type SetupMode = 'quick' | 'custom'

const colors: Record<Team['color'], string> = { cyan: '#2e5bff', red: '#ed4b3e', green: '#168c61', amber: '#d99a16', violet: '#6546b8', pink: '#d45482' }

function Logo({ large = false }: { large?: boolean }) { return <div className={`logo ${large ? 'logo-large' : ''}`} aria-label="Trinta Segundos"><span>TRINTA</span><b>SEGUNDOS</b><small>JOGO DE EQUIPAS</small></div> }
function PhoneScreen({ children, className = '', back, eyebrow }: { children: React.ReactNode; className?: string; back?: () => void; eyebrow?: string }) { return <main className={`phone-screen ${className}`}>{back && <button className="back" onClick={back} aria-label="Voltar"><ChevronLeft /></button>}{eyebrow && <div className="eyebrow">{eyebrow}</div>}<div className="screen-content">{children}</div></main> }
function PrimaryButton({ children, onClick, disabled = false, className = '' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) { return <button className={`primary-button ${className}`} onClick={onClick} disabled={disabled}><span>{children}</span></button> }
function Card({ children, active = false, className = '', onClick }: { children: React.ReactNode; active?: boolean; className?: string; onClick?: () => void }) { return <button type="button" className={`glass-card ${active ? 'active' : ''} ${className}`} onClick={onClick}>{children}</button> }
function TeamDot({ team, number }: { team: Team; number?: number }) { return <span className="team-dot" style={{ '--team': colors[team.color] } as React.CSSProperties}>{number ?? team.name[0]}</span> }
function FloatingDeck() { return <div className="floating-deck"><div className="ghost-card left" /><div className="ghost-card right" /><div className="hero-card"><span>CARTA</span><p>Maputo</p><p>Titanic</p><p>Mandela</p><i /></div></div> }
function Stat({ value, label }: { value: React.ReactNode; label: string }) { return <div className="stat"><strong>{value}</strong><small>{label}</small></div> }
function EqualIcon() { return <div className="equal-icon"><i /><i /><i /></div> }
function DynamicIcon() { return <div className="dynamic-icon"><i /><i /><i /></div> }
function Instruction({ number, title, text }: { number: string; title: string; text: string }) { return <Card><strong>{number}</strong><div><b>{title}</b><p>{text}</p></div></Card> }
function Timer({ value, duration }: { value: number; duration: number }) { return <div className="timer" style={{ '--timer-progress': `${value / duration * 360}deg` } as React.CSSProperties}><div>{String(Math.floor(value / 60)).padStart(2, '0')}:{String(value % 60).padStart(2, '0')}</div></div> }
function SelectField({ label, value, options, onChange }: { label: string; value: string | number; options: Array<[string | number, string]>; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, text]) => <option value={optionValue} key={optionValue}>{text}</option>)}</select></label> }
function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) { return <button type="button" className={`switch ${active ? 'on' : ''}`} onClick={onClick} aria-pressed={active}><span /></button> }

export function App() {
  const [screen, setScreen] = useState<Screen>(() => getStoredAdmin() ? 'admin' : 'home')
  const [setupMode, setSetupMode] = useState<SetupMode>('quick')
  const [session, setSession] = useState<GameSession>(() => createSession())
  const [availableDecks, setAvailableDecks] = useState<Deck[]>(initialDecks)
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [preferences, setPreferences] = useState<GameConfig>(defaultConfig())
  const [hasSaved, setHasSaved] = useState(false)
  const [ready, setReady] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [now, setNow] = useState(Date.now())
  const [deckName, setDeckName] = useState('')
  const [customWords, setCustomWords] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminError, setAdminError] = useState('')
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [analyticsError, setAnalyticsError] = useState('')
  const historySaved = useRef(new Set<string>())

  const activeTeam = session.teams[session.activeTeamIndex]
  const roundTeam = session.round ? session.teams[session.round.teamIndex] : activeTeam
  const selectedDecks = availableDecks.filter((deck) => session.config.selectedDeckIds.includes(deck.id))
  const sortedTeams = useMemo(() => [...session.teams].sort((a, b) => b.score - a.score), [session.teams])
  const recentWordIds = useMemo(() => history.slice(0, 3).flatMap((entry) => entry.usedWordIds), [history])

  useEffect(() => {
    registerVisit().catch((error) => console.error('Falha ao registar acesso:', error))
  }, [])

  const refreshAnalytics = useCallback(() => {
    setAnalyticsError('')
    loadAnalytics().then(setAnalytics).catch(() => setAnalyticsError('Não foi possível carregar os dados. Confirma se a aplicação foi iniciada com npm run dev.'))
  }, [])

  useEffect(() => {
    if (screen === 'admin') refreshAnalytics()
  }, [screen, refreshAnalytics])

  useEffect(() => {
    Promise.all([loadSession(), loadCustomDecks(), loadHistory(), loadPreferences()]).then(([saved, customDecks, savedHistory, savedPreferences]) => {
      if (customDecks.length) setAvailableDecks([...initialDecks, ...customDecks])
      setHistory(savedHistory)
      savedHistory.forEach((entry) => historySaved.current.add(entry.id))
      if (savedPreferences) setPreferences({ ...defaultConfig(), ...savedPreferences })
      if (saved) {
        const normalized = normalizeSession(saved)
        setHasSaved(normalized.status !== 'finished')
        if (normalized.status === 'playing' && normalized.round && remainingSeconds(normalized.round, normalized.config.durationSeconds) === 0) {
          setSession({ ...normalized, status: 'review', round: { ...normalized.round, words: normalized.round.words.map((word) => word.status === 'pending' ? { ...word, status: 'wrong' } : word) } })
          setScreen('review')
        }
      } else if (savedPreferences) setSession(createSession(createTeams(3), { ...defaultConfig(), ...savedPreferences }))
    }).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready || session.status === 'setup') return
    saveSession(session).then(() => setHasSaved(session.status !== 'finished')).catch(console.error)
  }, [session, ready])

  useEffect(() => {
    if (session.status !== 'finished' || !session.winnerTeamId || historySaved.current.has(session.id)) return
    const winner = session.teams.find((team) => team.id === session.winnerTeamId)
    if (!winner) return
    const entry: GameHistoryEntry = {
      id: session.id, completedAt: Date.now(), winnerName: winner.name, winnerScore: winner.score,
      roundCount: session.completedRounds.filter((round) => !round.isTiebreak).length,
      teamCount: session.teams.length, teams: session.teams.map(({ name, color, score }) => ({ name, color, score })),
      usedWordIds: session.usedWordIds,
    }
    historySaved.current.add(session.id)
    saveHistoryEntry(entry).then(() => setHistory((items) => [entry, ...items.filter((item) => item.id !== entry.id)]))
  }, [session])

  useEffect(() => {
    if (screen !== 'round' || !session.round?.startedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [screen, session.round?.startedAt])

  const timeLeft = session.round ? remainingSeconds(session.round, session.config.durationSeconds, now) : session.config.durationSeconds

  useEffect(() => {
    if (screen !== 'round' || !session.round || (timeLeft > 0 && !allWordsProcessed(session.round))) return
    const finalWords = session.round.words.map((word) => word.status === 'pending' ? { ...word, status: 'wrong' as const } : word)
    setSession((current) => ({ ...current, status: 'review', round: current.round ? { ...current.round, words: finalWords } : null, updatedAt: Date.now() }))
    feedback('end')
    setScreen('time-up')
    window.setTimeout(() => setScreen('review'), 1000)
  }, [timeLeft, screen, session.round])

  const feedback = (kind: 'tap' | 'end') => {
    if (session.config.vibrationEnabled && navigator.vibrate) navigator.vibrate(kind === 'end' ? [90, 60, 140] : 20)
    if (!session.config.soundEnabled) return
    try {
      const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Context) return
      const context = new Context(); const oscillator = context.createOscillator(); const gain = context.createGain()
      oscillator.frequency.value = kind === 'end' ? 180 : 520; gain.gain.value = .035
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (kind === 'end' ? .28 : .06))
    } catch { /* feedback is optional */ }
  }

  const updateConfig = (patch: Partial<GameConfig>) => setSession((value) => ({ ...value, config: { ...value.config, ...patch }, updatedAt: Date.now() }))
  const setTeamCount = (count: number) => setSession((value) => ({ ...value, teams: createTeams(count), updatedAt: Date.now() }))
  const updateTeam = (index: number, patch: Partial<Team>) => setSession((value) => ({
    ...value,
    teams: value.teams.map((team, teamIndex) => value.config.composition === 'balanced' && patch.playerCount !== undefined
      ? { ...team, playerCount: patch.playerCount, players: team.players.slice(0, patch.playerCount) }
      : teamIndex === index ? { ...team, ...patch } : team), updatedAt: Date.now(),
  }))

  const startSetup = (mode: SetupMode) => {
    const config = mode === 'quick' ? { ...defaultConfig(), soundEnabled: preferences.soundEnabled, vibrationEnabled: preferences.vibrationEnabled } : { ...preferences }
    setSetupMode(mode); setSession(createSession(createTeams(3), config)); setScreen('team-count')
  }

  const prepareNamedPlayers = () => setSession((value) => ({ ...value, teams: value.teams.map((team) => ({ ...team, players: Array.from({ length: team.playerCount }, (_, index) => team.players[index] ?? '') })) }))

  const beginGame = () => {
    let startingTeamIndex = Math.min(session.config.startingTeamIndex, session.teams.length - 1)
    if (session.config.randomFirstTeam) startingTeamIndex = Math.floor(Math.random() * session.teams.length)
    const prepared = { ...session, activeTeamIndex: startingTeamIndex, cycleStartTeamIndex: startingTeamIndex, config: { ...session.config, startingTeamIndex } }
    try {
      const round = createRound(prepared, availableDecks, recentWordIds)
      const next = { ...prepared, status: 'ready' as const, round, updatedAt: Date.now() }
      setSession(next); setPreferences(next.config); savePreferences(next.config); setScreen('handoff')
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível criar o cartão.') }
  }

  const beginCountdown = () => {
    setCountdown(3); setScreen('countdown'); feedback('tap')
    let value = 3
    const interval = window.setInterval(() => {
      value -= 1
      if (value <= 0) {
        window.clearInterval(interval)
        setSession((current) => ({ ...current, status: 'playing', round: current.round ? { ...current.round, startedAt: Date.now() } : null, updatedAt: Date.now() }))
        setNow(Date.now()); setScreen('round')
      } else { setCountdown(value); feedback('tap') }
    }, 1000)
  }

  const skipExplainer = () => setSession((current) => ({
    ...current,
    teams: current.teams.map((team, index) => {
      if (index !== current.activeTeamIndex) return team
      const size = current.config.registerPlayerNames && team.players.length ? team.players.length : team.playerCount
      return { ...team, nextExplainerIndex: (team.nextExplainerIndex + 1) % Math.max(1, size) }
    }),
    updatedAt: Date.now(),
  }))

  const setWordStatus = useCallback((id: string, status: WordStatus) => {
    setSession((current) => ({ ...current, round: current.round ? { ...current.round, words: current.round.words.map((word) => word.id === id ? { ...word, status: word.status === status ? 'pending' : status } : word) } : null, updatedAt: Date.now() }))
    feedback('tap')
  }, [session.config.soundEnabled, session.config.vibrationEnabled])

  const passSpecificWord = (id: string) => {
    if (!session.round) return
    const word = session.round.words.find((item) => item.id === id)
    if (!word || (word.status !== 'passed' && session.config.passLimit < 99 && passesUsed(session.round) >= session.config.passLimit)) return
    setWordStatus(id, 'passed')
  }

  const finishReview = () => {
    const next = confirmRound(session); setSession(next)
    setScreen(next.status === 'finished' ? 'victory' : next.status === 'tiebreak' ? 'tiebreak' : 'board')
  }

  const prepareNextRound = () => {
    try {
      const round = createRound({ ...session, round: null }, availableDecks, recentWordIds)
      setSession((current) => ({ ...current, status: 'ready', round, updatedAt: Date.now() })); setScreen('handoff')
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível criar o cartão.') }
  }

  const resumeSaved = async () => {
    const saved = await loadSession(); if (!saved) return
    const normalized = normalizeSession(saved); setSession(normalized)
    const destination: Screen = normalized.status === 'finished' ? 'victory' : normalized.status === 'tiebreak' ? 'tiebreak' : normalized.status === 'review' ? 'review' : normalized.status === 'playing' ? 'round' : normalized.status === 'between-rounds' ? 'ranking' : normalized.status === 'ready' ? 'handoff' : 'summary'
    setScreen(destination)
  }

  const abandonSaved = async () => { await clearSession(); setHasSaved(false); setSession(createSession(createTeams(3), preferences)) }

  const enterAdmin = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAdminEmail(adminEmail) || !storeAdmin(adminEmail)) {
      setAdminError('Este e-mail não possui acesso administrativo.')
      return
    }
    setAdminError(''); setAdminEmail(''); setScreen('admin')
  }

  const leaveAdmin = () => { clearStoredAdmin(); setAnalytics(null); setScreen('home') }

  const openNewDeck = () => { setEditingDeckId(null); setDeckName(''); setCustomWords([]); setCustomInput(''); setScreen('create-deck') }
  const editDeck = (deck: Deck) => { setEditingDeckId(deck.id); setDeckName(deck.name); setCustomWords(deck.words.map((word) => typeof word === 'string' ? word : word.text)); setCustomInput(''); setScreen('create-deck') }
  const persistDeck = async () => {
    if (!deckName.trim()) return
    const deck: Deck = { id: editingDeckId ?? generateId(), name: deckName.trim(), icon: '✦', wordCount: customWords.length, availableOffline: true, selected: false, custom: true, draft: customWords.length < 20, words: customWords }
    await saveCustomDeck(deck)
    setAvailableDecks((items) => [...items.filter((item) => item.id !== deck.id), deck])
    if (deck.draft) updateConfig({ selectedDeckIds: session.config.selectedDeckIds.filter((id) => id !== deck.id) })
    setScreen('library')
  }
  const removeDeck = async (id: string) => { await deleteCustomDeck(id); setAvailableDecks((items) => items.filter((item) => item.id !== id)); updateConfig({ selectedDeckIds: session.config.selectedDeckIds.filter((deckId) => deckId !== id) }) }

  const bestRound = session.completedRounds.filter((round) => !round.isTiebreak).reduce((best, round) => Math.max(best, round.score), 0)
  const hardestMiss = session.completedRounds.flatMap((round) => round.words).find((word) => word.difficulty === 'hard' && word.status !== 'correct')

  if (!ready) return <PhoneScreen className="loading"><Logo large /><p>A preparar o baralho…</p></PhoneScreen>

  if (screen === 'admin-login') return <PhoneScreen className="admin-login-screen" back={() => setScreen('home')} eyebrow="Acesso reservado"><div className="admin-login"><ShieldCheck /><h1>Painel<br />administrativo</h1><p className="intro">Nesta versão MVP, apenas o e-mail administrativo configurado pode abrir o painel.</p><form onSubmit={enterAdmin}><label className="text-field"><span>E-mail</span><input type="email" autoComplete="email" value={adminEmail} placeholder="nome@exemplo.com" onChange={(event) => { setAdminEmail(event.target.value); setAdminError('') }} /></label>{adminError && <p className="form-error" role="alert">{adminError}</p>}<PrimaryButton disabled={!adminEmail.trim()}>Entrar</PrimaryButton></form></div></PhoneScreen>

  if (screen === 'admin') return <PhoneScreen className="admin-screen" eyebrow="Administração MVP"><div className="admin-header"><div><small>Sessão administrativa</small><h1>Painel</h1><p>{ADMIN_EMAIL}</p></div><button onClick={leaveAdmin} aria-label="Sair do painel"><LogOut /></button></div><div className="admin-stats"><div className="stat"><Users /><strong>{analytics?.uniqueVisitors ?? '—'}</strong><small>Visitantes únicos</small></div><div className="stat"><History /><strong>{analytics?.totalVisits ?? '—'}</strong><small>Acessos registados</small></div></div><div className="admin-note glass-card"><ShieldCheck /><div><b>Métrica do MVP</b><p>Cada navegador recebe um identificador anónimo. Como os jogadores não iniciam sessão, este valor representa dispositivos, não contas verificadas.</p></div></div>{analytics?.lastVisit && <p className="last-visit">Último acesso: {new Date(analytics.lastVisit).toLocaleString('pt-PT')}</p>}{analyticsError && <p className="form-error" role="alert">{analyticsError}</p>}<button className="secondary-button refresh-admin" onClick={refreshAnalytics}><RefreshCw /> Actualizar dados</button></PhoneScreen>

  if (screen === 'home') return <PhoneScreen className="home-screen"><div className="home-hero"><Logo /><FloatingDeck /></div><div className="bottom-stack"><PrimaryButton onClick={() => startSetup('quick')}>Partida rápida</PrimaryButton><button className="secondary-cta" onClick={() => startSetup('custom')}>Personalizar partida</button>{hasSaved && <div className="saved-game glass-card"><button onClick={resumeSaved}><span>Continuar partida</span><b>{session.teams[0]?.name ?? 'Equipa'} · sessão guardada</b></button><button onClick={abandonSaved} aria-label="Abandonar partida"><Trash2 /></button></div>}<nav className="home-nav"><button onClick={() => setScreen('library')}><BookOpen />Baralhos</button><button onClick={() => setScreen('history')}><History />Histórico</button><button onClick={() => setScreen('how-to')}><CircleHelp />Como jogar</button><button onClick={() => setScreen('settings')}><Settings />Definições</button></nav><button className="admin-entry" onClick={() => setScreen('admin-login')}><ShieldCheck /> Administração</button></div></PhoneScreen>

  if (screen === 'team-count') return <PhoneScreen back={() => setScreen('home')} eyebrow={`${setupMode === 'quick' ? 'Partida rápida' : 'Partida personalizada'} · Equipas`}><h1>Quantas equipas<br />vão jogar?</h1><div className="stepper"><button onClick={() => setTeamCount(session.teams.length - 1)}><Minus /></button><strong>{session.teams.length}</strong><button onClick={() => setTeamCount(session.teams.length + 1)}><Plus /></button></div><div className="team-lights">{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < session.teams.length ? 'on' : ''} style={{ '--team': colors[session.teams[i]?.color ?? 'cyan'] } as React.CSSProperties} />)}</div>{setupMode === 'quick' && <><p className="section-label">Como distribuir os jogadores?</p><div className="two-cards compact"><Card active={session.config.composition === 'balanced'} onClick={() => updateConfig({ composition: 'balanced' })}><EqualIcon /><b>Iguais</b></Card><Card active={session.config.composition === 'dynamic'} onClick={() => updateConfig({ composition: 'dynamic' })}><DynamicIcon /><b>Livre</b></Card></div></>}<PrimaryButton onClick={() => setScreen(setupMode === 'custom' ? 'composition' : 'teams')}>Continuar</PrimaryButton></PhoneScreen>

  if (screen === 'composition') return <PhoneScreen back={() => setScreen('team-count')} eyebrow="Personalizada · Composição"><h1>Composição<br />das equipas</h1><p className="intro">Escolha blocos iguais ou quantidades livres. Cada equipa mantém a sua própria rotação.</p><div className="choice-stack"><Card active={session.config.composition === 'balanced'} onClick={() => updateConfig({ composition: 'balanced' })}><div><b>Equilibrada</b><small>Mesmo número de jogadores em todas as equipas</small></div><EqualIcon /></Card><Card active={session.config.composition === 'dynamic'} onClick={() => updateConfig({ composition: 'dynamic' })}><div><b>Dinâmica</b><small>Cada equipa pode ter uma quantidade diferente</small></div><DynamicIcon /></Card></div><PrimaryButton onClick={() => setScreen('rules')}>Configurar regras</PrimaryButton></PhoneScreen>

  if (screen === 'rules') return <PhoneScreen className="rules-screen" back={() => setScreen('composition')} eyebrow="Regras da Casa"><h1>Como querem<br />jogar?</h1><div className="rules-grid"><SelectField label="Vitória" value={session.config.victoryMode} options={[["points", 'Corrida por pontos'], ["rounds", 'Número fixo de rondas']]} onChange={(value) => updateConfig({ victoryMode: value as GameConfig['victoryMode'] })} />{session.config.victoryMode === 'points' ? <SelectField label="Meta" value={session.config.targetScore} options={[[20, '20 pontos'], [30, '30 pontos'], [40, '40 pontos'], [50, '50 pontos']]} onChange={(value) => updateConfig({ targetScore: Number(value) })} /> : <SelectField label="Rondas por equipa" value={session.config.roundLimit} options={[[3, '3 rondas'], [5, '5 rondas'], [7, '7 rondas'], [10, '10 rondas']]} onChange={(value) => updateConfig({ roundLimit: Number(value) })} />}<SelectField label="Tempo" value={session.config.durationSeconds} options={[[20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '60 segundos']]} onChange={(value) => updateConfig({ durationSeconds: Number(value) })} /><SelectField label="Palavras" value={session.config.wordsPerCard} options={[[4, '4 palavras'], [5, '5 palavras'], [6, '6 palavras'], [7, '7 palavras']]} onChange={(value) => updateConfig({ wordsPerCard: Number(value) })} /><SelectField label="Passes" value={session.config.passLimit} options={[[0, 'Sem passes'], [1, '1 passe'], [2, '2 passes'], [3, '3 passes'], [99, 'Ilimitados']]} onChange={(value) => updateConfig({ passLimit: Number(value) })} /><SelectField label="Dificuldade" value={session.config.difficulty} options={[["mixed", 'Mista'], ["easy", 'Fácil'], ["normal", 'Normal'], ["hard", 'Difícil']]} onChange={(value) => updateConfig({ difficulty: value as GameConfig['difficulty'] })} />{!session.config.randomFirstTeam && <SelectField label="Primeira equipa" value={session.config.startingTeamIndex} options={session.teams.map((team, index) => [index, team.name])} onChange={(value) => updateConfig({ startingTeamIndex: Number(value) })} />}</div><div className="toggle-list"><label><span><b>Registar nomes</b><small>Rotação nominal dos explicadores</small></span><Toggle active={session.config.registerPlayerNames} onClick={() => updateConfig({ registerPlayerNames: !session.config.registerPlayerNames })} /></label><label><span><b>Rotação automática</b><small>Distribui a vez entre os jogadores</small></span><Toggle active={session.config.automaticRotation} onClick={() => updateConfig({ automaticRotation: !session.config.automaticRotation })} /></label><label><span><b>Penalizar passe</b><small>−1 por palavra passada, mínimo zero</small></span><Toggle active={session.config.passPenalty} onClick={() => updateConfig({ passPenalty: !session.config.passPenalty })} /></label><label><span><b>Primeira equipa aleatória</b><small>Sorteada ao começar</small></span><Toggle active={session.config.randomFirstTeam} onClick={() => updateConfig({ randomFirstTeam: !session.config.randomFirstTeam })} /></label></div><PrimaryButton onClick={() => setScreen('teams')}>Configurar equipas</PrimaryButton></PhoneScreen>

  if (screen === 'teams') return <PhoneScreen className="teams-screen" back={() => setScreen(setupMode === 'custom' ? 'rules' : 'team-count')} eyebrow="Configuração · Equipas"><div className="title-row"><h1>Equipas</h1><span>{session.config.composition === 'balanced' ? `${session.teams[0].playerCount} por equipa` : `${session.teams.reduce((sum, team) => sum + team.playerCount, 0)} jogadores`}</span></div><div className="teams-list">{session.teams.map((team, index) => <div className="team-card" key={team.id} style={{ '--team': colors[team.color] } as React.CSSProperties}><TeamDot team={team} number={index + 1} /><div className="team-details"><input value={team.name} aria-label={`Nome da equipa ${index + 1}`} onChange={(event) => updateTeam(index, { name: event.target.value })} /><small>Equipa {index + 1}</small></div><div className="mini-stepper"><button onClick={() => updateTeam(index, { playerCount: Math.max(1, team.playerCount - 1) })}><Minus /></button><b>{team.playerCount}</b><button onClick={() => updateTeam(index, { playerCount: Math.min(12, team.playerCount + 1) })}><Plus /></button></div></div>)}</div><PrimaryButton disabled={session.teams.some((team) => !team.name.trim())} onClick={() => { if (setupMode === 'quick') setScreen('summary'); else if (session.config.registerPlayerNames) { prepareNamedPlayers(); setScreen('players') } else setScreen('decks') }}>{setupMode === 'quick' ? 'Ver resumo' : session.config.registerPlayerNames ? 'Adicionar jogadores' : 'Escolher baralhos'}</PrimaryButton></PhoneScreen>

  if (screen === 'players') { const allNamed = session.teams.every((team) => team.players.length === team.playerCount && team.players.every((name) => name.trim())); return <PhoneScreen className="players-screen" back={() => setScreen('teams')} eyebrow="Participantes"><h1>Quem vai<br />jogar?</h1><div className="players-groups">{session.teams.map((team, teamIndex) => <section key={team.id}><header><TeamDot team={team} /><b>Equipa {team.name}</b></header>{Array.from({ length: team.playerCount }, (_, playerIndex) => <input key={playerIndex} value={team.players[playerIndex] ?? ''} placeholder={`Jogador ${playerIndex + 1}`} onChange={(event) => updateTeam(teamIndex, { players: Array.from({ length: team.playerCount }, (_, index) => index === playerIndex ? event.target.value : team.players[index] ?? '') })} />)}</section>)}</div><PrimaryButton disabled={!allNamed} onClick={() => setScreen('decks')}>Escolher baralhos</PrimaryButton></PhoneScreen> }

  if (screen === 'decks') return <PhoneScreen className="decks-screen" back={() => setScreen(session.config.registerPlayerNames ? 'players' : 'teams')} eyebrow="Conteúdo offline"><h1>Baralhos em<br />jogo</h1><p className="intro">{selectedDecks.length} seleccionados · {selectedDecks.reduce((sum, deck) => sum + deck.words.length, 0)} palavras reais no dispositivo</p><div className="deck-grid">{availableDecks.filter((deck) => !deck.draft).map((deck) => <Card key={deck.id} active={session.config.selectedDeckIds.includes(deck.id)} onClick={() => updateConfig({ selectedDeckIds: session.config.selectedDeckIds.includes(deck.id) ? session.config.selectedDeckIds.filter((id) => id !== deck.id) : [...session.config.selectedDeckIds, deck.id] })}><span className="deck-icon">{deck.icon}</span><b>{deck.name}</b><small>{deck.words.length} palavras <em>· offline</em></small></Card>)}</div><PrimaryButton disabled={!selectedDecks.length || selectedDecks.reduce((sum, deck) => sum + deck.words.length, 0) < session.config.wordsPerCard} onClick={() => setScreen('summary')}>Ver resumo</PrimaryButton></PhoneScreen>

  if (screen === 'summary') return <PhoneScreen className="summary-screen" back={() => setScreen(setupMode === 'quick' ? 'teams' : 'decks')} eyebrow="Tudo pronto"><h1>{session.teams.length} equipas.<br />{session.config.victoryMode === 'points' ? `Primeira a ${session.config.targetScore} ganha.` : `${session.config.roundLimit} rondas para cada.`}</h1><div className="stats-grid"><Stat value={`${session.config.durationSeconds}s`} label="Por ronda" /><Stat value={session.config.wordsPerCard} label="Palavras" /><Stat value={session.config.passLimit >= 99 ? '∞' : session.config.passLimit} label="Passes" /><Stat value={session.config.victoryMode === 'points' ? session.config.targetScore : session.config.roundLimit} label={session.config.victoryMode === 'points' ? 'Meta' : 'Rondas'} /></div><Card className="order-card"><small>Ordem</small><div>{session.teams.map((team, index) => <span key={team.id}><TeamDot team={team} number={index + 1} />{team.name}{index < session.teams.length - 1 && ' ›'}</span>)}</div></Card><Card className="decks-summary">Baralhos: {selectedDecks.map((deck) => deck.name).join(' + ')} <em>offline</em></Card><PrimaryButton onClick={beginGame}>Começar</PrimaryButton></PhoneScreen>

  if (screen === 'handoff') return <PhoneScreen className="handoff-screen" eyebrow={`${session.round?.isTiebreak ? 'Desempate' : `Ronda ${session.round?.number ?? 1}`} · ${session.config.victoryMode === 'points' ? `meta ${session.config.targetScore}` : `${session.config.roundLimit} rondas`}`}><div className="handoff"><div className="solo-card"><i style={{ '--team': colors[activeTeam.color] } as React.CSSProperties} /></div><h1>Vez da<br />equipa <span style={{ color: colors[activeTeam.color] }}>{activeTeam.name}</span></h1><Card><TeamDot team={activeTeam} /><div><b>{explainerLabel(activeTeam, session.config)}</b><small>Passem o telemóvel sem mostrar o cartão.</small></div></Card>{session.config.automaticRotation && <button className="text-action" onClick={skipExplainer}>Saltar explicador</button>}{session.round?.reusedWords && <p className="warning">O conteúdo foi esgotado. Algumas palavras poderão repetir-se.</p>}</div><PrimaryButton onClick={beginCountdown}>Estou pronto</PrimaryButton></PhoneScreen>

  if (screen === 'countdown') return <PhoneScreen className="countdown-screen"><div className="countdown"><span>Prepara</span><strong key={countdown}>{countdown}</strong><small>O cartão aparece depois da contagem</small></div></PhoneScreen>

  if (screen === 'round' && session.round) return <PhoneScreen className={`round-screen ${timeLeft <= 5 ? 'urgent' : ''}`}><Timer value={timeLeft} duration={session.config.durationSeconds} /><p className="round-owner">{explainerLabel(roundTeam, session.config)} · Equipa {roundTeam.name}</p><div className="word-card">{session.round.words.map((word) => <div key={word.id} className={`word-row ${word.status}`}><button className="word-answer" onClick={() => setWordStatus(word.id, 'correct')}><span>{word.text}</span>{word.status === 'correct' && <Check />}{word.status === 'wrong' && <X />}</button>{session.config.passLimit > 0 && <button className="word-pass" aria-label={`Passar ${word.text}`} onClick={() => passSpecificWord(word.id)} disabled={word.status !== 'passed' && session.config.passLimit < 99 && passesUsed(session.round!) >= session.config.passLimit}>{word.status === 'passed' ? '↶' : '↷'}</button>}</div>)}</div><div className="round-stats"><div><strong>{scoreRound(session.round, session.config)}</strong><small>Acertos líquidos</small></div><div><small>Passes</small><strong>{passesUsed(session.round)}/{session.config.passLimit >= 99 ? '∞' : session.config.passLimit}</strong></div></div></PhoneScreen>

  if (screen === 'time-up') return <PhoneScreen className="time-up"><div><h1>Tempo!</h1><p>A preparar revisão</p></div><small>A ronda terminou</small></PhoneScreen>

  if (screen === 'review' && session.round) return <PhoneScreen className="review-screen" eyebrow={`${session.round.isTiebreak ? 'Desempate' : `Ronda ${session.round.number}`} · Equipa ${roundTeam.name}`}><h1>Confirma<br />a ronda</h1><p className="section-label">Tocar para corrigir</p><div className="review-list">{session.round.words.map((word) => <div key={word.id}><span>{word.text}</span><div><button className={word.status === 'correct' ? 'selected correct' : ''} onClick={() => setWordStatus(word.id, 'correct')}><Check /></button><button disabled={word.status !== 'passed' && session.config.passLimit < 99 && passesUsed(session.round!) >= session.config.passLimit} className={word.status === 'passed' ? 'selected passed' : ''} onClick={() => passSpecificWord(word.id)}>↷</button><button className={word.status === 'wrong' || word.status === 'pending' ? 'selected wrong' : ''} onClick={() => setWordStatus(word.id, 'wrong')}><X /></button></div></div>)}</div><div className="review-score"><span>{session.config.passPenalty ? 'Acertos − passes' : 'Ronda'}</span><strong>+{scoreRound(session.round, session.config)}</strong></div><PrimaryButton onClick={finishReview}>Confirmar +{scoreRound(session.round, session.config)}</PrimaryButton></PhoneScreen>

  if (screen === 'board') return <PhoneScreen className="board-screen" eyebrow={session.config.victoryMode === 'points' ? `Pista · meta ${session.config.targetScore}` : `Progresso · ${session.config.roundLimit} rondas`}><div className="board-head"><span>ronda {session.roundNumber}</span><b>{session.config.victoryMode === 'points' ? session.config.targetScore : session.config.roundLimit}<small>{session.config.victoryMode === 'points' ? 'meta' : 'rondas'}</small></b></div><div className="race-track"><div className="track-line" /><div className="track-meta">{session.config.victoryMode === 'points' ? `Meta ${session.config.targetScore}` : 'Classificação'}</div>{session.teams.map((team, index) => <div className="racer" key={team.id} style={{ '--team': colors[team.color], '--progress': `${Math.max(6, team.score / Math.max(1, session.config.targetScore) * 80)}%`, '--lane': index } as React.CSSProperties}><TeamDot team={team} /><span>{team.name}<b>{team.score}</b></span></div>)}</div><PrimaryButton onClick={() => setScreen('ranking')}>Ver classificação</PrimaryButton></PhoneScreen>

  if (screen === 'ranking') return <PhoneScreen className="ranking-screen" eyebrow={`Classificação · ronda ${session.roundNumber}`}><h1>Quem manda</h1><div className="ranking-list">{sortedTeams.map((team, index) => <div className={index === 0 ? 'leader' : ''} key={team.id}><strong>0{index + 1}</strong><TeamDot team={team} /><span><b>Equipa {team.name}</b><small>{session.config.victoryMode === 'points' ? `${Math.max(0, session.config.targetScore - team.score)} para a meta` : `${team.score} pontos`}</small></span><em>{team.score}</em></div>)}</div><Card className="best-round"><span>Melhor ronda</span><b>{bestRound}/{session.config.wordsPerCard}</b></Card><PrimaryButton onClick={prepareNextRound}>Próxima ronda</PrimaryButton></PhoneScreen>

  if (screen === 'tiebreak' && session.tiebreak) { const duelTeams = session.tiebreak.teamIds.map((id) => session.teams.find((team) => team.id === id)!).filter(Boolean); const next = duelTeams[session.tiebreak.currentIndex]; return <PhoneScreen className="tiebreak-screen" eyebrow={`Desempate · tentativa ${session.tiebreak.attempt}`}><h1>Está tudo<br />empatado</h1><div className="duel">{duelTeams.map((team, index) => <span key={team.id}><TeamDot team={team} /><small>{session.tiebreak!.scores[team.id] ?? '—'}</small>{index < duelTeams.length - 1 && <b>VS</b>}</span>)}</div><p className="intro centered">Cada equipa empatada joga uma ronda. Estes pontos não alteram a classificação principal.</p><Card className="next-duelist"><TeamDot team={next} /><div><small>Próxima equipa</small><b>{next.name}</b></div></Card><PrimaryButton onClick={prepareNextRound}>Começar ronda extra</PrimaryButton></PhoneScreen> }

  if (screen === 'victory') { const winner = session.teams.find((team) => team.id === session.winnerTeamId) ?? sortedTeams[0]; return <PhoneScreen className="victory-screen" eyebrow="Fim da partida"><div className="victory"><div className="winner-orb" style={{ '--team': colors[winner.color] } as React.CSSProperties}><TeamDot team={winner} /></div><h1>Equipa {winner.name}<br /><span>venceu</span></h1><p>{winner.score} pontos</p></div><div className="final-ranking">{sortedTeams.map((team) => <div key={team.id}><TeamDot team={team} /><b>{team.name}</b><strong>{team.score}</strong></div>)}</div><div className="victory-stats"><Stat value={`${bestRound}/${session.config.wordsPerCard}`} label="Melhor ronda" /><Stat value={hardestMiss?.text ?? '—'} label="Desafio difícil" /><Stat value={session.completedRounds.filter((round) => !round.isTiebreak).length} label="Rondas" /><Stat value={session.usedWordIds.length} label="Palavras vistas" /></div><PrimaryButton onClick={() => { setSession(rematch(session)); setSetupMode('quick'); setScreen('summary') }}><RotateCcw /> Revanche</PrimaryButton><button className="secondary-button" onClick={() => startSetup('custom')}>Nova partida</button></PhoneScreen> }

  if (screen === 'library') return <PhoneScreen className="library-screen" back={() => setScreen('home')}><h1>Baralhos</h1><p className="intro">Todos os {availableDecks.length} baralhos estão guardados neste dispositivo.</p><div className="library-list">{availableDecks.map((deck) => <div className="library-item glass-card" key={deck.id}><span className="deck-icon">{deck.icon}</span><button onClick={() => deck.custom && editDeck(deck)}><b>{deck.name}</b><small>{deck.words.length} palavras · offline</small></button><em className={deck.draft ? 'draft' : ''}>{deck.draft ? 'rascunho' : 'pronto'}</em>{deck.custom && <button className="delete-deck" onClick={() => removeDeck(deck.id)} aria-label={`Eliminar ${deck.name}`}><Trash2 /></button>}</div>)}</div><PrimaryButton onClick={openNewDeck}>Criar baralho</PrimaryButton></PhoneScreen>

  if (screen === 'create-deck') return <PhoneScreen className="create-deck-screen" back={() => setScreen('library')} eyebrow="Baralho personalizado"><h1>{editingDeckId ? 'Editar' : 'Novo'}<br />baralho</h1><label className="text-field"><span>Nome do baralho</span><input value={deckName} placeholder="Ex.: Turma de 2026" onChange={(event) => setDeckName(event.target.value)} /></label><div className="custom-progress"><span>{customWords.length}/20</span><i style={{ width: `${Math.min(100, customWords.length / 20 * 100)}%` }} /></div><form className="word-input" onSubmit={(event) => { event.preventDefault(); const value = customInput.trim(); if (value && !customWords.some((word) => word.toLocaleLowerCase() === value.toLocaleLowerCase())) { setCustomWords((words) => [...words, value]); setCustomInput('') } }}><input placeholder="Escrever uma palavra…" value={customInput} onChange={(event) => setCustomInput(event.target.value)} /><button aria-label="Adicionar palavra"><Plus /></button></form><div className="word-chips">{customWords.map((word) => <button key={word} onClick={() => setCustomWords((words) => words.filter((item) => item !== word))}>{word}<X /></button>)}</div><p className="tip">Com menos de 20 palavras será guardado como rascunho. Ao chegar a 20, fica disponível para partidas.</p><PrimaryButton disabled={!deckName.trim()} onClick={persistDeck}>{customWords.length < 20 ? 'Guardar rascunho' : 'Guardar baralho'}</PrimaryButton></PhoneScreen>

  if (screen === 'history') return <PhoneScreen className="history-screen" back={() => setScreen('home')}><h1>Histórico</h1>{history.length === 0 ? <div className="empty-state"><History /><b>Ainda não há partidas</b><p>As partidas concluídas aparecerão aqui.</p></div> : <div className="history-list">{history.map((entry) => <Card key={entry.id}><div><small>{new Date(entry.completedAt).toLocaleDateString('pt-PT')} · {entry.roundCount} rondas</small><b>Equipa {entry.winnerName}</b><span>{entry.winnerScore} pontos · {entry.teamCount} equipas</span></div><strong>{entry.teams.map((team) => `${team.name} ${team.score}`).join(' · ')}</strong></Card>)}</div>}</PhoneScreen>

  if (screen === 'how-to') return <PhoneScreen back={() => setScreen('home')}><h1>Como<br />jogar</h1><div className="instruction-list"><Instruction number="01" title="Forma equipas" text="Escolhe pelo menos duas equipas e os baralhos." /><Instruction number="02" title="Explica" text="Explica as palavras sem dizer a resposta. Usa o passe específico quando necessário." /><Instruction number="03" title="Confirma" text="Revê os acertos com o grupo antes de somar os pontos." /><Instruction number="04" title="Chega à meta" text="Completem o ciclo de turnos; em empate, as finalistas jogam rondas extras." /></div></PhoneScreen>

  return <PhoneScreen className="settings-screen" back={() => setScreen('home')}><h1>Definições</h1><div className="settings-list"><div className="glass-card"><Volume2 /><div><b>Som</b><small>Feedback curto nas acções e no fim</small></div><Toggle active={preferences.soundEnabled} onClick={() => { const next = { ...preferences, soundEnabled: !preferences.soundEnabled }; setPreferences(next); setSession((value) => ({ ...value, config: { ...value.config, soundEnabled: next.soundEnabled } })); savePreferences(next) }} /></div><div className="glass-card"><span className="vibration">≈</span><div><b>Vibração</b><small>Pulsos curtos quando suportados</small></div><Toggle active={preferences.vibrationEnabled} onClick={() => { const next = { ...preferences, vibrationEnabled: !preferences.vibrationEnabled }; setPreferences(next); setSession((value) => ({ ...value, config: { ...value.config, vibrationEnabled: next.vibrationEnabled } })); savePreferences(next) }} /></div><div className="glass-card"><WifiOff /><div><b>Modo offline</b><small>Aplicação e baralhos base disponíveis</small></div><em>pronto</em></div></div></PhoneScreen>
}
