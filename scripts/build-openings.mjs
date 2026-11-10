/**
 * Downloads the CC0 opening tables from lichess-org/chess-openings
 * and writes src/openings/book/data/openings.json.
 *
 * The generated file is committed. The app build does not need the network.
 * License checked against COPYING.txt and the GitHub SPDX id CC0-1.0.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/openings/book/data/openings.json')
const SOURCE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'
const FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']

function positionKey(fen) {
  const parts = fen.trim().split(/\s+/)
  return `${parts[0]} ${parts[1] ?? 'w'} ${parts[2] ?? '-'} ${parts[3] ?? '-'}`
}

function rowsFrom(tsv) {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const header = lines.shift()
  if (header !== 'eco\tname\tpgn') throw new Error(`Unexpected header: ${header}`)
  return lines.map((line) => {
    const [eco, name, pgn] = line.split('\t')
    if (!eco || !name || pgn === undefined) throw new Error(`Bad row: ${line}`)
    return { eco, name, pgn }
  })
}

function epdFor(pgn) {
  const chess = new Chess()
  if (pgn.trim() !== '' && pgn.trim() !== '*') chess.loadPgn(pgn)
  return positionKey(chess.fen())
}

const license = await fetch(`${SOURCE}/COPYING.txt`)
if (!license.ok) throw new Error(`License download failed: ${license.status}`)
const copying = await license.text()
if (!copying.includes('CC0 1.0 Universal')) {
  throw new Error('chess-openings license is not CC0. Stop and do not generate the file.')
}

const records = []
for (const file of FILES) {
  const response = await fetch(`${SOURCE}/${file}`)
  if (!response.ok) throw new Error(`${file} download failed: ${response.status}`)
  const rows = rowsFrom(await response.text())
  for (const row of rows) {
    let epd
    try {
      epd = epdFor(row.pgn)
    } catch (error) {
      throw new Error(`${file} ${row.eco} ${row.name}: ${error instanceof Error ? error.message : error}`)
    }
    records.push({ eco: row.eco, name: row.name, pgn: row.pgn, epd })
  }
  console.log(`${file}: ${rows.length}`)
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, `${JSON.stringify(records)}\n`)
console.log(`wrote ${records.length} openings`)
