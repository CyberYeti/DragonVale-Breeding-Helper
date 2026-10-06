<!--
  One tile in the menu grid: a DragonTile for `item`, described by core/tile
  for the chosen cave and Display settings. A tick toggles the Collection
  through the store; a click anywhere else opens the Dragon's Focus view.
  Select mode's tap-to-select and long-press (ticket #45) belong here.
-->
<script lang="ts">
  import type { MenuItem } from '../../lib/core/menu';
  import { describeTile } from '../../lib/core/tile';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import DragonTile from '../tile/DragonTile.svelte';

  let { item, note }: { item: MenuItem; note?: string } = $props();

  const store = useStore();
  const nav = useNav();

  const view = $derived(describeTile(store.world, item.dragon, store.cave, store.display));
</script>

<DragonTile
  {view}
  {note}
  onopen={(v) => nav.openFocus(v.dragon.name, v.opensAs)}
  ontoggle={(tick, v) => store.toggle(v.dragon, tick.form)}
/>
