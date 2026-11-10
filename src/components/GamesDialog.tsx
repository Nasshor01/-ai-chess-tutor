import { useEffect, useRef, useState } from 'react'
import { listGames, movesFor } from '../storage/games'
import { exportPgn, importPgnText, type PgnIdentity } from '../storage/pgn'
import type { Game, UserColor } from '../storage/types'
import { formatImportReport, fullMoveCount, gameOpponent, resultLabel } from './gameList'
import { Modal } from './Modal'
import './GamesDialog.css'

interface Props {
  onClose: () => void
  onResume: (id: string) => Promise<boolean>
  onDelete: (id: string) => Promise<void>
}

export function GamesDialog({ onClose, onResume, onDelete }: Props) {
  const [games, setGames] = useState<Game[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [report, setReport] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [color, setColor] = useState<UserColor>('w')
  const [name, setName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = () => {
    void listGames()
      .then(setGames)
      .catch(() => setReport(['Partie se nepodařilo načíst.']))
  }

  useEffect(() => {
    reload()
  }, [])

  const download = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const pgnOf = async (game: Game) => {
    if (game.pgn.trim()) return game.pgn
    const moves = await movesFor(game.id)
    return exportPgn({
      startFen: game.startFen,
      uci: moves.map((move) => move.uci),
      event: game.headers.Event,
      site: game.headers.Site,
      date: game.headers.Date,
      white: game.headers.White,
      black: game.headers.Black,
      result: game.result,
    })
  }

  const exportOne = (game: Game) => {
    void pgnOf(game)
      .then((text) => download(`partie-${game.headers.Date}.pgn`, text))
      .catch(() => setReport(['Partii se nepodařilo exportovat.']))
  }

  const exportAll = () => {
    setBusy(true)
    void Promise.all(games.map((game) => pgnOf(game)))
      .then((texts) => download('moje-partie.pgn', texts.filter(Boolean).join('\n\n')))
      .catch(() => setReport(['Partie se nepodařilo exportovat.']))
      .finally(() => setBusy(false))
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    const identity: PgnIdentity = { color, name: name.trim() || undefined }
    void file
      .text()
      .then((text) => importPgnText(text, identity))
      .then((imported) => {
        setReport(formatImportReport(imported))
        reload()
      })
      .catch(() => setReport(['Soubor se nepodařilo přečíst.']))
      .finally(() => setBusy(false))
  }

  return (
    <Modal
      title="Moje partie"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={exportAll} disabled={busy || games.length === 0}>
            Exportovat vše
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Zavřít
          </button>
        </>
      }
    >
      <div className="games__import">
        <label>
          Hrál jsem
          <select value={color} onChange={(event) => setColor(event.target.value as UserColor)}>
            <option value="w">bílými</option>
            <option value="b">černými</option>
            <option value="both">oběma</option>
          </select>
        </label>
        <label>
          Jméno v partii
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="volitelné" />
        </label>
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          Importovat PGN
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pgn,text/plain"
          hidden
          onChange={(event) => {
            onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {report.length > 0 && (
        <div className="games__report" role="status">
          {report.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {games.length === 0 ? (
        <p className="games__empty">Zatím tu žádná partie není. Importuj PGN, nebo odehraj partii.</p>
      ) : (
        <ul className="games__list">
          {games.map((game) => (
            <li key={game.id} className="games__row">
              <div>
                <strong>{game.headers.Date}</strong>
                <span>{gameOpponent(game)}</span>
                <span>{resultLabel(game.result)}</span>
                <span>{fullMoveCount(game.plyCount)} tahů</span>
              </div>
              <div className="games__actions">
                {game.status === 'in-progress' && (
                  <button
                    type="button"
                    className="btn btn--small btn--primary"
                    onClick={() => {
                      void onResume(game.id).then((ok) => {
                        if (ok) onClose()
                        else setReport(['Partii nejde načíst.'])
                      })
                    }}
                  >
                    Pokračovat
                  </button>
                )}
                <button type="button" className="btn btn--small" onClick={() => exportOne(game)}>
                  Export
                </button>
                <button
                  type="button"
                  className={`btn btn--small btn--danger ${confirmId === game.id ? 'is-confirm' : ''}`}
                  onClick={() => {
                    if (confirmId !== game.id) {
                      setConfirmId(game.id)
                      return
                    }
                    setConfirmId(null)
                    void onDelete(game.id).then(reload)
                  }}
                >
                  {confirmId === game.id ? 'Opravdu?' : 'Smazat'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
