<!--
  The two invisible handles every graph node has. Edges point up: they leave
  a node from its top (source) and enter the node above at its bottom
  (target).
-->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
</script>

<Handle type="target" position={Position.Bottom} isConnectable={false} />
<Handle type="source" position={Position.Top} isConnectable={false} />
