import { Chess, type Color, type Move, type Square } from 'chess.js'
import type { Score } from '../engine/types'
import { cpFor, czSan, materialBalance, opposite, plural } from '../chess/utils'
import { relativeRank } from './features'

const FILES = 'abcdefgh'

/** Positive moves until `side` mates, or null when that side is not the one mating. */
export function mateDistance(score: Score | null | undefined, side: Color): number | null {
  if (!score || score.mate === null || score.mate === 0) return null
  const moves = side === 'w' ? score.mate : -score.mate
  return moves > 0 ? moves : null
}

/**
 * The side is clearly winning: a forced mate, a decisive evaluation,
 * or extra material that is already working (the eval stands in for piece activity).
 * `fen` is the position the score describes.
 */
export function isClearlyWinning(score: Score | null | undefined, side: Color, fen: string): boolean {
  if (!score) return false
  if (mateDistance(score, side) !== null) return true
  const cp = cpFor(score, side)
  if (cp >= 450) return true
  let material = 0
  try {
    material = materialBalance(new Chess(fen), side)
  } catch {
    return false
  }
  if (material >= 3 && cp >= 180) return true
  if (material >= 2 && cp >= 280) return true
  return false
}

function neighbours(square: Square): Square[] {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1])
  const result: Square[] = []
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue
      const f = file + df
      const r = rank + dr
      if (f >= 0 && f < 8 && r >= 1 && r <= 8) result.push(`${FILES[f]}${r}` as Square)
    }
  }
  return result
}

function findKing(chess: Chess, color: Color): Square | null {
  for (const row of chess.board()) {
    for (const cell of row) if (cell?.type === 'k' && cell.color === color) return cell.square
  }
  return null
}

/**
 * Squares the king of `color` could step to on its turn.
 * The king is lifted first, so a square "behind" it on a checking line still counts as attacked.
 */
export function kingFlightSquares(fen: string, color: Color): Square[] {
  const chess = new Chess(fen)
  const king = findKing(chess, color)
  if (!king) return []
  const targets = neighbours(king).filter((square) => chess.get(square)?.color !== color)
  chess.remove(king)
  return targets.filter((square) => !chess.isAttacked(square, opposite(color)))
}

export interface RestrictFacts {
  escapesBefore: number
  escapesAfter: number
  closed: number
  isCheck: boolean
  isMate: boolean
  seventh: boolean
  cutsKing: boolean
  queenNear: boolean
  kingCloser: boolean
}

/** How the move squeezes the enemy king: escape squares, the 7th rank, a cut-off, a nearby queen. */
export function restrictFacts(fenBefore: string, move: Move): RestrictFacts {
  const enemy = opposite(move.color)
  const before = new Chess(fenBefore)
  const after = new Chess(move.after)
  const kingBefore = findKing(before, enemy)
  const kingAfter = findKing(after, enemy)
  const escapesBefore = kingBefore ? kingFlightSquares(fenBefore, enemy).length : 0
  const escapesAfter = kingAfter ? kingFlightSquares(move.after, enemy).length : 0
  const seventh = (move.piece === 'r' || move.piece === 'q') && relativeRank(move.to, move.color) === 7
  let cutsKing = false
  let queenNear = false
  if (kingAfter && (move.piece === 'r' || move.piece === 'q')) {
    const fileGap = Math.abs(move.to.charCodeAt(0) - kingAfter.charCodeAt(0))
    const rankGap = Math.abs(Number(move.to[1]) - Number(kingAfter[1]))
    const sharesLine = move.to[0] === kingAfter[0] || move.to[1] === kingAfter[1]
    cutsKing = (sharesLine && fileGap + rankGap > 0) || (seventh && rankGap <= 2 && fileGap > 0)
  }
  if (move.piece === 'q' && kingAfter) {
    const fileGap = Math.abs(move.to.charCodeAt(0) - kingAfter.charCodeAt(0))
    const rankGap = Math.abs(Number(move.to[1]) - Number(kingAfter[1]))
    const distance = Math.max(fileGap, rankGap)
    queenNear = distance > 0 && distance <= 2
  }
  let kingCloser = false
  if (move.piece === 'k' && kingBefore && kingAfter) {
    const distance = (from: Square, to: Square) =>
      Math.max(Math.abs(from.charCodeAt(0) - to.charCodeAt(0)), Math.abs(Number(from[1]) - Number(to[1])))
    kingCloser = distance(move.to, kingAfter) < distance(move.from, kingBefore)
  }
  return {
    escapesBefore,
    escapesAfter,
    closed: Math.max(0, escapesBefore - escapesAfter),
    isCheck: move.san.includes('+') || after.inCheck(),
    isMate: after.isCheckmate(),
    seventh,
    cutsKing,
    queenNear,
    kingCloser,
  }
}

export function restrictScore(facts: RestrictFacts): number {
  let score = 0
  if (facts.isMate) score += 50
  if (facts.isCheck) score += 8
  if (facts.seventh) score += 7
  score += facts.closed * 3
  if (facts.cutsKing) score += 5
  if (facts.queenNear) score += 3
  if (facts.kingCloser) score += 4
  return score
}

export interface ConversionInput {
  fenBefore: string
  move: Move
  evalBest: Score | null
  evalMove: Score | null
  /** True when `evalMove` comes from a search of the position before the move (the distance includes it). */
  evalFromBefore: boolean
  bestSan: string | null
  byUser: boolean
}

export interface ConversionGuidance {
  lines: string[]
  /** The position stayed winning, so a big win-chance drop should not be called a blunder. */
  soften: boolean
  /** A shorter forced mate was available and this move is not it. */
  missedFaster: boolean
  threw: boolean
  headline: string | null
  /** Mover's moves still left until mate, after this move. */
  mateIn: number | null
}

function countdown(moves: number): string {
  if (moves <= 1) return 'Ještě jeden tah do matu, pokud budeš přesný.'
  return `Ještě ${moves} ${plural(moves, 'tah', 'tahy', 'tahů')} do matu, pokud budeš přesný.`
}

/**
 * Czech guidance for converting a won position. Null when the mover is not
 * the user, or the position was not clearly winning before or after the move.
 */
export function conversionGuidance(input: ConversionInput): ConversionGuidance | null {
  if (!input.byUser) return null
  const after = new Chess(input.move.after)
  if (after.isCheckmate()) return null

  const side = input.move.color
  const beforeWinning = isClearlyWinning(input.evalBest, side, input.fenBefore)
  const afterWinning = isClearlyWinning(input.evalMove, side, input.move.after)
  if (!beforeWinning && !afterWinning) return null

  const playedSan = czSan(input.move.san)
  const sameBest = input.bestSan !== null && playedSan === input.bestSan
  const bestMate = mateDistance(input.evalBest, side)
  let mateIn = mateDistance(input.evalMove, side)
  if (mateIn !== null && input.evalFromBefore) mateIn = Math.max(1, mateIn - 1)

  if (beforeWinning && !afterWinning) {
    return {
      lines: ['Tímhle tahem pouštíš vyhranou pozici.'],
      soften: false,
      missedFaster: false,
      threw: true,
      headline: null,
      mateIn: null,
    }
  }

  // bestMate is counted from before the move. A perfect follow-up leaves bestMate - 1.
  const perfectRemaining = bestMate === null ? null : Math.max(1, bestMate - 1)
  const missed = beforeWinning && perfectRemaining !== null && !sameBest && (mateIn === null || mateIn > perfectRemaining)
  const cpDrop =
    input.evalBest && input.evalMove ? cpFor(input.evalBest, side) - cpFor(input.evalMove, side) : 0
  const soften = beforeWinning && !sameBest && (missed || cpDrop >= 120)

  const lines = ['Máš vyhranou pozici – teď omezuj krále.']
  if (mateIn !== null && mateIn > 0 && mateIn <= 12) lines.push(countdown(mateIn))
  const facts = restrictFacts(input.fenBefore, input.move)
  const tookSquares = facts.closed > 0 || facts.isCheck || facts.seventh || facts.cutsKing
  if (missed && input.bestSan) {
    lines.push(`Rychlejší mat začínal tahem ${input.bestSan}. Pomalejší plán ale pořád vyhrává.`)
  } else if (tookSquares) {
    lines.push('Tímhle tahem bereš soupeři útěková pole.')
  }

  return {
    lines: lines.slice(0, 3),
    soften,
    missedFaster: missed,
    threw: false,
    headline: soften || missed ? 'Pořád máš vyhranou pozici – teď omezuj krále.' : null,
    mateIn,
  }
}
