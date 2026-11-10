import { describe, expect, it } from 'vitest'
import { PIECES, PIECE_SET_CREDIT } from './pieceSet'

describe('piece set', () => {
  it('has a white and a black piece for every role', () => {
    expect(Object.keys(PIECES).sort()).toEqual(['bB', 'bK', 'bN', 'bP', 'bQ', 'bR', 'wB', 'wK', 'wN', 'wP', 'wQ', 'wR'])
  })

  it('names the author and a license that allows shipping the drawings in a web app', () => {
    expect(PIECE_SET_CREDIT.author).toBe('Colin M.L. Burnett')
    expect(PIECE_SET_CREDIT.license).toBe('CC BY-SA 3.0')
    expect(PIECE_SET_CREDIT.licenseUrl).toContain('creativecommons.org/licenses/by-sa/3.0')
  })
})