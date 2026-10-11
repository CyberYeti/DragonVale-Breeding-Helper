<!--
  A button with a popover (the page header's ▸ Filters and ▸ Display, the
  header's ⋯ menu). At desktop width the panel drops down under the button;
  at phone width (≤ 700px, spec §8 Phone layout) it opens as a bottom sheet
  over a dimmed backdrop.

  Usage:
    <Popover label="Filters" align="left">
      {#snippet trigger({ open, toggle })}
        <ToolButton pressed={open} aria-expanded={open} onclick={toggle}>▸ Filters</ToolButton>
      {/snippet}
      {#snippet children({ close })}…panel contents…{/snippet}
    </Popover>

  `open` is bindable. Escape, a click outside and the backdrop close it.
  Only one Popover is open at a time: opening one closes the other.
-->
<script module lang="ts">
  /** Closes the Popover that is open, if any. */
  let closeOpen: (() => void) | null = null;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  type Controls = { readonly open: boolean; readonly toggle: () => void; readonly close: () => void };

  let {
    open = $bindable(false),
    label,
    align = 'left',
    trigger,
    children,
  }: {
    open?: boolean;
    /** The panel's accessible name. */
    label: string;
    /** Which edge of the button the desktop panel lines up with. */
    align?: 'left' | 'right';
    trigger: Snippet<[Controls]>;
    children: Snippet<[Controls]>;
  } = $props();

  let anchor = $state<HTMLElement>();

  function close() {
    open = false;
  }

  function toggle() {
    open = !open;
  }

  const controls: Controls = {
    get open() {
      return open;
    },
    toggle,
    close,
  };

  // Opening this one closes any other.
  $effect(() => {
    if (!open) return;
    closeOpen?.();
    closeOpen = close;
    return () => {
      if (closeOpen === close) closeOpen = null;
    };
  });

  function onpointerdown(event: PointerEvent) {
    if (open && anchor && !anchor.contains(event.target as Node)) close();
  }

  function onkeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }
</script>

<svelte:window {onpointerdown} {onkeydown} />

<span class="anchor" bind:this={anchor}>
  {@render trigger(controls)}
  {#if open}
    <button type="button" class="backdrop" tabindex="-1" aria-label="Close" onclick={close}></button>
    <div class="panel" class:right={align === 'right'} role="dialog" aria-label={label}>
      {@render children(controls)}
    </div>
  {/if}
</span>

<style>
  .anchor {
    position: relative;
    display: inline-block;
  }
  .panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    min-width: 220px;
    max-width: min(360px, calc(100vw - 24px));
    padding: 10px 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 8px 24px #0003;
  }
  .panel.right {
    left: auto;
    right: 0;
  }
  .backdrop {
    display: none;
  }

  /* Phone: a bottom sheet over a dimmed page. Keep 700px in step with MenuShell. */
  @media (max-width: 700px) {
    .backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 40;
      padding: 0;
      border: 0;
      background: #0006;
      cursor: default;
    }
    .panel,
    .panel.right {
      position: fixed;
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 41;
      min-width: 0;
      max-width: none;
      max-height: 80vh;
      max-height: 80dvh;
      overflow: auto;
      padding: 14px 16px calc(20px + env(safe-area-inset-bottom));
      border: 0;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -10px 30px #0006;
    }
  }
</style>
