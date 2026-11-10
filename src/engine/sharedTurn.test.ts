import { describe, expect, it } from 'vitest'
import { beginSharedOpponentTurn, preferSharedEngine } from './sharedTurn'

describe('shared worker opponent', () => {
  it('cancels a running analysis and does not wait for it when there are four cores or fewer', async () => {
    expect(preferSharedEngine(4)).toBe(true)
    let cancelled = false
    let busy = false
    const analysisNeverEnds = new Promise<string>(() => undefined)
    const started = performance.now()
    const plan = beginSharedOpponentTurn(
      preferSharedEngine(4),
      () => {
        cancelled = true
      },
      (active) => {
        busy = active
      },
    )
    const move = await Promise.race([
      Promise.resolve('e7e5'),
      analysisNeverEnds,
      new Promise<string>((resolve) => setTimeout(() => resolve('timed-out'), 40)),
    ])
    expect(plan.waitsForAnalysis).toBe(false)
    expect(move).toBe('e7e5')
    expect(performance.now() - started).toBeLessThan(40)
    expect(cancelled).toBe(true)
    expect(busy).toBe(true)
  })

  it('leaves analysis running when the opponent has its own worker', () => {
    expect(preferSharedEngine(8)).toBe(false)
    let cancelled = false
    beginSharedOpponentTurn(
      preferSharedEngine(8),
      () => {
        cancelled = true
      },
      () => undefined,
    )
    expect(cancelled).toBe(false)
  })
})