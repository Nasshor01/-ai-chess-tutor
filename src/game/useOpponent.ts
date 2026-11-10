import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { Chess, type Move } from 'chess.js'
import { opponent } from '../engine/engines'
import { czSan, parseUci } from '../chess/utils'
import { describeOpponentMove } from '../tutor/commentary'
import { describeDefence } from '../tutor/mating'
import type { GameEndReason, GameOutcome } from '../tutor/summary'
import type { TutorMessage } from '../tutor/types'
import { DIFFICULTIES } from './difficulty'
import { detectEnd } from './end'
import { nextId, wait } from './messages'
import { MATE_DEFENDER, MIN_OPPONENT_DELAY } from './search'
import type { GameOverInfo, GameSettings, PlyRecord } from './types'

type Ref<T> = { current: T }

type Book = { expected: { san: string; explanation: string } } | null

export function useOpponent(args: {
  selfPlayRef: Ref<boolean>
  settingsRef: Ref<GameSettings>
  chessRef: Ref<Chess>
  genRef: Ref<number>
  pliesRef: Ref<PlyRecord[]>
  gameOverRef: Ref<GameOverInfo | null>
  openingDoneRef: Ref<boolean>
  isInBook: () => Book
  setAiThinking: Dispatch<SetStateAction<boolean>>
  commitPlies: (next: PlyRecord[]) => void
  pushMessage: (message: TutorMessage) => void
  finishGame: (outcome: GameOutcome, reason: GameEndReason, gen: number) => Promise<void>
  concludePuzzle: (solved: boolean, plyIndex: number, text?: string, title?: string) => void
  promptOpeningMove: () => void
  analyseCurrent: () => void
  onPliesChanged: (gen: number) => void
}) {
  const {
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
    onPliesChanged,
  } = args

  const playOpponent = useCallback(
    async (gen: number) => {
      const chess = chessRef.current
      if (selfPlayRef.current && settingsRef.current.mode !== 'mate') return
      const fenBefore = chess.fen()
      const level = DIFFICULTIES[settingsRef.current.difficulty]
      const book = isInBook()
      setAiThinking(true)
      const started = performance.now()

      let uci: string | null = null
      try {
        if (settingsRef.current.mode === 'mate') {
          uci = (await opponent.bestMove(fenBefore, MATE_DEFENDER)).bestMove
        } else if (book) {
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
      if (gen !== genRef.current || gameOverRef.current || (selfPlayRef.current && settingsRef.current.mode !== 'mate')) {
        setAiThinking(false)
        return
      }

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
      onPliesChanged(gen)
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
        const defence = settingsRef.current.mode === 'mate' ? describeDefence(move) : null
        pushMessage({
          id: nextId(),
          kind: 'opponent',
          plyIndex: ply.index,
          san: czSan(move.san),
          text: defence ?? describeOpponentMove(fenBefore, move, history, level.verbosity),
        })
      }

      const end = detectEnd(chess)
      if (end) {
        void finishGame(end.outcome, end.reason, gen)
        if (settingsRef.current.mode === 'mate') {
          concludePuzzle(false, ply.index, 'Partie skončila dřív, než padl mat. Zkus úlohu znovu.')
        }
        return
      }
      if (settingsRef.current.mode === 'opening' && !openingDoneRef.current) promptOpeningMove()
      analyseCurrent()
    },
    [
      analyseCurrent,
      chessRef,
      commitPlies,
      concludePuzzle,
      finishGame,
      gameOverRef,
      genRef,
      isInBook,
      openingDoneRef,
      pliesRef,
      promptOpeningMove,
      pushMessage,
      onPliesChanged,
      selfPlayRef,
      setAiThinking,
      settingsRef,
    ],
  )

  return playOpponent
}
