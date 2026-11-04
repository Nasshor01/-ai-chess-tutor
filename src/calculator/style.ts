import type { Move } from 'chess.js'
import type { MoveFacts } from '../tutor/features'

export type Habit = 'develop' | 'castle' | 'center' | 'capture' | 'check'

export interface PlayStyle {
  habit: Habit
  /** Set when one minor piece clearly dominates the other. */
  piece: 'n' | 'b' | null
  text: string
}

const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])

/**
 * What the player actually does in this game. Needs a few of their own moves;
 * until then the calculator stays on the generic club-player mix.
 */
export function playStyle(moves: Move[]): PlayStyle | null {
  if (moves.length < 4) return null
  let develop = 0
  let castle = 0
  let center = 0
  let capture = 0
  let check = 0
  let knights = 0
  let bishops = 0
  for (const move of moves) {
    if (move.piece === 'n' || move.piece === 'b') {
      develop++
      if (move.piece === 'n') knights++
      else bishops++
    }
    if (move.isKingsideCastle() || move.isQueensideCastle()) castle++
    if (move.piece === 'p' && CENTER.has(move.to)) center++
    if (move.captured) capture++
    if (move.san.includes('+') || move.san.includes('#')) check++
  }
  const ranked: Array<[Habit, number]> = [
    ['develop', develop],
    ['castle', castle],
    ['center', center],
    ['capture', capture],
    ['check', check],
  ]
  ranked.sort((a, b) => b[1] - a[1])
  const [habit, count] = ranked[0]
  if (count < 2) return null
  const piece = bishops >= knights + 2 ? 'b' : knights >= bishops + 2 ? 'n' : null
  return { habit, piece, text: styleText(habit, piece) }
}

function styleText(habit: Habit, piece: 'n' | 'b' | null): string {
  if (habit === 'develop' && piece === 'b') return 'Podle tvých tahů v téhle partii nejradši vyvíjíš střelce.'
  if (habit === 'develop' && piece === 'n') return 'Podle tvých tahů v téhle partii nejradši vyvíjíš jezdce.'
  if (habit === 'develop') return 'Podle tvých tahů v téhle partii nejradši vyvíjíš lehké figury.'
  if (habit === 'castle') return 'Podle tvých tahů v téhle partii rochuješ, jakmile to jde.'
  if (habit === 'center') return 'Podle tvých tahů v téhle partii si bereš střed pěšcem.'
  if (habit === 'capture') return 'Podle tvých tahů v téhle partii rád bereš materiál.'
  return 'Podle tvých tahů v téhle partii hledáš šachy.'
}

/** Small nudge so a sound move that matches the player wins a tie. It never rescues a hang. */
export function styleBonus(facts: MoveFacts, style: PlayStyle | null, hangValue: number, badCaptureLoss: number): number {
  if (!style || hangValue > 0 || badCaptureLoss > 0) return 0
  const move = facts.move
  let bonus = 0
  if (style.habit === 'develop' && facts.development) bonus += 3
  if (style.habit === 'castle' && facts.castle) bonus += 3
  if (style.habit === 'center' && facts.centerPawn) bonus += 3
  if (style.habit === 'capture' && move.captured) bonus += 3
  if (style.habit === 'check' && facts.isCheck && !facts.earlyQueen) bonus += 2
  if (style.piece === 'b' && move.piece === 'b' && facts.development) bonus += 2
  if (style.piece === 'n' && move.piece === 'n' && facts.development) bonus += 2
  return bonus
}
