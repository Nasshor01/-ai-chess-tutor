import { DEFAULT_POSITION } from 'chess.js'
import { getOpening } from '../openings/openings'
import { MATE_PUZZLES, getPuzzle, type MatePuzzle } from '../puzzles/matePuzzles'
import { mateInText } from '../chess/utils'
import type { TutorMessage } from '../tutor/types'
import { DIFFICULTIES } from './difficulty'
import type { GameSettings } from './types'

let messageCounter = 0
export const nextId = () => `m${++messageCounter}`

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const activePuzzle = (settings: GameSettings): MatePuzzle | undefined =>
  settings.mode === 'mate' ? getPuzzle(settings.puzzleId) : undefined

export const startFen = (settings: GameSettings) => activePuzzle(settings)?.fen ?? DEFAULT_POSITION

export function welcomeMessages(settings: GameSettings): TutorMessage[] {
  const level = DIFFICULTIES[settings.difficulty]
  const puzzle = activePuzzle(settings)
  if (puzzle) {
    const number = MATE_PUZZLES.indexOf(puzzle) + 1
    return [
      {
        id: nextId(),
        kind: 'opening',
        plyIndex: -1,
        tone: 'info',
        title: `Trénink matů – úloha ${number}/${MATE_PUZZLES.length}`,
        text: `Bílý táhne a dá ${mateInText(puzzle.mateIn)}. Soupeř se bude bránit naplno, takže hledej tahy, které nenechají krále utéct. Po každém tahu ti řeknu, jestli matová síť drží.`,
      },
    ]
  }
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
