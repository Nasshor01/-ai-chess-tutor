import type { ImportReport } from '../storage/pgn'
import type { Game, GameResult } from '../storage/types'

export function gameOpponent(game: Game): string {
  if (game.source === 'app-free') return 'Stockfish'
  if (game.source === 'app-calculator') return 'Kalkulačka'
  if (game.source === 'vs-personal') return 'Já'
  return `${game.headers.White} – ${game.headers.Black}`
}

export function fullMoveCount(plyCount: number): number {
  return Math.ceil(plyCount / 2)
}

export function resultLabel(result: GameResult): string {
  if (result === '1/2-1/2') return '½–½'
  if (result === '*') return 'rozehraná'
  return result
}

/** Czech lines for the import summary. The first skipped reasons only, so a long file stays readable. */
export function formatImportReport(report: ImportReport): string[] {
  if (report.error) return [report.error]
  const lines = [`Načteno ${report.imported}, přeskočeno ${report.skipped.length}, duplicit ${report.duplicates}.`]
  for (const skip of report.skipped.slice(0, 3)) lines.push(`Partie ${skip.index}: ${skip.reason}`)
  if (report.variationsDropped) lines.push('Vedlejší varianty se neukládají, zůstala jen hlavní linie.')
  return lines
}
