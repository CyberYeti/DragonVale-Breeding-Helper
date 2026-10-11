<!--
  A key to the arrow styles, for the ones this graph actually draws. Closed
  by default, so it stays out of the way. The styles match GraphCanvas's edge
  CSS.
-->
<script lang="ts">
  import type { GraphModel } from '../../lib/core/graph';
  import { loopEdges } from './flow';

  let { model }: { model: GraphModel } = $props();

  type Entry = { name: string; text: string; line: 'needs' | 'met' | 'locked' | 'evolves' | 'coop' | 'loop' };

  const entries = $derived.by(() => {
    const kinds = new Set(model.edges.map((e) => e.kind));
    const states = new Set(model.edges.map((e) => e.state));
    const out: Entry[] = [{ name: 'needs', text: 'Needed for a Route', line: 'needs' }];
    if (states.has('met')) out.push({ name: 'met', text: 'A Route you can breed now', line: 'met' });
    if (states.has('locked')) out.push({ name: 'locked', text: 'Purchase only, or a limited Dragon not Available', line: 'locked' });
    if (kinds.has('evolves-from')) out.push({ name: 'evolves', text: 'Evolves from', line: 'evolves' });
    if (kinds.has('coop-only')) out.push({ name: 'coop', text: "A friend's Dragon (Co-op)", line: 'coop' });
    if (loopEdges(model).size > 0) out.push({ name: 'loop', text: 'Loop: these Dragons need each other', line: 'loop' });
    return out;
  });
</script>

<details class="key">
  <summary>Key</summary>
  <ul>
    {#each entries as entry (entry.name)}
      <li>
        <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true">
          {#if entry.line === 'loop'}
            <path class="line loop" d="M2 12C6 0 22 0 27 8" />
            <path class="head loop" d="M30 12 24.2 8.6 29.2 5.4Z" />
          {:else}
            <path class="line {entry.line}" d="M2 7H29" />
            <path class="head {entry.line}" d="M26 3 32 7 26 11Z" />
          {/if}
        </svg>
        <span>{entry.text}</span>
      </li>
    {/each}
  </ul>
</details>

<style>
  .key {
    position: absolute;
    right: 12px;
    top: 12px;
    z-index: 5;
    max-width: 260px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--fg);
    font-size: 12px;
  }
  summary {
    padding: 4px 10px;
    cursor: pointer;
    font-weight: 600;
  }
  ul {
    margin: 0;
    padding: 2px 10px 8px;
    list-style: none;
    display: grid;
    gap: 5px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  svg {
    flex: none;
  }
  .line {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.5;
  }
  .head {
    fill: var(--muted);
  }
  .line.met {
    stroke: var(--own);
    stroke-width: 2.5;
  }
  .head.met {
    fill: var(--own);
  }
  .line.locked {
    stroke: #c62828;
    stroke-dasharray: 5 4;
  }
  .head.locked {
    fill: #c62828;
  }
  .line.evolves {
    stroke-dasharray: 7 4;
  }
  .line.coop {
    stroke-dasharray: 2 3;
  }
  .line.loop {
    stroke: var(--loop);
    stroke-width: 2;
  }
  .head.loop {
    fill: var(--loop);
  }
</style>
