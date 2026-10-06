<!--
  The page header (spec §8 Desktop layout): the tab's icon and title, a
  progress bar and owned/total, then Select, ▸ Filters, ▸ Display and Graph.
  The filter chips row sits under it. Each button is its own component so the
  tickets that wire them up don't edit this file.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import DisplayButton from './DisplayButton.svelte';
  import FilterChips from './FilterChips.svelte';
  import FiltersButton from './FiltersButton.svelte';
  import GraphButton from './GraphButton.svelte';
  import { useMenuView } from './menuView.svelte';
  import MenuIcon from './MenuIcon.svelte';
  import SelectButton from './SelectButton.svelte';
  import { tabHeading } from './tabInfo';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();

  const heading = $derived(
    nav.searching
      ? { title: `Search: “${nav.query.trim()}”`, icon: null }
      : tabHeading(nav.tab, store.snapshot, menu.contents),
  );
  const owned = $derived(menu.view.owned);
  const total = $derived(menu.view.total);
  const percent = $derived(total ? (100 * owned) / total : 0);
</script>

<div class="page-header">
  <h1>
    {#if heading.icon}<MenuIcon icon={heading.icon} />{/if}
    <span>{heading.title}</span>
  </h1>
  <span
    class="bar"
    role="progressbar"
    aria-label="Owned"
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={owned}
  ><i style:width="{percent}%"></i></span>
  <span class="counts">{owned}/{total} owned</span>

  <span class="spacer"></span>
  <SelectButton />
  <FiltersButton />
  <DisplayButton />
  <GraphButton />
</div>
<FilterChips />

<style>
  .page-header {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    padding: 12px 12px 4px;
  }
  h1 {
    --icon-size: 28px;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 20px;
  }
  .bar {
    display: block;
    height: 6px;
    width: 140px;
    background: var(--line);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--own);
  }
  .counts {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .spacer {
    flex: 1;
  }
</style>
