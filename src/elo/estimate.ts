import type { GamePhase, GameResult, GameSource, UserColor } from '../storage/types'

export interface EloMove {
  byUser: boolean
  cpLoss?: number | null
  category?: string | null
  phase?: GamePhase | null
  /** White's centipawn evaluation before the move. */
  evalBefore?: number | null
  timeSpentMs?: number | null
  /** Set by the estimate. True when the user had White. Absent when they played both. */
  userWhite?: boolean
}

export interface EloGame {
  id: string
  result: GameResult
  userColor: UserColor
  source: GameSource
  updatedAt: number
  moves: EloMove[]
}

export interface Subscore {
  id: 'tactics' | 'opening' | 'middlegame' | 'endgame' | 'defense' | 'time'
  label: string
  /** 0–100, or null when there are not enough moves. */
  value: number | null
  samples: number
  /** Extra text when the subscore is not a 0–100 value. Time uses this for the average. */
  detail?: string
}

export interface EloEstimate {
  /** Null until at least one of the user's moves has a centipawn loss. */
  elo: number | null
  low: number | null
  high: number | null
  games: number
  acpl: number | null
  anchored: boolean
  /** True when fewer than 20 games in the window have been analysed. */
  thin: boolean
  byPhase: Record<GamePhase, number | null>
  subscores: Subscore[]
}

const WINDOW = 40
const MIN_MOVES = 8
const REFERENCE_ACPL = 50
const POINTS_PER_CP = 4
const MISTAKES = new Set(['inaccuracy', 'mistake', 'blunder'])

/**
 * A linear estimate, not a FIDE rating.
 *
 * ACPL is the average centipawn loss of the user's analysed moves.
 * 50 ACPL maps to the anchor (1500 when the user has not entered a rating).
 * Each centipawn away from 50 moves the estimate by 4 points.
 * Imported games also add (score − 0.5) × 200, because those results are
 * against people. Games against the computer are not used for that term:
 * beating a weak engine is not a rating. The 95% interval is ±1.96 × 400 / sqrt(n).
 */
export function estimateElo(games: EloGame[], options?: { anchor?: number; now?: number }): EloEstimate {
  const anchor = options?.anchor
  const base = anchor ?? 1500
  const window = [...games]
    .filter((game) => game.moves.some((move) => move.byUser && move.cpLoss != null))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, WINDOW)
  const moves = window.flatMap((game) =>
    game.moves
      .filter((move) => move.byUser && move.cpLoss != null)
      .map((move) => ({ ...move, userWhite: game.userColor === 'both' ? undefined : game.userColor === 'w' })),
  )
  const acpl = moves.length === 0 ? null : moves.reduce((sum, move) => sum + (move.cpLoss ?? 0), 0) / moves.length
  const imported = window.filter((game) => game.source === 'import' && game.userColor !== 'both' && game.result !== '*')
  const resultTerm = imported.length === 0 ? 0 : (meanScore(imported) - 0.5) * 200
  const elo = acpl === null ? null : Math.round(base - (acpl - REFERENCE_ACPL) * POINTS_PER_CP + resultTerm)
  const spread = window.length === 0 ? null : Math.round((1.96 * 400) / Math.sqrt(window.length))
  return {
    elo,
    low: elo === null || spread === null ? null : elo - spread,
    high: elo === null || spread === null ? null : elo + spread,
    games: window.length,
    acpl: acpl === null ? null : Math.round(acpl),
    anchored: anchor != null,
    thin: window.length < 20,
    byPhase: {
      opening: errorShare(moves, (move) => move.phase === 'opening'),
      middlegame: errorShare(moves, (move) => move.phase === 'middlegame'),
      endgame: errorShare(moves, (move) => move.phase === 'endgame'),
    },
    subscores: [
      sub('tactics', 'Taktika', moves, (move) => (move.category ?? '').includes('|')),
      sub('opening', 'Zahájení', moves, (move) => move.phase === 'opening'),
      sub('middlegame', 'Střed hry', moves, (move) => move.phase === 'middlegame'),
      sub('endgame', 'Koncovky', moves, (move) => move.phase === 'endgame'),
      sub('defense', 'Obrana', moves, (move) => wasWorse(move)),
      sub('time', 'Čas', moves, (move) => move.timeSpentMs != null),
    ],
  }
}

function meanScore(games: EloGame[]): number {
  const scores = games.map((game) => scoreOf(game.result, game.userColor))
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function scoreOf(result: GameResult, color: UserColor): number {
  const white = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5
  return color === 'b' ? 1 - white : white
}

function errorShare(moves: EloMove[], take: (move: EloMove) => boolean): number | null {
  const picked = moves.filter(take)
  if (picked.length < MIN_MOVES) return null
  const errors = picked.filter((move) => MISTAKES.has(quality(move.category))).length
  return errors / picked.length
}

function sub(id: Subscore['id'], label: string, moves: EloMove[], take: (move: EloMove) => boolean): Subscore {
  const picked = id === 'time' ? moves.filter((move) => move.timeSpentMs != null) : moves.filter(take)
  if (id === 'time') {
    if (picked.length < MIN_MOVES) return { id, label, value: null, samples: picked.length }
    const seconds = picked.reduce((sum, move) => sum + (move.timeSpentMs ?? 0), 0) / picked.length / 1000
    return { id, label, value: null, samples: picked.length, detail: `${Math.round(seconds)} s` }
  }
  if (picked.length < MIN_MOVES) return { id, label, value: null, samples: picked.length }
  const errors = picked.filter((move) => MISTAKES.has(quality(move.category))).length
  return { id, label, value: Math.round(100 * (1 - errors / picked.length)), samples: picked.length }
}

function quality(category: string | null | undefined): string {
  return category?.split('|')[0] ?? ''
}

/** The user was at least half a pawn worse before the move. */
function wasWorse(move: EloMove): boolean {
  if (move.evalBefore == null || move.userWhite == null) return false
  return move.userWhite ? move.evalBefore < -50 : move.evalBefore > 50
}

export function snapshotPayload(estimate: EloEstimate, createdAt: number): { id: string; createdAt: number; payload: string } {
  return { id: `elo_${createdAt}`, createdAt, payload: JSON.stringify(estimate) }
}
