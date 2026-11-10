import type { Move } from 'chess.js'
import { applyUci } from '../chess/utils'
import type { EngineLine } from '../engine/types'
import { explainMove } from '../tutor/commentary'
import { CONCEPTS, type ConceptId } from '../tutor/concepts'

export interface TeachLine {
  uci: string
  cp: number | null
  mate: number | null
}

export interface TeachingChoice {
  uci: string
  san: string
  reason: string
}

const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])

/**
 * The move to study, not always the engine's first line.
 * Lines that lose more than the level budget are dropped.
 * Below 1600, or when the weakness is development, castling or the centre,
 * a developing, castling or centre-pawn move inside the budget wins over a sharper one.
 * The sentence comes from explainMove and the matching concept.
 */
export function teachingMove(args: {
  fen: string
  lines: TeachLine[]
  elo: number | null
  weakness: ConceptId | null
}): TeachingChoice | null {
  const scored = args.lines
    .map((line) => {
      const move = applyUci(args.fen, line.uci)
      return move ? { line, move, cp: sideCp(line) } : null
    })
    .filter((row): row is { line: TeachLine; move: Move; cp: number } => row !== null)
  if (scored.length === 0) return null
  const best = Math.max(...scored.map((row) => row.cp))
  const budget = lossBudget(args.elo)
  const pool = scored.filter((row) => best - row.cp <= budget)
  const usable = pool.length > 0 ? pool : scored
  const preferCalm = args.elo == null || args.elo < 1600 || args.weakness === 'development' || args.weakness === 'castling' || args.weakness === 'center'
  const calm = usable.filter((row) => instructional(row.move))
  const chosen = (preferCalm && calm.length > 0 ? calm : usable).reduce((lead, row) => (row.cp > lead.cp ? row : lead))
  const concept = conceptFor(chosen.move)
  const engineLine: EngineLine = { multipv: 1, depth: 0, cp: chosen.line.cp, mate: chosen.line.mate, pv: [chosen.line.uci] }
  const because = explainMove(args.fen, chosen.move, [], engineLine)
  const lesson = concept ? (args.elo != null && args.elo >= 1600 ? CONCEPTS[concept].short : CONCEPTS[concept].explanation) : ''
  return {
    uci: chosen.line.uci,
    san: chosen.move.san,
    reason: lesson ? `${because}. ${lesson}` : because,
  }
}

/** Centipawn budget for a move that is still worth learning at this level. */
export function lossBudget(elo: number | null): number {
  if (elo == null || elo < 1200) return 80
  if (elo < 1600) return 50
  return 30
}

function instructional(move: Move): boolean {
  if (move.isKingsideCastle() || move.isQueensideCastle()) return true
  if ((move.piece === 'n' || move.piece === 'b') && !move.captured) return true
  return move.piece === 'p' && CENTER.has(move.to)
}

function conceptFor(move: Move): ConceptId | null {
  if (move.isKingsideCastle() || move.isQueensideCastle()) return 'castling'
  if (move.piece === 'n' || move.piece === 'b') return 'development'
  if (move.piece === 'p' && CENTER.has(move.to)) return 'center'
  return null
}

function sideCp(line: TeachLine): number {
  if (line.mate != null) {
    if (line.mate === 0) return -10000
    const sign = line.mate > 0 ? 1 : -1
    return sign * (9000 - Math.min(80, Math.abs(line.mate)) * 50)
  }
  return line.cp ?? 0
}
