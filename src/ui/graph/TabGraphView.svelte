<!--
  The tab graph (spec §9, Kinds of graph): every Dragon on the tab, before
  search and filters, plus everything they need, in the chosen cave. Drawn
  with the large-graph rules.

  - Tapping a Dragon pulls its path into a Target-on-top tree over the
    faded graph (nav.pullTree). Tapping another Dragon, faded or in the
    tree, re-focuses on it.
  - With a tree pulled, tapping a Route, an Element, a rule node or the
    Target opens its click panel, as in the Focus view; a Dragon named in a
    panel that isn't in the tree is pulled instead. Faded Routes and
    Elements do nothing.
  - The background (or Escape) closes the panel, or goes back a level:
    tree → tab graph → tiles.

  One instance draws both the `tab-graph` level and the `tree` above it, so
  the canvas can move the tree's nodes out of the graph and back.

  The tab graph is a main graph: dragging its nodes saves the arrangement
  for this tab and cave (SavedArrangements), on top of the automatic
  layout. Drags inside a pulled tree last while the tree is open.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import {
    pullTree,
    tabGraph,
    type GraphModel,
    type GraphNode,
    type NodeId,
    type TabGraph,
    type Target,
  } from '../../lib/core/graph';
  import type { Position } from '../../lib/core/layout';
  import { tabContents, type Tab } from '../../lib/core/menu';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { tabGraphName, withMoves } from './arrangement';
  import { useArrangements } from './arrangement.svelte';
  import { place } from './flow';
  import GraphView from './GraphView.svelte';
  import ClickPanelFrame from './panel/ClickPanelFrame.svelte';
  import { ClickPanel, provideClickPanel } from './panel/clickPanel.svelte';
  import WhyLine from './WhyLine.svelte';

  let { tab, tree = null }: { tab: Tab; tree?: Target | null } = $props();

  const store = useStore();
  const nav = useNav();
  const arrangements = useArrangements();

  type Graph = { graph: TabGraph; positions: ReadonlyMap<NodeId, Position> } | { error: string };
  type Built = { model: GraphModel; positions: ReadonlyMap<NodeId, Position> } | { error: string };

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

  /** The layout with the player's saved moves; ids no longer in the graph are ignored. */
  const arranged = $derived('error' in graph ? null : withMoves(graph.positions, arrangements.moves(tab, store.cave)));

  const built = $derived.by((): Built => {
    if ('error' in graph) return graph;
    const positions = arranged ?? graph.positions;
    if (!tree) return { model: graph.graph, positions };
    try {
      return { model: pullTree(graph.graph, tree), positions };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  const fitKey = $derived(`${tabGraphName(tab)}:${store.cave}${tree ? `:${tree.dragon}:${tree.form}` : ''}`);

  /** The click panel works on the pulled tree; a plain tab graph has none to open. */
  const panel = new ClickPanel(
    store,
    () => (tree && 'model' in built ? built.model : null),
    (dragon, form) => nav.pullTree(dragon, form),
  );
  provideClickPanel(panel);

  // A new tree, tab or cave starts with the panel closed.
  $effect(() => {
    void fitKey;
    untrack(() => panel.close());
  });

  function onnodeclick(node: GraphNode) {
    if (!('model' in built)) return;
    if (node.kind === 'dragon' && node.id !== built.model.target?.node) {
      nav.pullTree(node.dragon, node.form);
      return;
    }
    if (!tree || node.pull === 'faded') return;
    panel.toggle(node);
  }

  function onpaneclick() {
    if (panel.selected !== null) panel.close();
    else nav.back();
  }
</script>

<div class="tab-graph">
  {#if 'model' in built}
    {#if built.model.nodes.length === 0}
      <p class="note">Nothing on this tab to draw.</p>
    {:else}
      <ClickPanelFrame {panel}>
        <GraphView
          model={built.model}
          positions={built.positions}
          large
          arrangement={arrangements.resets}
          onarrange={(moves) => arrangements.move(tab, store.cave, moves)}
          selected={panel.selected}
          {fitKey}
          {onnodeclick}
          {onpaneclick}
        />
        <WhyLine info={built.model.target} hint="Tap a Dragon to pull out its tree." />
      </ClickPanelFrame>
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
    display: flex;
  }
  .note {
    padding: 16px;
    color: var(--muted);
  }
</style>
