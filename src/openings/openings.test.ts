import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { OPENINGS, bookInfo, detectOpening, openingFromBookLine } from './openings'

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

  it('keeps curated comments only when the whole curated line is a prefix', () => {
    const italian = OPENINGS.find((opening) => opening.id === 'italian')
    if (!italian) throw new Error('missing italian')
    const exact = openingFromBookLine('C50:Italian Game', 'C50', 'Italian Game', italian.moves.map((move) => move.san))
    expect(exact.moves.map((move) => move.explanation)).toEqual(italian.moves.map((move) => move.explanation))
    const sharedStart = openingFromBookLine('C20:Open Game', 'C20', 'Open Game', ['e4', 'e5'])
    expect(sharedStart.moves.every((move) => move.explanation === '')).toBe(true)
    const longer = openingFromBookLine('C50:Italian Game', 'C50', 'Italian Game', [...italian.moves.map((move) => move.san), 'O-O'])
    expect(longer.moves.at(-1)?.explanation).toBe('')
    expect(longer.moves[0]?.explanation).toBe(italian.moves[0]?.explanation)
  })

  it('returns book explanations while the game follows a line', () => {
    expect(bookInfo(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])?.openingName).toBe('Španělská hra')
    expect(bookInfo(['e4', 'e5'])?.openingName).toBe('')
    expect(bookInfo(['a4'])).toBeNull()
  })
})
