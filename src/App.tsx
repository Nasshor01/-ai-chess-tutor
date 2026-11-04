import { useCallback, useState } from 'react'
import { czSan } from './chess/utils'
import { ChessBoardView } from './components/ChessBoardView'
import { Controls } from './components/Controls'
import { EvalMeter } from './components/EvalMeter'
import { ChartIcon, PlusIcon } from './components/Icons'
import { MoveHistory } from './components/MoveHistory'
import { NewGameDialog } from './components/NewGameDialog'
import { PlayerBar } from './components/PlayerBar'
import { SummaryDialog } from './components/SummaryDialog'
import { TutorPanel } from './components/TutorPanel'
import type { GameSettings } from './game/types'
import { useChessGame } from './game/useChessGame'
import type { GameSummary } from './tutor/summary'
import './App.css'

export default function App() {
  const game = useChessGame()
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [showNewGame, setShowNewGame] = useState(false)
  const [dismissedSummary, setDismissedSummary] = useState<GameSummary | null>(null)

  const summary = game.gameOver?.summary ?? null
  const summaryOpen = !!summary && summary !== dismissedSummary

  const plyLabel = useCallback(
    (index: number) => {
      const ply = game.plies[index]
      if (!ply) return ''
      return `${Math.floor(index / 2) + 1}${ply.move.color === 'w' ? '.' : '…'} ${czSan(ply.move.san)}`
    },
    [game.plies],
  )

  const startGame = (settings: GameSettings) => {
    setShowNewGame(false)
    setOrientation('white')
    game.newGame(settings)
  }

  const statusText = game.gameOver
    ? 'Konec partie'
    : game.aiThinking
      ? 'Počítač přemýšlí'
      : game.turn === 'w'
        ? game.inCheck
          ? 'Šach! Jsi na tahu'
          : 'Jsi na tahu'
        : 'Na tahu je soupeř'

  const modeLabel = game.activeOpening ? `Trénink: ${game.activeOpening.name}` : 'Volná hra'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__logo" aria-hidden="true">
            ♞
          </div>
          <div>
            <h1>AI Chess Tutor</h1>
            <p>Šachový trenér, který vysvětluje</p>
          </div>
        </div>
        <div className="topbar__meta">
          <span className="pill">{game.config.label}</span>
          <span className="pill pill--muted">{modeLabel}</span>
          {summary && !summaryOpen && (
            <button type="button" className="btn btn--small" onClick={() => setDismissedSummary(null)}>
              <ChartIcon width={16} height={16} /> Rozbor
            </button>
          )}
          <button type="button" className="btn btn--small btn--primary topbar__new" onClick={() => setShowNewGame(true)}>
            <PlusIcon width={16} height={16} /> Nová hra
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="play" aria-label="Šachovnice">
          <div className="play__board">
            <PlayerBar
              name={orientation === 'white' ? 'Počítač' : 'Ty'}
              subtitle={orientation === 'white' ? `Stockfish · ${game.config.label}` : 'bílé figury'}
              color={orientation === 'white' ? 'b' : 'w'}
              plies={game.plies}
              active={!game.gameOver && (orientation === 'white' ? game.turn === 'b' : game.turn === 'w')}
              status={
                orientation === 'white'
                  ? game.aiThinking
                    ? 'Přemýšlí'
                    : undefined
                  : !game.gameOver && game.turn === 'w'
                    ? statusText
                    : undefined
              }
              thinking={orientation === 'white' && game.aiThinking}
            />
            <ChessBoardView
              fen={game.fen}
              orientation={orientation}
              canMove={game.canMove}
              lastMove={game.lastMove}
              inCheck={game.inCheck}
              hint={game.hint}
              onMove={game.makeMove}
            />
            <PlayerBar
              name={orientation === 'white' ? 'Ty' : 'Počítač'}
              subtitle={orientation === 'white' ? 'bílé figury' : `Stockfish · ${game.config.label}`}
              color={orientation === 'white' ? 'w' : 'b'}
              plies={game.plies}
              active={!game.gameOver && (orientation === 'white' ? game.turn === 'w' : game.turn === 'b')}
              status={
                orientation === 'white'
                  ? !game.gameOver && game.turn === 'w'
                    ? statusText
                    : game.gameOver
                      ? statusText
                      : undefined
                  : game.aiThinking
                    ? 'Přemýšlí'
                    : undefined
              }
              thinking={orientation === 'black' && game.aiThinking}
            />
          </div>
          <Controls
            canUndo={game.plies.some((p) => p.byUser) && !game.aiThinking}
            canHint={game.canMove && game.engineStatus !== 'loading'}
            canResign={!game.gameOver && game.plies.length > 0}
            onNewGame={() => setShowNewGame(true)}
            onUndo={game.undo}
            onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            onHint={game.requestHint}
            onResign={game.resign}
          />
        </section>

        <aside className="sidebar" aria-label="Trenér a analýza">
          <EvalMeter
            evaluation={game.evaluation}
            analysing={game.analysing}
            engineStatus={game.engineStatus}
            openingName={game.openingName}
          />
          <TutorPanel messages={game.messages} plyLabel={plyLabel} />
          <MoveHistory plies={game.plies} comments={game.comments} onExplain={game.explainPly} />
        </aside>
      </main>

      {showNewGame && (
        <NewGameDialog initial={game.settings} onStart={startGame} onClose={() => setShowNewGame(false)} />
      )}
      {summaryOpen && summary && (
        <SummaryDialog
          summary={summary}
          onClose={() => setDismissedSummary(summary)}
          onNewGame={() => {
            setDismissedSummary(summary)
            setShowNewGame(true)
          }}
        />
      )}
    </div>
  )
}
