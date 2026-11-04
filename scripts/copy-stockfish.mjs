// Copies the lite single-threaded Stockfish build into public/ so it can run as a Web Worker.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(dirname(require.resolve('stockfish/package.json')), 'bin')
const targetDir = join(root, 'public', 'stockfish')
const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']

mkdirSync(targetDir, { recursive: true })
for (const file of files) {
  const source = join(sourceDir, file)
  if (!existsSync(source)) {
    console.error(`[copy-stockfish] Missing ${source}`)
    process.exit(1)
  }
  copyFileSync(source, join(targetDir, file))
}
console.log(`[copy-stockfish] Copied ${files.length} files to public/stockfish`)
