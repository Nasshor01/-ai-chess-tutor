import type { Move, PieceSymbol, Square } from 'chess.js'
import type { PersonalMode, PersonalStrengthId } from '../personal/types'
import type { GameEndReason, GameOutcome, GameSummary } from '../tutor/summary'
import type { Difficulty } from './difficulty'

export type OpponentKind = 'engine' | 'personal'

export type GameMode = 'free' | 'opening' | 'mate'

export interface GameSettings {
  difficulty: Difficulty
  mode: GameMode
  openingId: string | null
  puzzleId: string | null
  /** Missing means the built-in engine. Personal play is free play only. */
  opponent?: OpponentKind
  personalMode?: PersonalMode
  personalStrength?: PersonalStrengthId
}

export function opponentOf(settings: GameSettings): OpponentKind {
  return settings.opponent === 'personal' && settings.mode === 'free' ? 'personal' : 'engine'
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
