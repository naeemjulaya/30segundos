import { useEffect, useRef, useState } from 'react'
import { Check, Copy, LogOut, RefreshCw, Share2, ShieldCheck, Shuffle, Users, Wifi, WifiOff, X } from 'lucide-react'
import type { DuelVariant, RoomMode, RoomSnapshot, ServerMessage } from '../multiplayer/types'
import { clearRoomCredentials, loadRoomCredentials, WebSocketTransport } from '../multiplayer/transport'
import { applyRoomUpdate } from '../multiplayer/stateSync'
import { backendUrl } from '../shared/backend'

const colors = ['#2e5bff', '#ed4b3e', '#168c61', '#d99a16', '#6546b8', '#d45482']

function Action({ children, onClick, disabled = false, secondary = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean }) {
  return <button className={secondary ? 'secondary-button' : 'primary-button'} onClick={onClick} disabled={disabled}>{children}</button>
}

export function MultiplayerApp({ initialCode = '', onExit }: { initialCode?: string; onExit: () => void }) {
  const transport = useRef(new WebSocketTransport())
  const [step, setStep] = useState<'CHOICE' | 'CREATE' | 'JOIN'>(initialCode ? 'JOIN' : 'CHOICE')
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialCode)
  const [mode, setMode] = useState<RoomMode>('TEAMS')
  const [duelVariant, setDuelVariant] = useState<DuelVariant>('ALTERNATING')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [playerId, setPlayerId] = useState(loadRoomCredentials()?.playerId ?? '')
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const version = useRef(0)
  const roomRef = useRef<RoomSnapshot | null>(null)
  const clockOffset = useRef(0)

  useEffect(() => {
    const current = transport.current
    const unsubscribe = current.subscribe((message: ServerMessage) => {
      if (message.type === 'ERROR') setError(message.message)
      if (message.type === 'ROOM_STATE' || message.type === 'ROOM_PATCH') {
        const update = applyRoomUpdate(roomRef.current, version.current, clockOffset.current, message)
        if (update.needsSync) { current.send({ type: 'SYNC_STATE' }); return }
        version.current = update.version; clockOffset.current = update.clockOffsetMs; roomRef.current = update.snapshot; setRoom(update.snapshot)
        if (message.type === 'ROOM_STATE') { setPlayerId(message.credentials?.playerId ?? loadRoomCredentials()?.playerId ?? ''); setError('') }
      }
    })
    current.connect()
    return () => { unsubscribe(); current.close() }
  }, [])

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])

  const me = room?.players.find(player => player.id === playerId)
  const isHost = room?.hostId === playerId
  const explainer = room?.players.find(player => player.id === room.explainerId)
  const activeTeam = room?.game ? room.game.teams[room.game.activeTeamIndex] : null
  const remaining = room?.roundEndsAt ? Math.max(0, Math.ceil((room.roundEndsAt - (now + clockOffset.current)) / 1000)) : room?.game?.config.durationSeconds ?? 30
  const joinLink = room ? `${location.origin}/join/${room.code}` : ''
  const unresolved = room?.review ? Object.values(room.review.disputes).filter(dispute => !dispute.resolvedStatus) : []
  const requiredReady = room?.players.filter(player => player.presence === 'CONNECTED').every(player => player.ready) ?? false

  const send = (command: Parameters<WebSocketTransport['send']>[0]) => transport.current.send(command)
  const leave = () => { send({ type: 'ROOM_LEAVE' }); clearRoomCredentials(); window.setTimeout(() => { transport.current.close(); onExit() }, 50) }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `Sala ${room?.code}`, text: 'Entra na minha sala de Trinta Segundos', url: joinLink }); return } catch { /* fallback */ } }
    await copyText(joinLink)
  }

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
    else { const input = document.createElement('textarea'); input.value = value; document.body.append(input); input.select(); document.execCommand('copy'); input.remove() }
    setError('Copiado.')
  }

  if (!room) return <main className="phone-screen multiplayer-entry"><button className="back" onClick={onExit} aria-label="Voltar">‹</button><div className="screen-content"><div className="multiplayer-mark"><Wifi /><span>Multiplayer</span></div><h1>Jogar com<br />vários telemóveis</h1>{step === 'CHOICE' && <div className="multiplayer-actions"><Action onClick={() => setStep('CREATE')}>Criar sala</Action><Action secondary onClick={() => setStep('JOIN')}>Entrar numa sala</Action></div>}{step !== 'CHOICE' && <div className="multiplayer-form"><label className="text-field"><span>O teu nome</span><input value={name} maxLength={30} onChange={event => setName(event.target.value)} /></label>{step === 'JOIN' && <label className="text-field"><span>Código da sala</span><input value={code} maxLength={4} autoCapitalize="characters" onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>}{step === 'CREATE' && <><div className="mode-choice"><button className={mode === 'TEAMS' ? 'active' : ''} onClick={() => setMode('TEAMS')}><Users />Equipas</button><button className={mode === 'DUEL' ? 'active' : ''} onClick={() => setMode('DUEL')}><ShieldCheck />1 vs 1</button></div>{mode === 'DUEL' && <div className="duel-variants"><button className={duelVariant === 'ALTERNATING' ? 'active' : ''} onClick={() => setDuelVariant('ALTERNATING')}>Alternado<small>Trocam de papel a cada ronda</small></button><button className={duelVariant === 'DUEL' ? 'active' : ''} onClick={() => setDuelVariant('DUEL')}>Duelo<small>Mesmo número de rondas</small></button></div>}</>}<Action disabled={!name.trim() || (step === 'JOIN' && code.length !== 4)} onClick={() => step === 'CREATE' ? send({ type: 'ROOM_CREATE', name, mode, duelVariant, maxPlayers: 8 }) : send({ type: 'ROOM_JOIN', code, name })}>{step === 'CREATE' ? 'Criar sala' : 'Entrar'}</Action><button className="text-action" onClick={() => setStep('CHOICE')}>Voltar às opções</button></div>}{error && <p className="form-error" role="alert">{error}</p>}<p className="lan-note"><Wifi /> Funciona pela Internet ou no mesmo Wi-Fi através deste servidor.</p></div></main>

  if (room.status === 'CLOSED') return <main className="phone-screen multiplayer-finished"><div className="screen-content"><h1>Sala<br />encerrada</h1><p className="waiting-copy">O host encerrou esta sala.</p><Action onClick={leave}>Voltar ao início</Action></div></main>

  if (room.phase === 'LOBBY') return <main className="phone-screen lobby-screen"><div className="screen-content"><header className="room-header"><div><small>Sala</small><h1>{room.code}</h1></div><button onClick={leave} aria-label="Sair da sala"><LogOut /></button></header><div className="invite-grid"><img src={backendUrl(`/api/rooms/${room.code}/qr.svg`)} alt={`QR Code da sala ${room.code}`} /><div><b>{joinLink.replace(/^https?:\/\//, '')}</b><button onClick={() => copyText(room.code)}><Copy /> Copiar código</button><button onClick={share}><Share2 /> Partilhar</button></div></div>{isHost && <div className="multiplayer-config"><label>Tempo<select value={room.gameConfig.durationSeconds} onChange={event => send({ type: 'ROOM_CONFIG_UPDATE', config: { durationSeconds: Number(event.target.value) } })}><option value="20">20s</option><option value="30">30s</option><option value="45">45s</option><option value="60">60s</option></select></label><label>Palavras<select value={room.gameConfig.wordsPerCard} onChange={event => send({ type: 'ROOM_CONFIG_UPDATE', config: { wordsPerCard: Number(event.target.value) } })}>{[4, 5, 6, 7, 8].map(value => <option value={value} key={value}>{value}</option>)}</select></label><label>Passes<select value={room.gameConfig.passLimit} onChange={event => send({ type: 'ROOM_CONFIG_UPDATE', config: { passLimit: Number(event.target.value) } })}>{[0, 1, 2, 3, 99].map(value => <option value={value} key={value}>{value === 99 ? '∞' : value}</option>)}</select></label></div>}<section className="lobby-players"><header><b>{room.players.length}/{room.maxPlayers} jogadores</b><span>{room.players.filter(player => player.ready).length} prontos</span></header>{room.players.map(player => <div key={player.id}><span className={`presence ${player.presence.toLocaleLowerCase()}`}>{player.presence === 'CONNECTED' ? <Wifi /> : <WifiOff />}</span><b>{player.name}{player.id === room.hostId ? ' · host' : ''}</b>{isHost && room.teams.length && room.mode === 'TEAMS' ? <select value={player.teamId ?? ''} onChange={event => send({ type: 'PLAYER_MOVE', playerId: player.id, teamId: event.target.value })}>{room.teams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}</select> : <em>{player.ready ? <><Check /> pronto</> : 'a aguardar'}</em>}{isHost && player.id !== room.hostId && <button className="remove-player" onClick={() => send({ type: 'PLAYER_REMOVE', playerId: player.id })}><X /></button>}</div>)}</section>{room.mode === 'DUEL' && <p className="lobby-tip">{room.duelVariant === 'ALTERNATING' ? 'Alternado: trocam de papel depois de cada ronda.' : 'Duelo: ambos recebem o mesmo número de rondas.'}</p>}{isHost && room.mode === 'TEAMS' && <div className="distribution-actions"><button className="secondary-button" onClick={() => send({ type: 'ROOM_DISTRIBUTE', strategy: 'BALANCED' })}><Shuffle /> Equilibrar</button><button className="secondary-button" onClick={() => send({ type: 'ROOM_DISTRIBUTE', strategy: 'RANDOM' })}>Aleatório</button></div>}<Action onClick={() => send({ type: 'PLAYER_READY', ready: !me?.ready })}>{me?.ready ? 'Já estou pronto ✓' : 'Estou pronto'}</Action>{isHost && <Action disabled={!requiredReady || room.players.length < 2} onClick={() => send({ type: 'GAME_START' })}>Começar partida</Action>}{isHost && <button className="text-action cancel-room" onClick={() => send({ type: 'ROOM_CLOSE' })}>Cancelar sala</button>}{!isHost && <p className="waiting-copy">O host iniciará quando todos estiverem prontos.</p>}{error && <p className="form-error">{error}</p>}</div></main>

  if (room.phase === 'ROUND_READY') {
    const myTurn = room.explainerId === playerId
    return <main className="phone-screen multiplayer-turn"><div className="screen-content"><small>Ronda {room.game?.round?.number}</small><h1>{myTurn ? 'É a tua vez' : `${explainer?.name ?? 'O explicador'} vai explicar`}</h1><div className="versus-card"><b>{room.mode === 'DUEL' ? `${explainer?.name} explica` : `Equipa ${activeTeam?.name}`}</b><p>{myTurn ? 'O cartão só aparecerá neste telemóvel.' : 'Aguarda. As palavras permanecem privadas.'}</p></div>{myTurn ? <Action onClick={() => send({ type: 'ROUND_READY' })}>Estou pronto</Action> : <p className="waiting-copy"><RefreshCw /> À espera do explicador…</p>}</div></main>
  }

  if (room.phase === 'ROUND_ACTIVE' || room.phase === 'PAUSED') {
    const myTurn = room.explainerId === playerId
    return <main className={`phone-screen multiplayer-round ${remaining <= 5 ? 'urgent' : ''}`}><div className="screen-content"><div className="network-timer">00:{String(remaining).padStart(2, '0')}</div>{room.phase === 'PAUSED' && <><p className="connection-warning">O explicador perdeu a ligação. A tentar reconectar…</p>{isHost && now + clockOffset.current - (explainer?.lastSeenAt ?? now) >= 15_000 && <Action secondary onClick={() => send({ type: 'ROUND_ABORT' })}>Encerrar esta ronda</Action>}</>}{myTurn && room.game?.round ? <div className="multiplayer-word-list">{room.game.round.words.map(word => <div key={word.id} className={word.status}><button onClick={() => send({ type: 'WORD_MARK', wordId: word.id, status: 'correct' })}>{word.text}{word.status === 'correct' && <Check />}</button><button disabled={word.status !== 'passed' && (room.game?.round?.words.filter(item => item.status === 'passed').length ?? 0) >= (room.game?.config.passLimit ?? 0)} onClick={() => send({ type: 'WORD_MARK', wordId: word.id, status: 'passed' })}>↷</button></div>)}</div> : <div className="spectator-state"><Wifi /><h1>{activeTeam?.name} está a jogar</h1><p>{explainer?.name} está a explicar. Aguarda…</p></div>}</div></main>
  }

  if (room.phase === 'REVIEW' && room.game?.round && room.review) return <main className="phone-screen multiplayer-review"><div className="screen-content"><h1>Revisão<br />colectiva</h1><p>{Object.keys(room.review.confirmations).length}/{room.players.filter(player => player.presence === 'CONNECTED').length} confirmaram</p><div className="review-list">{room.game.round.words.map(word => { const dispute = room.review?.disputes[word.id]; return <div key={word.id}><span>{word.text}<small>{word.status === 'correct' ? 'Acertada' : word.status === 'passed' ? 'Passada' : 'Não acertada'}</small></span>{!dispute ? <button onClick={() => send({ type: 'REVIEW_DISPUTE', wordId: word.id, proposedStatus: word.status === 'correct' ? 'wrong' : 'correct' })}>Contestar</button> : dispute.resolvedStatus ? <em>Resolvida</em> : room.mode === 'TEAMS' && playerId === room.explainerId ? <em>Em votação</em> : <div className="vote-buttons"><button onClick={() => send({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'COUNT' })}><Check /></button><button onClick={() => send({ type: 'REVIEW_VOTE', wordId: word.id, vote: 'DONT_COUNT' })}><X /></button></div>}</div> })}</div>{isHost && room.mode === 'TEAMS' && unresolved.map(dispute => <div className="host-tiebreak" key={dispute.wordId}><b>Desempate do host</b><button onClick={() => send({ type: 'REVIEW_HOST_RESOLVE', wordId: dispute.wordId, status: 'correct' })}>Contar</button><button onClick={() => send({ type: 'REVIEW_HOST_RESOLVE', wordId: dispute.wordId, status: 'wrong' })}>Não contar</button></div>)}<Action disabled={unresolved.length > 0 || Boolean(room.review.confirmations[playerId])} onClick={() => send({ type: 'REVIEW_CONFIRM' })}>{room.review.confirmations[playerId] ? 'Confirmado ✓' : 'Concordo'}</Action>{isHost && now >= room.review.expiresAt && <Action secondary onClick={() => send({ type: 'REVIEW_FORCE_FINALIZE' })}>Finalizar após timeout</Action>}</div></main>

  if (room.phase === 'BETWEEN_ROUNDS') return <main className="phone-screen multiplayer-score"><div className="screen-content"><h1>Classificação</h1>{room.game?.teams.map((team, index) => <div className="score-row" key={team.id} style={{ '--team': colors[index] } as React.CSSProperties}><b>{room.mode === 'DUEL' ? team.name : `Equipa ${team.name}`}</b><strong>{team.score}</strong></div>)}{isHost ? <Action onClick={() => send({ type: 'NEXT_ROUND' })}>Próxima ronda</Action> : <p className="waiting-copy">A aguardar o host…</p>}</div></main>

  return <main className="phone-screen multiplayer-finished"><div className="screen-content"><h1>Fim do<br />jogo</h1>{room.game?.teams.sort((a, b) => b.score - a.score).map((team, index) => <div className="score-row" key={team.id}><span>{index + 1}º</span><b>{team.name}</b><strong>{team.score}</strong></div>)}<Action onClick={leave}>Voltar ao início</Action></div></main>
}
