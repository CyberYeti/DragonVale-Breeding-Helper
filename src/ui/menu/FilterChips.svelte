<!--
  The row of removable filter chips under the page header ("Filtered: Not
  owned ✕ … Clear all", spec §8 Desktop layout). Renders nothing while no
  filter is on.
-->
<script lang="ts">
  import { NO_FILTERS } from '../../lib/core/menu';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { rarityFill } from '../tile/labels';
  import {
    RARITIES,
    elementChoices,
    elementMatchLabel,
    filtersOn,
    RARITY_SQUARE,
    showLabel,
    toggleElement,
    toggleRarity,
  } from './filterLabels';

  const nav = useNav();
  const store = useStore();
  const filters = $derived(nav.filters);
  /** The ticked Elements, in the Filters popover's order. */
  const elements = $derived(elementChoices(store.snapshot).filter((e) => filters.elements.has(e.name)));
</script>

{#if filtersOn(filters)}
  <div class="chips" role="group" aria-label="Filters on">
    <span class="lbl">Filtered:</span>
    {#if filters.breedableNow}
      <button
        type="button"
        class="chip"
        aria-label="Remove filter Breedable now"
        onclick={() => (nav.filters = { ...filters, breedableNow: false })}>Breedable now ✕</button
      >
    {/if}
    {#if filters.availableNow}
      <button
        type="button"
        class="chip"
        aria-label="Remove filter Available now"
        onclick={() => (nav.filters = { ...filters, availableNow: false })}>Available now ✕</button
      >
    {/if}
    {#if filters.show !== 'all'}
      <button
        type="button"
        class="chip"
        aria-label="Remove filter {showLabel(filters.show)}"
        onclick={() => (nav.filters = { ...filters, show: 'all' })}>{showLabel(filters.show)} ✕</button
      >
    {/if}
    {#each RARITIES.filter((r) => filters.rarities.has(r)) as rarity (rarity)}
      <button
        type="button"
        class="chip"
        aria-label="Remove filter {rarity}"
        onclick={() => (nav.filters = toggleRarity(filters, rarity))}><span style:color={rarityFill(rarity)} aria-hidden="true">{RARITY_SQUARE}</span> {rarity} ✕</button
      >
    {/each}
    {#each elements as element (element.name)}
      <button
        type="button"
        class="chip"
        aria-label="Remove filter {element.name}"
        onclick={() => (nav.filters = toggleElement(filters, element.name))}
        >{#if element.icon}<img src={element.icon} alt="" draggable="false" />{/if}{element.name} ✕</button
      >
    {/each}
    {#if elements.length > 0 && filters.elementMatch === 'exact'}
      <button
        type="button"
        class="chip"
        aria-label="Remove {elementMatchLabel('exact')}"
        onclick={() => (nav.filters = { ...filters, elementMatch: 'contains' })}>{elementMatchLabel('exact')} ✕</button
      >
    {/if}
    <button type="button" class="clear" onclick={() => (nav.filters = NO_FILTERS)}>Clear all</button>
  </div>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 2px 12px 6px;
  }
  .lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .chip,
  .clear {
    padding: 2px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    font-size: 12px;
    cursor: pointer;
  }
  .chip img {
    width: 14px;
    height: 14px;
    margin-right: 3px;
    vertical-align: -2px;
  }
  .chip {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }
</style>
