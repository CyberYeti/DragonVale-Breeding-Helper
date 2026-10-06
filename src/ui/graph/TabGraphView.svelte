<!--
  The tab graph (spec §9, Kinds of graph): every Dragon on the tab, before
  search and filters, plus everything they need, in the chosen cave. Drawn
  with the large-graph rules.

  - Tapping a Dragon pulls its path into a Target-on-top tree over the
    faded graph (nav.pullTree). Tapping another Dragon, faded or in the
    tree, re-focuses on it.
  - With a tree pulled, tapping a Route, an Element or the Target selects
    it, as in the Focus view; faded Routes and Elements do nothing.
  - The background clears the selection, or goes back a level:
    tree → tab graph → tiles.

  One instance draws both the `tab-graph` level and the `tree` above it, so
  the canvas can move the tree's nodes out of the graph and back.
-->
<script lang="ts">
  import { pullTree, tabGraph, type GraphModel, type GraphNode, type NodeId, type TabGraph, type Target } from '../../lib/core/graph';
  import type { Position } from '../../lib/core/layout';
  import { tabContents, type Tab } from '../../lib/core/menu';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { place } from './flow';
  import GraphView from './GraphView.svelte';
  import WhyLine from './WhyLine.svelte';

  let { tab, tree = null }: { tab: Tab; tree?: Target | null } = $props();

  const store = useStore();
  const nav = useNav();

  type Built = { model: GraphModel; positions: ReadonlyMap<NodeId, Position> } | { error: string };
  type Graph = { graph: TabGraph; positions: ReadonlyMap<NodeId, Position> } | { error: string };

  /** The tab graph and its layout: rebuilt for a new tab, cave or Collection, not for a new tree. */
  const graph = $derived.by((): Graph => {
    try {
      const names = tabContents(store.world, tab, store.cave).sections.flatMap((s) => s.items.map((i) => i.dragon.name));
      const g = tabGraph(store.world, names, store.cave);
      return { graph: g, positions: place(g) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  const built = $derived.by((): Built => {
    if ('error' in graph) return graph;
    if (!tree) return { model: graph.graph, positions: graph.positions };
    try {
      return { model: pullTree(graph.graph, tree), positions: graph.positions };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  const tabKey = $derived(tab.kind === 'page' ? `page:${tab.page}` : tab.kind);
  const fitKey = $derived(`${tabKey}:${store.cave}${tree ? `:${tree.dragon}:${tree.form}` : ''}`);

  let selected = $state<NodeId | null>(null);
  // A new tree, tab or cave starts with nothing selected.
  $effect(() => {
    void fitKey;
    selected = null;
  });

  function onnodeclick(node: GraphNode) {
    if (!('model' in built)) return;
    const target = built.model.target?.node;
    if (node.kind === 'dragon' && node.id !== target) {
      nav.pullTree(node.dragon, node.form);
      return;
    }
    if (!tree || node.pull === 'faded') return;
    selected = selected === node.id ? null : node.id;
  }

  function onpaneclick() {
    if (selected !== null) selected = null;
    else nav.back();
  }
</script>

<div class="tab-graph">
  {#if 'model' in built}
    {#if built.model.nodes.length === 0}
      <p class="note">Nothing on this tab to draw.</p>
    {:else}
      <GraphView
        model={built.model}
        positions={built.positions}
        large
        {selected}
        {fitKey}
        {onnodeclick}
        {onpaneclick}
      />
      <WhyLine info={built.model.target} hint="Tap a Dragon to pull out its tree." />
    {/if}
  {:else}
    <p class="note">Can't draw this graph: {built.error}</p>
  {/if}
</div>

<style>
  .tab-graph {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .note {
    padding: 16px;
    color: var(--muted);
  }
</style>
