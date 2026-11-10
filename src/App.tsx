import { useCallback, useEffect, useState } from 'react'
import { Chess } from 'chess.js'
import { useCalculator } from './calculator/useCalculator'
import { czSan } from './chess/utils'
import { CalculatorPanel } from './components/CalculatorPanel'
import { ChessBoardView } from './components/ChessBoardView'
import { Controls } from './components/Controls'
import { EvalMeter } from './components/EvalMeter'
import { ChartIcon, PlusIcon, TargetIcon } from './components/Icons'
import { MoveHistory } from './components/MoveHistory'
import { GamesDialog } from './components/GamesDialog'
import { NewGameDialog } from './components/NewGameDialog'
import { PositionSetupDialog } from './components/PositionSetupDialog'
import { PlayerBar } from './components/PlayerBar'
import { PuzzlePanel } from './components/PuzzlePanel'
import { SummaryDialog } from './components/SummaryDialog'
import { TutorPanel } from './components/TutorPanel'
import type { GameSettings } from './game/types'
import { useChessGame } from './game/useChessGame'
import { subscribeStorageWarning } from './storage/errors'
import type { GameSummary } from './tutor/summary'
import './App.css'

export default function App() {
  const game = useChessGame()
  const calc = useCalculator(game)
  const preview = calc.preview
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [showNewGame, setShowNewGame] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
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

  useEffect(() => subscribeStorageWarning(setStorageWarning), [])

  const { stepPreview, closePreview } = calc
  useEffect(() => {
    if (!preview) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview()
      else if (event.key === 'ArrowRight') stepPreview(1)
      else if (event.key === 'ArrowLeft') stepPreview(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, stepPreview, closePreview])

  const startGame = (settings: GameSettings) => {
    setShowNewGame(false)
    setOrientation('white')
    game.newGame(settings)
  }

  const confirmPosition = (fen: string) => {
    if (!game.loadPosition(fen)) return
    calc.enable()
    setShowSetup(false)
    setOrientation(new Chess(fen).turn() === 'b' ? 'black' : 'white')
  }

  const analyzeHere = () => {
    game.openInCalculator()
    calc.enable()
  }

  const puzzleOver = !!game.puzzle && game.puzzleStatus !== 'playing'
  const selfPlay = game.selfPlay && !game.puzzle
  const statusText = selfPlay && !game.gameOver
    ? game.turn === 'w'
      ? game.inCheck
        ? 'Šach! Na tahu je bílý – hraješ ty'
        : 'Na tahu je bílý – hraješ ty'
      : game.inCheck
        ? 'Šach! Na tahu je černý – hraješ ty'
        : 'Na tahu je černý – hraješ ty'
    : puzzleOver
    ? game.puzzleStatus === 'solved'
      ? 'Úloha vyřešena'
      : 'Úloha nevyšla'
    : game.gameOver
      ? 'Konec partie'
      : game.judging
        ? 'Trenér hodnotí tah'
        : game.aiThinking
          ? 'Počítač přemýšlí'
          : game.turn === 'w'
            ? game.inCheck
              ? 'Šach! Jsi na tahu'
              : 'Jsi na tahu'
            : 'Na tahu je soupeř'

  const modeLabel = game.puzzle
    ? 'Trénink matů'
    : game.activeOpening
      ? `Trénink: ${game.activeOpening.name}`
      : 'Volná hra'
  const opponentSubtitle = game.puzzle ? 'Stockfish · brání se naplno' : `Stockfish · ${game.config.label}`
  const puzzleMovesLeft = game.puzzle ? game.puzzle.mateIn - game.plies.filter((p) => p.byUser).length : 0

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
          {!game.puzzle && !selfPlay && <span className="pill">{game.config.label}</span>}
          <span className="pill pill--muted">{selfPlay ? 'Obě barvy' : modeLabel}</span>
          {summary && !summaryOpen && (
            <button type="button" className="btn btn--small" onClick={() => setDismissedSummary(null)}>
              <ChartIcon width={16} height={16} /> Rozbor
            </button>
          )}
          <button
            type="button"
            className="btn btn--small topbar__mate"
            onClick={() => {
              setOrientation('white')
              if (game.puzzle) game.exitPuzzles()
              else game.nextPuzzle()
            }}
          >
            <TargetIcon width={16} height={16} /> {game.puzzle ? 'Normální hra' : 'Trénink matů'}
          </button>
          <button type="button" className="btn btn--small" onClick={() => setShowGames(true)}>
            Moje partie
          </button>
          <button type="button" className="btn btn--small btn--primary topbar__new" onClick={() => setShowNewGame(true)}>
            <PlusIcon width={16} height={16} /> Nová hra
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="play" aria-label="Šachovnice">
          {storageWarning && (
            <p className="storage-banner" role="alert">
              {storageWarning}
            </p>
          )}
          <div className="play__board">
            <PlayerBar
              name={selfPlay || orientation === 'black' ? 'Ty' : 'Počítač'}
              subtitle={
                selfPlay
                  ? orientation === 'white'
                    ? 'černé figury · hraješ obě barvy'
                    : 'bílé figury · hraješ obě barvy'
                  : orientation === 'white'
                    ? opponentSubtitle
                    : 'bílé figury'
              }
              color={orientation === 'white' ? 'b' : 'w'}
              plies={game.plies}
              active={!game.gameOver && (orientation === 'white' ? game.turn === 'b' : game.turn === 'w')}
              status={
                selfPlay
                  ? !game.gameOver && game.turn === (orientation === 'white' ? 'b' : 'w')
                    ? statusText
                    : undefined
                  : orientation === 'white'
                    ? game.aiThinking
                      ? 'Přemýšlí'
                      : undefined
                    : !game.gameOver && game.turn === 'w'
                      ? statusText
                      : undefined
              }
              thinking={!selfPlay && orientation === 'white' && game.aiThinking}
            />
            <div className="play__stage">
              <ChessBoardView
                fen={preview?.fen ?? game.fen}
                orientation={orientation}
                canMove={game.canMove && !preview}
                lastMove={preview ? preview.lastMove : game.lastMove}
                inCheck={preview ? preview.inCheck : game.inCheck}
                hint={preview ? null : game.hint}
                extraArrows={calc.arrows}
                onMove={game.makeMove}
              />
              {preview && (
                <div className="preview-banner" role="status">
                  <span>
                    Náhled varianty {preview.option.letter} – nehraje se ({preview.step}/{preview.total})
                  </span>
                  <button type="button" className="btn btn--small" onClick={closePreview}>
                    Zpět k partii
                  </button>
                </div>
              )}
            </div>
            <PlayerBar
              name={selfPlay || orientation === 'white' ? 'Ty' : 'Počítač'}
              subtitle={
                selfPlay
                  ? orientation === 'white'
                    ? 'bílé figury · hraješ obě barvy'
                    : 'černé figury · hraješ obě barvy'
                  : orientation === 'white'
                    ? 'bílé figury'
                    : opponentSubtitle
              }
              color={orientation === 'white' ? 'w' : 'b'}
              plies={game.plies}
              active={!game.gameOver && (orientation === 'white' ? game.turn === 'w' : game.turn === 'b')}
              status={
                selfPlay
                  ? !game.gameOver && game.turn === (orientation === 'white' ? 'w' : 'b')
                    ? statusText
                    : game.gameOver
                      ? statusText
                      : undefined
                  : orientation === 'white'
                    ? !game.gameOver && game.turn === 'w'
                      ? statusText
                      : game.gameOver
                        ? statusText
                        : undefined
                    : game.aiThinking
                      ? 'Přemýšlí'
                      : undefined
              }
              thinking={!selfPlay && orientation === 'black' && game.aiThinking}
            />
          </div>
          <Controls
            canUndo={game.plies.some((p) => p.byUser) && !game.aiThinking}
            canHint={game.canMove && game.engineStatus !== 'loading'}
            canResign={game.puzzle ? game.puzzleStatus === 'playing' && !game.gameOver : !game.gameOver && game.plies.length > 0}
            resignLabel={game.puzzle ? 'Řešení' : 'Vzdát'}
            onNewGame={() => setShowNewGame(true)}
            onUndo={game.undo}
            onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            onHint={game.requestHint}
            onResign={game.resign}
          />
        </section>

        <aside className="sidebar" aria-label="Trenér a analýza">
          {game.puzzle && (
            <PuzzlePanel
              puzzle={game.puzzle}
              status={game.puzzleStatus}
              solved={game.solvedPuzzles}
              movesLeft={puzzleMovesLeft}
              onSelect={(id) => {
                setOrientation('white')
                game.startPuzzle(id)
              }}
              onRetry={() => game.startPuzzle(game.puzzle!.id)}
              onNext={game.nextPuzzle}
              onExit={game.exitPuzzles}
            />
          )}
          {!game.puzzle && (
            <EvalMeter
              evaluation={game.evaluation}
              analysing={game.analysing}
              engineStatus={game.engineStatus}
              openingName={game.openingName}
            />
          )}
          {!game.puzzle && <CalculatorPanel calc={calc} onSetup={() => setShowSetup(true)} onAnalyze={analyzeHere} />}
          <TutorPanel messages={game.messages} plyLabel={plyLabel} />
          <MoveHistory plies={game.plies} comments={game.comments} onExplain={game.explainPly} />
        </aside>
      </main>

      {showGames && (
        <GamesDialog
          onClose={() => setShowGames(false)}
          onResume={game.resumeGame}
          onDelete={game.deleteSavedGame}
        />
      )}
      {showNewGame && (
        <NewGameDialog initial={game.settings} onStart={startGame} onClose={() => setShowNewGame(false)} />
      )}
      {showSetup && (
        <PositionSetupDialog initialFen={game.fen} onConfirm={confirmPosition} onClose={() => setShowSetup(false)} />
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
