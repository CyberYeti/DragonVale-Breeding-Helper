<!--
  The Breeding cave picker (spec §8 Desktop layout): Normal / Rift / Co-op
  with the game's cave art. The choice lives in the store and survives reloads.
-->
<script lang="ts">
  import type { Cave } from '../../lib/core/breeding';
  import { useStore } from '../store.svelte';
  import { caveName } from '../tile/labels';
  import MenuIcon from './MenuIcon.svelte';
  import { CAVE_ICONS } from './tabInfo';

  const store = useStore();
  const CAVES: readonly Cave[] = ['normal', 'rift', 'coop'];
</script>

<div class="picker" role="group" aria-labelledby="cave-label">
  <div class="label" id="cave-label">Breeding cave</div>
  <div class="caves">
    {#each CAVES as cave (cave)}
      <button
        type="button"
        class="cave"
        class:on={store.cave === cave}
        aria-pressed={store.cave === cave}
        onclick={() => (store.cave = cave)}
      >
        <MenuIcon icon={{ src: CAVE_ICONS[cave] }} />
        <span>{caveName(cave)}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .caves {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 4px;
  }
  .cave {
    --icon-size: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 2px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
  }
  .cave.on {
    background: var(--bg);
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
</style>
