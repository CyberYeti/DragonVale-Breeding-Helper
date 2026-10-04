<script>
  // Edge with an optional badge (×2 both, evolves (…), co-op only), in the same chip style as the tiles.
  import { BaseEdge, EdgeLabel, getBezierPath } from "@xyflow/svelte";
  let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = $props();
  const p = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }));
</script>

<BaseEdge {id} path={p[0]} {markerEnd} />
{#if data?.label}<EdgeLabel x={p[1]} y={p[2]}><span class="ebadge">{data.label}</span></EdgeLabel>{/if}
