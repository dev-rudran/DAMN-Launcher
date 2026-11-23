/**
 * Rewrite the main entry <script> path in dist/index.html to include the Pages
 * base (/DAMN-Launcher/) — Vite leaves the entry script unprefixed even when
 * base is set (the manifest and SW registration do get the base prefix).
 * Safe no-op when the path is already correct or when serving at the root.
 */
import fs from 'node:fs/promises'

const BASE = '/DAMN-Launcher/'
const htmlPath = new URL('../dist/index.html', import.meta.url)
let html = await fs.readFile(htmlPath, 'utf8')
if (!html.includes('src="/assets/')) {
  console.log('[fix-base] nothing to fix')
  process.exit(0)
}
html = html.replace(/src="\/assets\//g, `src="${BASE}assets/`)
await fs.writeFile(htmlPath, html)
console.log('[fix-base] rewrote entry script path to', BASE)
