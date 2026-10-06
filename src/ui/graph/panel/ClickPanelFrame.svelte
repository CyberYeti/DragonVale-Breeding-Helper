<!--
  Lays a graph view out with its click panel (spec §9 Click panel): the
  graph (children) fills the space, the Details side sheet opens on the
  right; on a phone the popover docks at the bottom and the sheet is a bottom
  sheet. Escape closes the panel before it reaches the graph layer's
  Escape (back one level).

  The view provides the same ClickPanel with provideClickPanel, so the node
  components' NodePopover can read it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { phoneWidth, type ClickPanel } from './clickPanel.svelte';
  import PanelPopover from './PanelPopover.svelte';
  import PanelSheet from './PanelSheet.svelte';

  let { panel, children }: { panel: ClickPanel; children: Snippet } = $props();

  const data = $derived(panel.data);

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || panel.selected === null) return;
    event.stopPropagation();
    panel.close();
  }
</script>

<svelte:window onkeydowncapture={onkeydown} />

<div class="frame">
  <div class="graph">
    {@render children()}
    {#if data && !panel.details && phoneWidth.current}
      <div class="dock">
        <PanelPopover {panel} {data} docked />
      </div>
    {/if}
  </div>
  {#if data && panel.details}
    <aside class="side">
      <PanelSheet {panel} {data} />
    </aside>
  {/if}
</div>

<style>
  .frame {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .graph {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .side {
    flex: none;
    width: 360px;
    min-height: 0;
    border-left: 1px solid var(--line);
    background: var(--card);
  }
  .dock {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 10;
    display: flex;
    justify-content: center;
  }

  /* Phone: the side sheet is a bottom sheet. Keep 700px in step with MenuShell. */
  @media (max-width: 700px) {
    .side {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 41;
      width: auto;
      height: 62vh;
      height: 62dvh;
      border-left: 0;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -10px 30px #0006;
      overflow: hidden;
    }
  }
</style>
