import { describe, expect, it } from 'vitest'
import { livePlayers, liveSource, liveUserColor } from './liveRecord'

describe('saved game identity', () => {
  it('stores a personal game as vs-personal with the user as White', () => {
    expect(liveSource(false, true)).toBe('vs-personal')
    expect(liveUserColor(false)).toBe('w')
    expect(livePlayers(false, true, 'today').black).toBe('Já dnes')
  })

  it('leaves free play and the calculator on their own sources', () => {
    expect(liveSource(false, false)).toBe('app-free')
    expect(liveSource(true, true)).toBe('app-calculator')
    expect(liveUserColor(true)).toBe('both')
    expect(livePlayers(false, false, 'today').black).toBe('Stockfish')
  })
})