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
    {@const info = built.model.target}
    <GraphView model={built.model} {selected} {fitKey} {onnodeclick} {onpaneclick} />
    {#if info}
      <p class="why" class:ok={info.breedableNow} aria-live="polite">
        {#if info.breedableNow}
          ✔ Breedable now
        {:else}
          {#each info.reasons as r, i (i)}{#if i > 0}<span class="sep">·</span>{/if}<span class="reason r-{r.kind}"
              >{r.label}</span
            >{/each}
        {/if}
      </p>
    {/if}
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
  .why {
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 5;
    max-width: min(520px, calc(100% - 24px));
    margin: 0;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    font-size: 13px;
    pointer-events: none;
  }
  .why.ok {
    color: var(--own);
    font-weight: 600;
  }
  .reason {
    font-weight: 600;
  }
  .reason.r-owned {
    color: var(--own);
  }
  .sep {
    margin: 0 0.4em;
    color: var(--muted);
  }
  .error {
    padding: 16px;
    color: var(--muted);
  }
</style>
