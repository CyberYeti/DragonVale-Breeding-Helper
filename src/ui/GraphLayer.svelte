<!--
  The graph levels above the tiles (nav.levels): a tile's Focus view, the
  Graph button's tab graph, and a tree pulled out of it. Draws the level on
  top by its kind; the graphs themselves live in ui/graph. ← Back and Escape
  go back one level, through the browser history like its own back. A tab
  graph with nodes the player moved offers Reset arrangement.
-->
<script lang="ts">
  import type { GraphLevel } from './nav.svelte';
  import { useNav } from './nav.svelte';
  import { useStore } from './store.svelte';
  import { tabHeading } from './menu/tabInfo';
  import { useMenuView } from './menu/menuView.svelte';
  import { caveName } from '../lib/core/breeding';
  import FocusView from './graph/FocusView.svelte';
  import TabGraphView from './graph/TabGraphView.svelte';
  import { provideArrangements, SavedArrangements } from './graph/arrangement.svelte';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();
  const arrangements = new SavedArrangements();
  provideArrangements(arrangements);

  // Show all is for the graph that's open: the next one starts filtered again.
  $effect(() => {
    if (!nav.level) menu.showAllInGraph = false;
  });

  /** The tab graph a pulled tree sits on (or the tab graph itself). */
  const tabLevel = $derived(
    nav.levels.find((l): l is Extract<GraphLevel, { kind: 'tab-graph' }> => l.kind === 'tab-graph') ?? null,
  );

  function title(level: GraphLevel): string {
    switch (level.kind) {
      case 'focus':
      case 'tree':
        return `${level.target}${level.form === 'rift' ? ' (Rift form)' : ''}`;
      case 'tab-graph':
        return `Graph: ${tabHeading(level.tab, store.snapshot, menu.contents).title}`;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && nav.level) nav.back();
  }
</script>

<svelte:window {onkeydown} />

{#if nav.level}
  {@const level = nav.level}
  <div class="layer" role="dialog" aria-modal="true" aria-label={title(level)}>
    <div class="head">
      <button type="button" onclick={() => nav.back()}>← Back</button>
      <b>{title(level)}</b>
      <span class="muted">{level.kind === 'focus' ? 'Focus view' : 'Tab graph'} · {caveName(store.cave)} cave</span>
      {#if level.kind !== 'focus' && menu.graphRoots.narrowed}
        <button
          type="button"
          class="scope"
          aria-pressed={menu.showAllInGraph}
          title={menu.showAllInGraph
            ? 'Draw only the Dragons the filters show. The filters themselves are not changed'
            : 'Draw every Dragon on the tab. The filters themselves are not changed'}
          onclick={() => (menu.showAllInGraph = !menu.showAllInGraph)}
          >{menu.showAllInGraph
            ? `All ${menu.graphRoots.tabCount} · Show filtered`
            : `Showing ${menu.graphRoots.names.length} of ${menu.graphRoots.tabCount} · Show all`}</button
        >
      {/if}
      {#if level.kind === 'tab-graph' && !menu.graphFiltered && arrangements.has(level.tab, store.cave)}
        <button
          type="button"
          class="reset"
          title="Put the nodes you moved back where the automatic layout puts them"
          onclick={() => arrangements.reset(level.tab, store.cave)}>Reset arrangement</button
        >
      {/if}
    </div>
    {#if level.kind === 'focus'}
      <FocusView target={level.target} form={level.form} />
    {:else if tabLevel}
      <!-- One TabGraphView for the tab graph and the tree pulled out of it, so the tree can animate. -->
      <TabGraphView
        tab={tabLevel.tab}
        tree={level.kind === 'tree' ? { dragon: level.target, form: level.form } : null}
      />
    {/if}
  </div>
{/if}

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 35;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--card);
  }
  .head button {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }
  .head .scope,
  .head .reset {
    margin-left: auto;
  }
  .head .scope + .reset {
    margin-left: 0;
  }
  .head .scope[aria-pressed='true'] {
    background: var(--bg);
  }
  .muted {
    color: var(--muted);
  }
</style>
