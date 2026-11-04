import type { MoveQuality, Verdict } from './types'

/** Thresholds in lost win-probability percentage points (similar to Lichess). */
export function qualityFromLoss(winLoss: number, isBest: boolean): MoveQuality {
  if (isBest || winLoss < 0.5) return 'best'
  if (winLoss < 2.5) return 'excellent'
  if (winLoss < 6) return 'good'
  if (winLoss < 12) return 'inaccuracy'
  if (winLoss < 22) return 'mistake'
  return 'blunder'
}

export function verdictOf(quality: MoveQuality): Verdict {
  switch (quality) {
    case 'inaccuracy':
      return 'average'
    case 'mistake':
    case 'blunder':
      return 'bad'
    default:
      return 'good'
  }
}

export const QUALITY_LABEL: Record<MoveQuality, string> = {
  book: 'Teoretický tah',
  best: 'Nejlepší tah',
  excellent: 'Výborný tah',
  good: 'Dobrý tah',
  inaccuracy: 'Nepřesnost',
  mistake: 'Chyba',
  blunder: 'Hrubá chyba',
}

export const QUALITY_SYMBOL: Record<MoveQuality, string> = {
  book: '≡',
  best: '★',
  excellent: '!',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  good: 'Dobrý tah',
  average: 'Průměrný tah',
  bad: 'Špatný tah',
}

/** Per-move accuracy 0–100 from lost win-probability (Lichess formula). */
export function moveAccuracy(winLoss: number): number {
  const value = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669
  return Math.max(0, Math.min(100, value))
}
