import { describe, expect, it } from 'vitest'
import { PIECES } from './pieces'

describe('piece set', () => {
  it('has a white and a black piece for every role', () => {
    expect(Object.keys(PIECES).sort()).toEqual(['bB', 'bK', 'bN', 'bP', 'bQ', 'bR', 'wB', 'wK', 'wN', 'wP', 'wQ', 'wR'])
  })
})