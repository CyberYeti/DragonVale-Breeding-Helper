<!--
  The header above the page (spec §8 Desktop layout): search over every
  Dragon, then the ⋯ menu. A non-blank search replaces the tab's tiles with
  the results; Escape in the box clears it.

  `leading` sits before the search box (the phone layout's ☰ button).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useNav } from '../nav.svelte';
  import MoreMenu from './MoreMenu.svelte';

  let { leading }: { leading?: Snippet } = $props();

  const nav = useNav();

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && nav.query !== '') {
      event.stopPropagation();
      nav.search('');
    }
  }
</script>

<header class="header">
  {@render leading?.()}
  <input
    class="search"
    type="search"
    placeholder="Search every Dragon…"
    aria-label="Search every Dragon"
    autocomplete="off"
    spellcheck="false"
    value={nav.query}
    oninput={(e) => nav.search(e.currentTarget.value)}
    {onkeydown}
  />
  <span class="spacer"></span>
  <MoreMenu />
</header>

<style>
  .header {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--card);
  }
  .search {
    flex: 1;
    max-width: 460px;
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
  }
  .spacer {
    flex: 1;
  }
</style>
