import type { CSSProperties } from 'react'
import { CHECK_GLOW, HIGHLIGHT_WASH } from '../ui/markers'

function wash(color: string, alpha: number): string {
  const hex = color.slice(1)
  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  return `inset 0 0 0 999px rgba(${red}, ${green}, ${blue}, ${alpha})`
}

/** Darkens both light and dark squares. Diameter is about a quarter of the square. */
const MOVE_DOT = 'rgba(22, 26, 22, 0.58)'

const DOT: CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${MOVE_DOT} 0 12.5%, transparent 13%)`,
  cursor: 'pointer',
}

const CAPTURE: CSSProperties = {
  backgroundImage: `radial-gradient(circle, transparent 76%, ${MOVE_DOT} 78%, ${MOVE_DOT} 88%, transparent 90%)`,
  cursor: 'pointer',
}

export interface HighlightInput {
  lastFrom: string | null
  lastTo: string | null
  selected: string | null
  checkSquare: string | null
  targets: Array<{ to: string; captured: boolean }>
}

/** Square overlays. A start position with nothing selected paints no square. */
export function highlightStyles(input: HighlightInput): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {}
  const paint = (square: string, shadow: string) => {
    const previous = styles[square]?.boxShadow
    styles[square] = { ...styles[square], boxShadow: previous ? `${previous}, ${shadow}` : shadow }
  }
  if (input.lastFrom && input.lastTo) {
    const fill = wash(HIGHLIGHT_WASH.last.color, HIGHLIGHT_WASH.last.alpha)
    paint(input.lastFrom, fill)
    paint(input.lastTo, fill)
  }
  if (input.selected) paint(input.selected, wash(HIGHLIGHT_WASH.selected.color, HIGHLIGHT_WASH.selected.alpha))
  if (input.checkSquare) {
    paint(input.checkSquare, 'inset 0 0 0 999px rgba(176, 48, 48, 0.16)')
    paint(input.checkSquare, `inset 0 0 26px 8px ${CHECK_GLOW}`)
  }
  for (const target of input.targets) {
    styles[target.to] = { ...styles[target.to], ...(target.captured ? CAPTURE : DOT) }
  }
  return styles
}
