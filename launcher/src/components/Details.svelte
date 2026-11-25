<script>
  import { posterUrl, placeholderFor } from '../data.js'

  export let game = null
  export let favorite = false
  export let onOpen = () => {}
  export let onBack = () => {}
  export let onPrev = () => {}
  export let onNext = () => {}
  export let onToggleFavorite = () => {}

  let imgEl = null
  function onImgError() {
    if (imgEl) imgEl.src = placeholderFor(game)
  }
  const openUrl = (u) => window.open(u, '_blank', 'noopener,noreferrer')
  const sizeLabel = (g) => g.repack_size || null
  $: reqEntries = game?.requirements ? Object.entries(game.requirements) : []
</script>

{#if game}
  <div class="details" role="dialog" aria-label={game.title}>
    <div class="details-bg" style="background-image: url('{posterUrl(game)}')"></div>
    <button class="d-back" on:click={onBack}>‹ Back <span class="d-key">Esc</span></button>
    <div class="details-content">
      <div class="details-media">
        <img
          bind:this={imgEl}
          class="d-poster"
          src={posterUrl(game)}
          alt={game.title}
          loading="eager"
          decoding="async"
          on:error={onImgError}
        />
        <div class="d-nav">
          <button on:click={onPrev} aria-label="Previous game">‹ Prev</button>
          <button class="d-fav" on:click={onToggleFavorite} aria-pressed={favorite}>
            {favorite ? '★ Favorited' : '☆ Favorite'}
          </button>
          <button on:click={onNext} aria-label="Next game">Next ›</button>
        </div>
      </div>

      <div class="details-text">
        <h1 class="d-title">{game.title}</h1>
        <div class="d-sub">
          <span class="badge">{game.source}</span>
          {#if game.version}<span class="d-chip">{game.version}</span>{/if}
          {#if game.date}<span class="d-muted">{game.date}</span>{/if}
          {#if sizeLabel(game)}<span class="d-chip accent">{sizeLabel(game)}</span>{/if}
        </div>

        {#if game.genres?.length}
          <div class="d-tags">{#each game.genres.slice(0, 6) as g}<span>{g}</span>{/each}</div>
        {/if}

        <div class="d-credits">
          <strong>Cracked by</strong>
          <span>{game.credits?.length ? game.credits.join(', ') : 'Unknown'}</span>
        </div>

        <section>
          <h2 class="d-sec">Download</h2>
          <div class="d-links-row">
            <button class="d-open" on:click={onOpen}>▶ Open download page</button>
            {#each (game.links || []).slice(0, 6) as l (l.url)}
              <button class="d-link" on:click={() => openUrl(l.url)}>{l.provider}</button>
            {/each}
            {#if game.site_url}
              <button class="d-link ghost" on:click={() => openUrl(game.site_url)}>Source ↗</button>
            {/if}
          </div>
        </section>

        {#if reqEntries.length}
          <section>
            <h2 class="d-sec">Minimum Requirements</h2>
            <dl class="d-req-grid">
              {#each reqEntries as [k, v]}
                <div class="d-req-row"><dt class="d-req-k">{k}</dt><dd class="d-req-v">{v}</dd></div>
              {/each}
            </dl>
          </section>
        {/if}

        {#if game.features?.length}
          <section>
            <h2 class="d-sec">Repack Features</h2>
            <ul class="d-feats-list">
              {#each game.features.slice(0, 18) as f}<li>{f}</li>{/each}
            </ul>
          </section>
        {/if}

        {#if game.description}
          <section>
            <h2 class="d-sec">About</h2>
            <p class="d-desc">{game.description}</p>
          </section>
        {/if}

        {#if game.screenshots?.length}
          <section>
            <h2 class="d-sec">Screenshots</h2>
            <div class="d-shots-grid">
              {#each game.screenshots.slice(0, 6) as s (s)}
                <img src={s} alt="" loading="lazy" decoding="async" class="d-shot" />
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}
