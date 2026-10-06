<!--
  The Focus view (spec §9): the Target's tree on its own, in the chosen
  cave, with the line saying why the Target can't be bred now.

  - Tapping another Dragon in the tree makes it the Target (this level is
    replaced, so Escape still goes straight back to the tiles).
  - Tapping a Route, Element or the Target selects it; a selected dimmed
    Route shows its path at full brightness (rule 6). The click panel (#49)
    hangs off this selection.
  - The background clears the selection, or goes back a level when nothing
    is selected.
-->
<script lang="ts">
  import { focusTree, type GraphModel, type GraphNode, type NodeId } from '../../lib/core/graph';
  import type { Form } from '../../lib/core/collection';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import GraphView from './GraphView.svelte';
  import WhyLine from './WhyLine.svelte';

  let { target, form }: { target: string; form: Form } = $props();

  const store = useStore();
  const nav = useNav();

  const built = $derived.by((): { model: GraphModel } | { error: string } => {
    try {
      return { model: focusTree(store.world, { dragon: target, form }, store.cave) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
  const fitKey = $derived(`${target}:${form}:${store.cave}`);

  let selected = $state<NodeId | null>(null);
  // A new Target or cave starts with nothing selected.
  $effect(() => {
    void fitKey;
    selected = null;
  });

  function onnodeclick(node: GraphNode) {
    if (node.kind === 'dragon' && 'model' in built && node.id !== built.model.target?.node) {
      nav.back();
      nav.openFocus(node.dragon, node.form);
      return;
    }
    selected = selected === node.id ? null : node.id;
  }

  function onpaneclick() {
    if (selected !== null) selected = null;
    else nav.back();
  }
</script>

<div class="focus">
  {#if 'model' in built}
    <GraphView model={built.model} {selected} {fitKey} {onnodeclick} {onpaneclick} />
    <WhyLine info={built.model.target} />
  {:else}
    <p class="error">Can't draw this graph: {built.error}</p>
  {/if}
</div>

<style>
  .focus {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .error {
    padding: 16px;
    color: var(--muted);
  }
</style>
