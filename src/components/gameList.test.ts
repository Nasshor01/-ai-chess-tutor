import { describe, expect, it } from 'vitest'
import { formatImportReport, fullMoveCount, gameOpponent, resultLabel } from './gameList'
import type { Game } from '../storage/types'

function game(patch: Partial<Game>): Game {
  return {
    id: 'g',
    pgn: '',
    result: '*',
    userColor: 'w',
    source: 'app-free',
    createdAt: 1,
    updatedAt: 1,
    status: 'in-progress',
    headers: { Event: 'Volná hra', Site: 'AI Chess Tutor', Date: '2026.11.10', White: 'Hráč', Black: 'Stockfish', Result: '*' },
    startFen: 'start',
    dedupKey: 'live:g',
    plyCount: 3,
    ...patch,
  }
}

describe('game list labels', () => {
  it('names the opponent from the source and counts full moves', () => {
    expect(gameOpponent(game({ source: 'app-free' }))).toBe('Stockfish')
    expect(gameOpponent(game({ source: 'vs-personal' }))).toBe('Já')
    expect(gameOpponent(game({ source: 'app-calculator' }))).toBe('Kalkulačka')
    expect(gameOpponent(game({ source: 'import', headers: { ...game({}).headers, White: 'Anna', Black: 'BoB' } }))).toBe('Anna – BoB')
    expect(fullMoveCount(0)).toBe(0)
    expect(fullMoveCount(3)).toBe(2)
    expect(resultLabel('1/2-1/2')).toBe('½–½')
    expect(resultLabel('*')).toBe('rozehraná')
  })

  it('summarises an import in Czech and keeps the variation note', () => {
    expect(
      formatImportReport({
        imported: 2,
        duplicates: 1,
        skipped: [
          { index: 3, reason: 'Nelegální tah' },
          { index: 4, reason: 'Prázdná partie' },
        ],
        variationsDropped: true,
      }),
    ).toEqual([
      'Načteno 2, přeskočeno 2, duplicit 1.',
      'Partie 3: Nelegální tah',
      'Partie 4: Prázdná partie',
      'Vedlejší varianty se neukládají, zůstala jen hlavní linie.',
    ])
    expect(formatImportReport({ imported: 0, duplicates: 0, skipped: [], variationsDropped: false, error: 'Soubor není v kódování UTF-8.' })).toEqual([
      'Soubor není v kódování UTF-8.',
    ])
  })
})
