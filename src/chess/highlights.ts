import type { CSSProperties } from 'react'
import { HIGHLIGHT_RINGS, MARKER_OUTLINE } from '../ui/markers'

function ring(color: string): CSSProperties {
  return { boxShadow: `inset 0 0 0 3px ${color}, inset 0 0 0 6px ${MARKER_OUTLINE}` }
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
  if (input.lastFrom && input.lastTo) {
    styles[input.lastFrom] = ring(HIGHLIGHT_RINGS.last)
    styles[input.lastTo] = ring(HIGHLIGHT_RINGS.last)
  }
  if (input.checkSquare) styles[input.checkSquare] = { ...styles[input.checkSquare], ...ring(HIGHLIGHT_RINGS.check) }
  if (input.selected) styles[input.selected] = { ...styles[input.selected], ...ring(HIGHLIGHT_RINGS.selected) }
  for (const target of input.targets) {
    styles[target.to] = { ...styles[target.to], ...(target.captured ? CAPTURE : DOT) }
  }
  return styles
}
