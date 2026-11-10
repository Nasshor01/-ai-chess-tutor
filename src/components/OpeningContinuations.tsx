import { czSan, parseUci } from '../chess/utils'
import {
  continuationStats,
  continuations,
  describeMoveStat,
  type Book,
  type Continuation,
  type PlayedGame,
} from '../openings/book/book'
import type { MoveInput } from '../game/types'

interface Props {
  book: Book
  fen: string
  games: readonly PlayedGame[] | null
  statsFailed: boolean
  previewUci: string | null
  canPlay: boolean
  onPreview: (uci: string) => void
  onPlay: (move: MoveInput) => void
}

function variantLabel(count: number): string {
  if (count === 1) return '1 varianta'
  if (count >= 2 && count <= 4) return `${count} varianty`
  return `${count} variant`
}

export function OpeningContinuations({ book, fen, games, statsFailed, previewUci, canPlay, onPreview, onPlay }: Props) {
  const moves = continuations(book, fen)
  const stats = games ? continuationStats(games, fen, moves.map((move) => move.uci)) : null
  if (moves.length === 0) return <p className="opening-moves__empty">Z téhle pozice kniha už nepokračuje.</p>
  return (
    <ul className="opening-moves">
      {moves.map((move) => (
        <ContinuationRow
          key={move.uci}
          move={move}
          fresh={games ? describeMoveStat(stats?.get(move.uci)).fresh : false}
          label={statsFailed ? 'Statistiku se nepodařilo načíst.' : games ? describeMoveStat(stats?.get(move.uci)).label : 'Načítám statistiku…'}
          pressed={previewUci === move.uci}
          canPlay={canPlay}
          onPreview={onPreview}
          onPlay={onPlay}
        />
      ))}
    </ul>
  )
}

function ContinuationRow({
  move,
  label,
  fresh,
  pressed,
  canPlay,
  onPreview,
  onPlay,
}: {
  move: Continuation
  label: string
  fresh: boolean
  pressed: boolean
  canPlay: boolean
  onPreview: (uci: string) => void
  onPlay: (move: MoveInput) => void
}) {
  return (
    <li className="opening-moves__row">
      <button type="button" className="opening-moves__pick" aria-pressed={pressed} onClick={() => onPreview(move.uci)}>
        <span className="opening-moves__san">{czSan(move.san)}</span>
        <span className="opening-moves__title">{move.resultingName ?? 'bez názvu'}</span>
        <span className="opening-moves__meta">
          {move.eco ?? '—'} · {variantLabel(move.variationsBelow)}
        </span>
      </button>
      <p className="opening-moves__stat">
        {label}
        {fresh && <span className="opening-moves__badge">nové pro tebe</span>}
      </p>
      <button type="button" className="btn btn--small" disabled={!canPlay} onClick={() => onPlay(parseUci(move.uci))}>
        Zahrát
      </button>
    </li>
  )
}
