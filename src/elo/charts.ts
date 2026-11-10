/** Points of a radar polygon. Values are 0–100. The first axis points up. */
export function radarPoints(values: number[], cx: number, cy: number, radius: number): string {
  if (values.length === 0) return ''
  return values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / values.length
      const reach = (Math.max(0, Math.min(100, value)) / 100) * radius
      const x = cx + reach * Math.cos(angle)
      const y = cy + reach * Math.sin(angle)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * Vertical position of a review-graph sample.
 * `cp` is White's centipawn evaluation. A positive value (White is better) sits above the midline.
 * The scale is clamped to ±800 centipawns.
 */
export function reviewEvalY(cp: number, height = 160): number {
  const mid = height / 2
  return mid - (Math.max(-800, Math.min(800, cp)) / 800) * (mid - 10)
}

/** A line through Elo samples. Y grows upward. */
export function eloLine(values: number[], width: number, height: number, pad = 12): string {
  if (values.length === 0) return ''
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = Math.max(1, high - low)
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (values.length - 1)
      const y = pad + (1 - (value - low) / span) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
