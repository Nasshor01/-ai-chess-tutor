import { describe, expect, it } from 'vitest'
import { START_FEN, expandFen, fenFromPlacement, placementFromFen, playableFen } from './position'

function fenError(raw: string): string | undefined {
  const result = playableFen(raw)
  return 'error' in result ? result.error : undefined
}

describe('playableFen', () => {
  it('accepts the starting position and a short piece placement', () => {
    expect(playableFen(START_FEN)).toEqual({ fen: START_FEN })
    const short = playableFen('4k3/8/8/8/8/8/8/4K3 b')
    expect(short).toEqual({ fen: '4k3/8/8/8/8/8/8/4K3 b - - 0 1' })
    expect(expandFen('8/8/8/8/8/8/8/8', 'b').endsWith(' b - - 0 1')).toBe(true)
    expect(expandFen('4k3/8/8/8/8/8/8/4K3 w KQkq')).toBe('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1')
  })

  it('rejects a board that cannot be played and says why in Czech', () => {
    expect(playableFen('8/8/8/8/8/8/8/8 w - - 0 1')).toEqual({ error: 'Chybí bílý král.' })
    expect(fenError('4k3/8/8/8/8/8/8/4K2 w - - 0 1')).toMatch(/osm polí/)
    expect(playableFen('8/8/8/8/8/8/k7/K7 w - - 0 1')).toEqual({
      error: 'Králové nesmí stát na sousedních polích.',
    })
    expect(fenError('4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1')).toMatch(/není na tahu/)
    expect(fenError('not a fen')).toBeTruthy()
  })

  it('drops castling rights when the rook is gone and keeps them on the start board', () => {
    const stripped = playableFen('4k3/8/8/8/8/8/8/4K3 w KQ - 0 1')
    expect(stripped).toEqual({ fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1' })
    const placed = placementFromFen(START_FEN)
    expect(placed?.turn).toBe('w')
    expect(fenFromPlacement(placed!.placement, 'w')).toBe(START_FEN)
  })
})
