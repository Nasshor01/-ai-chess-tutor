import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { analyst, calculatorEngine, opponent, warmUpEngines } from '../engine/engines'
import type { Score } from '../engine/types'
import { lineToScore } from '../chess/utils'
import { detectOpening, getOpening, type Opening } from '../openings/openings'
import type { TutorComment, TutorMessage } from '../tutor/types'
import { useCalculatorBridge } from './useCalculatorBridge'
import { useGameCommands } from './useGameCommands'
import { useOpening } from './useOpening'
import { useOpponent } from './useOpponent'
import { useTutor } from './useTutor'
import { DIFFICULTIES } from './difficulty'
import { activePuzzle, nextId, startFen, welcomeMessages } from './messages'
import { ANALYSIS, MATE_ANALYSIS } from './search'
import { loadCalculatorEnabled, loadConceptProgress, loadSettings, loadSolvedPuzzles } from './storage'
import type { EngineStatus, GameOverInfo, GameSettings, HintArrow, PlyRecord, PuzzleStatus } from './types'

export function useChessGame() {
  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const settingsRef = useRef(settings)
  // Calculator Mode plays both colours. Initialised from the same flag so the first move already skips Stockfish.
  const [selfPlay, setSelfPlayState] = useState(() => loadCalculatorEnabled() && loadSettings().mode !== 'mate')
  const selfPlayRef = useRef(selfPlay)
  const conceptsRef = useRef(loadConceptProgress())

  const [initialChess] = useState(() => new Chess(startFen(settings)))
  const chessRef = useRef(initialChess)
  const genRef = useRef(0)
  const pliesRef = useRef<PlyRecord[]>([])
  const commentsRef = useRef<Record<number, TutorComment>>({})
  const commentJobsRef = useRef(new Map<number, Promise<unknown>>())
  const gameOverRef = useRef<GameOverInfo | null>(null)
  const wrongAttemptsRef = useRef(0)

  const [puzzleStatus, setPuzzleStatusState] = useState<PuzzleStatus>('playing')
  const puzzleStatusRef = useRef<PuzzleStatus>('playing')
  const [solvedPuzzles, setSolvedPuzzles] = useState<string[]>(loadSolvedPuzzles)
  const solvedRef = useRef(solvedPuzzles)
  const [judging, setJudging] = useState(false)
  const tipShownForRef = useRef<string | null>(null)

  const [fen, setFen] = useState(() => initialChess.fen())
  const [plies, setPlies] = useState<PlyRecord[]>([])
  const [messages, setMessages] = useState<TutorMessage[]>(() => welcomeMessages(settings))
  const [comments, setComments] = useState<Record<number, TutorComment>>({})
  const [evaluation, setEvaluation] = useState<Score | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [pendingAnalyses, setPendingAnalyses] = useState(0)
  const [hint, setHint] = useState<HintArrow | null>(null)
  const [gameOver, setGameOverState] = useState<GameOverInfo | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('loading')
  const [openingDone, setOpeningDoneState] = useState(false)
  const openingDoneRef = useRef(false)
  const didInitRef = useRef(false)

  const config = DIFFICULTIES[settings.difficulty]
  const activeOpening: Opening | undefined =
    settings.mode === 'opening' && settings.openingId ? getOpening(settings.openingId) : undefined

  const setOpeningDone = useCallback((done: boolean) => {
    openingDoneRef.current = done
    setOpeningDoneState(done)
  }, [])

  const setGameOver = useCallback((info: GameOverInfo | null) => {
    gameOverRef.current = info
    setGameOverState(info)
  }, [])

  const setPuzzleStatus = useCallback((status: PuzzleStatus) => {
    puzzleStatusRef.current = status
    setPuzzleStatusState(status)
  }, [])

  const puzzle = activePuzzle(settings)

  const commitPlies = useCallback((next: PlyRecord[]) => {
    pliesRef.current = next
    setPlies(next)
    setFen(chessRef.current.fen())
  }, [])

  const pushMessage = useCallback((message: TutorMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const replaceMessage = useCallback((id: string, message: TutorMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? message : m)))
  }, [])

  const storeComment = useCallback((comment: TutorComment) => {
    commentsRef.current = { ...commentsRef.current, [comment.plyIndex]: comment }
    setComments(commentsRef.current)
  }, [])

  /** Analyses the current position in the background (feeds the eval bar and makes hints instant). */
  const analyseCurrent = useCallback(() => {
    const currentFen = chessRef.current.fen()
    if (chessRef.current.isGameOver()) return
    analyst
      .analyze(currentFen, settingsRef.current.mode === 'mate' ? MATE_ANALYSIS : ANALYSIS)
      .then((result) => {
        if (chessRef.current.fen() === currentFen) setEvaluation(lineToScore(result.lines[0], currentFen))
      })
      .catch(() => undefined)
  }, [])

  const { isInBook, promptOpeningMove } = useOpening({
    settingsRef,
    pliesRef,
    chessRef,
    pushMessage,
    setOpeningDone,
    setHint,
  })

  const { finishGame, commentOnPly, judgeMatePly, concludePuzzle, explainPly } = useTutor({
    settingsRef,
    selfPlayRef,
    conceptsRef,
    chessRef,
    genRef,
    pliesRef,
    commentsRef,
    commentJobsRef,
    solvedRef,
    pushMessage,
    replaceMessage,
    storeComment,
    setGameOver,
    setAiThinking,
    setPendingAnalyses,
    setJudging,
    setPuzzleStatus,
    setSolvedPuzzles,
    setEvaluation,
    setMessages,
  })

  const playOpponent = useOpponent({
    selfPlayRef,
    settingsRef,
    chessRef,
    genRef,
    pliesRef,
    gameOverRef,
    openingDoneRef,
    isInBook,
    setAiThinking,
    commitPlies,
    pushMessage,
    finishGame,
    concludePuzzle,
    promptOpeningMove,
    analyseCurrent,
  })

  const { loadPosition, openInCalculator } = useCalculatorBridge({
    settingsRef,
    selfPlayRef,
    chessRef,
    genRef,
    commentsRef,
    commentJobsRef,
    wrongAttemptsRef,
    gameOverRef,
    setSettings,
    setSelfPlayState,
    setPuzzleStatus,
    setJudging,
    setOpeningDone,
    setComments,
    setGameOver,
    setHint,
    setAiThinking,
    setPendingAnalyses,
    setEvaluation,
    setMessages,
    commitPlies,
    pushMessage,
    analyseCurrent,
  })

  const { makeMove, newGame, startPuzzle, nextPuzzle, exitPuzzles, undo, resign, setSelfPlay, requestHint } = useGameCommands({
    settingsRef,
    selfPlayRef,
    chessRef,
    genRef,
    pliesRef,
    commentsRef,
    commentJobsRef,
    gameOverRef,
    wrongAttemptsRef,
    puzzleStatusRef,
    solvedRef,
    openingDoneRef,
    tipShownForRef,
    setSettings,
    setSelfPlayState,
    setPuzzleStatus,
    setJudging,
    setOpeningDone,
    setComments,
    setGameOver,
    setHint,
    setAiThinking,
    setPendingAnalyses,
    setEvaluation,
    setMessages,
    commitPlies,
    pushMessage,
    analyseCurrent,
    isInBook,
    promptOpeningMove,
    finishGame,
    commentOnPly,
    judgeMatePly,
    concludePuzzle,
    playOpponent,
  })

  const clearHint = useCallback(() => setHint(null), [])

  const notify = useCallback(
    (title: string, text: string) =>
      pushMessage({ id: nextId(), kind: 'info', title, text, plyIndex: pliesRef.current.length - 1 }),
    [pushMessage],
  )

  useEffect(() => {
    const lifecycle = { cancelled: false }
    warmUpEngines()
      .then(() => {
        if (lifecycle.cancelled) return
        setEngineStatus('ready')
        analyseCurrent()
      })
      .catch(() => {
        if (lifecycle.cancelled) return
        setEngineStatus('error')
        pushMessage({
          id: nextId(),
          kind: 'info',
          title: 'Engine se nepodařilo načíst',
          text: 'Stockfish se nespustil, takže trenér bude komentovat jen základní principy a počítač bude hrát náhodněji.',
        })
      })
    if (!didInitRef.current) {
      didInitRef.current = true
      if (settingsRef.current.mode === 'opening' && pliesRef.current.length === 0) promptOpeningMove()
    }
    return () => {
      lifecycle.cancelled = true
    }
  }, [analyseCurrent, promptOpeningMove, pushMessage])

  useEffect(() => {
    return () => {
      analyst.terminate()
      opponent.terminate()
      calculatorEngine.terminate()
    }
  }, [])

  const position = useMemo(() => new Chess(fen), [fen])
  const turn = position.turn()
  const lastMove = plies.length ? plies[plies.length - 1].move : null
  const openingName = useMemo(() => {
    if (activeOpening) return activeOpening.name
    return detectOpening(plies.map((p) => p.move.san))?.name ?? null
  }, [activeOpening, plies])

  return {
    settings,
    config,
    fen,
    plies,
    messages,
    comments,
    evaluation,
    aiThinking,
    analysing: pendingAnalyses > 0,
    hint,
    gameOver,
    engineStatus,
    openingName,
    openingDone,
    activeOpening,
    turn,
    inCheck: position.inCheck(),
    lastMove,
    canMove:
      !gameOver && !aiThinking && !judging && ((selfPlay && !puzzle) || turn === 'w') && (!puzzle || puzzleStatus === 'playing'),
    selfPlay,
    setSelfPlay,
    puzzle,
    puzzleStatus,
    solvedPuzzles,
    judging,
    startPuzzle,
    nextPuzzle,
    exitPuzzles,
    makeMove,
    newGame,
    loadPosition,
    openInCalculator,
    undo,
    resign,
    requestHint,
    explainPly,
    clearHint,
    notify,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
