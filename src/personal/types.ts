import type { StyleProfile } from '../profile/styleProfile'

export type PersonalMode = 'today' | 'month-ago' | 'trained'
export type PersonalStrengthId = 'soft' | 'match' | 'sharp'

export interface PersonalStrength {
  id: PersonalStrengthId
  label: string
  /** Stockfish Skill Level. Full-strength analysis does not use this. */
  skill: number
  depth: number
  movetime: number
  multipv: number
  /** Higher means a flatter choice among the engine lines. */
  temperature: number
}

/** One MultiPV line. Scores are from the side to move, as Stockfish reports them. */
export interface PersonalLine {
  uci: string
  cp: number | null
  mate: number | null
}

export interface PersonalHistory {
  /** Piece placement, the first field of a FEN. */
  placement: string
  /** Position before the move, so a recorded mistake can be classified. */
  fenBefore: string
  uci: string
  mistake: boolean
}

export interface DatedProfile {
  createdAt: number
  profile: StyleProfile
}

export interface PersonalInput {
  fen: string
  mode: PersonalMode
  strength: PersonalStrengthId
  now: number
  /** Current style. Null when it has not been computed. */
  profile: StyleProfile | null
  snapshots: DatedProfile[]
  history: PersonalHistory[]
  lines: PersonalLine[]
  /** Defaults to Math.random. Tests pass a seeded generator. */
  rng?: () => number
}

export interface PersonalCandidate {
  uci: string
  san: string
  /** Share of the choice, 0–1. The candidates sum to 1. */
  probability: number
  reason: string
}

export interface PersonalMoveResult {
  mode: PersonalMode
  available: boolean
  unavailableReason: string | null
  weakModel: boolean
  notice: string | null
  candidates: PersonalCandidate[]
  played: PersonalCandidate | null
}

/**
 * The only type the board and the dialogs depend on.
 * `statistical` is the first implementation. `maia` is reserved for a neural policy.
 */
export interface PersonalMoveProvider {
  readonly id: 'statistical' | 'maia'
  choose(input: PersonalInput): PersonalMoveResult
}
