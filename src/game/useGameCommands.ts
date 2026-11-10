import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { Chess, type Move } from 'chess.js'
import { analyst, calculatorEngine, opponent } from '../engine/engines'
import type { Score } from '../engine/types'
import { applyUci, czSan, formatLine, pvToSan } from '../chess/utils'
import { getPuzzle, nextPuzzleId, type MatePuzzle } from '../puzzles/matePuzzles'
import { explainMove } from '../tutor/commentary'
import type { MateOutcome } from '../tutor/mating'
import type { GameEndReason, GameOutcome } from '../tutor/summary'
import type { TutorComment, TutorMessage } from '../tutor/types'
import { detectEnd } from './end'
import { getOpening, type Opening } from '../openings/openings'
import { loadOpeningBook } from '../openings/loadBook'
import { activePuzzle, bookLineText, nextId, startFen, welcomeMessages } from './messages'
import { ANALYSIS, MATE_ANALYSIS } from './search'
import { saveSettings } from './storage'
import type { GameOverInfo, GameSettings, HintArrow, MoveInput, PlyRecord, PuzzleStatus } from './types'

type Ref<T> = { current: T }
type Book = { opening: Opening; index: number; expected: Opening['moves'][number] } | null

export function useGameCommands(args: {
  settingsRef: Ref<GameSettings>
  selfPlayRef: Ref<boolean>
  chessRef: Ref<Chess>
  genRef: Ref<number>
  pliesRef: Ref<PlyRecord[]>
  commentsRef: Ref<Record<number, TutorComment>>
  commentJobsRef: Ref<Map<number, Promise<unknown>>>
  gameOverRef: Ref<GameOverInfo | null>
  wrongAttemptsRef: Ref<number>
  puzzleStatusRef: Ref<PuzzleStatus>
  solvedRef: Ref<string[]>
  openingDoneRef: Ref<boolean>
  tipShownForRef: Ref<string | null>
  setSettings: Dispatch<SetStateAction<GameSettings>>
  setSelfPlayState: Dispatch<SetStateAction<boolean>>
  setPuzzleStatus: (status: PuzzleStatus) => void
  setJudging: Dispatch<SetStateAction<boolean>>
  setOpeningDone: (done: boolean) => void
  setComments: Dispatch<SetStateAction<Record<number, TutorComment>>>
  setGameOver: (info: GameOverInfo | null) => void
  setHint: Dispatch<SetStateAction<HintArrow | null>>
  setAiThinking: Dispatch<SetStateAction<boolean>>
  setPendingAnalyses: Dispatch<SetStateAction<number>>
  setEvaluation: Dispatch<SetStateAction<Score | null>>
  setMessages: Dispatch<SetStateAction<TutorMessage[]>>
  commitPlies: (next: PlyRecord[]) => void
  pushMessage: (message: TutorMessage) => void
  analyseCurrent: () => void
  isInBook: () => Book
  promptOpeningMove: () => void
  finishGame: (outcome: GameOutcome, reason: GameEndReason, gen: number) => Promise<void>
  commentOnPly: (ply: PlyRecord, gen: number, explain: boolean) => Promise<unknown> | undefined
  judgeMatePly: (ply: PlyRecord, gen: number, puzzle: MatePuzzle) => Promise<MateOutcome | null>
  concludePuzzle: (solved: boolean, plyIndex: number, text?: string, title?: string) => void
  playOpponent: (gen: number) => Promise<void>
  onPliesChanged: (gen: number) => void
  onAbandon: () => void
}) {
  const {
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
    onPliesChanged,
    onAbandon,
  } = args

  const makeMove = useCallback(
    ({ from, to, promotion }: MoveInput): boolean => {
      const chess = chessRef.current
      const puzzle = activePuzzle(settingsRef.current)
      const selfPlayNow = selfPlayRef.current && !puzzle
      if (gameOverRef.current || (!selfPlayNow && chess.turn() !== 'w')) return false
      if (puzzle && puzzleStatusRef.current !== 'playing') return false

      const book = isInBook()
      let move: Move
      try {
        move = chess.move({ from, to, promotion: promotion ?? 'q' })
      } catch {
        return false
      }

      if (!selfPlayNow && book && move.san !== book.expected.san) {
        chess.undo()
        wrongAttemptsRef.current++
        const reveal = wrongAttemptsRef.current >= 2
        pushMessage({
          id: nextId(),
          kind: 'opening',
          plyIndex: pliesRef.current.length - 1,
          tone: 'warning',
          title: `${czSan(move.san)} není tah z této varianty`,
          text: reveal
            ? bookLineText(book.opening.name, book.expected.san, book.expected.explanation)
            : 'Zkus to znovu – zamysli se, jak nejlépe vyvinout figury a bojovat o střed.',
        })
        if (reveal) {
          const expected = new Chess(chess.fen()).move(book.expected.san)
          setHint({ from: expected.from, to: expected.to })
        }
        return false
      }
      wrongAttemptsRef.current = 0

      const gen = genRef.current
      const ply: PlyRecord = { index: pliesRef.current.length, move, byUser: true }
      commitPlies([...pliesRef.current, ply])
      if (!puzzle) onPliesChanged(gen)
      setHint(null)

      if (puzzle) {
        const end = detectEnd(chess)
        if (end) void finishGame(end.outcome, end.reason, gen)
        void judgeMatePly(ply, gen, puzzle).then((outcome) => {
          if (gen !== genRef.current) return
          if (outcome === 'mated' || (!outcome && end?.reason === 'checkmate')) concludePuzzle(true, ply.index)
          else if (!outcome) {
            if (!end) void playOpponent(gen)
          } else if (outcome !== 'held') {
            concludePuzzle(false, ply.index)
            if (!end) analyseCurrent()
          } else if (!end) void playOpponent(gen)
        })
        return true
      }

      void commentOnPly(ply, gen, false)

      const end = detectEnd(chess)
      if (end) {
        void finishGame(end.outcome, end.reason, gen)
      } else if (!selfPlayNow) {
        if (settingsRef.current.mode === 'opening' && !openingDoneRef.current && !isInBook()) {
          promptOpeningMove()
        }
        void playOpponent(gen)
      }
      return true
    },
    [
      analyseCurrent,
      chessRef,
      commentOnPly,
      commitPlies,
      concludePuzzle,
      finishGame,
      gameOverRef,
      genRef,
      isInBook,
      judgeMatePly,
      openingDoneRef,
      onPliesChanged,
      playOpponent,
      pliesRef,
      promptOpeningMove,
      pushMessage,
      puzzleStatusRef,
      selfPlayRef,
      setHint,
      settingsRef,
      wrongAttemptsRef,
    ],
  )

  const newGame = useCallback(
    (next?: Partial<GameSettings>) => {
      const previousMode = settingsRef.current.mode
      const merged: GameSettings = { ...settingsRef.current, ...next }
      if (merged.opponent === 'personal' && merged.mode !== 'free') merged.opponent = 'engine'
      if (merged.mode === 'opening' && !merged.openingId) merged.openingId = 'italian'
      if (merged.mode === 'mate' && !getPuzzle(merged.puzzleId)) merged.puzzleId = nextPuzzleId(null, solvedRef.current)
      settingsRef.current = merged
      setSettings(merged)
      saveSettings(merged)

      genRef.current++
      onAbandon()
      analyst.cancelAll()
      opponent.cancelAll()
      if (previousMode !== merged.mode) {
        analyst.terminate()
        opponent.terminate()
        calculatorEngine.terminate()
      }
      if (merged.mode === 'mate') {
        analyst.resetGame()
        opponent.resetGame()
        selfPlayRef.current = false
        setSelfPlayState(false)
      }
      chessRef.current.load(startFen(merged))
      commentsRef.current = {}
      commentJobsRef.current.clear()
      wrongAttemptsRef.current = 0
      setPuzzleStatus('playing')
      setJudging(false)
      setOpeningDone(false)
      setComments({})
      setGameOver(null)
      setHint(null)
      setAiThinking(false)
      setPendingAnalyses(0)
      setEvaluation(null)
      commitPlies([])
      const openingReady = !(merged.mode === 'opening' && merged.openingId && !getOpening(merged.openingId))
      if (openingReady) {
        setMessages(welcomeMessages(merged))
        if (merged.mode === 'opening') promptOpeningMove()
      } else {
        const gen = genRef.current
        setMessages([
          {
            id: nextId(),
            kind: 'info',
            title: 'Načítám knihu zahájení',
            text: 'Chvilku strpení, připravuji variantu.',
          },
        ])
        void loadOpeningBook().then(() => {
          if (genRef.current !== gen) return
          setMessages(welcomeMessages(settingsRef.current))
          promptOpeningMove()
        })
      }
      analyseCurrent()
    },
    [
      analyseCurrent,
      chessRef,
      commentJobsRef,
      commentsRef,
      commitPlies,
      genRef,
      promptOpeningMove,
      selfPlayRef,
      setAiThinking,
      setComments,
      setEvaluation,
      setGameOver,
      setHint,
      setJudging,
      setMessages,
      setOpeningDone,
      setPendingAnalyses,
      setPuzzleStatus,
      setSelfPlayState,
      onAbandon,
      setSettings,
      settingsRef,
      solvedRef,
      wrongAttemptsRef,
    ],
  )

  const startPuzzle = useCallback((id: string) => newGame({ mode: 'mate', puzzleId: id }), [newGame])
  const nextPuzzle = useCallback(
    () => newGame({ mode: 'mate', puzzleId: nextPuzzleId(settingsRef.current.puzzleId, solvedRef.current) }),
    [newGame, settingsRef, solvedRef],
  )
  const exitPuzzles = useCallback(() => newGame({ mode: 'free' }), [newGame])

  const undo = useCallback(() => {
    const current = pliesRef.current
    let target = current.length - 1
    while (target >= 0 && !current[target].byUser) target--
    if (target < 0) return

    genRef.current++
    analyst.cancelAll()
    opponent.cancelAll()
    for (let i = current.length; i > target; i--) chessRef.current.undo()

    const remaining = current.slice(0, target)
    const nextComments: Record<number, TutorComment> = {}
    Object.values(commentsRef.current).forEach((c) => {
      if (c.plyIndex < target) nextComments[c.plyIndex] = c
    })
    commentsRef.current = nextComments
    for (const key of [...commentJobsRef.current.keys()]) if (key >= target) commentJobsRef.current.delete(key)

    setComments(nextComments)
    setGameOver(null)
    setPuzzleStatus('playing')
    setJudging(false)
    setHint(null)
    setAiThinking(false)
    setPendingAnalyses(0)
    commitPlies(remaining)
    setMessages((prev) => [
      ...prev.filter((m) => !('plyIndex' in m) || m.plyIndex === undefined || m.plyIndex < target),
      { id: nextId(), kind: 'info', text: 'Tah vrácen. Zkus najít lepší pokračování!', plyIndex: target - 1 },
    ])
    const lastUser = [...remaining].reverse().find((p) => p.byUser)
    setEvaluation(lastUser ? (nextComments[lastUser.index]?.evalAfter ?? null) : null)

    if (settingsRef.current.mode === 'opening') {
      const stillInBook = !!isInBook()
      setOpeningDone(!stillInBook)
    }
    analyseCurrent()
    onPliesChanged(genRef.current)
  }, [
    analyseCurrent,
    chessRef,
    commentJobsRef,
    commentsRef,
    commitPlies,
    genRef,
    isInBook,
    onPliesChanged,
    pliesRef,
    setAiThinking,
    setComments,
    setEvaluation,
    setGameOver,
    setHint,
    setJudging,
    setMessages,
    setOpeningDone,
    setPendingAnalyses,
    setPuzzleStatus,
    settingsRef,
  ])

  const resign = useCallback(() => {
    if (gameOverRef.current) return
    const puzzle = activePuzzle(settingsRef.current)
    if (puzzle) {
      if (puzzleStatusRef.current !== 'playing') return
      genRef.current++
      analyst.cancelAll()
      opponent.cancelAll()
      setAiThinking(false)
      setJudging(false)
      concludePuzzle(
        false,
        pliesRef.current.length - 1,
        `Řešení: ${formatLine(puzzle.fen, puzzle.solution)}. ${puzzle.idea} Klikni na „Zkusit znovu“ a zahraj si ho sám.`,
        'Řešení úlohy',
      )
      return
    }
    opponent.cancelAll()
    void finishGame('loss', 'resign', genRef.current)
  }, [concludePuzzle, finishGame, gameOverRef, genRef, pliesRef, puzzleStatusRef, setAiThinking, setJudging, settingsRef])

  const setSelfPlay = useCallback(
    (on: boolean) => {
      if (selfPlayRef.current === on) return
      selfPlayRef.current = on
      setSelfPlayState(on)
      if (on) {
        opponent.cancelAll()
        setAiThinking(false)
        return
      }
      if (!gameOverRef.current && chessRef.current.turn() === 'b' && settingsRef.current.mode !== 'mate') {
        void playOpponent(genRef.current)
      }
    },
    [chessRef, gameOverRef, genRef, playOpponent, selfPlayRef, setAiThinking, setSelfPlayState, settingsRef],
  )

  const requestHint = useCallback(async () => {
    const chess = chessRef.current
    if (gameOverRef.current || (!selfPlayRef.current && chess.turn() !== 'w')) return
    const plyIndex = pliesRef.current.length - 1
    const book = isInBook()
    if (book) {
      const move = new Chess(chess.fen()).move(book.expected.san)
      setHint({ from: move.from, to: move.to })
      pushMessage({
        id: nextId(),
        kind: 'hint',
        plyIndex,
        san: czSan(move.san),
        text: bookLineText(book.opening.name, move.san, book.expected.explanation),
      })
      return
    }

    const fenNow = chess.fen()
    const gen = genRef.current
    const puzzle = activePuzzle(settingsRef.current)
    if (puzzle) {
      if (puzzleStatusRef.current !== 'playing') return
      if (tipShownForRef.current !== fenNow) {
        tipShownForRef.current = fenNow
        pushMessage({
          id: nextId(),
          kind: 'hint',
          plyIndex,
          san: 'Tip',
          text: `${puzzle.tip} Když si pořád nevíš rady, klikni na Nápovědu ještě jednou a ukážu ti tah.`,
        })
        return
      }
      const played = pliesRef.current.map((p) => p.move.san)
      const onSolution = played.every((san, i) => puzzle.solution[i] === san) && puzzle.solution[played.length]
      let sans: string[] = []
      if (onSolution) sans = puzzle.solution.slice(played.length)
      else {
        setPendingAnalyses((n) => n + 1)
        try {
          const result = await analyst.analyze(fenNow, MATE_ANALYSIS)
          sans = pvToSan(fenNow, result.lines[0]?.pv ?? [], 7)
        } catch {
          return
        } finally {
          setPendingAnalyses((n) => Math.max(0, n - 1))
        }
      }
      if (gen !== genRef.current || chessRef.current.fen() !== fenNow || sans.length === 0) return
      const best = new Chess(fenNow).move(sans[0])
      setHint({ from: best.from, to: best.to })
      pushMessage({
        id: nextId(),
        kind: 'hint',
        plyIndex,
        san: czSan(best.san),
        text: `Zahraj ${czSan(best.san)} – ${best.san.includes('+') ? 'šachem udržíš krále pod tlakem' : 'tímto tahem stáhneš síť kolem krále'}.`,
        line: formatLine(fenNow, sans),
      })
      return
    }

    setPendingAnalyses((n) => n + 1)
    try {
      const result = await analyst.analyze(fenNow, ANALYSIS)
      if (gen !== genRef.current || chessRef.current.fen() !== fenNow || !result.bestMove) return
      const best = applyUci(fenNow, result.bestMove)
      if (!best) return
      setHint({ from: best.from, to: best.to })
      const history = pliesRef.current.map((p) => p.move)
      pushMessage({
        id: nextId(),
        kind: 'hint',
        plyIndex,
        san: czSan(best.san),
        text: `Zkus ${czSan(best.san)} – tento tah ${explainMove(fenNow, best, history, result.lines[0])}.`,
        line: formatLine(fenNow, pvToSan(fenNow, result.lines[0]?.pv ?? [], 5)),
      })
    } catch {
      // Cancelled by undo/new game.
    } finally {
      setPendingAnalyses((n) => Math.max(0, n - 1))
    }
  }, [
    chessRef,
    gameOverRef,
    genRef,
    isInBook,
    pliesRef,
    pushMessage,
    puzzleStatusRef,
    selfPlayRef,
    setHint,
    setPendingAnalyses,
    settingsRef,
    tipShownForRef,
  ])

  return { makeMove, newGame, startPuzzle, nextPuzzle, exitPuzzles, undo, resign, setSelfPlay, requestHint }
}
