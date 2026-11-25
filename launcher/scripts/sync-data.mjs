import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const src = resolve(root, '../../indexer/data')
const dest = resolve(root, '../public/data')

if (!existsSync(resolve(src, 'index.json'))) {
  console.log('[sync] no indexer/data/index.json — run the indexer first')
  process.exit(0)
}

// Clean destination first so trimmed/regenerated posters don't linger.
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true, force: true })
console.log(`[sync] copied index.json + posters to ${dest}`)
