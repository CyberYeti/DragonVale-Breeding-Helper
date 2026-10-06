<!--
  The left sidebar (spec §8 Desktop layout), top to bottom: the Breeding cave
  picker; the Breedable now, Limited rotation and Event tabs; the Elemental /
  Epic / Special page groups as an exclusive accordion. Every entry shows
  owned/total. The open group is local state.
-->
<script lang="ts">
  import type { PageGroup } from '../../lib/core/menu';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import CavePicker from './CavePicker.svelte';
  import { useMenuView } from './menuView.svelte';
  import NavEntry from './NavEntry.svelte';
  import { BREEDABLE_ICON, GROUP_TITLES, LIMITED_ICON, eventIcon, eventLabel, pageIcon } from './tabInfo';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();

  const counts = $derived(menu.counts);
  const firstEvent = $derived(menu.events.sections.find((s) => s.kind === 'event'));

  function groupOf(): PageGroup | null {
    const tab = nav.tab;
    if (tab.kind !== 'page') return null;
    return store.snapshot.pages.find((p) => p.name === tab.page)?.group ?? null;
  }

  /** The one open page group; starts on the current page's group. */
  let openGroup = $state<PageGroup | null>(groupOf() ?? 'elemental');

  function toggleGroup(group: PageGroup) {
    openGroup = openGroup === group ? null : group;
  }
</script>

<nav class="sidebar" aria-label="Tabs and Dragonarium pages">
  <div class="brand">Breeding Helper</div>

  <CavePicker />

  <div class="tabs">
    <NavEntry tab={{ kind: 'breedable' }} label="Breedable now" icon={BREEDABLE_ICON} count={counts.breedable} />
    <NavEntry tab={{ kind: 'limited' }} label="Limited rotation" icon={LIMITED_ICON} count={counts.limited} />
    <NavEntry
      tab={{ kind: 'event' }}
      label={eventLabel(menu.events)}
      icon={eventIcon(firstEvent?.kind === 'event' ? firstEvent.event.name : undefined)}
      count={counts.event}
    />
  </div>

  {#each counts.groups as { group, count, pages } (group)}
    {@const open = openGroup === group}
    <section class="group">
      <button
        type="button"
        class="group-head"
        aria-expanded={open}
        aria-controls="pages-{group}"
        onclick={() => toggleGroup(group)}
      >
        <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <b>{GROUP_TITLES[group]}</b>
        <span class="muted">({pages.length})</span>
        <span class="count">{count.owned}/{count.total}</span>
      </button>
      {#if open}
        <div class="pages" id="pages-{group}">
          {#each pages as { page, count: pageCount } (page.name)}
            <NavEntry tab={{ kind: 'page', page: page.name }} label={page.name} icon={pageIcon(page)} count={pageCount} />
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    height: 100%;
    overflow: auto;
    background: var(--card);
    border-right: 1px solid var(--line);
    /* Scrollbar hidden (spec §8). */
    scrollbar-width: none;
  }
  .sidebar::-webkit-scrollbar {
    display: none;
  }
  .brand {
    font-weight: 700;
  }
  .group-head {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 0;
    border: 0;
    background: none;
    cursor: pointer;
    text-align: left;
  }
  .caret {
    width: 14px;
    color: var(--muted);
  }
  .count {
    margin-left: auto;
    padding-right: 8px;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--muted);
  }
</style>
