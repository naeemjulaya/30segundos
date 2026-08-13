export type TeamColor = 'cyan' | 'red' | 'green' | 'amber' | 'violet' | 'pink'
export type CompositionMode = 'balanced' | 'dynamic'
export type WordStatus = 'pending' | 'correct' | 'passed' | 'wrong'
export type Difficulty = 'easy' | 'normal' | 'hard' | 'mixed'
export type VictoryMode = 'points' | 'rounds'

export interface Team {
  id: string
  name: string
  color: TeamColor
  playerCount: number
  players: string[]
  nextExplainerIndex: number
  score: number
}

export interface DeckWord {
  text: string
  difficulty: Exclude<Difficulty, 'mixed'>
}

export interface Deck {
  id: string
  name: string
  icon: string
  wordCount: number
  availableOffline: boolean
  selected: boolean
  custom?: boolean
  draft?: boolean
  words: Array<string | DeckWord>
}

export interface GameConfig {
  composition: CompositionMode
  durationSeconds: number
  wordsPerCard: number
  passLimit: number
  passPenalty: boolean
  targetScore: number
  victoryMode: VictoryMode
  roundLimit: number
  difficulty: Difficulty
  selectedDeckIds: string[]
  registerPlayerNames: boolean
  automaticRotation: boolean
  startingTeamIndex: number
  randomFirstTeam: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
}

export interface RoundWord {
  id: string
  text: string
  difficulty: Exclude<Difficulty, 'mixed'>
  status: WordStatus
}

export interface Round {
  id: string
  teamIndex: number
  number: number
  words: RoundWord[]
  startedAt: number | null
  confirmed: boolean
  score: number
  isTiebreak: boolean
  reusedWords: boolean
}

export interface RoundResult {
  id: string
  number: number
  teamId: string
  teamName: string
  score: number
  isTiebreak: boolean
  completedAt: number
  words: RoundWord[]
}

export interface TiebreakState {
  teamIds: string[]
  scores: Record<string, number>
  currentIndex: number
  attempt: number
}

export interface GameSession {
  id: string
  status: 'setup' | 'ready' | 'playing' | 'review' | 'between-rounds' | 'tiebreak' | 'finished'
  teams: Team[]
  config: GameConfig
  round: Round | null
  completedRounds: RoundResult[]
  roundNumber: number
  activeTeamIndex: number
  cycleStartTeamIndex: number
  finishingCycle: boolean
  tiebreak: TiebreakState | null
  winnerTeamId: string | null
  createdAt: number
  updatedAt: number
  usedWordIds: string[]
}

export interface GameHistoryEntry {
  id: string
  completedAt: number
  winnerName: string
  winnerScore: number
  roundCount: number
  teamCount: number
  teams: Array<Pick<Team, 'name' | 'color' | 'score'>>
  usedWordIds: string[]
}
