import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { calculatorEngine } from '../engine/engines'
import { EngineCancelledError } from '../engine/stockfish'
import { loadCalculatorEnabled, saveCalculatorEnabled } from '../game/storage'
import type { ChessGame } from '../game/useChessGame'
import { activeSuggestionIndex, selectCalculatorArrows, type BoardArrow, boardArrowColor } from './boardArrows'
import { hydrateShowAllArrows, loadShowAllArrows, persistShowAllArrows } from './arrowPreference'
import { calculate, type Analyze, type CalcOption, type CalcResult } from './calculator'

export const OPTION_COLORS: Record<CalcOption['letter'], string> = {
  A: 'rgba(96, 165, 250, 0.95)',
  B: 'rgba(251, 191, 36, 0.95)',
  C: 'rgba(248, 113, 113, 0.95)',
}

/** Mating line is purple; a slower-but-winning move stays neutral instead of looking like a blunder. */
export function optionColor(option: Pick<CalcOption, 'kind' | 'letter' | 'keeps'>): string {
  if (option.kind === 'mate') return 'rgba(167, 139, 250, 0.95)'
  if (option.kind === 'slow' && option.keeps !== false) return 'rgba(148, 163, 184, 0.95)'
  return OPTION_COLORS[option.letter]
}

export { boardArrowColor, type BoardArrow }

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
  const [optionFocus, setOptionFocus] = useState<{ fen: string; pinned: number | null; hovered: number | null }>({
    fen: '',
    pinned: null,
    hovered: null,
  })
  const [showAllArrows, setShowAllArrowsState] = useState(loadShowAllArrows)
  const showAllTouched = useRef(false)
  const announcedRef = useRef<string | null>(null)

  const unavailableReason = game.puzzle
    ? 'V tréninku matů je kalkulačka vypnutá – mat najdi sám!'
    : game.gameOver
      ? 'Partie skončila.'
      : null
  const bothSides = enabled && !game.puzzle
  const active = bothSides && !game.gameOver && game.engineStatus === 'ready' && game.canMove
  const { fen, plies, comments, notify, setSelfPlay } = game
  const pinnedOption = optionFocus.fen === fen ? optionFocus.pinned : null
  const hoveredOption = optionFocus.fen === fen ? optionFocus.hovered : null
  const setPinnedOption = useCallback((pinned: number | null) => {
    setOptionFocus((current) => ({ fen, pinned, hovered: current.fen === fen ? current.hovered : null }))
  }, [fen])
  const setHoveredOption = useCallback((hovered: number | null) => {
    setOptionFocus((current) => ({ fen, hovered, pinned: current.fen === fen ? current.pinned : null }))
  }, [fen])
  const releaseSuggestion = useCallback(() => {
    setOptionFocus({ fen, pinned: null, hovered: null })
  }, [fen])
  const setShowAllArrows = useCallback((value: boolean) => {
    showAllTouched.current = true
    setShowAllArrowsState(value)
    persistShowAllArrows(value)
  }, [])

  useEffect(() => {
    const life = { cancelled: false }
    void hydrateShowAllArrows().then((stored) => {
      if (life.cancelled || showAllTouched.current || stored === null) return
      setShowAllArrowsState(stored)
    })
    return () => {
      life.cancelled = true
    }
  }, [])

  // The user moves for both colours whenever the calculator is on (and not in a mating puzzle).
  useEffect(() => {
    setSelfPlay(bothSides)
  }, [bothSides, setSelfPlay])

  useEffect(() => {
    if (!enabled) calculatorEngine.terminate()
  }, [enabled])

  useEffect(() => {
    return () => calculatorEngine.terminate()
  }, [])

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
    const history: Move[] = gameRef.current.plies.map((p) => p.move)
    const ownMoves = gameRef.current.plies.filter((ply) => ply.byUser).map((ply) => ply.move)
    calculate(fen, history, analyze, cancelled, ownMoves)
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
    const who = last.move.color === 'w' ? 'bílé' : 'černé'
    notify(
      'Režim kalkulačka',
      `Za ${who} jsi zahrál „${option.label}“ (${option.san}).${expected ? ` V pokračování se nabízí ${expected}.` : ''}`,
    )
  }, [computed, enabled, notify, plies])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      saveCalculatorEnabled(!prev)
      return !prev
    })
    setPreviewState(null)
  }, [])

  const enable = useCallback(() => {
    setEnabled((prev) => {
      if (prev) return prev
      saveCalculatorEnabled(true)
      return true
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
      nextArrow: next ? { from: next.slice(0, 2), to: next.slice(2, 4), color: boardArrowColor(option) } : null,
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

  const playOption = useCallback(
    (optionIndex: number) => {
      const option = (computed?.fen === fen ? computed.result : null)?.options[optionIndex]
      if (!option) return
      const promotion = option.uci.length > 4 ? (option.uci[4] as Move['promotion']) : undefined
      setPreviewState(null)
      game.makeMove({ from: option.from, to: option.to, promotion })
    },
    [computed, fen, game],
  )

  const arrows: BoardArrow[] = useMemo(
    () =>
      selectCalculatorArrows({
        positionFen: fen,
        resultFen: active && result ? fen : null,
        options: result?.options ?? [],
        hovered: hoveredOption,
        pinned: preview ? preview.index : pinnedOption,
        showAll: showAllArrows,
        previewing: preview != null,
        previewArrow: preview?.nextArrow ?? null,
      }),
    [active, fen, hoveredOption, pinnedOption, preview, result, showAllArrows],
  )
  const activeOption = preview
    ? preview.index
    : activeSuggestionIndex(result?.options ?? [], hoveredOption, pinnedOption)

  return {
    enabled,
    toggle,
    enable,
    unavailableReason,
    loading,
    waiting: enabled && !unavailableReason && !game.canMove && game.engineStatus === 'ready',
    engineLoading: enabled && !unavailableReason && game.engineStatus !== 'ready',
    result: active ? result : null,
    side: game.turn,
    preview,
    pinnedOption,
    setPinnedOption,
    hoveredOption,
    setHoveredOption,
    releaseSuggestion,
    activeOption,
    showAllArrows,
    setShowAllArrows,
    openPreview,
    stepPreview,
    closePreview,
    playOption,
    arrows,
  }
}

export type Calculator = ReturnType<typeof useCalculator>
