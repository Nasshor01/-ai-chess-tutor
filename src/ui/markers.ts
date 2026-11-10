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

/** Soft square fills. Alpha stays low so the square color and notation remain readable. */
export const HIGHLIGHT_WASH = {
  last: { color: '#a8843e', alpha: 0.22 },
  selected: { color: '#2f8f70', alpha: 0.3 },
} as const

export const CHECK_GLOW = 'rgba(176, 48, 48, 0.5)'
