/**
 * Board markers. Fills are light enough to read on every dark square.
 * A near-black outline keeps the same marker readable on every light square.
 */
export const MARKER_OUTLINE = '#111827'

export const BOARD_ARROWS = {
  hint: '#5eead4',
  predict: '#93c5fd',
  improve: '#6ee7b7',
  A: '#93c5fd',
  B: '#fde047',
  C: '#fecaca',
  mate: '#d8b4fe',
  slow: '#e2e8f0',
} as const

export const HIGHLIGHT_RINGS = {
  last: '#fde047',
  selected: '#6ee7b7',
  check: '#fecaca',
} as const
