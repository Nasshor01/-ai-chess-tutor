import { useEffect, useState } from 'react'
import { BulbIcon, FlagIcon, FlipIcon, PlusIcon, UndoIcon } from './Icons'
import './Controls.css'

interface Props {
  canUndo: boolean
  canHint: boolean
  canResign: boolean
  onNewGame: () => void
  onUndo: () => void
  onFlip: () => void
  onHint: () => void
  onResign: () => void
  resignLabel?: string
}

export function Controls({
  canUndo,
  canHint,
  canResign,
  onNewGame,
  onUndo,
  onFlip,
  onHint,
  onResign,
  resignLabel = 'Vzdát',
}: Props) {
  const [confirmResign, setConfirmResign] = useState(false)

  useEffect(() => {
    if (!confirmResign) return
    const timer = setTimeout(() => setConfirmResign(false), 3500)
    return () => clearTimeout(timer)
  }, [confirmResign])

  return (
    <div className="controls" role="toolbar" aria-label="Ovládání partie">
      <button type="button" className="btn" onClick={onNewGame}>
        <PlusIcon />
        <span>Nová hra</span>
      </button>
      <button type="button" className="btn" onClick={onUndo} disabled={!canUndo}>
        <UndoIcon />
        <span>Zpět</span>
      </button>
      <button type="button" className="btn" onClick={onFlip}>
        <FlipIcon />
        <span>Otočit</span>
      </button>
      <button type="button" className="btn btn--accent" onClick={onHint} disabled={!canHint}>
        <BulbIcon />
        <span>Nápověda</span>
      </button>
      <button
        type="button"
        className={`btn btn--danger ${confirmResign ? 'is-confirm' : ''}`}
        disabled={!canResign}
        onClick={() => {
          if (confirmResign) {
            setConfirmResign(false)
            onResign()
          } else {
            setConfirmResign(true)
          }
        }}
      >
        <FlagIcon />
        <span>{confirmResign ? 'Opravdu?' : resignLabel}</span>
      </button>
    </div>
  )
}
