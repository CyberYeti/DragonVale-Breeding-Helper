<!--
  One GraphModel edge, drawn upward from what is needed to what it makes,
  with its badges as HTML chips on an EdgeLabel at the middle. Colour, dash
  and dimming come from the edge's classes (see GraphCanvas).
-->
<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';
  import type { FlowEdge } from './flow';

  let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<FlowEdge> =
    $props();

  const path = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }));
  const badges = $derived(data?.edge.badges ?? []);
</script>

<BaseEdge {id} path={path[0]} {markerEnd} />
{#if badges.length > 0}
  <EdgeLabel x={path[1]} y={path[2]} class={['edge-badges', { dim: data?.edge.state === 'dimmed' && !data.lit }]}>
    {#each badges as badge, i (i)}
      <span class="chip b-{badge.kind}">{badge.label}</span>
    {/each}
  </EdgeLabel>
{/if}
