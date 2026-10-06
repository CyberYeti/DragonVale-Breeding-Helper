<!--
  The Focus view (spec §9): the Target's tree on its own, in the chosen
  cave, with the line saying why the Target can't be bred now.

  - Tapping a Route, Element, rule or Dragon node opens its click panel
    (popover; Details opens the side sheet). A selected Route shows its path
    at full brightness (rule 6) and highlights the edges into it.
  - Another Dragon becomes the Target from its popover ("Make it the
    Target"), or when a Dragon named in a panel isn't in the tree. This level
    is replaced, so Escape still goes straight back to the tiles.
  - The background (or Escape) closes the panel, or goes back a level when
    nothing is selected.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { focusTree, type GraphModel, type GraphNode } from '../../lib/core/graph';
  import type { Form } from '../../lib/core/collection';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import GraphView from './GraphView.svelte';
  import ClickPanelFrame from './panel/ClickPanelFrame.svelte';
  import { ClickPanel, provideClickPanel } from './panel/clickPanel.svelte';

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

  const panel = new ClickPanel(
    store,
    () => ('model' in built ? built.model : null),
    (dragon, as) => {
      nav.back();
      nav.openFocus(dragon, as);
    },
  );
  provideClickPanel(panel);

  // A new Target or cave starts with nothing selected.
  $effect(() => {
    void fitKey;
    untrack(() => panel.close());
  });

  function onnodeclick(node: GraphNode) {
    panel.toggle(node);
  }

  function onpaneclick() {
    if (panel.selected !== null) panel.close();
    else nav.back();
  }
</script>

<div class="focus">
  {#if 'model' in built}
    {@const info = built.model.target}
    <ClickPanelFrame {panel}>
      <GraphView model={built.model} selected={panel.selected} {fitKey} {onnodeclick} {onpaneclick} />
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
    </ClickPanelFrame>
  {:else}
    <p class="error">Can't draw this graph: {built.error}</p>
  {/if}
</div>

<style>
  .focus {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
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
