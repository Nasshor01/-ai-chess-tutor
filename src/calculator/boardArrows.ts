import type { CalcOption } from './calculator'
import { ARROW_OPACITY, BOARD_ARROWS } from '../ui/markers'

/** One suggestion arrow. Missing opacity and width use the single-arrow style. */
export interface BoardArrow {
  from: string
  to: string
  color: string
  opacity?: number
  strokeWidth?: number
}

/** Cap for the three-at-once drawing. The hovered arrow uses the cap; the others stay quieter. */
export const GROUP_ARROW_OPACITY = 0.6
export const GROUP_ARROW_QUIET_OPACITY = 0.42
export const ARROW_STROKE = 0.11
export const GROUP_ARROW_QUIET_STROKE = 0.07

export type ArrowOption = Pick<CalcOption, 'letter' | 'from' | 'to' | 'kind' | 'keeps'>

/** Muted board tint for one suggestion. The panel chips stay separate. */
export function boardArrowColor(option: Pick<CalcOption, 'kind' | 'letter' | 'keeps'>): string {
  if (option.kind === 'mate') return BOARD_ARROWS.mate
  if (option.kind === 'slow' && option.keeps !== false) return BOARD_ARROWS.slow
  return BOARD_ARROWS[option.letter]
}

export interface ArrowSelection {
  positionFen: string
  /** Fen the suggestions were calculated for. A mismatch means the position already moved. */
  resultFen: string | null
  options: ArrowOption[]
  hovered: number | null
  /** Touch or keyboard choice. Mouse hover wins while the pointer is over a card. */
  pinned: number | null
  showAll: boolean
  /** Set while the line preview is open. Its arrow belongs to the preview position, not the old trio. */
  previewing: boolean
  previewArrow: { from: string; to: string; color: string } | null
}

function knownIndex(options: ArrowOption[], index: number | null): number | null {
  if (index == null || !options[index]) return null
  return index
}

/** Card whose arrow is shown, or drawn stronger when all three are visible. Defaults to A. */
export function activeSuggestionIndex(options: ArrowOption[], hovered: number | null, pinned: number | null): number | null {
  if (options.length === 0) return null
  const chosen = knownIndex(options, hovered) ?? knownIndex(options, pinned)
  if (chosen != null) return chosen
  const letterA = options.findIndex((option) => option.letter === 'A')
  return letterA >= 0 ? letterA : 0
}

function single(option: ArrowOption): BoardArrow {
  return {
    from: option.from,
    to: option.to,
    color: boardArrowColor(option),
    opacity: ARROW_OPACITY,
    strokeWidth: ARROW_STROKE,
  }
}

/** Which calculator arrows belong on the current position. */
export function selectCalculatorArrows(input: ArrowSelection): BoardArrow[] {
  if (!input.resultFen || input.resultFen !== input.positionFen) return []
  if (input.previewing) {
    return input.previewArrow
      ? [{ ...input.previewArrow, opacity: ARROW_OPACITY, strokeWidth: ARROW_STROKE }]
      : []
  }
  if (input.options.length === 0) return []
  const active = activeSuggestionIndex(input.options, input.hovered, input.pinned)
  if (active == null) return []
  if (!input.showAll) return [single(input.options[active])]
  const quiet: BoardArrow[] = []
  let emphasis: BoardArrow | null = null
  input.options.forEach((option, index) => {
    const chosen = index === active
    const arrow: BoardArrow = {
      from: option.from,
      to: option.to,
      color: boardArrowColor(option),
      opacity: chosen ? GROUP_ARROW_OPACITY : GROUP_ARROW_QUIET_OPACITY,
      strokeWidth: chosen ? ARROW_STROKE : GROUP_ARROW_QUIET_STROKE,
    }
    if (chosen) emphasis = arrow
    else quiet.push(arrow)
  })
  return emphasis ? [...quiet, emphasis] : quiet
}
