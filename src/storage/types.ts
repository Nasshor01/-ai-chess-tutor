/** Persisted game and the empty stores reserved for later phases. */

export const DB_NAME = 'ai-chess-tutor'
export const DB_VERSION = 1

export type GameSource = 'app-free' | 'app-calculator' | 'import' | 'vs-personal'
export type GameStatus = 'in-progress' | 'finished'
export type UserColor = 'w' | 'b' | 'both'
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'
export type GamePhase = 'opening' | 'middlegame' | 'endgame'

export interface GameHeaders {
  Event: string
  Site: string
  Date: string
  White: string
  Black: string
  Result: string
  Round?: string
  SetUp?: string
  FEN?: string
  /** Extra headers kept from an import. Keys are the PGN tag names. */
  extra?: Record<string, string>
}

/** Optional clock. The app has no clock yet, so this stays unset. */
export interface GameClock {
  initialMs: number
  incrementMs: number
}

export interface Game {
  id: string
  pgn: string
  result: GameResult
  userColor: UserColor
  source: GameSource
  createdAt: number
  updatedAt: number
  status: GameStatus
  headers: GameHeaders
  startFen: string
  /** Import identity. Not unique: two played games may share moves. */
  dedupKey: string
  plyCount: number
  clock?: GameClock
}

export interface MoveRecord {
  gameId: string
  ply: number
  fenBefore: string
  uci: string
  san: string
  byUser: boolean
  timeSpentMs?: number
  evalBefore?: number | null
  evalAfter?: number | null
  cpLoss?: number | null
  category?: string
  phase?: GamePhase
}

/** Filled in phase 2. The store exists so the schema version does not have to change just to create it. */
export interface AnalysisCacheRecord {
  key: string
  fen: string
  depth: number
  multipv: number
  movetime: number | null
  skill: number
  payload: string
  updatedAt: number
}

/** Filled in phase 4. */
export interface PlayerProfileSnapshot {
  id: string
  createdAt: number
  payload: string
}

/** Filled in phase 3. */
export interface EloSnapshot {
  id: string
  createdAt: number
  payload: string
}

/** Filled in phase 7. */
export interface TrainingItem {
  id: string
  createdAt: number
  payload: string
}

export interface MigrationSnapshot {
  settings: string | null
  concepts: string | null
  solvedPuzzles: string | null
  calculator: string | null
}

export interface MigrationRecord {
  status: 'written' | 'verified'
  snapshot: MigrationSnapshot
  /** Keys that were present but could not be parsed. localStorage is left untouched. */
  skipped: string[]
}

export interface KvRecord {
  key: string
  value: unknown
}
