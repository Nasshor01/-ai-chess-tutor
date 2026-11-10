import { describe, expect, it } from 'vitest'
import { parseAppearance } from './appearance'

describe('appearance', () => {
  it('accepts a saved theme and board, and rejects the rest', () => {
    expect(parseAppearance({ theme: 'light', board: 'walnut' })).toEqual({ theme: 'light', board: 'walnut' })
    expect(parseAppearance({ theme: 'neon', board: 'blue' })).toBeNull()
    expect(parseAppearance(null)).toBeNull()
  })
})