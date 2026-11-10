import { describe, expect, it } from 'vitest'
import { parseInfo } from './uci'

describe('parseInfo', () => {
  it('reads depth, centipawns and the principal variation', () => {
    const line = 'info depth 10 seldepth 14 multipv 1 score cp 23 nodes 1000 nps 50000 time 20 pv e2e4 e7e5 g1f3'
    expect(parseInfo(line)).toEqual({
      multipv: 1,
      depth: 10,
      cp: 23,
      mate: null,
      pv: ['e2e4', 'e7e5', 'g1f3'],
    })
  })

  it('keeps the mate distance, including a mate against the side to move', () => {
    expect(parseInfo('info depth 18 seldepth 22 multipv 1 score mate 3 nodes 5000 time 40 pv d1h5 e7e5 h5f7')).toMatchObject({
      mate: 3,
      cp: null,
      pv: ['d1h5', 'e7e5', 'h5f7'],
    })
    expect(parseInfo('info depth 8 multipv 1 score mate -2 pv e7e8q')).toMatchObject({
      mate: -2,
      pv: ['e7e8q'],
    })
  })

  it('reads a later MultiPV line without mixing it into the first', () => {
    expect(parseInfo('info depth 12 multipv 2 score cp -15 pv e7e5 g1f3')).toEqual({
      multipv: 2,
      depth: 12,
      cp: -15,
      mate: null,
      pv: ['e7e5', 'g1f3'],
    })
  })

  it('ignores lowerbound and upperbound and still keeps the score', () => {
    expect(parseInfo('info depth 14 multipv 1 score cp 40 lowerbound nodes 10 time 1 pv e2e4')?.cp).toBe(40)
    expect(parseInfo('info depth 14 multipv 1 score cp 10 upperbound pv d2d4')).toMatchObject({
      cp: 10,
      pv: ['d2d4'],
    })
    expect(parseInfo('info depth 9 multipv 1 score mate 1 lowerbound pv h5f7')).toMatchObject({ mate: 1, cp: null })
  })

  it('returns null when the line has no variation, including mate 0', () => {
    expect(parseInfo('info depth 0 score mate 0')).toBeNull()
    expect(parseInfo('info string NNUE evaluation using nn-1234')).toBeNull()
  })
})
