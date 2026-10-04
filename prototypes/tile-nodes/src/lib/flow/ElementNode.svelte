<script>
  import { Handle, Position, NodeToolbar } from "@xyflow/svelte";
  import ElementTile from "../ElementTile.svelte";
  import Popover from "../Popover.svelte";
  import { app } from "../state.svelte.js";
  import { view } from "../view.svelte.js";
  import { panelNode } from "../scene.js";
  let { id, data } = $props();
  const sn = $derived(data.sn);
</script>

<Handle type="target" position={Position.Bottom} isConnectable={false} />
<ElementTile name={sn.name} rift={sn.rift} faded={sn.faded} lite={data.liteMode && (sn.faded || view.far)} picked={app.sel === id} />
<Handle type="source" position={Position.Top} isConnectable={false} />
{#if app.sel === id}<NodeToolbar nodeId={id} isVisible position={Position.Right}><Popover node={panelNode(sn)} /></NodeToolbar>{/if}
