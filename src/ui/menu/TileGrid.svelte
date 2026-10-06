<!--
  The tile grid: the current view's sections (after search, Owned forms and
  filters), each a grid of MenuTiles, with a heading when there is more than
  one section. Event sections always get a header (icon, name, end date,
  currency); Limited rotation and Event tiles carry a note ("ends in N days",
  shop cost). The Event tab says when no Event is running and lists the
  overlay's unrecognised names at the bottom.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { caveName } from '../tile/labels';
  import MenuTile from './MenuTile.svelte';
  import { useMenuView } from './menuView.svelte';
  import MenuIcon from './MenuIcon.svelte';
  import { emptyText, eventSubtitle, filtersOn, itemNote, limitedGap, noEventText, sectionHeading } from './sections';
  import { eventIcon } from './tabInfo';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();

  const sections = $derived(menu.view.sections);
  const onEventTab = $derived(!nav.searching && nav.tab.kind === 'event');
  const noEvent = $derived(onEventTab && menu.contents.noEvent);
  const notRecognised = $derived(onEventTab ? menu.contents.notRecognised : []);
  const gap = $derived(limitedGap(store.limitedStatus));
  const now = $derived(store.world.now);
</script>

<div class="grid-area">
  {#if noEvent}
    <p class="empty">{noEventText(gap)}</p>
  {/if}
  {#each sections as section, i (i)}
    {@const heading = sectionHeading(section, sections.length)}
    <section class="section">
      {#if section.kind === 'event'}
        <header class="event-head">
          <h2><MenuIcon icon={eventIcon(section.event.name)} /><span>{section.event.name}</span></h2>
          <p class="sub">{eventSubtitle(section.event, now)}</p>
        </header>
      {:else if heading}
        <h2>{heading}</h2>
      {/if}
      {#if section.items.length}
        <div class="grid">
          {#each section.items as item (item.dragon.name)}
            <MenuTile {item} note={itemNote(section, item, now)} />
          {/each}
        </div>
      {:else}
        <p class="empty">{emptyText(section, filtersOn(nav.filters), caveName(store.cave), gap)}</p>
      {/if}
    </section>
  {/each}
  {#if notRecognised.length}
    <p class="not-recognised">Not recognised: {notRecognised.join(', ')}</p>
  {/if}
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
  .event-head {
    padding: 12px 12px 6px;
  }
  .event-head h2 {
    --icon-size: 24px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
  }
  .sub {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .not-recognised {
    margin: 8px 12px;
    font-size: 12px;
    color: var(--muted);
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
