<!--
  The click panel's side sheet (spec §9 Click panel), opened by Details:
  everything core/panel lists for the selected node, with ownership ticks on
  every Dragon. ClickPanelFrame places it beside the graph, or as a bottom
  sheet on a phone. Ticking a Dragon writes the Collection, and the headline
  and lists follow at once (the PanelData is derived from the World).
-->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { NOT_AVAILABLE } from '../../../lib/core/breeding';
  import type { Candidate, PanelData } from '../../../lib/core/panel';
  import type { ClickPanel } from './clickPanel.svelte';
  import PanelDragon from './PanelDragon.svelte';
  import { matcher, pairCount, panelTitle, routeKindText } from './panelText';

  let { panel, data }: { panel: ClickPanel; data: PanelData } = $props();

  /** Pair groups drawn at first, and partners per group, before "Show more". */
  const GROUPS = 40;
  const PARTNERS = 8;

  let query = $state('');
  let groupLimit = $state(GROUPS);
  const openGroups = new SvelteSet<string>();

  // Another node starts with a clear search and the lists folded.
  $effect.pre(() => {
    void panel.selected;
    query = '';
    groupLimit = GROUPS;
    openGroups.clear();
  });

  const title = $derived(panelTitle(data));
  const match = $derived(matcher(query));

  /** Groups and partners matching the search: a matching parent keeps all its partners. */
  const groups = $derived.by(() => {
    if (data.kind !== 'route') return [];
    return data.pairs
      .map((g) => (match(g.parent) ? g : { parent: g.parent, with: g.with.filter(match) }))
      .filter((g) => g.with.length > 0);
  });

  const searchable = $derived.by(() => {
    switch (data.kind) {
      case 'route':
        return pairCount(data.pairs) > PARTNERS || data.suggestions.length > PARTNERS;
      case 'element':
        return data.carriers.length + data.alternatives.length > PARTNERS;
      case 'dragon':
        return false;
    }
  });

  function candidateTag(c: Candidate): string | undefined {
    return c.breedableNow ? 'Breedable now' : undefined;
  }
  function candidateNote(c: Candidate): string | undefined {
    return c.available ? undefined : NOT_AVAILABLE;
  }
</script>

<section class="sheet" aria-label="{title}: details">
  <header>
    <div class="top">
      <h2>{title}</h2>
      <button type="button" class="x" aria-label="Back to the popover" title="Back" onclick={() => panel.closeDetails()}
        >‹</button
      >
      <button type="button" class="x" aria-label="Close" onclick={() => panel.close()}>✕</button>
    </div>
    {#if data.kind === 'route'}<div class="kind muted">{routeKindText(data.route)} Route</div>{/if}
    <div class="headline t-{data.tone}" aria-live="polite">{data.headline}</div>
    {#if data.kind === 'route' && data.reason}<p class="reason">{data.reason}</p>{/if}
    {#if data.kind === 'dragon'}{#each data.reasons as r (r)}<p class="reason">{r}</p>{/each}{/if}
    {#if searchable}
      <input
        class="search"
        type="search"
        placeholder={data.kind === 'route' && data.pairs.length > 0
          ? `Search ${pairCount(data.pairs).toLocaleString('en-US')} pairs by Dragon…`
          : 'Search Dragons…'}
        aria-label="Search this list"
        bind:value={query}
      />
    {/if}
  </header>

  <div class="body">
    {#if data.kind === 'route'}
      {#if data.pairs.length > 0}
        <div class="lbl">Your Valid pairs · grouped by parent, simplest first</div>
        {#each groups.slice(0, groupLimit) as g (g.parent.dragon.name)}
          {@const key = g.parent.dragon.name}
          {@const all = openGroups.has(key)}
          <div class="group">
            <PanelDragon {panel} item={g.parent} />
            <ul class="with">
              {#each all ? g.with : g.with.slice(0, PARTNERS) as w (w.dragon.name)}
                <li><PanelDragon {panel} item={w} note={w.dragon === g.parent.dragon ? '×2' : undefined} /></li>
              {/each}
            </ul>
            {#if g.with.length > PARTNERS}
              <button type="button" class="more" onclick={() => (all ? openGroups.delete(key) : openGroups.add(key))}>
                {all ? 'Show fewer' : `Show all ${g.with.length} with ${g.parent.dragon.name}`}
              </button>
            {/if}
          </div>
        {:else}
          <p class="muted">No pair matches.</p>
        {/each}
        {#if groups.length > groupLimit}
          <button type="button" class="more" onclick={() => (groupLimit += GROUPS)}>
            Show more ({groups.length - groupLimit} more parents)
          </button>
        {/if}
      {:else if data.route.kind === 'bred' && !data.status.met}
        <div class="lbl">Would make a Valid pair with something you own</div>
        <ul>
          {#each data.suggestions.filter(match) as s (s.dragon.name)}
            <li>
              <PanelDragon
                {panel}
                item={s}
                tag={candidateTag(s)}
                note="+ your {s.with.dragon.name}{s.available ? '' : ` · ${NOT_AVAILABLE}`}"
              />
            </li>
          {:else}
            <li class="muted">
              {data.suggestions.length > 0 ? 'No Dragon matches.' : 'None: you need more than one new Dragon.'}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if data.kind === 'element'}
      <div class="lbl">Yours that carry it ({data.carriers.length})</div>
      <ul>
        {#each data.carriers.filter(match) as c (c.dragon.name)}
          <li><PanelDragon {panel} item={c} /></li>
        {:else}
          <li class="muted">{data.carriers.length > 0 ? 'No Dragon matches.' : 'None yet.'}</li>
        {/each}
      </ul>
      <div class="lbl">Basic dragon</div>
      <ul>
        {#if data.basic}
          <li>
            <PanelDragon {panel} item={data.basic} tag={candidateTag(data.basic)} note={candidateNote(data.basic)} />
          </li>
        {:else}
          <li class="muted">None can be a parent here.</li>
        {/if}
      </ul>
      <div class="lbl">Alternatives ({data.alternatives.length})</div>
      <ul>
        {#each data.alternatives.filter(match) as a (a.dragon.name)}
          <li><PanelDragon {panel} item={a} tag={candidateTag(a)} note={candidateNote(a)} /></li>
        {:else}
          <li class="muted">{data.alternatives.length > 0 ? 'No Dragon matches.' : 'None.'}</li>
        {/each}
      </ul>
    {:else}
      <ul>
        <li><PanelDragon {panel} item={{ dragon: data.dragon, form: data.form, ticks: data.ticks }} /></li>
      </ul>
      <div class="lbl">Routes</div>
      <ul>
        {#each data.routes as r (r.index)}
          <li class="route">
            <button type="button" class="link" onclick={() => panel.pickRoute(data.dragon.name, data.form, r.index)}
              >{routeKindText(r.route)} Route {r.index + 1}</button
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
  </div>
</section>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--card);
    color: var(--fg);
    font-size: 13px;
  }
  header {
    flex: none;
    padding: 12px 14px 8px;
    border-bottom: 1px solid var(--line);
  }
  .top {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
  }
  .x {
    flex: none;
    padding: 0 8px;
    border: 0;
    background: none;
    font-size: 17px;
    line-height: 22px;
    cursor: pointer;
  }
  .kind {
    font-size: 12px;
  }
  .headline {
    margin: 6px 0 2px;
    font-size: 15px;
    font-weight: 600;
  }
  .reason {
    margin: 2px 0;
  }
  .search {
    width: 100%;
    margin-top: 8px;
    padding: 5px 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 14px calc(16px + env(safe-area-inset-bottom));
  }
  .lbl {
    margin: 12px 0 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    padding: 2px 0;
    border-bottom: 1px solid var(--line);
  }
  li:last-child {
    border-bottom: 0;
  }
  li.route {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
    padding: 4px 0;
  }
  .group {
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .with {
    margin-left: 18px;
    padding-left: 8px;
    border-left: 2px solid var(--line);
  }
  .with li {
    border-bottom: 0;
  }
  .more {
    margin: 4px 0 0 28px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    text-decoration: underline;
    cursor: pointer;
    font-size: 12px;
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
  .wide {
    display: block;
    width: 100%;
    margin-top: 12px;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }
  .wide.primary {
    background: var(--own);
    border-color: var(--own);
    color: #fff;
  }
  .muted {
    color: var(--muted);
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
</style>
