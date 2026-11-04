import type { Move, PieceSymbol, Square } from 'chess.js'
import type { GameEndReason, GameOutcome, GameSummary } from '../tutor/summary'
import type { Difficulty } from './difficulty'

export type GameMode = 'free' | 'opening' | 'mate'

export interface GameSettings {
  difficulty: Difficulty
  mode: GameMode
  openingId: string | null
  puzzleId: string | null
}

export type PuzzleStatus = 'playing' | 'solved' | 'failed'

export interface PlyRecord {
  index: number
  move: Move
  byUser: boolean
}

export interface GameOverInfo {
  outcome: GameOutcome
  reason: GameEndReason
  summary: GameSummary | null
}

export interface HintArrow {
  from: Square
  to: Square
}

export interface MoveInput {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export type EngineStatus = 'loading' | 'ready' | 'error'
