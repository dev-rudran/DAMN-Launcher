/**
 * Rewrite absolute asset paths in dist/index.html to include the Pages base
 * (/DAMN-Launcher/) — Vite leaves the entry <script> and the generated
 * stylesheet link unprefixed even when `base` is set (the manifest and SW
 * registration do get the base prefix).
 * Safe no-op when the paths are already correct or when serving at the root.
 */
import fs from 'node:fs/promises'

const BASE = '/DAMN-Launcher/'
const htmlPath = new URL('../dist/index.html', import.meta.url)
let html = await fs.readFile(htmlPath, 'utf8')
const before = html
html = html.replace(/(src|href)="\/(assets|icons|favicon[^"]*)/g, `$1="${BASE}$2`)
if (html === before) {
  console.log('[fix-base] nothing to fix')
  process.exit(0)
}
await fs.writeFile(htmlPath, html)
console.log('[fix-base] rewrote asset paths to', BASE)
