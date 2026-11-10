import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, DEFAULT_POSITION } from 'chess.js'
import { analyst, calculatorEngine, opponent, warmUpEngines } from '../engine/engines'
import { detectEnd } from './end'
import { scheduleLearning } from './learning'
import { abandonLiveGame, loadRestorableGame, rememberLiveGame, replaySavedGame, type LiveSlot } from './persist'
import { resumeStoredAnalysis } from './analysisBridge'
import { reportStorageFailure } from '../storage/errors'
import { gameBundle, removeGame, setActiveGameId } from '../storage/games'
import type { Game, MoveRecord } from '../storage/types'
import type { Score } from '../engine/types'
import { lineToScore } from '../chess/utils'
import { nameForPosition, type Book } from '../openings/book/book'
import { loadOpeningBook } from '../openings/loadBook'
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
import {
  bootstrapStorage,
  conceptProgressFrom,
  loadCalculatorEnabled,
  loadConceptProgress,
  loadSettings,
  loadSolvedPuzzles,
} from './storage'
import type { GameEndReason, GameOutcome } from '../tutor/summary'
import type { EngineStatus, GameOverInfo, GameSettings, HintArrow, PlyRecord, PuzzleStatus } from './types'

export function useChessGame() {
  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const [savedGameId, setSavedGameId] = useState<string | null>(null)
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
  const [openingBook, setOpeningBook] = useState<Book | null>(null)
  const [openingDone, setOpeningDoneState] = useState(false)
  const openingDoneRef = useRef(false)
  const didInitRef = useRef(false)
  const didRestore = useRef(false)
  const slotRef = useRef<LiveSlot>({
    id: { current: null },
    createdAt: { current: null },
    startFen: { current: DEFAULT_POSITION },
  })

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

  const publishPlies = useCallback(
    (gen: number, finished: { outcome: GameOutcome; reason: GameEndReason } | null = null) => {
      const id = rememberLiveGame({
        slot: slotRef.current,
        gen,
        genNow: () => genRef.current,
        mode: settingsRef.current.mode,
        selfPlay: selfPlayRef.current,
        personal: settingsRef.current.opponent === 'personal' && settingsRef.current.mode === 'free',
        personalMode: settingsRef.current.personalMode,
        plies: pliesRef.current,
        finished,
      })
      setSavedGameId(id)
      if (finished && id) scheduleLearning(id)
    },
    [slotRef],
  )

  const onAbandon = useCallback(() => {
    abandonLiveGame(slotRef.current)
    setSavedGameId(null)
  }, [slotRef])

  const onGameFinished = useCallback(
    (outcome: GameOutcome, reason: GameEndReason, gen: number) => publishPlies(gen, { outcome, reason }),
    [publishPlies],
  )

  const onPositionLoaded = useCallback(
    (fen: string, end: { outcome: GameOutcome; reason: GameEndReason } | null) => {
      slotRef.current.id.current = null
      slotRef.current.createdAt.current = null
      slotRef.current.startFen.current = fen
      setSavedGameId(
        rememberLiveGame({
          slot: slotRef.current,
          gen: genRef.current,
          genNow: () => genRef.current,
          mode: 'free',
          selfPlay: true,
          personal: false,
          plies: [],
          finished: end,
        }),
      )
    },
    [slotRef],
  )

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
    onGameFinished,
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
    onPliesChanged: publishPlies,
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
    onPositionLoaded,
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
    onPliesChanged: publishPlies,
    onAbandon,
  })

  const clearHint = useCallback(() => setHint(null), [])

  const notify = useCallback(
    (title: string, text: string) =>
      pushMessage({ id: nextId(), kind: 'info', title, text, plyIndex: pliesRef.current.length - 1 }),
    [pushMessage],
  )

  useEffect(() => {
    const lifecycle = { cancelled: false }
    void resumeStoredAnalysis()
    void bootstrapStorage().then((stored) => {
      if (lifecycle.cancelled || !stored) return
      if (stored.settings) {
        settingsRef.current = stored.settings
        setSettings(stored.settings)
      }
      if (stored.concepts) conceptsRef.current = conceptProgressFrom(stored.concepts)
      if (stored.solvedPuzzles) {
        solvedRef.current = stored.solvedPuzzles
        setSolvedPuzzles(stored.solvedPuzzles)
      }
      if (stored.calculator !== null && settingsRef.current.mode !== 'mate') {
        selfPlayRef.current = stored.calculator
        setSelfPlayState(stored.calculator)
      }
    })
    return () => {
      lifecycle.cancelled = true
    }
  }, [])

  const applyRestored = useCallback(
    (bundle: { game: Game; moves: MoveRecord[] }, announce: boolean) => {
      genRef.current += 1
      analyst.cancelAll()
      opponent.cancelAll()
      calculatorEngine.cancelAll()
      const plies = replaySavedGame(chessRef.current, bundle.game.startFen, bundle.moves)
      if (!plies) return false
      slotRef.current.id.current = bundle.game.id
      setSavedGameId(bundle.game.id)
      slotRef.current.createdAt.current = bundle.game.createdAt
      slotRef.current.startFen.current = bundle.game.startFen
      const selfPlay = bundle.game.source === 'app-calculator' || bundle.game.userColor === 'both'
      selfPlayRef.current = selfPlay
      setSelfPlayState(selfPlay)
      const merged = { ...settingsRef.current, mode: 'free' as const }
      settingsRef.current = merged
      setSettings(merged)
      commentsRef.current = {}
      setComments({})
      setHint(null)
      setAiThinking(false)
      setPendingAnalyses(0)
      setJudging(false)
      commitPlies(plies)
      void setActiveGameId(bundle.game.id).catch((error: unknown) => reportStorageFailure(error))
      if (announce) {
        setMessages([
          {
            id: nextId(),
            kind: 'info',
            title: 'Rozehraná partie',
            text: 'Pokračuješ tam, kde jsi skončil.',
          },
        ])
      }
      const end = detectEnd(chessRef.current)
      if (end) setGameOver({ outcome: end.outcome, reason: end.reason, summary: null })
      else {
        setGameOver(null)
        if (!selfPlay && chessRef.current.turn() === 'b') void playOpponent(genRef.current)
        else analyseCurrent()
      }
      return true
    },
    [analyseCurrent, commitPlies, playOpponent, setGameOver, slotRef],
  )

  const resumeGame = useCallback(
    async (id: string) => {
      const bundle = await gameBundle(id).catch((error: unknown) => {
        reportStorageFailure(error)
        return null
      })
      if (!bundle) return false
      return applyRestored(bundle, true)
    },
    [applyRestored],
  )

  const deleteSavedGame = useCallback(
    async (id: string) => {
      if (slotRef.current.id.current === id) {
        slotRef.current.id.current = null
        setSavedGameId(null)
        slotRef.current.createdAt.current = null
      }
      await removeGame(id)
    },
    [slotRef],
  )

  useEffect(() => {
    if (didRestore.current) return
    const lifecycle = { cancelled: false }
    void loadRestorableGame().then((bundle) => {
      if (lifecycle.cancelled || didRestore.current) return
      didRestore.current = true
      if (!bundle || genRef.current !== 0 || pliesRef.current.length > 0) return
      applyRestored(bundle, false)
    })
    return () => {
      lifecycle.cancelled = true
    }
  }, [applyRestored])

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
      if (settingsRef.current.mode === 'opening' && pliesRef.current.length === 0) {
        const id = settingsRef.current.openingId
        if (id && !getOpening(id)) {
          void loadOpeningBook().then(() => {
            if (settingsRef.current.mode === 'opening' && pliesRef.current.length === 0) promptOpeningMove()
          })
        } else {
          promptOpeningMove()
        }
      }
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
  useEffect(() => {
    const lifecycle = { cancelled: false }
    void loadOpeningBook()
      .then((book) => {
        if (!lifecycle.cancelled) setOpeningBook(book)
      })
      .catch(() => undefined)
    return () => {
      lifecycle.cancelled = true
    }
  }, [])

  const openingName = useMemo(() => {
    if (activeOpening) return activeOpening.name
    if (openingBook) {
      const named = nameForPosition(openingBook, fen)
      if (named) return named
    }
    return detectOpening(plies.map((p) => p.move.san))?.name ?? null
  }, [activeOpening, fen, openingBook, plies])

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
    savedGameId,
    resumeGame,
    deleteSavedGame,
    requestHint,
    explainPly,
    clearHint,
    notify,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
