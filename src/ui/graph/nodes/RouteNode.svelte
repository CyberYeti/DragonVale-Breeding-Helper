<!--
  A Route pill (◆) joining a Dragon to what one of its Routes needs. Met is
  green, a Purchase only Route shows 🔒, a dimmed one (waiting on a Dragon
  that isn't Available) is faint until selected. The Route's badges are on
  its edge into the Dragon.
-->
<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import type { RouteNode } from '../../../lib/core/graph';
  import type { FlowNode } from '../flow';
  import NodePopover from '../panel/NodePopover.svelte';
  import Ends from './Ends.svelte';

  let { id, data }: NodeProps<FlowNode> = $props();

  const node = $derived(data.node as RouteNode);
  const KIND_TEXT = { bred: 'Bred', coop: 'Co-op bred', evolved: 'Evolved' } as const;
  const title = $derived(
    `${KIND_TEXT[node.routeKind]} Route ${node.routeIndex + 1} of ${node.dragon}: ${node.met ? 'met' : 'not met'}`,
  );
</script>

<Ends />
<NodePopover {id} />
<div class="pill" class:met={node.met} {title}>
  {node.state === 'locked' ? '🔒' : '◆'}
</div>

<style>
  .pill {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 2px solid var(--muted);
    border-radius: 50%;
    background: var(--card);
    color: var(--muted);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
  }
  .pill.met {
    border-color: var(--own);
    background: var(--own);
    color: #fff;
  }
</style>
