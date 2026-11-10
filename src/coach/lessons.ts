import { CONCEPTS } from '../tutor/concepts'
import { QUALITY_LABEL } from '../tutor/classify'
import type { GamePhase } from '../storage/types'

export interface ReviewedMove {
  ply: number
  san: string
  byUser: boolean
  cpLoss: number | null
  /** quality, then motifs, joined with |. Null when the move was not analysed. */
  category: string | null
  phase: GamePhase | null
}

export interface LessonLine {
  label: string
  text: string
}

export interface GameLesson {
  analyzed: boolean
  mistakes: LessonLine[]
  strength: LessonLine | null
  goal: LessonLine | null
}

const MISTAKE = new Set(['mistake', 'blunder'])
const PHASE_IN: Record<GamePhase, string> = {
  opening: 'V zahájení',
  middlegame: 'Ve střední hře',
  endgame: 'V koncovce',
}
const MIN_PHASE = 4

/**
 * Picks up to three analysed mistakes, one strong phase and one next goal.
 * Nothing is filled in when the game has no centipawn loss and no category.
 */
export function lessonsFromMoves(moves: ReviewedMove[]): GameLesson {
  const user = moves.filter((move) => move.byUser)
  const analyzed = user.some((move) => move.cpLoss != null || (move.category != null && move.category.length > 0))
  if (!analyzed) return { analyzed: false, mistakes: [], strength: null, goal: null }

  const mistakes = user
    .filter((move) => MISTAKE.has(qualityOf(move.category) ?? ''))
    .sort((a, b) => (b.cpLoss ?? 0) - (a.cpLoss ?? 0))
    .slice(0, 3)
    .map((move) => ({
      label: `${Math.floor(move.ply / 2) + 1}. ${move.san}`,
      text: mistakeText(move),
    }))

  return {
    analyzed: true,
    mistakes,
    strength: strongestPhase(user),
    goal: nextGoal(user, mistakes.length > 0),
  }
}

function mistakeText(move: ReviewedMove): string {
  const quality = qualityOf(move.category)
  const name = quality && quality in QUALITY_LABEL ? QUALITY_LABEL[quality as keyof typeof QUALITY_LABEL] : 'Chyba'
  const loss = move.cpLoss == null ? '' : ` Ztráta ${Math.round(move.cpLoss)} cp.`
  const motif = motifsOf(move.category).map((item) => motifGoal(item)).find((item) => item)
  return `${name}.${loss}${motif ? ` ${motif}` : ''}`.trim()
}

function strongestPhase(moves: ReviewedMove[]): LessonLine | null {
  let best: { phase: GamePhase; avg: number; count: number } | null = null
  for (const phase of ['opening', 'middlegame', 'endgame'] as const) {
    const rows = moves.filter((move) => move.phase === phase && move.cpLoss != null)
    if (rows.length < MIN_PHASE) continue
    const avg = rows.reduce((sum, move) => sum + (move.cpLoss ?? 0), 0) / rows.length
    if (!best || avg < best.avg) best = { phase, avg, count: rows.length }
  }
  if (!best) return null
  return {
    label: PHASE_IN[best.phase],
    text: `${PHASE_IN[best.phase]} je průměrná ztráta ${Math.round(best.avg)} cp z ${best.count} tahů. To je v téhle partii tvoje nejsilnější fáze.`,
  }
}

function nextGoal(moves: ReviewedMove[], hadMistake: boolean): LessonLine | null {
  if (hadMistake) {
    const motifs = new Map<string, number>()
    for (const move of moves) {
      if (!MISTAKE.has(qualityOf(move.category) ?? '')) continue
      for (const motif of motifsOf(move.category)) motifs.set(motif, (motifs.get(motif) ?? 0) + 1)
    }
    const top = [...motifs.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top) {
      const text = motifGoal(top[0])
      if (text) return { label: 'Cíl', text: `Příště: ${text}` }
    }
    return { label: 'Cíl', text: 'Příště si u každého tahu ověř, co soupeř bere a čím hrozí, než sáhneš po figuře.' }
  }
  let worst: { phase: GamePhase; avg: number } | null = null
  for (const phase of ['opening', 'middlegame', 'endgame'] as const) {
    const rows = moves.filter((move) => move.phase === phase && move.cpLoss != null)
    if (rows.length < MIN_PHASE) continue
    const avg = rows.reduce((sum, move) => sum + (move.cpLoss ?? 0), 0) / rows.length
    if (!worst || avg > worst.avg) worst = { phase, avg }
  }
  if (!worst) return null
  return {
    label: 'Cíl',
    text: `Příště se zaměř na ${worst.phase === 'opening' ? 'zahájení' : worst.phase === 'middlegame' ? 'střední hru' : 'koncovku'}: průměrná ztráta je ${Math.round(worst.avg)} cp.`,
  }
}

function motifGoal(motif: string): string | null {
  if (motif === 'vidlička') return CONCEPTS.fork.short
  if (motif === 'figura zůstala viset') return CONCEPTS.hangingPiece.short
  return null
}

function qualityOf(category: string | null): string | null {
  if (!category) return null
  return category.split('|')[0] ?? null
}

function motifsOf(category: string | null): string[] {
  if (!category) return []
  return category.split('|').slice(1).filter((part) => part.length > 0)
}
