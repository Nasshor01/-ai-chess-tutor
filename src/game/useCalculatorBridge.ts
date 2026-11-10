import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { Chess } from 'chess.js'
import { analyst, opponent } from '../engine/engines'
import type { Score } from '../engine/types'
import { playableFen } from '../chess/position'
import type { TutorComment, TutorMessage } from '../tutor/types'
import { detectEnd } from './end'
import { nextId } from './messages'
import type { GameOverInfo, GameSettings, HintArrow, PlyRecord, PuzzleStatus } from './types'
import { saveSettings } from './storage'

type Ref<T> = { current: T }

export function useCalculatorBridge(args: {
  settingsRef: Ref<GameSettings>
  selfPlayRef: Ref<boolean>
  chessRef: Ref<Chess>
  genRef: Ref<number>
  commentsRef: Ref<Record<number, TutorComment>>
  commentJobsRef: Ref<Map<number, Promise<unknown>>>
  wrongAttemptsRef: Ref<number>
  gameOverRef: Ref<GameOverInfo | null>
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
}) {
  const {
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
  } = args

  const loadPosition = useCallback(
    (rawFen: string): boolean => {
      const parsed = playableFen(rawFen)
      if ('error' in parsed) return false

      const merged: GameSettings = { ...settingsRef.current, mode: 'free' }
      settingsRef.current = merged
      setSettings(merged)
      saveSettings(merged)

      genRef.current++
      analyst.cancelAll()
      opponent.cancelAll()
      analyst.resetGame()
      opponent.resetGame()

      chessRef.current.load(parsed.fen)
      commentsRef.current = {}
      commentJobsRef.current.clear()
      wrongAttemptsRef.current = 0
      setPuzzleStatus('playing')
      setJudging(false)
      setOpeningDone(false)
      setComments({})
      setHint(null)
      setAiThinking(false)
      setPendingAnalyses(0)
      setEvaluation(null)
      selfPlayRef.current = true
      setSelfPlayState(true)
      commitPlies([])

      const chess = chessRef.current
      const end = detectEnd(chess)
      const side = chess.turn() === 'w' ? 'bílý' : 'černý'
      if (end) {
        setGameOver({ outcome: end.outcome, reason: end.reason, summary: null })
        setMessages([
          {
            id: nextId(),
            kind: 'info',
            title: 'Pozice nastavena',
            text:
              end.reason === 'checkmate'
                ? `Na tahu je ${side}, ale je to už mat.`
                : `Na tahu je ${side}, ale pozice je už remíza.`,
          },
        ])
      } else {
        setGameOver(null)
        setMessages([
          {
            id: nextId(),
            kind: 'info',
            title: 'Pozice nastavena',
            text: `Na tahu je ${side}. Hraješ obě barvy a kalkulačka ti nabídne tři tahy.`,
          },
        ])
        analyseCurrent()
      }
      return true
    },
    [
      analyseCurrent,
      chessRef,
      commentJobsRef,
      commentsRef,
      commitPlies,
      genRef,
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
      setSettings,
      settingsRef,
      wrongAttemptsRef,
    ],
  )

  const openInCalculator = useCallback(() => {
    if (settingsRef.current.mode === 'mate') return
    const chess = chessRef.current
    const end = detectEnd(chess)
    if (!end && gameOverRef.current) {
      opponent.cancelAll()
      setGameOver(null)
      setAiThinking(false)
    }
    selfPlayRef.current = true
    setSelfPlayState(true)
    opponent.cancelAll()
    setAiThinking(false)
    const side = chess.turn() === 'w' ? 'bílý' : 'černý'
    pushMessage({
      id: nextId(),
      kind: 'info',
      title: 'Calculator Mode',
      text: end
        ? 'Tahle pozice je už rozhodnutá, kalkulačka v ní nemá tah.'
        : `Rozebíráš aktuální pozici. Na tahu je ${side} a hraješ obě barvy.`,
    })
  }, [chessRef, gameOverRef, pushMessage, selfPlayRef, setAiThinking, setGameOver, setSelfPlayState, settingsRef])

  return { loadPosition, openInCalculator }
}
