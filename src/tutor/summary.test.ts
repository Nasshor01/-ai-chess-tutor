import { describe, expect, it } from 'vitest'
import { buildSummary } from './summary'

describe('buildSummary result text', () => {
  it('keeps the player voice in a normal game', () => {
    expect(buildSummary([], 'win', 'checkmate').title).toBe('Vyhrál jsi matem!')
    expect(buildSummary([], 'loss', 'checkmate').title).toBe('Prohra – soupeř dal mat')
    expect(buildSummary([], 'draw', 'stalemate').title).toBe('Remíza')
  })

  it('names the side that mated when both colours are the player', () => {
    expect(buildSummary([], 'win', 'checkmate', { neutralResult: true }).title).toBe('Bílý dal mat')
    expect(buildSummary([], 'loss', 'checkmate', { neutralResult: true }).title).toBe('Černý dal mat')
    expect(buildSummary([], 'draw', 'repetition', { neutralResult: true }).title).toBe('Remíza')
  })
})