<!--
  One Dragon listed in a click panel: its art, its name (tap: select its node
  or make it the Target) and its ownership ticks, which write the Collection.
  `note` is a short line after the name ("+ your Plant Dragon").
-->
<script lang="ts">
  import type { Listed } from '../../../lib/core/panel';
  import { useStore } from '../../store.svelte';
  import { assetUrl, rarityColour } from '../../tile/labels';
  import type { ClickPanel } from './clickPanel.svelte';
  import { formSuffix } from './panelText';

  let {
    panel,
    item,
    note,
    tag,
    ticks = true,
  }: {
    panel: ClickPanel;
    item: Listed;
    note?: string;
    /** A small label before the name, e.g. "Breedable now". */
    tag?: string;
    ticks?: boolean;
  } = $props();

  const store = useStore();
  const dragon = $derived(item.dragon);
  const owned = $derived(item.ticks.some((t) => t.form === item.form && t.owned));
  const single = $derived(item.ticks.length === 1);
</script>

<div class="row">
  <span class="art" style:--rc={rarityColour(dragon.rarity)}>
    {#if dragon.image}
      <img src={assetUrl(dragon.image)} alt="" class:grey={!owned} loading="lazy" decoding="async" draggable="false" />
    {/if}
  </span>
  <span class="text">
    <button type="button" class="name" onclick={() => panel.pickDragon(dragon.name, item.form)}
      >{dragon.name}{formSuffix(item)}</button
    >
    {#if tag}<span class="tag">{tag}</span>{/if}
    {#if note}<span class="note">{note}</span>{/if}
  </span>
  {#if ticks}
    <span class="ticks">
      {#each item.ticks as tick (tick.form)}
        <button
          type="button"
          class:on={tick.owned}
          class:rift={tick.form === 'rift' && !single}
          aria-pressed={tick.owned}
          aria-label="{single ? 'Owned' : tick.form === 'rift' ? 'Rift form' : 'Normal form'}: {dragon.name}"
          onclick={() => store.toggle(dragon, tick.form)}
          >{single ? '✔ Owned' : tick.form === 'rift' ? 'Rift' : 'Normal'}</button
        >
      {/each}
    </span>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
  }
  .art {
    flex: none;
    width: 28px;
    height: 28px;
    border: 2px solid var(--rc);
    border-radius: 7px;
    background: var(--bg);
    overflow: hidden;
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .art img.grey {
    filter: grayscale(1) opacity(0.5);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 6px;
  }
  .name {
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .name:hover {
    text-decoration-style: solid;
  }
  .note {
    font-size: 12px;
    color: var(--muted);
  }
  .tag {
    font-size: 10px;
    font-weight: 600;
    padding: 0 5px;
    border-radius: 5px;
    background: var(--own);
    color: #fff;
  }
  .ticks {
    flex: none;
    display: flex;
    gap: 3px;
  }
  .ticks button {
    cursor: pointer;
    font-size: 11px;
    line-height: 18px;
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: var(--muted);
    white-space: nowrap;
  }
  .ticks button.on {
    background: var(--own);
    border-color: var(--own);
    color: #fff;
  }
  .ticks button.rift.on {
    background: var(--rift);
    border-color: var(--rift);
  }
</style>
