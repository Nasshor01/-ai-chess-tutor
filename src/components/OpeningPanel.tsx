import { useEffect, useState } from 'react'
import { ecoForPosition, hasPosition, nameForPosition } from '../openings/book/book'
import type { MoveInput } from '../game/types'
import { BOARD_ARROWS } from '../ui/markers'
import { OpeningContinuations } from './OpeningContinuations'
import { useOpeningLibrary } from './useOpeningLibrary'

interface Props {
  fen: string
  canPlay: boolean
  onArrow: (arrow: { from: string; to: string; color: string } | null) => void
  onPlay: (move: MoveInput) => void
}

export function OpeningPanel({ fen, canPlay, onArrow, onPlay }: Props) {
  const library = useOpeningLibrary()
  const [pinned, setPinned] = useState<{ fen: string; uci: string } | null>(null)
  const preview = pinned?.fen === fen ? pinned.uci : null
  const book = library.book

  useEffect(() => {
    if (!preview) {
      onArrow(null)
      return
    }
    onArrow({ from: preview.slice(0, 2), to: preview.slice(2, 4), color: BOARD_ARROWS.hint })
    return () => onArrow(null)
  }, [onArrow, preview])

  if (library.bookFailed) {
    return (
      <section className="card opening-panel" aria-label="Zahájení">
        <h2 className="card__title">Zahájení</h2>
        <p>Knihu zahájení se nepodařilo načíst.</p>
      </section>
    )
  }
  if (!book) {
    return (
      <section className="card opening-panel" aria-label="Zahájení">
        <h2 className="card__title">Zahájení</h2>
        <p>Načítám knihu zahájení…</p>
      </section>
    )
  }
  if (!hasPosition(book, fen)) return null
  const name = nameForPosition(book, fen)
  const eco = ecoForPosition(book, fen)
  return (
    <section className="card opening-panel" aria-label="Zahájení">
      <h2 className="card__title">Zahájení</h2>
      <p className="opening-panel__name">{name ? `${name}${eco ? ` · ${eco}` : ''}` : 'Tahle pozice ještě nemá název'}</p>
      <OpeningContinuations
        book={book}
        fen={fen}
        games={library.games}
        statsFailed={library.statsFailed}
        previewUci={preview}
        canPlay={canPlay}
        onPreview={(uci) => setPinned({ fen, uci })}
        onPlay={onPlay}
      />
    </section>
  )
}
