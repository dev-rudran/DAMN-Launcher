<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import GameCard from './GameCard.svelte'

  const dispatch = createEventDispatcher()

  export let games = []
  export let focused = 0
  let container = null
  let cols = 9

  function measureCols() {
    if (!container) return
    const gap = 16
    const minW = 220
    cols = Math.max(1, Math.floor((container.clientWidth + gap) / (minW + gap)))
    container.style.setProperty('--cols', String(cols))
  }

  let ro
  onMount(() => {
    ro = new ResizeObserver(measureCols)
    ro.observe(container)
    measureCols()
  })
  onDestroy(() => ro?.disconnect())

  $: if (games.length && focused >= games.length) focused = games.length - 1

  function move(dy, dx) {
    const n = games.length
    if (!n || !container) return
    const row = Math.floor(focused / cols)
    const col = focused % cols
    const nr = Math.max(0, Math.min(Math.ceil(n / cols) - 1, row + dy))
    const nc = Math.max(0, Math.min(cols - 1, col + dx))
    const nf = nr * cols + nc
    if (nf !== focused) {
      focused = nf
      const el = container.querySelectorAll('.card')[nf]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      dispatch('focus', nf)
    }
  }

  export function pageUp() { move(-cols) }
  export function pageDown() { move(cols) }
  export function focus(idx) {
    if (idx < 0 || idx >= games.length) return
    focused = idx
    const el = container?.querySelectorAll('.card')[idx]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    dispatch('focus', idx)
  }
</script>

<div class="grid" bind:this={container}>
  {#each games as g, i (g.id)}
    <GameCard game={g} isFocused={i === focused} onSelect={() => dispatch('select', i)} />
  {/each}
  {#if !games.length}
    <div class="empty">
      <h2>No games indexed</h2>
      <p>Run the indexer to populate the library — <code>npm run index</code> in <code>indexer/</code>.</p>
    </div>
  {/if}
</div>
