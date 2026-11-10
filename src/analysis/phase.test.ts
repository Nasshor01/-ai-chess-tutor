import { describe, expect, it } from 'vitest'
import { START_FEN } from '../chess/position'
import { assessMove } from './assess'
import { phaseOf } from './phase'

describe('game phase', () => {
  it('calls the start an opening and a bare king an endgame', () => {
    expect(phaseOf(START_FEN)).toBe('opening')
    expect(phaseOf('8/8/8/4k3/8/8/4K3/6Q1 w - - 0 40')).toBe('endgame')
    expect(phaseOf('q3k3/8/8/8/8/8/8/Q3K2R w - - 0 20')).toBe('middlegame')
  })
})

describe('move assessment', () => {
  it('records the centipawn loss and the drop in win probability', () => {
    const same = assessMove({
      before: { cp: 40, mate: null },
      after: { cp: 40, mate: null },
      color: 'w',
      playedUci: 'e2e4',
      bestUci: 'e2e4',
    })
    expect(same.cpLoss).toBe(0)
    expect(same.winLoss).toBe(0)
    expect(same.quality).toBe('best')

    const blunder = assessMove({
      before: { cp: 200, mate: null },
      after: { cp: -400, mate: null },
      color: 'w',
      playedUci: 'a2a3',
      bestUci: 'e2e4',
    })
    expect(blunder.cpLoss).toBe(600)
    expect(blunder.winLoss).toBeGreaterThan(22)
    expect(blunder.quality).toBe('blunder')
  })
})
