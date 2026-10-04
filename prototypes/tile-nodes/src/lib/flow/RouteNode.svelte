<script>
  import { Handle, Position, NodeToolbar } from "@xyflow/svelte";
  import RoutePill from "../RoutePill.svelte";
  import Popover from "../Popover.svelte";
  import { app } from "../state.svelte.js";
  let { id, data } = $props();
</script>

<Handle type="target" position={Position.Bottom} isConnectable={false} />
<RoutePill n={data.sn.n} faded={data.sn.faded} picked={app.sel === id} />
<Handle type="source" position={Position.Top} isConnectable={false} />
{#if app.sel === id}<NodeToolbar nodeId={id} isVisible position={Position.Right}><Popover node={data.sn.src} /></NodeToolbar>{/if}
