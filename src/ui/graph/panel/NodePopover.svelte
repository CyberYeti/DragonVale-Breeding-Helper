<!--
  The click panel's popover for one node, attached with NodeToolbar (spec §9
  Click panel). Every node component draws one; it shows only while its node
  is selected in the view's ClickPanel, the Details sheet is closed and the
  screen is wider than a phone (there ClickPanelFrame docks it at the
  bottom). GraphCanvas pans a node picked in a panel into view (it must
  work for nodes culled off screen). Draws nothing in a view without a ClickPanel.
-->
<script lang="ts">
  import { NodeToolbar, Position, useSvelteFlow } from '@xyflow/svelte';
  import { untrack } from 'svelte';
  import { phoneWidth, useClickPanel } from './clickPanel.svelte';
  import PanelPopover from './PanelPopover.svelte';

  let { id }: { id: string } = $props();

  const panel = useClickPanel();
  const flow = useSvelteFlow();

  const open = $derived(panel !== null && panel.selected === id && !panel.details && !phoneWidth.current);

  /** Right of the node, or left when the node sits in the right half of the screen. Picked on opening. */
  let side = $state(Position.Right);
  $effect.pre(() => {
    if (!open) return;
    untrack(() => {
      const node = flow.getInternalNode(id);
      if (!node) return;
      const { x } = flow.flowToScreenPosition(node.internals.positionAbsolute);
      side = x > window.innerWidth / 2 ? Position.Left : Position.Right;
    });
  });
</script>

{#if open && panel?.data}
  <NodeToolbar isVisible position={side} align="start" offset={12}>
    <PanelPopover {panel} data={panel.data} />
  </NodeToolbar>
{/if}
