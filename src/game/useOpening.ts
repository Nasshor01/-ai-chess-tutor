import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { Chess } from 'chess.js'
import { czSan } from '../chess/utils'
import { getOpening } from '../openings/openings'
import type { TutorMessage } from '../tutor/types'
import { DIFFICULTIES } from './difficulty'
import { nextId } from './messages'
import type { GameSettings, HintArrow, PlyRecord } from './types'

type Ref<T> = { current: T }

export function useOpening(args: {
  settingsRef: Ref<GameSettings>
  pliesRef: Ref<PlyRecord[]>
  chessRef: Ref<Chess>
  pushMessage: (message: TutorMessage) => void
  setOpeningDone: (done: boolean) => void
  setHint: Dispatch<SetStateAction<HintArrow | null>>
}) {
  const { settingsRef, pliesRef, chessRef, pushMessage, setOpeningDone, setHint } = args

  const isInBook = useCallback(() => {
    const s = settingsRef.current
    if (s.mode !== 'opening' || !s.openingId) return null
    const opening = getOpening(s.openingId)
    if (!opening) return null
    const index = pliesRef.current.length
    const allMatch = pliesRef.current.every((p, i) => opening.moves[i]?.san === p.move.san)
    return allMatch && index < opening.moves.length ? { opening, index, expected: opening.moves[index] } : null
  }, [pliesRef, settingsRef])

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
  }, [chessRef, isInBook, pliesRef, pushMessage, setHint, setOpeningDone, settingsRef])

  return { isInBook, promptOpeningMove }
}
