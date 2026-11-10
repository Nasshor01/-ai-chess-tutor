export interface ArrowPoint {
  x: number
  y: number
}

/** Centre of a square in a 0–8 board, origin at the top left. */
export function squareCenter(square: string, orientation: 'white' | 'black'): ArrowPoint {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const x = orientation === 'white' ? file + 0.5 : 7.5 - file
  const y = orientation === 'white' ? 7.5 - rank : rank + 0.5
  return { x, y }
}

/** Straight arrow, shortened so the head sits inside the target square. */
export function arrowLine(from: string, to: string, orientation: 'white' | 'black'): ArrowPoint & { x2: number; y2: number } {
  const start = squareCenter(from, orientation)
  const end = squareCenter(to, orientation)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const trim = 0.22
  return { x: start.x, y: start.y, x2: end.x - (dx / length) * trim, y2: end.y - (dy / length) * trim }
}
