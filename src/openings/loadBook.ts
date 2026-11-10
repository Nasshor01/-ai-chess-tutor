import { buildBook, lineTo, type Book, type OpeningRecord } from './book/book'
import { openingFromBookLine, registerBookLines } from './openings'

let pending: Promise<Book> | null = null

function recordsOf(mod: unknown): OpeningRecord[] {
  if (Array.isArray(mod)) return mod as OpeningRecord[]
  if (mod && typeof mod === 'object' && 'default' in mod && Array.isArray(mod.default)) return mod.default as OpeningRecord[]
  throw new Error('Kniha zahájení nemá očekávaný tvar.')
}

/** Loads the generated table as its own chunk and registers the lines for training. */
export function loadOpeningBook(): Promise<Book> {
  if (!pending) {
    pending = import('./book/data/openings.json')
      .then((mod) => {
        const book = buildBook(recordsOf(mod))
        registerBookLines(
          book.entries.flatMap((entry) => {
            const steps = lineTo(book, entry.id)
            if (!steps) return []
            return [openingFromBookLine(entry.id, entry.eco, entry.name, steps.map((step) => step.san))]
          }),
        )
        return book
      })
      .catch((error: unknown) => {
        pending = null
        throw error
      })
  }
  return pending
}
