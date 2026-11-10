import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { parseUci } from '../chess/utils'
import type { MoveInput } from '../game/types'
import { surpriseAvoid } from '../openings/avoid'
import {
  ECO_GROUPS,
  ecoForPosition,
  hasPosition,
  lineTo,
  nameForPosition,
  positionKey,
  searchOpenings,
  surpriseOpening,
  type EcoGroupId,
} from '../openings/book/book'
import { BOARD_ARROWS } from '../ui/markers'
import type { BoardName } from '../ui/appearance'
import { ChessBoardView } from './ChessBoardView'
import { OpeningContinuations } from './OpeningContinuations'
import { useOpeningLibrary } from './useOpeningLibrary'
import './OpeningExplorer.css'

interface Props {
  board: BoardName
  onTrain: (openingId: string) => void
}

interface Step {
  fen: string
  uci: string
  move: ReturnType<Chess['move']>
}

export function OpeningExplorer({ board, onTrain }: Props) {
  const library = useOpeningLibrary()
  const [line, setLine] = useState<Step[]>([])
  const [preview, setPreview] = useState<{ fen: string; uci: string } | null>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<EcoGroupId | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [color, setColor] = useState<'w' | 'b'>('w')
  const startFen = useMemo(() => new Chess().fen(), [])
  const fen = line.at(-1)?.fen ?? startFen
  const chess = useMemo(() => new Chess(fen), [fen])
  const previewUci = preview?.fen === fen ? preview.uci : null
  const book = library.book
  const name = book ? nameForPosition(book, fen) : null
  const eco = book ? ecoForPosition(book, fen) : null
  const results = book && (query.trim() || group) ? searchOpenings(book, query, group) : []
  const groupInfo = ECO_GROUPS.find((item) => item.id === group) ?? null
  const trainId = selectedId ?? (book ? openingAt(book, fen) : null)

  const showLine = (id: string) => {
    if (!book) return
    const steps = lineTo(book, id)
    if (!steps) return
    const replay = new Chess()
    const built: Step[] = []
    for (const step of steps) {
      const move = replay.move(parseUci(step.uci))
      built.push({ fen: replay.fen(), uci: step.uci, move })
    }
    setLine(built)
    setSelectedId(id)
    setPreview(null)
  }

  const surprise = () => {
    if (!book || (!library.games && !library.statsFailed)) return
    const pick = surpriseOpening(book, color, surpriseAvoid(book, library.games ?? [], library.tried))
    if (pick) showLine(pick.id)
  }

  const arrow = previewUci
    ? [{ from: previewUci.slice(0, 2), to: previewUci.slice(2, 4), color: BOARD_ARROWS.hint }]
    : []

  return (
    <section className="openings-screen" aria-labelledby="openings-title">
      <div className="openings-screen__board">
        <h2 id="openings-title">Zahájení</h2>
        <p className="openings-screen__name">{name ? `${name}${eco ? ` · ${eco}` : ''}` : 'Tahle pozice ještě nemá název'}</p>
        {library.bookFailed && <p role="alert">Knihu zahájení se nepodařilo načíst.</p>}
        {!book && !library.bookFailed && <p>Načítám knihu zahájení…</p>}
        <ChessBoardView
          board={board}
          fen={fen}
          orientation={color === 'w' ? 'white' : 'black'}
          canMove={false}
          lastMove={line.at(-1)?.move ?? null}
          inCheck={chess.inCheck()}
          hint={null}
          extraArrows={arrow}
          onMove={() => false}
        />
        <div className="openings-screen__actions">
          <button type="button" className="btn btn--small" disabled={line.length === 0} onClick={() => { setLine((current) => current.slice(0, -1)); setSelectedId(null); setPreview(null) }}>
            Zpět v linii
          </button>
          <button type="button" className="btn btn--small" disabled={line.length === 0} onClick={() => { setLine([]); setSelectedId(null); setPreview(null) }}>
            Začátek
          </button>
          <button type="button" className="btn btn--small" aria-pressed={color === 'b'} onClick={() => setColor((current) => (current === 'w' ? 'b' : 'w'))}>
            {color === 'w' ? 'Prohlížet za černé' : 'Prohlížet za bílé'}
          </button>
          <button type="button" className="btn btn--small" disabled={!book || (!library.games && !library.statsFailed)} onClick={surprise}>
            Překvap mě
          </button>
        </div>
        <button type="button" className="btn btn--accent" disabled={!trainId} onClick={() => trainId && onTrain(trainId)}>
          Hrát tuto variantu bílými
        </button>
        <p className="openings-screen__note">Hra za černé v tréninku zatím nejde. Tady si linii můžeš jen prohlédnout.</p>
      </div>
      <div className="openings-screen__side">
        <label className="openings-screen__search">
          Hledat zahájení
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sicilská, Najdorf, King's Indian" />
        </label>
        <div className="openings-screen__groups" role="group" aria-label="Skupina ECO">
          <button type="button" className="btn btn--small" aria-pressed={group === null} onClick={() => setGroup(null)}>
            Vše
          </button>
          {ECO_GROUPS.map((item) => (
            <button key={item.id} type="button" className="btn btn--small" aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {groupInfo && <p className="openings-screen__note">{groupInfo.description}</p>}
        {results.length > 0 && (
          <ul className="openings-screen__results">
            {results.map((entry) => (
              <li key={entry.id}>
                <button type="button" aria-pressed={selectedId === entry.id} onClick={() => showLine(entry.id)}>
                  <span>{entry.name}</span>
                  <span className="opening-moves__meta">{entry.eco}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && results.length === 0 && book && <p className="openings-screen__note">Nic takového v knize není.</p>}
        {book && hasPosition(book, fen) && (
          <OpeningContinuations
            book={book}
            fen={fen}
            games={library.games}
            statsFailed={library.statsFailed}
            previewUci={previewUci}
            canPlay
            onPreview={(uci) => setPreview({ fen, uci })}
            onPlay={(move: MoveInput) => {
              const replay = new Chess(fen)
              const played = replay.move(move)
              setLine((current) => [...current, { fen: replay.fen(), uci: `${move.from}${move.to}${move.promotion ?? ''}`, move: played }])
              setSelectedId(null)
              setPreview(null)
            }}
          />
        )}
      </div>
    </section>
  )
}

function openingAt(book: NonNullable<ReturnType<typeof useOpeningLibrary>['book']>, fen: string): string | null {
  const key = positionKey(fen)
  const hits = book.entries.filter((entry) => entry.epd === key)
  const named = nameForPosition(book, fen)
  return hits.find((entry) => entry.name === named)?.id ?? hits[0]?.id ?? null
}
