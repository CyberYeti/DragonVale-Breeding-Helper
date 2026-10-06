<!--
  "<Dragon> (friend's)": a Co-op bred Route's friend's Dragon. Never checked
  against the Collection or expanded (rule 9), so it's a plain label, not a
  tile.
-->
<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import type { FriendNode } from '../../../lib/core/graph';
  import type { FlowNode } from '../flow';
  import NodePopover from '../panel/NodePopover.svelte';
  import Ends from './Ends.svelte';

  let { id, data }: NodeProps<FlowNode> = $props();

  const node = $derived(data.node as FriendNode);
</script>

<Ends />
<NodePopover {id} />
<div class="friend" title="A friend's {node.dragon}, in the Co-op cave">{node.label}</div>

<style>
  .friend {
    width: 104px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 2px 6px;
    border: 1px dashed var(--muted);
    border-radius: 10px;
    background: var(--card);
    font-size: 11px;
    line-height: 1.2;
    text-align: center;
  }
</style>
