import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { Chess, type Move } from 'chess.js'
import { markGameSearch } from '../analysis/busy'
import { analyst, playingEngine, preferSharedEngine, coreCount } from '../engine/engines'
import { beginSharedOpponentTurn } from '../engine/sharedTurn'
import { czSan, parseUci } from '../chess/utils'
import { describeOpponentMove } from '../tutor/commentary'
import { describeDefence } from '../tutor/mating'
import type { GameEndReason, GameOutcome } from '../tutor/summary'
import type { TutorMessage } from '../tutor/types'
import { formatPersonalNote, linesFrom, playPersonalMove } from './personalTurn'
import { opponentOf } from './types'
import { DIFFICULTIES } from './difficulty'
import { detectEnd } from './end'
import { nextId, wait } from './messages'
import { MATE_DEFENDER, MIN_OPPONENT_DELAY } from './search'
import { playerColorOf, type GameOverInfo, type GameSettings, type PlyRecord } from './types'

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
      const engine = playingEngine()
      const shared = preferSharedEngine(coreCount())
      beginSharedOpponentTurn(shared, () => analyst.cancelAll(), (active) => {
        if (active) markGameSearch(true)
      })
      try {
      const fenBefore = chess.fen()
      const level = DIFFICULTIES[settingsRef.current.difficulty]
      const book = isInBook()
      setAiThinking(true)
      const started = performance.now()

      let uci: string | null = null
      let personalNote: string | null = null
      try {
        if (settingsRef.current.mode === 'mate') {
          uci = (await engine.bestMove(fenBefore, MATE_DEFENDER)).bestMove
        } else if (opponentOf(settingsRef.current) === 'personal') {
          const choice = await playPersonalMove({
            fen: fenBefore,
            mode: settingsRef.current.personalMode ?? 'today',
            strength: settingsRef.current.personalStrength ?? 'match',
            search: async (fen, strength) => linesFrom(await engine.search(fen, strength)),
          })
          personalNote = formatPersonalNote(choice)
          uci = choice.played?.uci ?? null
          if (!choice.played) personalNote = `${personalNote} Zahraju obecný tah.`
        } else if (book) {
          const move = new Chess(fenBefore).move(book.expected.san)
          uci = `${move.from}${move.to}${move.promotion ?? ''}`
        } else if (Math.random() < level.randomMoveChance) {
          const moves = chess.moves({ verbose: true })
          const pick = moves[Math.floor(Math.random() * moves.length)]
          uci = `${pick.from}${pick.to}${pick.promotion ?? ''}`
        } else {
          const result = await engine.bestMove(fenBefore, { skill: level.skill, depth: level.depth, movetime: level.movetime })
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
          text: book.expected.explanation || 'Tah z knihy zahájení.',
        })
      } else {
        const defence = settingsRef.current.mode === 'mate' ? describeDefence(move) : null
        pushMessage({
          id: nextId(),
          kind: 'opponent',
          plyIndex: ply.index,
          san: czSan(move.san),
          text: personalNote ?? defence ?? describeOpponentMove(fenBefore, move, history, level.verbosity),
        })
      }

      const end = detectEnd(chess, playerColorOf(settingsRef.current))
      if (end) {
        void finishGame(end.outcome, end.reason, gen)
        if (settingsRef.current.mode === 'mate') {
          concludePuzzle(false, ply.index, 'Partie skončila dřív, než padl mat. Zkus úlohu znovu.')
        }
        return
      }
      if (settingsRef.current.mode === 'opening' && !openingDoneRef.current) promptOpeningMove()
      analyseCurrent()
      } finally {
        if (shared) markGameSearch(false)
      }
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
