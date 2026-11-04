// Test-only helper: runs the same Stockfish build in Node via stdin/stdout.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import type { EngineLine, EngineResult } from '../engine/types'

const require = createRequire(import.meta.url)

export class NodeEngine {
  private proc: ChildProcessWithoutNullStreams
  private buffer = ''
  private waiters: Array<(line: string) => boolean> = []

  constructor() {
    const enginePath: string = require('stockfish').findEngine('lite-single')
    this.proc = spawn(process.execPath, [enginePath], { stdio: 'pipe' })
    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      for (const line of lines) this.waiters = this.waiters.filter((w) => !w(line.trim()))
    })
  }

  private send(cmd: string) {
    this.proc.stdin.write(`${cmd}\n`)
  }

  async ready(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.waiters.push((l) => (l === 'readyok' ? (resolve(), true) : false))
      this.send('uci')
      this.send('isready')
    })
  }

  analyze(fen: string, depth = 12, multipv = 3): Promise<EngineResult> {
    const lines = new Map<number, EngineLine>()
    return new Promise((resolve) => {
      this.waiters.push((line) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const t = line.split(' ')
          const get = (k: string) => t[t.indexOf(k) + 1]
          const kind = get('score')
          const value = Number(t[t.indexOf('score') + 2])
          lines.set(Number(t.includes('multipv') ? get('multipv') : 1), {
            multipv: Number(t.includes('multipv') ? get('multipv') : 1),
            depth: Number(get('depth')),
            cp: kind === 'cp' ? value : null,
            mate: kind === 'mate' ? value : null,
            pv: t.slice(t.indexOf('pv') + 1),
          })
        }
        if (line.startsWith('bestmove')) {
          const best = line.split(' ')[1]
          const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv)
          resolve({ fen, bestMove: best === '(none)' ? null : best, lines: sorted, depth, requestedDepth: depth, multipv })
          return true
        }
        return false
      })
      this.send('ucinewgame')
      this.send(`setoption name MultiPV value ${multipv}`)
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)
    })
  }

  quit() {
    this.send('quit')
    this.proc.kill()
  }
}
