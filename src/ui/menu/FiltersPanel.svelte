<!--
  The Filters popover's contents (spec §8 Filters and Display): Breedable now
  in the chosen cave, Show All / Owned / Not owned, the Rarity checklist (none
  ticked = all), Clear all and Done. Writes `nav.filters` as new objects.
-->
<script lang="ts">
  import { NO_FILTERS } from '../../lib/core/menu';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { caveName, rarityColour } from '../tile/labels';
  import { RARITIES, SHOWS, raritySymbol, showLabel, toggleRarity } from './filterLabels';

  let { ondone }: { ondone: () => void } = $props();

  const nav = useNav();
  const store = useStore();
</script>

<label class="check bnow">
  <input
    type="checkbox"
    checked={nav.filters.breedableNow}
    onchange={(e) => (nav.filters = { ...nav.filters, breedableNow: e.currentTarget.checked })}
  />
  <span><b>Breedable now</b> <span class="muted">in the {caveName(store.cave)} cave</span></span>
</label>

<div class="lbl" id="filters-show">Show</div>
<div class="seg" role="radiogroup" aria-labelledby="filters-show">
  {#each SHOWS as show (show)}
    <button
      type="button"
      role="radio"
      aria-checked={nav.filters.show === show}
      class:on={nav.filters.show === show}
      onclick={() => (nav.filters = { ...nav.filters, show })}>{showLabel(show)}</button
    >
  {/each}
</div>

<div class="lbl" id="filters-rarity">Rarity <span class="hint">(none ticked = all)</span></div>
<div role="group" aria-labelledby="filters-rarity">
  {#each RARITIES as rarity (rarity)}
    <label class="check">
      <input
        type="checkbox"
        checked={nav.filters.rarities.has(rarity)}
        onchange={() => (nav.filters = toggleRarity(nav.filters, rarity))}
      />
      <span class="sym" style:color={rarityColour(rarity)} aria-hidden="true">{raritySymbol(rarity)}</span>
      {rarity}
    </label>
  {/each}
</div>

<div class="actions">
  <button type="button" class="small" onclick={() => (nav.filters = NO_FILTERS)}>Clear all</button>
  <span class="spacer"></span>
  <button type="button" class="small primary" onclick={ondone}>Done</button>
</div>

<style>
  .lbl {
    margin: 10px 0 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .hint {
    text-transform: none;
    letter-spacing: 0;
  }
  .muted {
    color: var(--muted);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px;
    border-radius: 6px;
    cursor: pointer;
  }
  .check:hover {
    background: var(--bg);
  }
  .check input {
    margin: 0;
  }
  .sym {
    width: 1.2em;
    text-align: center;
    -webkit-text-stroke: 0.5px var(--muted);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    padding: 4px 10px;
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--card);
    cursor: pointer;
  }
  .seg button:last-child {
    border-right: 0;
  }
  .seg button.on {
    background: var(--fg);
    color: var(--bg);
  }
  .actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .spacer {
    flex: 1;
  }
  .small {
    padding: 3px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }
</style>
