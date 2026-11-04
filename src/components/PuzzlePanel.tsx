import type { PuzzleStatus } from '../game/types'
import { mateInText } from '../chess/utils'
import { MATE_PUZZLES, type MatePuzzle } from '../puzzles/matePuzzles'
import { ArrowRightIcon, UndoIcon } from './Icons'
import './PuzzlePanel.css'

interface Props {
  puzzle: MatePuzzle
  status: PuzzleStatus
  solved: string[]
  movesLeft: number
  onSelect: (id: string) => void
  onRetry: () => void
  onNext: () => void
  onExit: () => void
}

const STATUS_TEXT: Record<PuzzleStatus, string> = {
  playing: 'Hledej mat',
  solved: 'Vyřešeno',
  failed: 'Nevyšlo',
}

export function PuzzlePanel({ puzzle, status, solved, movesLeft, onSelect, onRetry, onNext, onExit }: Props) {
  const index = MATE_PUZZLES.indexOf(puzzle)

  return (
    <section className="card puzzle" aria-label="Trénink matů">
      <div className="puzzle__header">
        <div>
          <h2 className="card__title">
            Trénink matů · úloha {index + 1}/{MATE_PUZZLES.length}
          </h2>
          <p className="puzzle__task">Bílý dá {mateInText(puzzle.mateIn)}</p>
        </div>
        <span className={`puzzle__status is-${status}`}>{STATUS_TEXT[status]}</span>
      </div>

      <div className="puzzle__meta">
        <span className={`puzzle__chip is-${puzzle.difficulty}`}>{puzzle.difficulty}</span>
        {status === 'playing' && (
          <span className="puzzle__left">
            Zbývá {movesLeft} {movesLeft === 1 ? 'tah' : movesLeft <= 4 ? 'tahy' : 'tahů'}
          </span>
        )}
        {status === 'solved' && <span className="puzzle__pattern">Vzor: {puzzle.pattern}</span>}
        <span className="puzzle__progress">
          Vyřešeno {solved.length}/{MATE_PUZZLES.length}
        </span>
      </div>

      <div className="puzzle__actions">
        <button type="button" className="btn btn--small" onClick={onRetry}>
          <UndoIcon width={16} height={16} /> Zkusit znovu
        </button>
        <button type="button" className={`btn btn--small ${status === 'solved' ? 'btn--primary' : ''}`} onClick={onNext}>
          Další úloha <ArrowRightIcon width={16} height={16} />
        </button>
        <select
          className="puzzle__select"
          aria-label="Vybrat úlohu"
          value={puzzle.id}
          onChange={(event) => onSelect(event.target.value)}
        >
          {MATE_PUZZLES.map((p, i) => (
            <option key={p.id} value={p.id}>
              {solved.includes(p.id) ? '✓ ' : ''}
              {i + 1}. Mat {p.mateIn} – {p.difficulty}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="puzzle__exit" onClick={onExit}>
        Zpět k normální hře
      </button>
    </section>
  )
}
