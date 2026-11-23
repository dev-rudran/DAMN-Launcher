<script>
  import { onMount, onDestroy } from 'svelte'
  import Library from './Library.svelte'
  import Details from './Details.svelte'
  import TopBar from './TopBar.svelte'
  import { loadIndex } from '../data.js'
  import { createGamepadNav } from '../GamepadNav.js'
  import { play, rumble } from '../sounds.js'

  const THEMES = ['dark', 'warm', 'slate']

  let games = []
  let meta = { version: null, game_count: 0, sources: {}, updated_at: null }
  let view = 'library'
  let details = null
  let focused = 0
  let library = null
  let searchOpen = false
  let searchQ = ''
  let sourceFilter = null
  let favoritesOn = false
  let trendingOn = false
  let theme = 'dark'
  let favorites = new Set()
  let soundsOn = true
  let lastTick = 0

  $: visible = computeVisible()

  function computeVisible() {
    let out = games
    if (sourceFilter) out = out.filter((g) => g.source === sourceFilter)
    if (favoritesOn) out = out.filter((g) => favorites.has(g.id))
    if (trendingOn) {
      const t = out.filter((g) => g.is_trending)
      if (t.length) out = t
    }
    const q = searchQ.trim().toLowerCase()
    if (q) out = out.filter((g) => fuzzyMatch(g, q))
    return out
  }

  function fuzzyMatch(g, q) {
    const hay = [g.title, g.name, ...(g.genres || []), ...(g.companies || []), ...(g.credits || [])]
      .join(' ').toLowerCase()
    return hay.includes(q)
  }

  function persistFavorites() {
    localStorage.setItem('damn.favorites', JSON.stringify([...favorites]))
  }
  function persistTheme() {
    localStorage.setItem('damn.theme', theme)
  }

  const loadFavorites = () => {
    try { return new Set(JSON.parse(localStorage.getItem('damn.favorites') || '[]')) } catch { return new Set() }
  }
  const loadTheme = () => {
    const t = localStorage.getItem('damn.theme')
    return THEMES.includes(t) ? t : 'dark'
  }

  favorites = loadFavorites()
  theme = loadTheme()
  soundsOn = localStorage.getItem('damn.sounds') !== 'off'

  async function init() {
    try {
      const data = await loadIndex()
      games = data.games || []
      meta = data.meta || meta
    } catch (e) {
      console.warn('[damn] no game index:', e)
    }
    focused = Math.min(focused, Math.max(0, games.length - 1))
  }

  const openAt = (i) => {
    const g = visible[i]
    if (!g) return
    details = g
    focused = i
    view = 'details'
    if (soundsOn) play.open()
  }

  const openDownload = () => {
    const d = details
    if (!d) return
    const url = d.site_url || d.links?.[0]?.url
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const onBack = () => {
    if (searchOpen) { searchOpen = false; searchQ = ''; return }
    view = 'library'
    if (details) focused = visible.findIndex((g) => g.id === details.id)
  }

  const toggleFavoriteAt = (i) => {
    const g = visible[i]
    if (!g) return
    if (favorites.has(g.id)) favorites.delete(g.id)
    else favorites.add(g.id)
    favorites = new Set(favorites)
    persistFavorites()
    if (soundsOn) play.toggle()
  }

  const setFavoritesView = () => { favoritesOn = !favoritesOn; focused = 0 }
  const setTrendingView = () => { trendingOn = !trendingOn; focused = 0 }
  const setSourceFilter = (s) => { sourceFilter = s; focused = 0 }
  const cycleTheme = () => {
    const i = THEMES.indexOf(theme)
    theme = THEMES[(i + 1) % THEMES.length]
    persistTheme()
    if (soundsOn) play.theme()
  }
  const toggleSounds = () => {
    soundsOn = !soundsOn
    localStorage.setItem('damn.sounds', soundsOn ? 'on' : 'off')
  }
  const openSearch = () => { searchOpen = true; searchQ = '' }
  const closeSearch = () => { searchOpen = false; searchQ = '' }

  const openAdjacent = (delta) => {
    const idx = visible.findIndex((g) => g.id === details?.id)
    const next = idx + delta
    if (visible[next]) { details = visible[next]; focused = next }
  }

  function tickSound() {
    const t = performance.now()
    if (t - lastTick > 90) {
      lastTick = t
      if (soundsOn) play.move()
    }
  }

  function onKey(e) {
    const a = document.activeElement
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) {
      if (e.key === 'Escape') closeSearch()
      return
    }
    switch (e.key) {
      case 'Enter': openAt(focused); e.preventDefault(); break
      case 'Escape': onBack(); break
      case '/': openSearch(); e.preventDefault(); break
      case 'T': cycleTheme(); break
      case 'S': toggleSounds(); break
      case 'F': toggleFavoriteAt(focused); break
      case 'ArrowUp': library?.move(-1, 0); tickSound(); e.preventDefault(); break
      case 'ArrowDown': library?.move(1, 0); tickSound(); e.preventDefault(); break
      case 'ArrowLeft': library?.move(0, -1); tickSound(); e.preventDefault(); break
      case 'ArrowRight': library?.move(0, 1); tickSound(); e.preventDefault(); break
      case 'PageUp': library?.pageUp(); e.preventDefault(); break
      case 'PageDown': library?.pageDown(); e.preventDefault(); break
      case 'Home': library?.focus(0); e.preventDefault(); break
      case 'End': library?.focus(visible.length - 1); e.preventDefault(); break
      default: break
    }
  }

  const gp = createGamepadNav({
    speedMs: 120,
    accelMs: 700,
    onMove: (dy, dx) => { library?.move(dy, dx); tickSound() },
    onPress: (idx, pad) => {
      switch (idx) {
        case 0: view === 'details' ? openDownload() : openAt(focused); break
        case 1: onBack(); break
        case 2: toggleFavoriteAt(focused); break
        case 3: openSearch(); break
        case 4: library?.pageUp(); break
        case 5: library?.pageDown(); break
        case 8: if (searchOpen) { searchOpen = false; searchQ = '' } else onBack(); break
        case 9: library?.focus(0); break
        default: break
      }
      if (idx !== 12 && idx !== 13 && idx !== 14 && idx !== 15 && idx !== 10 && idx !== 11) {
        rumble(pad, idx === 0 || idx === 2 ? 0.5 : 0.25)
        if (soundsOn && [0, 1, 2, 3, 4, 5, 8, 9].includes(idx)) play.select()
      }
    },
    onRstick: (x, y) => {
      if (view !== 'details') return
      const scroller = document.querySelector('.details-content')
      if (scroller) scroller.scrollTo({ top: scroller.scrollTop + y * 14, behavior: 'auto' })
    },
  })

  onMount(() => {
    init()
    gp.start()
    document.addEventListener('keydown', onKey)
  })
  onDestroy(() => {
    gp.stop()
    document.removeEventListener('keydown', onKey)
  })
</script>

<div class="app theme-{theme}">
  <TopBar
    {games}
    {meta}
    {favorites}
    {favoritesOn}
    {trendingOn}
    {theme}
    {searchOpen}
    bind:searchQ
    on:openSearch={openSearch}
    on:closeSearch={closeSearch}
    on:setFavoritesView={setFavoritesView}
    on:setTrendingView={setTrendingView}
    on:setSourceFilter={setSourceFilter}
    on:cycleTheme={cycleTheme}
  />
  <div class="workspace">
    {#if view === 'library'}
      <Library
        bind:this={library}
        games={visible}
        bind:focused
        on:select={(e) => openAt(e.detail)}
        on:focus={(e) => { focused = e.detail; tickSound() }}
      />
    {:else}
      <Details
        {details}
        favorite={favorites.has(details.id)}
        onOpen={openDownload}
        onBack={onBack}
        onPrev={() => openAdjacent(-1)}
        onNext={() => openAdjacent(1)}
        onToggleFavorite={() => toggleFavoriteAt(visible.indexOf(details))}
      />
    {/if}
  </div>
</div>
