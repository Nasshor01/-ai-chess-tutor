import type { Color, PieceSymbol } from 'chess.js'
import type { PlyRecord } from '../game/types'
import { PIECE_VALUE } from '../chess/utils'
import { PieceIcon } from '../chess/pieces'
import './PlayerBar.css'

const ORDER: Array<Exclude<PieceSymbol, 'k'>> = ['q', 'r', 'b', 'n', 'p']

interface Props {
  name: string
  subtitle: string
  color: Color
  plies: PlyRecord[]
  active: boolean
  status?: string
  thinking?: boolean
}

/** Pieces captured by `color` and the resulting material lead. */
function captured(plies: PlyRecord[], color: Color) {
  const taken = plies.filter((p) => p.move.color === color && p.move.captured).map((p) => p.move.captured as Exclude<PieceSymbol, 'k'>)
  const lost = plies.filter((p) => p.move.color !== color && p.move.captured).map((p) => p.move.captured as PieceSymbol)
  const score = (list: PieceSymbol[]) => list.reduce((sum, piece) => sum + PIECE_VALUE[piece], 0)
  const promotions = (c: Color) => plies.filter((p) => p.move.color === c && p.move.promotion).reduce((s, p) => s + PIECE_VALUE[p.move.promotion!] - 1, 0)
  const lead = score(taken) - score(lost) + promotions(color) - promotions(color === 'w' ? 'b' : 'w')
  taken.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  return { taken, lead }
}

export function PlayerBar({ name, subtitle, color, plies, active, status, thinking }: Props) {
  const { taken, lead } = captured(plies, color)
  const enemy: Color = color === 'w' ? 'b' : 'w'
  return (
    <div className={`player-bar ${active ? 'is-active' : ''}`}>
      <div className={`player-bar__avatar player-bar__avatar--${color}`} aria-hidden="true">
        <PieceIcon piece={color === 'w' ? 'wK' : 'bK'} />
      </div>
      <div className="player-bar__info">
        <div className="player-bar__name">
          {name}
          <span className="player-bar__subtitle">{subtitle}</span>
        </div>
        <div className="player-bar__captured" aria-label="Sebrané figury">
          {taken.map((piece, i) => (
            <span key={i}>
              <PieceIcon piece={`${enemy}${piece.toUpperCase()}`} />
            </span>
          ))}
          {lead > 0 && <em>+{lead}</em>}
        </div>
      </div>
      {status && (
        <div className={`player-bar__status ${thinking ? 'is-thinking' : ''}`}>
          {thinking && <span className="dots" aria-hidden="true"><i /><i /><i /></span>}
          {status}
        </div>
      )}
    </div>
  )
}
