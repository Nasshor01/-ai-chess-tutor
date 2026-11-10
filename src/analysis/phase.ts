import { Chess } from 'chess.js'
import type { GamePhase } from '../storage/types'

const OFFICER: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 }

/**
 * A documented heuristic, not a claim about chess theory.
 *
 * Officers are queens, rooks, bishops and knights, valued 9, 5, 3 and 3.
 * Opening: the full move number is 12 or less, both queens are on the board,
 * and both sides together still have at least 30 points of officer material.
 * Endgame: both sides together have 20 or fewer points of officer material.
 * Every other position is the middlegame.
 */
export function phaseOf(fen: string): GamePhase {
  const chess = new Chess(fen)
  let officers = 0
  let queens = 0
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.type === 'k' || cell.type === 'p') continue
      officers += OFFICER[cell.type] ?? 0
      if (cell.type === 'q') queens += 1
    }
  }
  const fullmove = Number(fen.split(' ')[5] ?? '1')
  if (fullmove <= 12 && queens === 2 && officers >= 30) return 'opening'
  if (officers <= 20) return 'endgame'
  return 'middlegame'
}
