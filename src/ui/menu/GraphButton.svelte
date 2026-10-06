<!--
  The page header's Graph button (spec §9 Kinds of graph): opens the current
  tab's graph as a new graph level in nav. On every tab, not on search results.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import ToolButton from './ToolButton.svelte';

  const nav = useNav();
</script>

{#if !nav.searching}
  <ToolButton onclick={() => nav.openTabGraph()}>Graph</ToolButton>
{/if}
