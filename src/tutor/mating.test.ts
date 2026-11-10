import { describe, expect, it } from 'vitest'
import { kingEscapeSquares } from './mating'

describe('kingEscapeSquares', () => {
  it('counts squares behind the king on a checking line as attacked', () => {
    expect(kingEscapeSquares('7k/8/5K2/8/8/8/8/R7 b - - 0 1')).toEqual(['g8', 'h7'])
    expect(kingEscapeSquares('R6k/8/6K1/8/8/8/8/8 b - - 0 1')).toEqual([])
  })
})
