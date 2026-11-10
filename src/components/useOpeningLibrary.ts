import { useEffect, useState } from 'react'
import { allMoves, listGames } from '../storage/games'
import { toPlayedGames, type Book, type PlayedGame } from '../openings/book/book'
import { loadOpeningBook } from '../openings/loadBook'
import { hydrateTriedOpenings, loadTriedOpenings } from '../openings/tried'

export function useOpeningLibrary() {
  const [book, setBook] = useState<Book | null>(null)
  const [games, setGames] = useState<PlayedGame[] | null>(null)
  const [tried, setTried] = useState<string[]>(() => loadTriedOpenings())
  const [bookFailed, setBookFailed] = useState(false)
  const [statsFailed, setStatsFailed] = useState(false)

  useEffect(() => {
    const life = { cancelled: false }
    void loadOpeningBook()
      .then((loaded) => {
        if (!life.cancelled) setBook(loaded)
      })
      .catch(() => {
        if (!life.cancelled) setBookFailed(true)
      })
    void Promise.all([listGames(), allMoves()])
      .then(([stored, moves]) => {
        if (!life.cancelled) setGames(toPlayedGames(stored, moves))
      })
      .catch(() => {
        if (!life.cancelled) setStatsFailed(true)
      })
    void hydrateTriedOpenings().then((stored) => {
      if (!life.cancelled && stored) setTried(stored)
    })
    return () => {
      life.cancelled = true
    }
  }, [])

  return { book, games, tried, bookFailed, statsFailed }
}
