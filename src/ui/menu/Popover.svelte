<!--
  A page-header popover (▸ Filters, ▸ Display): a trigger button and, while
  open, a panel under it. One popover is open at a time (popovers.svelte.ts).
  A click outside or Escape closes it.

  `trigger` gets the props the button needs (aria-expanded, aria-controls,
  onclick). The phone layout can restyle the panel as a bottom sheet here
  without touching the panels' contents.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { popovers } from './popovers.svelte';

  type TriggerProps = {
    'aria-expanded': boolean;
    'aria-controls': string;
    onclick: () => void;
  };

  let {
    id,
    label,
    trigger,
    children,
  }: { id: string; label: string; trigger: Snippet<[TriggerProps, boolean]>; children: Snippet } = $props();

  const open = $derived(popovers.open === id);
  const panelId = $derived(`popover-${id}`);

  let wrap = $state<HTMLElement>();

  function onpointerdown(event: PointerEvent) {
    if (open && wrap && !wrap.contains(event.target as Node)) popovers.close(id);
  }

  function onkeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      event.stopPropagation();
      popovers.close(id);
    }
  }
</script>

<svelte:window {onpointerdown} {onkeydown} />

<span class="wrap" bind:this={wrap}>
  {@render trigger({ 'aria-expanded': open, 'aria-controls': panelId, onclick: () => popovers.toggle(id) }, open)}
  {#if open}
    <div class="panel" id={panelId} role="dialog" aria-label={label}>
      {@render children()}
    </div>
  {/if}
</span>

<style>
  .wrap {
    position: relative;
  }
  .panel {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 30;
    min-width: 270px;
    padding: 10px 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 8px 24px #0003;
  }
</style>
