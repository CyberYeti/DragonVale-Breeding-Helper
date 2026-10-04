<script>
  import { SvelteFlowProvider } from "@xyflow/svelte";
  import FlowInner from "./FlowInner.svelte";
  let props = $props();
</script>

<SvelteFlowProvider><FlowInner {...props} /></SvelteFlowProvider>
