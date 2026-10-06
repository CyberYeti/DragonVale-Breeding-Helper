<!--
  The click panel's popover (spec §9 Click panel): the headline, the reason
  and the top 3 pairs, suggestions or Dragons, with Details for the side
  sheet. Drawn next to the node by NodePopover, or docked at the bottom on a
  phone by ClickPanelFrame.
-->
<script lang="ts">
  import type { PanelData } from '../../../lib/core/panel';
  import type { ClickPanel } from './clickPanel.svelte';
  import PanelDragon from './PanelDragon.svelte';
  import { flatPairs, pairCount, panelTitle } from './panelText';

  let {
    panel,
    data,
    docked = false,
  }: {
    panel: ClickPanel;
    data: PanelData;
    /** Phone: docked at the bottom of the graph, full width. */
    docked?: boolean;
  } = $props();

  const TOP = 3;
  const title = $derived(panelTitle(data));
  /** How many things the sheet adds over the popover; 0 hides Details. */
  const more = $derived.by(() => {
    switch (data.kind) {
      case 'route':
        return pairCount(data.pairs) + data.suggestions.length;
      case 'element':
        return data.carriers.length + data.alternatives.length + (data.basic ? 1 : 0);
      case 'dragon':
        return data.routes.length;
    }
  });
</script>

<div class="pop nodrag nopan nowheel" class:docked role="dialog" aria-label={title}>
  <div class="top">
    <h2>{title}</h2>
    <button type="button" class="x" aria-label="Close" onclick={() => panel.close()}>✕</button>
  </div>
  <div class="headline t-{data.tone}" aria-live="polite">{data.headline}</div>

  {#if data.kind === 'route'}
    {#if data.reason}<p class="reason">{data.reason}</p>{/if}
    {#if data.pairs.length > 0}
      <ul>
        {#each flatPairs(data.pairs, TOP) as [a, b] (a.dragon.name + '+' + b.dragon.name)}
          <li class="pair">
            <button type="button" class="link" onclick={() => panel.pickDragon(a.dragon.name, a.form)}
              >{a.dragon.name}</button
            >
            {#if a.dragon === b.dragon}
              <span class="muted">×2</span>
            {:else}
              <span class="muted">+</span>
              <button type="button" class="link" onclick={() => panel.pickDragon(b.dragon.name, b.form)}
                >{b.dragon.name}</button
              >
            {/if}
          </li>
        {/each}
      </ul>
    {:else if data.suggestions.length > 0}
      <div class="lbl">Would make a Valid pair</div>
      <ul>
        {#each data.suggestions.slice(0, TOP) as s (s.dragon.name)}
          <li>
            <PanelDragon
              {panel}
              item={s}
              note="+ your {s.with.dragon.name}"
              tag={s.breedableNow ? 'Breedable now' : undefined}
            />
          </li>
        {/each}
      </ul>
    {:else if data.route.kind === 'bred' && !data.status.met}
      <p class="muted small">No single new Dragon makes a Valid pair with what you own.</p>
    {/if}
  {:else if data.kind === 'element'}
    {#if data.carriers.length > 0}
      <ul>
        {#each data.carriers.slice(0, TOP) as c (c.dragon.name)}
          <li><PanelDragon {panel} item={c} /></li>
        {/each}
      </ul>
    {:else if data.basic}
      <div class="lbl">Basic dragon</div>
      <ul>
        <li><PanelDragon {panel} item={data.basic} tag={data.basic.breedableNow ? 'Breedable now' : undefined} /></li>
      </ul>
    {/if}
  {:else}
    {#each data.reasons as r (r)}<p class="reason">{r}</p>{/each}
    <ul>
      {#each data.routes.slice(0, TOP) as r (r.index)}
        <li class="route">
          <button type="button" class="link" onclick={() => panel.pickRoute(data.dragon.name, data.form, r.index)}
            >Route {r.index + 1}</button
          >
          <span class="t-{r.tone}">{r.headline}</span>
        </li>
      {/each}
    </ul>
    {#if !data.isTarget}
      <button type="button" class="wide primary" onclick={() => panel.retarget(data.dragon.name, data.form)}
        >🎯 Make it the Target</button
      >
    {/if}
  {/if}

  {#if more > 0}
    <button type="button" class="wide" onclick={() => panel.openDetails()}>Details</button>
  {/if}
</div>

<style>
  .pop {
    width: 300px;
    max-width: calc(100vw - 16px);
    max-height: min(60vh, 440px);
    overflow: auto;
    padding: 10px 12px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--card);
    color: var(--fg);
    box-shadow: 0 10px 30px #0004;
    font-size: 13px;
    line-height: 1.4;
    cursor: default;
  }
  .pop.docked {
    width: 100%;
    max-width: 480px;
    max-height: 50vh;
    max-height: 50dvh;
  }
  .top {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 14px;
  }
  .x {
    flex: none;
    margin: -4px -6px 0 0;
    padding: 2px 6px;
    border: 0;
    background: none;
    font-size: 15px;
    cursor: pointer;
  }
  .headline {
    margin: 4px 0;
    font-size: 15px;
    font-weight: 600;
  }
  .t-ok {
    color: var(--own);
  }
  .t-warn {
    color: var(--warn);
  }
  .t-bad {
    color: var(--bad);
  }
  .t-muted {
    color: var(--muted);
  }
  .reason {
    margin: 2px 0;
  }
  .lbl {
    margin: 8px 0 2px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 4px 0;
    padding: 0;
  }
  li {
    padding: 2px 0;
    border-bottom: 1px solid var(--line);
  }
  li:last-child {
    border-bottom: 0;
  }
  li.pair,
  li.route {
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12px;
  }
  .wide {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 5px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }
  .wide.primary {
    background: var(--own);
    border-color: var(--own);
    color: #fff;
  }
</style>
