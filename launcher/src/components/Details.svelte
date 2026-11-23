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
  function openUrl(u) {
    window.open(u, '_blank', 'noopener,noreferrer')
  }
</script>

{#if game}
  <div class="details">
    <div class="details-bg" style="background-image: url('{posterUrl(game)}')"></div>
    <div class="details-content">
      <div class="details-media">
        <button class="d-back" on:click={onBack}>B / Esc</button>
        <img
          bind:this={imgEl}
          class="d-poster"
          src={posterUrl(game)}
          alt=""
          loading="lazy"
          decoding="async"
          on:error={onImgError}
        />
      </div>
      <div class="details-text">
        <h1 class="d-title">{game.title}</h1>
        <div class="d-sub">
          <span class="badge">{game.source}</span>
          {#if game.version}<span class="d-muted">v{game.version}</span>{/if}
          {#if game.date}<span class="d-muted">{game.date}</span>{/if}
          {#if game.repack_size}<span class="d-muted">{game.repack_size}</span>{/if}
        </div>
        <div class="d-credits">
          <strong>Cracked by:</strong> <span>{game.credits && game.credits.length ? game.credits.join(', ') : '—'}</span>
        </div>
        {#if game.requirements && Object.keys(game.requirements).length}
          <section>
            <h2 class="d-sec">System Requirements</h2>
            <dl class="d-req-grid">
              {#each Object.entries(game.requirements) as [k, v]}
                <div class="d-req-row"><dt class="d-req-k">{k}</dt><dd class="d-req-v">{v}</dd></div>
              {/each}
            </dl>
          </section>
        {/if}
        {#if game.features && game.features.length}
          <section>
            <h2 class="d-sec">Repack Features</h2>
            <ul class="d-feats-list">
              {#each game.features as f}<li>{f}</li>{/each}
            </ul>
          </section>
        {/if}
        <section class="d-links">
          <h2 class="d-sec">Download</h2>
          <div class="d-links-row">
            <button class="d-open" on:click={onOpen}>▶ Open download</button>
            {#each (game.links || []).slice(0, 4) as l (l.url)}
              <button class="d-link" on:click={() => openUrl(l.url)}>{l.provider}</button>
            {/each}
            {#if game.site_url}
              <button class="d-link ghost" on:click={() => openUrl(game.site_url)}>Open on site</button>
            {/if}
          </div>
        </section>
        <div class="d-nav">
          <button on:click={onPrev}>‹ Previous</button>
          <button on:click={onNext}>Next ›</button>
          <button class="d-fav" on:click={onToggleFavorite}>{favorite ? '★ Favorited' : '★ Favorite'}</button>
        </div>
      </div>
      {#if game.screenshots && game.screenshots.length}
        <div class="d-shots">
          <h2 class="d-sec">Screenshots</h2>
          <div class="d-shots-grid">
            {#each game.screenshots as s (s)}
              <img src={s} alt="" loading="lazy" decoding="async" class="d-shot" />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
