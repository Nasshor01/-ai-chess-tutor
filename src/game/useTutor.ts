import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { Chess } from 'chess.js'
import { analyst } from '../engine/engines'
import { EngineCancelledError } from '../engine/stockfish'
import type { EngineResult, Score } from '../engine/types'
import { czSan } from '../chess/utils'
import { bookInfo } from '../openings/openings'
import type { MatePuzzle } from '../puzzles/matePuzzles'
import { buildComment } from '../tutor/commentary'
import { buildMateComment, type MateOutcome } from '../tutor/mating'
import { buildSummary, type GameEndReason, type GameOutcome } from '../tutor/summary'
import type { TutorComment, TutorMessage } from '../tutor/types'
import { DIFFICULTIES } from './difficulty'
import { activePuzzle, nextId } from './messages'
import { ANALYSIS, MATE_ANALYSIS, MATE_RECHECK } from './search'
import { saveConceptProgress, saveSolvedPuzzles, type ConceptProgress } from './storage'
import type { GameOverInfo, GameSettings, PlyRecord, PuzzleStatus } from './types'

type Ref<T> = { current: T }

export function useTutor(args: {
  settingsRef: Ref<GameSettings>
  selfPlayRef: Ref<boolean>
  conceptsRef: Ref<ConceptProgress>
  chessRef: Ref<Chess>
  genRef: Ref<number>
  pliesRef: Ref<PlyRecord[]>
  commentsRef: Ref<Record<number, TutorComment>>
  commentJobsRef: Ref<Map<number, Promise<unknown>>>
  solvedRef: Ref<string[]>
  pushMessage: (message: TutorMessage) => void
  replaceMessage: (id: string, message: TutorMessage) => void
  storeComment: (comment: TutorComment) => void
  setGameOver: (info: GameOverInfo | null) => void
  setAiThinking: Dispatch<SetStateAction<boolean>>
  setPendingAnalyses: Dispatch<SetStateAction<number>>
  setJudging: Dispatch<SetStateAction<boolean>>
  setPuzzleStatus: (status: PuzzleStatus) => void
  setSolvedPuzzles: Dispatch<SetStateAction<string[]>>
  setEvaluation: Dispatch<SetStateAction<Score | null>>
  setMessages: Dispatch<SetStateAction<TutorMessage[]>>
  onGameFinished?: (outcome: GameOutcome, reason: GameEndReason, gen: number) => void
}) {
  const {
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
  } = args

  const finishGame = useCallback(
    async (outcome: GameOutcome, reason: GameEndReason, gen: number) => {
      setGameOver({ outcome, reason, summary: null })
      setAiThinking(false)
      if (settingsRef.current.mode === 'mate') return
      await Promise.allSettled([...commentJobsRef.current.values()])
      if (gen !== genRef.current) return
      const summary = buildSummary(Object.values(commentsRef.current), outcome, reason, {
        neutralResult: selfPlayRef.current,
      })
      setGameOver({ outcome, reason, summary })
      onGameFinished?.(outcome, reason, gen)
      pushMessage({
        id: nextId(),
        kind: 'info',
        title: summary.title,
        text: `${summary.subtitle} ${summary.advice}`,
        plyIndex: pliesRef.current.length - 1,
      })
    },
    [commentJobsRef, commentsRef, genRef, onGameFinished, pliesRef, pushMessage, selfPlayRef, setAiThinking, setGameOver, settingsRef],
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
    [
      chessRef,
      commentJobsRef,
      conceptsRef,
      genRef,
      pliesRef,
      pushMessage,
      replaceMessage,
      setEvaluation,
      setMessages,
      setPendingAnalyses,
      settingsRef,
      storeComment,
    ],
  )

  /** Mating Practice: judges the player's move against the puzzle (net held / slower / escaped). */
  const judgeMatePly = useCallback(
    async (ply: PlyRecord, gen: number, puzzle: MatePuzzle): Promise<MateOutcome | null> => {
      const history = pliesRef.current.slice(0, ply.index).map((p) => p.move)
      const thinkingId = nextId()
      pushMessage({ id: thinkingId, kind: 'thinking', plyIndex: ply.index, san: czSan(ply.move.san) })
      setPendingAnalyses((n) => n + 1)
      setJudging(true)
      const gameOverAfter = new Chess(ply.move.after).isGameOver()
      const input = { plyIndex: ply.index, puzzle, move: ply.move, history, conceptSeen: conceptsRef.current }

      try {
        const before = await analyst.analyze(ply.move.before, MATE_ANALYSIS)
        let after = gameOverAfter ? null : await analyst.analyze(ply.move.after, MATE_ANALYSIS)
        let result = buildMateComment({ ...input, before, after })
        if ((result.outcome === 'slower' || result.outcome === 'escaped') && !gameOverAfter && result.movesLeft > 0) {
          after = await analyst.analyze(ply.move.after, MATE_RECHECK)
          result = buildMateComment({ ...input, before, after })
        }
        if (gen !== genRef.current) return null

        const progress = { ...conceptsRef.current }
        result.comment.concepts.forEach((m) => (progress[m.concept.id] = (progress[m.concept.id] ?? 0) + 1))
        conceptsRef.current = progress
        saveConceptProgress(progress)
        storeComment(result.comment)
        replaceMessage(thinkingId, { id: thinkingId, kind: 'comment', plyIndex: ply.index, comment: result.comment })
        if (chessRef.current.fen() === ply.move.after) setEvaluation(result.comment.evalAfter)
        return result.outcome
      } catch {
        return null
      } finally {
        setPendingAnalyses((n) => Math.max(0, n - 1))
        if (gen === genRef.current) {
          setJudging(false)
          setMessages((prev) => prev.filter((m) => !(m.id === thinkingId && m.kind === 'thinking')))
        }
      }
    },
    [
      chessRef,
      conceptsRef,
      genRef,
      pliesRef,
      pushMessage,
      replaceMessage,
      setEvaluation,
      setJudging,
      setMessages,
      setPendingAnalyses,
      storeComment,
    ],
  )

  const concludePuzzle = useCallback(
    (solved: boolean, plyIndex: number, text?: string, title?: string) => {
      const puzzle = activePuzzle(settingsRef.current)
      if (!puzzle) return
      setPuzzleStatus(solved ? 'solved' : 'failed')
      if (solved) {
        if (!solvedRef.current.includes(puzzle.id)) {
          solvedRef.current = [...solvedRef.current, puzzle.id]
          setSolvedPuzzles(solvedRef.current)
          saveSolvedPuzzles(solvedRef.current)
        }
        pushMessage({
          id: nextId(),
          kind: 'opening',
          plyIndex,
          tone: 'success',
          title: `Úloha vyřešena – ${puzzle.pattern}`,
          text: `Mat jsi stihl v limitu ${puzzle.mateIn} tahů. Tenhle vzor si zapamatuj – v partiích se objevuje často. Pokračuj další úlohou.`,
        })
      } else {
        pushMessage({
          id: nextId(),
          kind: 'opening',
          plyIndex,
          tone: 'warning',
          title: title ?? 'Tentokrát mat neprošel',
          text: text ?? 'Výše vidíš správné pokračování. Vrať tah tlačítkem Zpět, nebo zkus úlohu znovu od začátku.',
        })
      }
    },
    [pushMessage, setPuzzleStatus, setSolvedPuzzles, settingsRef, solvedRef],
  )

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
    [commentOnPly, commentsRef, genRef, pliesRef, pushMessage],
  )

  return { finishGame, commentOnPly, judgeMatePly, concludePuzzle, explainPly }
}
