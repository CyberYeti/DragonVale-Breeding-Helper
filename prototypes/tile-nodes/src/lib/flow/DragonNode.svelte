<script>
  // Svelte Flow node = a thin wrapper around THE DragonTile (no graph-only copy of the visuals).
  import { Handle, Position, NodeToolbar } from "@xyflow/svelte";
  import DragonTile from "../DragonTile.svelte";
  import Popover from "../Popover.svelte";
  import { app } from "../state.svelte.js";
  import { view } from "../view.svelte.js";
  import { panelNode } from "../scene.js";
  let { id, data } = $props();
  const sn = $derived(data.sn);
  const lite = $derived(data.liteMode && (sn.faded || view.far));
</script>

<Handle type="target" position={Position.Bottom} isConnectable={false} />
<DragonTile d={sn.d} form={sn.form} size={sn.root ? "root" : "md"} {lite} faded={sn.faded} root={sn.root} picked={app.sel === id} />
<Handle type="source" position={Position.Top} isConnectable={false} />
{#if app.sel === id}<NodeToolbar nodeId={id} isVisible position={Position.Right}><Popover node={panelNode(sn)} /></NodeToolbar>{/if}
