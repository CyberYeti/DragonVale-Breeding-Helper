<!--
  ui/graph's drawing surface: one GraphModel, drawn bottom-up with Svelte
  Flow. Every graph level (Focus view, tab graph, pulled tree) draws through
  this; the views above decide what model to pass and what a click does.
  It fills its positioned parent.
-->
<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import type { ComponentProps } from 'svelte';
  import GraphCanvas from './GraphCanvas.svelte';

  let props: ComponentProps<typeof GraphCanvas> = $props();
</script>

<SvelteFlowProvider>
  <GraphCanvas {...props} />
</SvelteFlowProvider>
