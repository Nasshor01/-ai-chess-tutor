import { describe, expect, it } from 'vitest'
import { openingFromBookLine, registerBookLines } from '../openings/openings'
import { bookLineText, welcomeMessages } from './messages'

describe('opening welcome', () => {
  it('does not invent a summary for a book line', () => {
    const line = openingFromBookLine('C20:King Pawn Game', 'C20', 'King Pawn Game', ['e4', 'e5'])
    registerBookLines([line])
    const [message] = welcomeMessages({ difficulty: 'beginner', mode: 'opening', openingId: line.id, puzzleId: null })
    expect(message && 'text' in message ? message.text : '').not.toContain('Hlavní myšlenka')
    expect(message && 'text' in message ? message.text : '').toContain('knihy')
    expect(bookLineText(line.name, 'e4', '')).toBe('V zahájení King Pawn Game se tady hraje e4.')
    expect(bookLineText('Italská hra', 'e4', 'Pěšec obsazuje střed.')).toContain('Pěšec obsazuje střed.')
  })
})
