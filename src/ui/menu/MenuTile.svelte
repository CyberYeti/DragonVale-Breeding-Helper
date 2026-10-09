<!--
  One tile in the menu grid: a DragonTile for `item`, described by core/tile
  for the chosen cave and Display settings. A tick toggles the Collection
  through the store; a click anywhere else opens the Dragon's Focus view.

  Select mode (spec §8 Select mode): a long press on a tile enters it with
  that tile selected. While it is on, ticks are hidden, a tap toggles the
  tile's selection and no graph opens; a selected tile is outlined and
  badged ✓.
-->
<script lang="ts">
  import type { MenuItem } from '../../lib/core/menu';
  import { describeTile } from '../../lib/core/tile';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import DragonTile from '../tile/DragonTile.svelte';
  import { elementIcons, riftIcon } from '../tile/labels';

  let { item, note }: { item: MenuItem; note?: string } = $props();

  const store = useStore();
  const nav = useNav();

  /** How long a press must be held to enter select mode. */
  const LONG_PRESS_MS = 500;
  /** A press that moves further than this (px) is a scroll, not a long press. */
  const LONG_PRESS_SLOP = 8;

  const view = $derived(describeTile(store.world, item.dragon, store.cave, store.display));
  const name = $derived(item.dragon.name);
  const selected = $derived(nav.selecting && nav.selected.has(name));

  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressAt: [number, number] | null = null;
  /** The long press just fired: swallow the click that ends it. */
  let suppressClick = false;

  function onpointerdown(event: PointerEvent) {
    suppressClick = false;
    if (nav.selecting || event.button !== 0) return;
    // A press on a tick toggles it; it never starts select mode.
    if (event.target instanceof Element && event.target.closest('.ticks')) return;
    pressAt = [event.clientX, event.clientY];
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressAt = null;
      suppressClick = true;
      nav.enterSelect();
      nav.toggleSelected(name);
      navigator.vibrate?.(20);
    }, LONG_PRESS_MS);
  }

  function onpointermove(event: PointerEvent) {
    if (pressAt && Math.hypot(event.clientX - pressAt[0], event.clientY - pressAt[1]) > LONG_PRESS_SLOP) cancelPress();
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    pressAt = null;
  }

  function onclickcapture(event: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  }

  function oncontextmenu(event: MouseEvent) {
    // A touch long press would otherwise open the browser's menu over the tile.
    if (pressAt || suppressClick || nav.selecting) event.preventDefault();
  }

  $effect(() => cancelPress);
</script>

<!-- The pointer handlers only time a long press; the tile's own buttons stay the controls (the Select button is the keyboard way in). -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="menu-tile"
  class:selecting={nav.selecting}
  class:selected
  {onpointerdown}
  {onpointermove}
  onpointerup={cancelPress}
  onpointercancel={cancelPress}
  onpointerleave={cancelPress}
  {onclickcapture}
  {oncontextmenu}
>
  <DragonTile
    {view}
    {note}
    riftIcon={riftIcon(store.snapshot, item.dragon)}
    elements={elementIcons(store.snapshot, item.dragon)}
    showTicks={!nav.selecting}
    onopen={(v) => (nav.selecting ? nav.toggleSelected(name) : nav.openFocus(v.dragon.name, v.opensAs))}
    ontoggle={(tick, v) => store.toggle(v.dragon, tick.form)}
  />
  {#if selected}<span class="check" aria-hidden="true">✓</span>{/if}
</div>

<style>
  .menu-tile {
    position: relative;
    min-width: 0;
    border-radius: 12px;
    -webkit-touch-callout: none;
  }
  .selected {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .check {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 5;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    color: #000;
    font-size: 12px;
    font-weight: 700;
    line-height: 20px;
    text-align: center;
    pointer-events: none;
  }
</style>
