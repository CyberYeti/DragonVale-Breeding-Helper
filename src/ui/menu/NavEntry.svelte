<!--
  One sidebar entry: icon, label and owned/total. Highlighted while its tab
  is on show (and no search is replacing it).
-->
<script lang="ts">
  import type { Count, Tab } from '../../lib/core/menu';
  import { useNav } from '../nav.svelte';
  import MenuIcon from './MenuIcon.svelte';
  import { sameTab, type IconSpec } from './tabInfo';

  let { tab, label, icon, count }: { tab: Tab; label: string; icon: IconSpec | null; count: Count } = $props();

  const nav = useNav();
  const on = $derived(!nav.searching && sameTab(nav.tab, tab));
</script>

<button type="button" class="entry" class:on aria-current={on ? 'page' : undefined} onclick={() => nav.goTo(tab)}>
  <span class="label">
    {#if icon}<MenuIcon {icon} />{/if}
    <span class="text">{label}</span>
  </span>
  <span class="count">{count.owned}/{count.total}</span>
</button>

<style>
  .entry {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    border: 0;
    border-radius: 8px;
    padding: 4px 8px;
    background: none;
    cursor: pointer;
  }
  .entry:hover {
    background: var(--bg);
  }
  .entry.on {
    background: var(--fg);
    color: var(--bg);
  }
  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    flex: none;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .entry.on .count {
    color: var(--bg);
  }
</style>
