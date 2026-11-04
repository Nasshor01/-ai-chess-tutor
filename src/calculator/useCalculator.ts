import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { calculatorEngine } from '../engine/engines'
import { EngineCancelledError } from '../engine/stockfish'
import { loadCalculatorEnabled, saveCalculatorEnabled } from '../game/storage'
import type { ChessGame } from '../game/useChessGame'
import { calculate, detectStyle, type Analyze, type CalcOption, type CalcResult } from './calculator'

export const OPTION_COLORS: Record<CalcOption['letter'], string> = {
  A: 'rgba(96, 165, 250, 0.9)',
  B: 'rgba(249, 115, 22, 0.9)',
  C: 'rgba(52, 211, 153, 0.9)',
}

export interface BoardArrow {
  from: string
  to: string
  color: string
}

interface Computed {
  fen: string
  result: CalcResult | null
}

interface PreviewState {
  fen: string
  option: number
  step: number
}

export function useCalculator(game: ChessGame) {
  const [enabled, setEnabled] = useState(loadCalculatorEnabled)
  const [computed, setComputed] = useState<Computed | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const announcedRef = useRef<string | null>(null)

  const unavailableReason = game.puzzle
    ? 'V tréninku matů je kalkulačka vypnutá – mat najdi sám!'
    : game.gameOver
      ? 'Partie skončila.'
      : null
  const active = enabled && !unavailableReason && game.canMove && game.engineStatus === 'ready'
  const style = useMemo(() => detectStyle(game.plies, game.comments), [game.plies, game.comments])
  const { fen, plies, comments, notify } = game

  // Comments arrive asynchronously; reading them through a ref avoids restarting the search for each one.
  const gameRef = useRef({ plies, comments })
  useEffect(() => {
    gameRef.current = { plies, comments }
  }, [plies, comments])

  useEffect(() => {
    if (!active) return
    const state = { cancelled: false }
    const cancelled = () => state.cancelled
    const analyze: Analyze = (f, o) =>
      cancelled() ? Promise.reject(new EngineCancelledError()) : calculatorEngine.analyze(f, o)
    const current = gameRef.current
    const history: Move[] = current.plies.map((p) => p.move)
    calculate(fen, history, detectStyle(current.plies, current.comments), analyze, cancelled)
      .then((result) => {
        if (!cancelled()) setComputed({ fen, result })
      })
      .catch(() => {
        if (!cancelled()) setComputed({ fen, result: null })
      })
    return () => {
      state.cancelled = true
      calculatorEngine.cancelAll()
    }
  }, [active, fen])

  const result = computed?.fen === fen ? computed.result : null
  const loading = active && computed?.fen !== fen

  // Tie the calculator into the tutor feed when the player follows one of its suggestions.
  useEffect(() => {
    const last = plies[plies.length - 1]
    if (!enabled || !last?.byUser || computed?.fen !== last.move.before || !computed.result) return
    const key = `${last.index}:${last.move.before}`
    if (announcedRef.current === key) return
    const uci = `${last.move.from}${last.move.to}${last.move.promotion ?? ''}`
    const option = computed.result.options.find((o) => o.uci === uci)
    if (!option) return
    announcedRef.current = key
    const expected = option.branches[0]?.reply
    notify(
      'Calculator Mode',
      `Zvolil jsi „${option.label}“.${expected ? ` Podle propočtu soupeř nejspíš odpoví ${expected}.` : ''}`,
    )
  }, [computed, enabled, notify, plies])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      saveCalculatorEnabled(!prev)
      return !prev
    })
    setPreviewState(null)
  }, [])

  const preview = useMemo(() => {
    if (!previewState || previewState.fen !== fen || !result) return null
    const option = result.options[previewState.option]
    if (!option) return null
    const board = new Chess(fen)
    let lastMove: Move | null = null
    for (const uci of option.preview.slice(0, previewState.step)) {
      lastMove = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    }
    const next = option.preview[previewState.step]
    return {
      option,
      index: previewState.option,
      step: previewState.step,
      total: option.preview.length,
      fen: board.fen(),
      lastMove,
      inCheck: board.inCheck(),
      nextArrow: next ? { from: next.slice(0, 2), to: next.slice(2, 4), color: OPTION_COLORS[option.letter] } : null,
    }
  }, [fen, previewState, result])

  const openPreview = useCallback((option: number) => setPreviewState({ fen, option, step: 1 }), [fen])
  const stepPreview = useCallback(
    (delta: number) =>
      setPreviewState((prev) => {
        if (!prev || !result) return prev
        const total = result.options[prev.option]?.preview.length ?? 1
        return { ...prev, step: Math.max(0, Math.min(total, prev.step + delta)) }
      }),
    [result],
  )
  const closePreview = useCallback(() => setPreviewState(null), [])

  const arrows: BoardArrow[] = useMemo(() => {
    if (preview) return preview.nextArrow ? [preview.nextArrow] : []
    if (!active || !result) return []
    return result.options.map((o) => ({ from: o.from, to: o.to, color: OPTION_COLORS[o.letter] }))
  }, [active, preview, result])

  return {
    enabled,
    toggle,
    unavailableReason,
    loading,
    waiting: enabled && !unavailableReason && !game.canMove,
    result: active ? result : null,
    style,
    preview,
    openPreview,
    stepPreview,
    closePreview,
    arrows,
  }
}

export type Calculator = ReturnType<typeof useCalculator>
