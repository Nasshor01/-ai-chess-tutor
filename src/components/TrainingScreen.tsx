import { useEffect, useState } from 'react'
import { applyUci } from '../chess/utils'
import type { BoardName } from '../ui/appearance'
import { dueCards, type TrainingCard } from '../training/items'
import { reviewSm2 } from '../training/sm2'
import { loadCards, loadRollups, saveCards } from '../training/store'
import { trendLines } from '../training/trend'
import { ChessBoardView } from './ChessBoardView'
import './TrainingScreen.css'

interface Props {
  board: BoardName
  onMates: () => void
}

export function TrainingScreen({ board, onMates }: Props) {
  const [cards, setCards] = useState<TrainingCard[] | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [held, setHeld] = useState<TrainingCard | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const life = { cancelled: false }
    void Promise.all([loadCards(), loadRollups()])
      .then(([loaded, rollups]) => {
        if (life.cancelled) return
        setCards(loaded)
        setLines(trendLines(rollups))
      })
      .catch(() => {
        if (!life.cancelled) setFailed(true)
      })
    return () => {
      life.cancelled = true
    }
  }, [])

  const due = cards ? dueCards(cards, now) : []
  const card = held ?? due[0] ?? null

  const grade = (kind: 'good' | 'again', current: TrainingCard) => {
    if (!cards || held) return
    const next = cards.map((item) =>
      item.id === current.id
        ? { ...item, ...reviewSm2(item, kind, Date.now()), lapses: item.lapses + (kind === 'again' ? 1 : 0) }
        : item,
    )
    setHeld(current)
    setNow(Date.now())
    setCards(next)
    const solution = applyUci(current.fen, current.solutionUci)
    setNote(kind === 'good' ? 'Správně. Tah sedí s lepším tahem z tvého rozboru.' : `To není lepší tah. Správně bylo ${solution?.san ?? current.solutionUci}. Karta se vrátí dřív.`)
    void saveCards(next).catch(() => setFailed(true))
  }

  return (
    <section className="training" aria-labelledby="training-title">
      <h2 id="training-title">Trénink</h2>
      <div className="training__mates">
        <h3>Matové úlohy</h3>
        <p>Vynucené maty ve dvou až čtyřech tazích. Soupeř se brání naplno.</p>
        <button type="button" className="btn btn--primary" onClick={onMates}>
          Otevřít matové úlohy
        </button>
      </div>
      <div className="training__weak">
        <h3>Slabiny z vlastních partií</h3>
        {failed && <p role="alert">Trénink se nepodařilo načíst.</p>}
        {!failed && cards === null && <p>Načítám úlohy…</p>}
        {cards && cards.length === 0 && <p>Zatím nemám opakovanou chybu z tvých partií. Až partie projde rozborem, objeví se tady.</p>}
        {card && (
          <div className="training__drill">
            <p>
              Najdi lepší tah než <strong>{card.playedSan}</strong>. Téma: {card.theme}. Zbývá {due.length}.
            </p>
            <ChessBoardView
              board={board}
              fen={card.fen}
              orientation="white"
              canMove={!note}
              lastMove={null}
              inCheck={false}
              hint={null}
              onMove={(input) => {
                const uci = `${input.from}${input.to}${input.promotion ?? ''}`
                if (uci === card.solutionUci) {
                  grade('good', card)
                  return true
                }
                grade('again', card)
                return false
              }}
            />
            {note && (
              <>
                <p>{note}</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setHeld(null)
                    setNote(null)
                  }}
                >
                  Další úloha
                </button>
              </>
            )}
          </div>
        )}
        {cards && cards.length > 0 && !card && <p>Dnes už nemáš nic k opakování.</p>}
        <h3>Ubývá stejných chyb?</h3>
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
