import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { OPENINGS, bookInfo, detectOpening } from './openings'

describe('openings', () => {
  it.each(OPENINGS.map((o) => [o.name, o] as const))('%s is a legal line', (_, opening) => {
    const chess = new Chess()
    for (const { san } of opening.moves) {
      expect(() => chess.move(san), `${opening.name}: ${san}`).not.toThrow()
    }
  })

  it('detects an opening once it is unambiguous', () => {
    expect(detectOpening(['e4', 'e5', 'Nf3', 'Nc6'])).toBeNull()
    expect(detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])?.name).toBe('Italská hra')
    expect(detectOpening(['e4', 'c5', 'Nf3'])?.name).toBe('Sicilská obrana')
  })

  it('returns book explanations while the game follows a line', () => {
    expect(bookInfo(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])?.openingName).toBe('Španělská hra')
    expect(bookInfo(['e4', 'e5'])?.openingName).toBe('')
    expect(bookInfo(['a4'])).toBeNull()
  })
})
