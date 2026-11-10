import { describe, expect, it } from 'vitest'
import { estimateElo, type EloGame, type EloMove } from './estimate'

function userMove(cpLoss: number, phase: EloMove['phase'], category = 'good'): EloMove {
  return { byUser: true, cpLoss, phase, category, evalBefore: 20 }
}

function game(id: string, moves: EloMove[], patch: Partial<EloGame> = {}): EloGame {
  return { id, result: '1-0', userColor: 'w', source: 'app-free', updatedAt: Number(id), moves, ...patch }
}

describe('personal Elo', () => {
  it('maps a low centipawn loss above the anchor and a high one below it', () => {
    const sharp = Array.from({ length: 20 }, (_, index) => game(String(index + 1), Array.from({ length: 8 }, () => userMove(20, 'opening'))))
    const loose = Array.from({ length: 20 }, (_, index) => game(String(index + 1), Array.from({ length: 8 }, () => userMove(80, 'opening', 'blunder'))))
    const better = estimateElo(sharp, { anchor: 1500 })
    const worse = estimateElo(loose, { anchor: 1500 })
    expect(better.elo).toBe(1620)
    expect(worse.elo).toBe(1380)
    expect(better.thin).toBe(false)
    expect(better.low).toBeLessThan(better.elo!)
    expect(better.high).toBeGreaterThan(better.elo!)
    expect(worse.subscores.find((score) => score.id === 'opening')?.value).toBe(0)
    expect(better.subscores.find((score) => score.id === 'opening')?.value).toBe(100)
  })

  it('warns below 20 games, ignores computer results, and hides time without a clock', () => {
    const games = [
      game('5', Array.from({ length: 8 }, () => userMove(50, 'middlegame')), { source: 'app-free', result: '1-0' }),
      game('4', Array.from({ length: 8 }, () => userMove(50, 'endgame')), { source: 'import', result: '0-1', userColor: 'w' }),
    ]
    const estimate = estimateElo(games, { anchor: 1500 })
    expect(estimate.thin).toBe(true)
    expect(estimate.games).toBe(2)
    expect(estimate.elo).toBe(1500 - 100)
    expect(estimate.subscores.find((score) => score.id === 'time')?.value).toBeNull()
    expect(estimate.subscores.find((score) => score.id === 'time')?.detail).toBeUndefined()
    expect(estimate.byPhase.opening).toBeNull()
  })

  it('uses imported results and a clock when they exist', () => {
    const timed: EloMove = { ...userMove(50, 'middlegame'), timeSpentMs: 4000, evalBefore: -80 }
    const games = Array.from({ length: 4 }, (_, index) =>
      game(String(index + 1), Array.from({ length: 8 }, () => timed), { source: 'import', result: '1-0' }),
    )
    const estimate = estimateElo(games, { anchor: 1500 })
    expect(estimate.elo).toBe(1500 + 100)
    expect(estimate.subscores.find((score) => score.id === 'time')?.detail).toBe('4 s')
    expect(estimate.subscores.find((score) => score.id === 'defense')?.samples).toBe(32)
  })
})
