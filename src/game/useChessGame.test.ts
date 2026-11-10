// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EngineResult } from '../engine/types'
import { useChessGame } from './useChessGame'

const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
const BLACK_MATES = 'K7/8/k7/8/8/8/8/7r b - - 0 1'
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1'

const engine = vi.hoisted(() => {
  const pending: Array<{ fen: string; resolve: (result: EngineResult) => void }> = []
  return {
    pending,
    analyze(fen: string) {
      return new Promise<EngineResult>((resolve) => {
        pending.push({ fen, resolve })
      })
    },
  }
})

vi.mock('../engine/engines', () => ({
  warmUpEngines: () => Promise.resolve(),
  analyst: {
    analyze: (fen: string) => engine.analyze(fen),
    bestMove: () => Promise.resolve({ bestMove: 'e7e5' }),
    cancelAll: () => undefined,
    resetGame: () => undefined,
    terminate: () => undefined,
  },
  opponent: {
    analyze: (fen: string) => engine.analyze(fen),
    bestMove: () => Promise.resolve({ bestMove: 'e7e5' }),
    cancelAll: () => undefined,
    resetGame: () => undefined,
    terminate: () => undefined,
  },
  calculatorEngine: {
    analyze: (fen: string) => engine.analyze(fen),
    bestMove: () => Promise.resolve({ bestMove: null }),
    cancelAll: () => undefined,
    resetGame: () => undefined,
    terminate: () => undefined,
  },
}))

function fake(fen: string): EngineResult {
  return { fen, bestMove: null, lines: [], depth: 12, requestedDepth: 12, multipv: 1 }
}

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const slot: { api: ReturnType<typeof useChessGame> | null } = { api: null }
  function Harness(): ReactNode {
    slot.api = useChessGame()
    return null
  }
  act(() => {
    root.render(createElement(Harness))
  })
  return {
    get api() {
      if (!slot.api) throw new Error('hook is not mounted')
      return slot.api
    },
    unmount() {
      act(() => root.unmount())
      container.remove()
    },
  }
}

async function flushMount() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Resolves every analysis that is in flight, including ones started by the resolution itself. */
async function drain() {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      const batch = engine.pending.splice(0)
      for (const item of batch) item.resolve(fake(item.fen))
      await Promise.resolve()
      await Promise.resolve()
      if (engine.pending.length === 0) break
    }
    await Promise.resolve()
  })
}

let mounted: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  engine.pending.length = 0
  vi.useFakeTimers()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('useChessGame flows', () => {
  it('names the winner in the player’s voice after a normal mate', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.loadPosition(BACK_RANK)).toBe(true)
      mounted!.api.setSelfPlay(false)
    })
    act(() => {
      expect(mounted!.api.makeMove({ from: 'd1', to: 'd8' })).toBe(true)
    })
    await drain()
    expect(mounted.api.gameOver?.summary?.title).toBe('Vyhrál jsi matem!')
  })

  it('names which colour mated when the player is both sides', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.loadPosition(BACK_RANK)).toBe(true)
    })
    act(() => {
      expect(mounted!.api.makeMove({ from: 'd1', to: 'd8' })).toBe(true)
    })
    await drain()
    expect(mounted.api.gameOver?.summary?.title).toBe('Bílý dal mat')

    act(() => {
      expect(mounted!.api.loadPosition(BLACK_MATES)).toBe(true)
    })
    expect(mounted.api.selfPlay).toBe(true)
    act(() => {
      expect(mounted!.api.makeMove({ from: 'h1', to: 'h8' })).toBe(true)
    })
    await drain()
    expect(mounted.api.gameOver?.summary?.title).toBe('Černý dal mat')
  })

  it('rejects a move that leaves the opening book and keeps the position', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      mounted!.api.newGame({ mode: 'opening', openingId: 'italian' })
    })
    act(() => {
      expect(mounted!.api.makeMove({ from: 'e2', to: 'e4' })).toBe(true)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(mounted.api.plies.map((ply) => ply.move.san)).toEqual(['e4', 'e5'])
    act(() => {
      expect(mounted!.api.makeMove({ from: 'a2', to: 'a3' })).toBe(false)
    })
    expect(mounted.api.plies.map((ply) => ply.move.san)).toEqual(['e4', 'e5'])
    expect(mounted.api.messages.some((message) => message.kind === 'opening' && message.title.includes('není tah'))).toBe(true)
  })

  it('loads a FEN into self-play and lets the player move both colours', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.loadPosition(BLACK_TO_MOVE)).toBe(true)
    })
    expect(mounted.api.turn).toBe('b')
    expect(mounted.api.selfPlay).toBe(true)
    expect(mounted.api.messages.some((message) => message.kind === 'info' && message.text.includes('Na tahu je černý'))).toBe(true)
    act(() => {
      expect(mounted!.api.makeMove({ from: 'e7', to: 'e5' })).toBe(true)
      expect(mounted!.api.makeMove({ from: 'e2', to: 'e4' })).toBe(true)
    })
    expect(mounted.api.plies.map((ply) => ply.byUser)).toEqual([true, true])
    expect(mounted.api.turn).toBe('b')
  })

  it('does not store a comment that resolves after genRef moved on', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.makeMove({ from: 'e2', to: 'e4' })).toBe(true)
    })
    expect(engine.pending.length).toBeGreaterThan(0)
    act(() => {
      mounted!.api.undo()
    })
    expect(mounted.api.plies).toHaveLength(0)
    await drain()
    expect(mounted.api.comments).toEqual({})
    expect(mounted.api.messages.some((message) => message.kind === 'comment')).toBe(false)
  })
})
