<!--
  The page header's ▸ Filters button and popover (spec §8 Filters and
  Display). The badge counts the filters that are on. The filters live in nav
  (`nav.filters`, a core/menu Filters) and reset on reload.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import { filterCount } from './filterLabels';
  import FiltersPanel from './FiltersPanel.svelte';
  import Popover from './Popover.svelte';
  import ToolButton from './ToolButton.svelte';

  const nav = useNav();
  const count = $derived(filterCount(nav.filters));
</script>

<Popover label="Filters" align="right">
  {#snippet trigger({ open, toggle })}
    <ToolButton aria-expanded={open} active={count > 0} onclick={toggle}>
      {open ? '▾' : '▸'} Filters{#if count > 0}&nbsp;<b class="badge" aria-label="{count} on">{count}</b>{/if}
    </ToolButton>
  {/snippet}
  {#snippet children({ close })}
    <FiltersPanel ondone={close} />
  {/snippet}
</Popover>

<style>
  .badge {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--accent);
    color: #000;
    font-size: 11px;
  }
</style>
