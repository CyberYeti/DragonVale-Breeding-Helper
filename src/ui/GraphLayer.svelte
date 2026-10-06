<!--
  The graph levels above the tiles (nav.levels): a tile's Focus view, the
  Graph button's tab graph, and a tree pulled out of it. Draws the level on
  top by its kind; the graphs themselves live in ui/graph. ← Back and Escape
  go back one level.
-->
<script lang="ts">
  import type { GraphLevel } from './nav.svelte';
  import { useNav } from './nav.svelte';
  import { useStore } from './store.svelte';
  import { tabHeading } from './menu/tabInfo';
  import { useMenuView } from './menu/menuView.svelte';
  import { caveName } from './tile/labels';
  import FocusView from './graph/FocusView.svelte';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();

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
    </div>
    {#if level.kind === 'focus'}
      <FocusView target={level.target} form={level.form} />
    {:else}
      <!-- The tab graph and the pulled tree (#48) draw here through ui/graph's GraphView. -->
      <p class="body muted">The graph will be drawn here.</p>
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
    gap: 10px;
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
  .body {
    padding: 16px;
  }
  .muted {
    color: var(--muted);
  }
</style>
