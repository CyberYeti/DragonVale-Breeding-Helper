<!--
  The tile grid: the current view's sections (after search, Owned forms and
  filters), each a grid of MenuTiles, with a heading when there is more than
  one section.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { caveName } from '../tile/labels';
  import MenuTile from './MenuTile.svelte';
  import { useMenuView } from './menuView.svelte';
  import { emptyText, filtersOn, sectionHeading } from './sections';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();

  const sections = $derived(menu.view.sections);
  const noEvent = $derived(!nav.searching && menu.contents.noEvent);
</script>

<div class="grid-area">
  {#if noEvent}
    <p class="empty">No event is running right now. This tab fills in by itself when the next event starts.</p>
  {/if}
  {#each sections as section, i (i)}
    {@const heading = sectionHeading(section, sections.length)}
    <section class="section">
      {#if heading}<h2>{heading}</h2>{/if}
      {#if section.items.length}
        <div class="grid">
          {#each section.items as item (item.dragon.name)}
            <MenuTile {item} />
          {/each}
        </div>
      {:else}
        <p class="empty">{emptyText(section, filtersOn(nav.filters), caveName(store.cave))}</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .grid-area {
    padding-bottom: 16px;
  }
  h2 {
    margin: 0;
    padding: 12px 12px 6px;
    font-size: 16px;
  }
  .grid {
    --tile-width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    padding: 4px 12px 16px;
  }
  .empty {
    margin: 8px 12px;
    color: var(--muted);
  }

  /* Phone (spec §8 Phone layout): smaller tiles, tighter gaps. Keep 700px in step with MenuShell. */
  @media (max-width: 700px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
      gap: 6px;
      padding: 4px 8px 12px;
    }
    h2 {
      padding: 10px 8px 4px;
    }
  }
</style>
