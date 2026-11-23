<script>
  import { posterUrl, placeholderFor } from '../data.js'

  export let game
  export let isFocused = false
  export let onSelect = () => {}

  let imgEl = null
  function onImgError() {
    if (imgEl) imgEl.src = placeholderFor(game)
  }
</script>

<article class="card" class:focused={isFocused} role="button" tabindex="-1" aria-label={game.title} on:click={onSelect}>
  <img class="poster" src={posterUrl(game)} alt="" loading="lazy" decoding="async" on:error={onImgError} />
  <div class="meta">
    <span class="badge">{game.source}</span>
    <span class="mtitle">{game.title}</span>
    <span class="msub">
      {#if game.repack_size}{game.repack_size}{/if}
      {#if game.genres && game.genres.length}
        {game.genres.slice(0, 2).join(' · ')}
      {/if}
      {#if game.date}{game.date}{/if}
    </span>
  </div>
</article>
