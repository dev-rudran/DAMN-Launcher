export async function loadIndex() {
  const res = await fetch('/data/index.json')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data || !Array.isArray(data.games)) throw new Error('Invalid index data')
  return data
}

export function posterUrl(game) {
  if (!game || !game.poster) return placeholderFor(game)
  const p = game.poster
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  return new URL(p, '/data/').href
}

export function placeholderFor(game) {
  const palette = ['#ffb400', '#00d9a6', '#b5c0ff', '#ff5f6d', '#a079ff']
  let h = 7
  const id = game?.id || game?.title || '?'
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const color = palette[h % palette.length]
  const letter = (game?.title || game?.name || id).slice(0, 1).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="${color}"/><text x="32" y="40" font-family="system-ui, sans-serif" font-size="30" font-weight="800" fill="#ffffff" fill-opacity="0.92" text-anchor="middle">${letter}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
