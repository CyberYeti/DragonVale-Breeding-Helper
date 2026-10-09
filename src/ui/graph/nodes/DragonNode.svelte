<!--
  A Dragon node: the same DragonTile as the menu (greyscale, sheen, banners,
  ticks), described by core/tile for the chosen cave and Display settings.
  An owned Target gets the "Owned" banner from the graph's `owned` badge;
  the node's other badges (Summoned, Purchased, Dead end)
  are chips under the tile. A tick writes the Collection; a click anywhere
  else reaches the graph's node click.
-->
<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import type { DragonNode } from '../../../lib/core/graph';
  import { describeTile } from '../../../lib/core/tile';
  import { useStore } from '../../store.svelte';
  import DragonTile from '../../tile/DragonTile.svelte';
  import { elementIcons, riftIcon } from '../../tile/labels';
  import { useCanvasView } from '../canvasView.svelte';
  import { tileWidth, type FlowNode } from '../flow';
  import NodePopover from '../panel/NodePopover.svelte';
  import Ends from './Ends.svelte';

  let { id, data }: NodeProps<FlowNode> = $props();

  const store = useStore();
  const canvas = useCanvasView();
  const node = $derived(data.node as DragonNode);
  const faded = $derived(node.pull === 'faded');
  /** Large graphs: faded and far-zoomed tiles are lite (spec §9 Performance rules). */
  const lite = $derived(canvas.large && (faded || canvas.far));
  const dragon = $derived(store.world.dragons.get(node.dragon));
  const view = $derived(dragon ? describeTile(store.world, dragon, store.cave, store.display) : null);
  const ownedBanner = $derived(node.badges.some((b) => b.kind === 'owned'));
  const chips = $derived(node.badges.filter((b) => b.kind !== 'owned'));
  const locked = $derived(node.state === 'locked');
</script>

<Ends />
<NodePopover {id} />
<div class="dragon" style:--tile-width="{tileWidth(node, data.target)}px">
  {#if view}
    <DragonTile
      {view}
      {lite}
      {faded}
      far={canvas.far}
      riftIcon={riftIcon(store.snapshot, view.dragon)}
      elements={elementIcons(store.snapshot, view.dragon)}
      {ownedBanner}
      note={node.form === 'rift' && view.ticks.length > 1 ? 'Rift form' : undefined}
      ontoggle={(tick, v) => store.toggle(v.dragon, tick.form)}
    />
  {/if}
  {#if !lite}
    {#if locked}<span class="lock" title="Not available: can't be bred or bought right now">🔒</span>{/if}
    {#each chips as badge, i (i)}
      <span class="chip b-{badge.kind}">{badge.label}</span>
    {/each}
  {/if}
</div>

<style>
  .dragon {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: var(--tile-width);
  }
  .lock {
    position: absolute;
    top: 4px;
    right: 6px;
    z-index: 6;
    font-size: 14px;
    pointer-events: none;
  }
</style>
