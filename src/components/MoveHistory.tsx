import { useEffect, useRef, useState } from 'react'
import { czSan } from '../chess/utils'
import type { PlyRecord } from '../game/types'
import { QUALITY_LABEL, QUALITY_SYMBOL } from '../tutor/classify'
import type { TutorComment } from '../tutor/types'
import { QuestionIcon } from './Icons'
import './MoveHistory.css'

interface Props {
  plies: PlyRecord[]
  comments: Record<number, TutorComment>
  onExplain: (plyIndex: number) => void
}

export function MoveHistory({ plies, comments, onExplain }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const active = selected !== null && selected < plies.length ? selected : plies.length - 1

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [plies.length])

  const rows: Array<{ number: number; white?: PlyRecord; black?: PlyRecord }> = []
  plies.forEach((ply) => {
    const number = Math.floor(ply.index / 2) + 1
    if (ply.move.color === 'w') rows.push({ number, white: ply })
    else if (rows.length && !rows[rows.length - 1].black) rows[rows.length - 1].black = ply
    else rows.push({ number, black: ply })
  })

  const cell = (ply?: PlyRecord) => {
    if (!ply) return <span className="history__cell is-empty" />
    const comment = comments[ply.index]
    return (
      <button
        type="button"
        className={`history__cell ${active === ply.index ? 'is-selected' : ''}`}
        onClick={() => setSelected(ply.index)}
        onDoubleClick={() => onExplain(ply.index)}
        title={comment ? QUALITY_LABEL[comment.quality] : 'Klikni pro výběr, dvojklik pro vysvětlení'}
      >
        <span>{czSan(ply.move.san)}</span>
        {comment && (
          <span className={`history__symbol q-${comment.quality}`} aria-label={QUALITY_LABEL[comment.quality]}>
            {QUALITY_SYMBOL[comment.quality]}
          </span>
        )}
      </button>
    )
  }

  const activePly = active >= 0 ? plies[active] : undefined

  return (
    <section className="card history" aria-label="Historie tahů">
      <div className="history__header">
        <h2 className="card__title">Historie tahů</h2>
        <span className="history__count">{plies.length ? `${Math.ceil(plies.length / 2)}. tah` : 'zatím žádné tahy'}</span>
      </div>

      <div className="history__list" ref={listRef}>
        {rows.length === 0 && <p className="history__empty">Táhni figurou na šachovnici – tahy se objeví tady.</p>}
        {rows.map((row) => (
          <div className="history__row" key={row.number}>
            <span className="history__number">{row.number}.</span>
            {cell(row.white)}
            {cell(row.black)}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn--small history__why"
        disabled={!activePly}
        onClick={() => activePly && onExplain(activePly.index)}
      >
        <QuestionIcon width={16} height={16} />
        Proč tento tah?
        {activePly && (
          <span className="history__why-move">
            {Math.floor(activePly.index / 2) + 1}
            {activePly.move.color === 'w' ? '.' : '…'} {czSan(activePly.move.san)}
          </span>
        )}
      </button>
    </section>
  )
}
