import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, DEFAULT_POSITION, type Move } from 'chess.js'
import { analyst, opponent, warmUpEngines } from '../engine/engines'
import { EngineCancelledError } from '../engine/stockfish'
import type { EngineResult, Score } from '../engine/types'
import { applyUci, czSan, formatLine, lineToScore, parseUci, pvToSan } from '../chess/utils'
import { bookInfo, detectOpening, getOpening, type Opening } from '../openings/openings'
import { buildComment, describeOpponentMove, explainMove } from '../tutor/commentary'
import { buildSummary, type GameEndReason, type GameOutcome } from '../tutor/summary'
import type { TutorComment, TutorMessage } from '../tutor/types'
import { ANALYSIS_DEPTH, ANALYSIS_MOVETIME, ANALYSIS_MULTIPV, DIFFICULTIES } from './difficulty'
import { loadConceptProgress, loadSettings, saveConceptProgress, saveSettings } from './storage'
import type { EngineStatus, GameOverInfo, GameSettings, HintArrow, MoveInput, PlyRecord } from './types'

const ANALYSIS = { depth: ANALYSIS_DEPTH, movetime: ANALYSIS_MOVETIME, multipv: ANALYSIS_MULTIPV }
const MIN_OPPONENT_DELAY = 550

let messageCounter = 0
const nextId = () => `m${++messageCounter}`

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function detectEnd(chess: Chess): { outcome: GameOutcome; reason: GameEndReason } | null {
  if (chess.isCheckmate()) return { outcome: chess.turn() === 'w' ? 'loss' : 'win', reason: 'checkmate' }
  if (chess.isStalemate()) return { outcome: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { outcome: 'draw', reason: 'insufficient' }
  if (chess.isThreefoldRepetition()) return { outcome: 'draw', reason: 'repetition' }
  if (chess.isDraw()) return { outcome: 'draw', reason: 'fifty' }
  return null
}

function welcomeMessages(settings: GameSettings): TutorMessage[] {
  const level = DIFFICULTIES[settings.difficulty]
  const opening = settings.mode === 'opening' && settings.openingId ? getOpening(settings.openingId) : undefined
  if (opening) {
    return [
      {
        id: nextId(),
        kind: 'opening',
        plyIndex: -1,
        tone: 'info',
        title: `Trénink zahájení: ${opening.name}`,
        text: `${opening.summary} Hlavní myšlenka: ${opening.idea}`,
      },
    ]
  }
  return [
    {
      id: nextId(),
      kind: 'welcome',
      text: `Ahoj! Jsem tvůj šachový trenér. Hraješ bílými na úrovni „${level.label}“. Po každém tahu ti řeknu, co bylo dobře, co šlo lépe a na co si dát pozor. Začni třeba tahem e4 nebo d4 – oba bojují o střed.`,
    },
  ]
}

export function useChessGame() {
  const chessRef = useRef(new Chess())
  const genRef = useRef(0)
  const pliesRef = useRef<PlyRecord[]>([])
  const commentsRef = useRef<Record<number, TutorComment>>({})
  const commentJobsRef = useRef(new Map<number, Promise<unknown>>())
  const gameOverRef = useRef<GameOverInfo | null>(null)
  const wrongAttemptsRef = useRef(0)

  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const settingsRef = useRef(settings)
  const conceptsRef = useRef(loadConceptProgress())

  const [fen, setFen] = useState(DEFAULT_POSITION)
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
      .analyze(currentFen, ANALYSIS)
      .then((result) => {
        if (chessRef.current.fen() === currentFen) setEvaluation(lineToScore(result.lines[0], currentFen))
      })
      .catch(() => undefined)
  }, [])

  const isInBook = useCallback(() => {
    const s = settingsRef.current
    if (s.mode !== 'opening' || !s.openingId) return null
    const opening = getOpening(s.openingId)
    if (!opening) return null
    const index = pliesRef.current.length
    const allMatch = pliesRef.current.every((p, i) => opening.moves[i]?.san === p.move.san)
    return allMatch && index < opening.moves.length ? { opening, index, expected: opening.moves[index] } : null
  }, [])

  const promptOpeningMove = useCallback(() => {
    const book = isInBook()
    const s = settingsRef.current
    if (s.mode !== 'opening') return
    if (!book) {
      setOpeningDone(true)
      const opening = s.openingId ? getOpening(s.openingId) : undefined
      pushMessage({
        id: nextId(),
        kind: 'opening',
        plyIndex: pliesRef.current.length - 1,
        tone: 'success',
        title: 'Zahájení zvládnuto!',
        text: `Prošel jsi hlavní variantu ${opening ? `zahájení ${opening.name}` : ''}. Teď pokračuj sám proti počítači – dál tě budu komentovat.`,
      })
      return
    }
    if (DIFFICULTIES[s.difficulty].verbosity === 'high') {
      const move = new Chess(chessRef.current.fen()).move(book.expected.san)
      setHint({ from: move.from, to: move.to })
      pushMessage({
        id: nextId(),
        kind: 'opening',
        plyIndex: pliesRef.current.length - 1,
        tone: 'info',
        title: `Tvůj tah: ${czSan(book.expected.san)}`,
        text: 'Šipka ukazuje tah z hlavní varianty. Zahraj ho a já ti vysvětlím, proč se hraje.',
      })
    } else if (pliesRef.current.length === 0) {
      pushMessage({
        id: nextId(),
        kind: 'opening',
        plyIndex: pliesRef.current.length - 1,
        tone: 'info',
        title: 'Jaký tah se tu hraje?',
        text: 'Zkus najít tah z hlavní varianty. Když si nevíš rady, klikni na Nápovědu.',
      })
    }
  }, [isInBook, pushMessage, setOpeningDone])

  const finishGame = useCallback(
    async (outcome: GameOutcome, reason: GameEndReason, gen: number) => {
      setGameOver({ outcome, reason, summary: null })
      setAiThinking(false)
      await Promise.allSettled([...commentJobsRef.current.values()])
      if (gen !== genRef.current) return
      const summary = buildSummary(Object.values(commentsRef.current), outcome, reason)
      setGameOver({ outcome, reason, summary })
      pushMessage({
        id: nextId(),
        kind: 'info',
        title: summary.title,
        text: `${summary.subtitle} ${summary.advice}`,
        plyIndex: pliesRef.current.length - 1,
      })
    },
    [pushMessage, setGameOver],
  )

  /** Runs engine analysis and produces the tutor's comment for a ply. */
  const commentOnPly = useCallback(
    (ply: PlyRecord, gen: number, explain: boolean) => {
      const history = pliesRef.current.slice(0, ply.index).map((p) => p.move)
      const thinkingId = nextId()
      pushMessage({ id: thinkingId, kind: 'thinking', plyIndex: ply.index, san: czSan(ply.move.san) })
      setPendingAnalyses((n) => n + 1)
      const sanHistory = [...history.map((m) => m.san), ply.move.san]
      const book = bookInfo(sanHistory)
      const verbosity = DIFFICULTIES[settingsRef.current.difficulty].verbosity

      const job = (async () => {
        let before: EngineResult | null = null
        let after: EngineResult | null = null
        try {
          before = await analyst.analyze(ply.move.before, ANALYSIS)
          const afterBoard = new Chess(ply.move.after)
          if (!afterBoard.isGameOver()) after = await analyst.analyze(ply.move.after, { ...ANALYSIS, multipv: 1 })
        } catch (error) {
          if (error instanceof EngineCancelledError || gen !== genRef.current) return
        }
        if (gen !== genRef.current) return

        const comment = buildComment({
          plyIndex: ply.index,
          fenBefore: ply.move.before,
          move: ply.move,
          history,
          byUser: ply.byUser,
          before,
          after,
          book,
          verbosity,
          conceptSeen: conceptsRef.current,
        })
        if (ply.byUser && !explain) {
          const progress = { ...conceptsRef.current }
          comment.concepts.forEach((m) => (progress[m.concept.id] = (progress[m.concept.id] ?? 0) + 1))
          conceptsRef.current = progress
          saveConceptProgress(progress)
        }
        storeComment(comment)
        replaceMessage(thinkingId, { id: thinkingId, kind: 'comment', plyIndex: ply.index, comment, explain })
        if (chessRef.current.fen() === ply.move.after) setEvaluation(comment.evalAfter)
      })().finally(() => {
        setPendingAnalyses((n) => Math.max(0, n - 1))
        if (gen === genRef.current) {
          setMessages((prev) => prev.filter((m) => !(m.id === thinkingId && m.kind === 'thinking')))
        }
      })

      if (!explain) commentJobsRef.current.set(ply.index, job)
      return job
    },
    [pushMessage, replaceMessage, storeComment],
  )

  const playOpponent = useCallback(
    async (gen: number) => {
      const chess = chessRef.current
      const fenBefore = chess.fen()
      const level = DIFFICULTIES[settingsRef.current.difficulty]
      const book = isInBook()
      setAiThinking(true)
      const started = performance.now()

      let uci: string | null = null
      try {
        if (book) {
          const move = new Chess(fenBefore).move(book.expected.san)
          uci = `${move.from}${move.to}${move.promotion ?? ''}`
        } else if (Math.random() < level.randomMoveChance) {
          const moves = chess.moves({ verbose: true })
          const pick = moves[Math.floor(Math.random() * moves.length)]
          uci = `${pick.from}${pick.to}${pick.promotion ?? ''}`
        } else {
          const result = await opponent.bestMove(fenBefore, { skill: level.skill, depth: level.depth, movetime: level.movetime })
          uci = result.bestMove
        }
      } catch {
        uci = null
      }

      const elapsed = performance.now() - started
      if (elapsed < MIN_OPPONENT_DELAY) await wait(MIN_OPPONENT_DELAY - elapsed)
      if (gen !== genRef.current || gameOverRef.current) return

      if (!uci) {
        const moves = chess.moves({ verbose: true })
        if (moves.length === 0) return
        const pick = moves.find((m) => m.captured) ?? moves[Math.floor(Math.random() * moves.length)]
        uci = `${pick.from}${pick.to}${pick.promotion ?? ''}`
      }

      let move: Move
      try {
        move = chess.move(parseUci(uci))
      } catch {
        setAiThinking(false)
        return
      }
      const history = pliesRef.current.map((p) => p.move)
      const ply: PlyRecord = { index: pliesRef.current.length, move, byUser: false }
      commitPlies([...pliesRef.current, ply])
      setAiThinking(false)

      if (book) {
        pushMessage({
          id: nextId(),
          kind: 'opponent',
          plyIndex: ply.index,
          san: czSan(move.san),
          text: book.expected.explanation,
        })
      } else {
        pushMessage({
          id: nextId(),
          kind: 'opponent',
          plyIndex: ply.index,
          san: czSan(move.san),
          text: describeOpponentMove(fenBefore, move, history, level.verbosity),
        })
      }

      const end = detectEnd(chess)
      if (end) {
        void finishGame(end.outcome, end.reason, gen)
        return
      }
      if (settingsRef.current.mode === 'opening' && !openingDoneRef.current) promptOpeningMove()
      analyseCurrent()
    },
    [analyseCurrent, commitPlies, finishGame, isInBook, promptOpeningMove, pushMessage],
  )

  const makeMove = useCallback(
    ({ from, to, promotion }: MoveInput): boolean => {
      const chess = chessRef.current
      if (gameOverRef.current || chess.turn() !== 'w') return false

      const book = isInBook()
      let move: Move
      try {
        move = chess.move({ from, to, promotion: promotion ?? 'q' })
      } catch {
        return false
      }

      if (book && move.san !== book.expected.san) {
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
            ? `V zahájení ${book.opening.name} se tady hraje ${czSan(book.expected.san)}. ${book.expected.explanation}`
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
      setHint(null)
      void commentOnPly(ply, gen, false)

      const end = detectEnd(chess)
      if (end) {
        void finishGame(end.outcome, end.reason, gen)
      } else {
        if (settingsRef.current.mode === 'opening' && !openingDoneRef.current && !isInBook()) {
          promptOpeningMove()
        }
        void playOpponent(gen)
      }
      return true
    },
    [commentOnPly, commitPlies, finishGame, isInBook, playOpponent, promptOpeningMove, pushMessage],
  )

  const newGame = useCallback(
    (next?: Partial<GameSettings>) => {
      const merged: GameSettings = { ...settingsRef.current, ...next }
      if (merged.mode === 'opening' && !merged.openingId) merged.openingId = 'italian'
      settingsRef.current = merged
      setSettings(merged)
      saveSettings(merged)

      genRef.current++
      analyst.cancelAll()
      opponent.cancelAll()
      chessRef.current.reset()
      commentsRef.current = {}
      commentJobsRef.current.clear()
      wrongAttemptsRef.current = 0
      setOpeningDone(false)
      setComments({})
      setGameOver(null)
      setHint(null)
      setAiThinking(false)
      setPendingAnalyses(0)
      setEvaluation(null)
      commitPlies([])
      setMessages(welcomeMessages(merged))
      if (merged.mode === 'opening') promptOpeningMove()
      analyseCurrent()
    },
    [analyseCurrent, commitPlies, promptOpeningMove, setGameOver, setOpeningDone],
  )

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
  }, [analyseCurrent, commitPlies, isInBook, setGameOver, setOpeningDone])

  const resign = useCallback(() => {
    if (gameOverRef.current) return
    opponent.cancelAll()
    void finishGame('loss', 'resign', genRef.current)
  }, [finishGame])

  const requestHint = useCallback(async () => {
    const chess = chessRef.current
    if (gameOverRef.current || chess.turn() !== 'w') return
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
        text: `V zahájení ${book.opening.name} se tady hraje ${czSan(move.san)}. ${book.expected.explanation}`,
      })
      return
    }

    const fenNow = chess.fen()
    const gen = genRef.current
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
  }, [isInBook, pushMessage])

  const explainPly = useCallback(
    (index: number) => {
      const ply = pliesRef.current[index]
      if (!ply) return
      const existing = commentsRef.current[index]
      if (existing) {
        pushMessage({ id: nextId(), kind: 'comment', plyIndex: index, comment: existing, explain: true })
        return
      }
      void commentOnPly(ply, genRef.current, true)
    },
    [commentOnPly, pushMessage],
  )

  const clearHint = useCallback(() => setHint(null), [])

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
    canMove: !gameOver && !aiThinking && turn === 'w',
    makeMove,
    newGame,
    undo,
    resign,
    requestHint,
    explainPly,
    clearHint,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
