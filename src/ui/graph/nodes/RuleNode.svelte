<!-- A requirement drawn as one node: "Any 4+ elements" or "Any pair". -->
<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import type { RuleNode } from '../../../lib/core/graph';
  import type { FlowNode } from '../flow';
  import Ends from './Ends.svelte';

  let { data }: NodeProps<FlowNode> = $props();

  const node = $derived(data.node as RuleNode);
</script>

<Ends />
<div class="rule">{node.label}</div>

<style>
  .rule {
    width: 104px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--card);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
</style>
