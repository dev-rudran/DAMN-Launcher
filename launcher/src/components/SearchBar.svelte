<script>
  import { onMount, createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let value = ''
  let input = null

  onMount(() => input?.focus())
</script>

<input
  bind:this={input}
  class="search-input"
  type="search"
  placeholder="Search games…"
  bind:value
  on:keydown={(e) => e.key === 'Escape' && dispatch('escape')}
/>
