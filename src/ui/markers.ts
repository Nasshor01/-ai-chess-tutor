/**
 * Board markers.
 * Arrows are a muted tint of the accent / info / warning / danger tokens.
 * They are drawn at ARROW_OPACITY with no dark outline, and the hues are
 * shifted just enough to stay visible on every light and dark square.
 */
export const ARROW_OPACITY = 0.75

export const BOARD_ARROWS = {
  hint: '#3fad7c',
  predict: '#6e9ecf',
  improve: '#3fad7c',
  A: '#6e9ecf',
  B: '#c49245',
  C: '#cc8682',
  mate: '#a991ca',
  slow: '#8f9aaa',
} as const

/** Still used by the square rings until those become fills. */
export const MARKER_OUTLINE = '#111827'

export const HIGHLIGHT_RINGS = {
  last: '#fde047',
  selected: '#6ee7b7',
  check: '#fecaca',
} as const
