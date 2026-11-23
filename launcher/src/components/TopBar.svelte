<script>
  import SearchBar from './SearchBar.svelte'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let games = 0
  export let meta = {}
  export let favorites = new Set()
  export let favoritesOn = false
  export let trendingOn = false
  export let theme = 'dark'
  export let searchOpen = false
  export let searchQ = ''
  export let sourceFilter = null

  $: sourceChips = Object.entries(meta?.sources || {}).map(([id, count]) => ({
    id,
    label: { fitgirl: 'FitGirl', dodi: 'DODI', ankergames: 'AnkerGames' }[id] || id,
    count,
  }))
</script>

<header class="topbar">
  <div class="brand">
    <span class="logo">DAMN</span>
    <span class="tagline">Launcher</span>
    <span class="count">{games} games</span>
    {#if meta?.version}<span class="ver">v{meta.version}</span>{/if}
  </div>
  <div class="top-right">
    <button class="chip" on:click={() => dispatch('openSearch')}>Search</button>
    <button class="chip {favoritesOn ? 'on' : ''}" on:click={() => dispatch('setFavoritesView')}>
      Favorites{favorites.size ? ` · ${favorites.size}` : ''}
    </button>
    <button class="chip {trendingOn ? 'on' : ''}" on:click={() => dispatch('setTrendingView')}>Trending</button>
    <button class="chip" on:click={() => dispatch('cycleTheme')}>Theme: {theme}</button>
  </div>
  <div class="chips">
    <button class="chip source {sourceFilter === null ? 'on' : ''}" on:click={() => dispatch('setSourceFilter', null)}>All</button>
    {#each sourceChips as s (s.id)}
      <button
        class="chip source {sourceFilter === s.id ? 'on' : ''}"
        on:click={() => dispatch('setSourceFilter', s.id)}
      >
        {s.label}{s.count > 0 ? ` (${s.count})` : ''}
      </button>
    {/each}
  </div>
  {#if searchOpen}
    <div class="search-row">
      <SearchBar bind:value={searchQ} on:escape={() => dispatch('closeSearch')} />
    </div>
  {/if}
</header>
