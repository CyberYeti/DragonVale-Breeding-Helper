<!--
  DragonTile (spec §8 Dragon tile): the one Dragon card used in the menu, on
  graph nodes, in the popover and in the side sheet. It renders a TileView
  from core/tile and applies no breeding rules of its own.

  Width comes from the parent through `--tile-width` (default 96px). Lite
  tiles are square; full tiles add the name, an optional note and the ticks.
-->
<script lang="ts">
  import type { Tick, TileView } from '../../lib/core/tile';
  import { assetUrl, bannerBlocks, bannerText, rarityColour, tickText } from './labels';

  type Props = {
    view: TileView;
    /** Graphs only: art and rarity border, no name, banner, ticks or sheen. */
    lite?: boolean;
    /** Drawn faded (a graph's background behind a pulled tree). */
    faded?: boolean;
    /** Far zoomed out. A faded lite tile then drops its art: a rarity-coloured square. */
    far?: boolean;
    /** Show the ownership ticks (select mode hides them). */
    showTicks?: boolean;
    /** A short line under the name, e.g. "ends in 3 days" or a shop cost. */
    note?: string;
    /**
     * Graphs only: an owned Target gets the "Owned" banner (spec §9 rule 8),
     * drawn instead of any other banner. The menu leaves it off.
     */
    ownedBanner?: boolean;
    /** A click anywhere but a tick. */
    onopen?: (view: TileView) => void;
    /** A tick was clicked; write `tick.form` to the Collection. Never also opens. */
    ontoggle?: (tick: Tick, view: TileView) => void;
  };

  let {
    view,
    lite = false,
    faded = false,
    far = false,
    showTicks = true,
    note,
    ownedBanner = false,
    onopen,
    ontoggle,
  }: Props = $props();

  const dragon = $derived(view.dragon);
  const square = $derived(lite && faded && far);
  const src = $derived(dragon.image ? assetUrl(dragon.image) : null);
  /** The last src that failed to load; it falls back to the silhouette. */
  let failedSrc = $state<string | null>(null);
  const showArt = $derived(src !== null && src !== failedSrc);
  const sheen = $derived(view.sheen && !lite);
  const title = $derived(`${dragon.name} · ${dragon.rarity}${sheen ? ' · Breedable now' : ''}`);

  function open() {
    onopen?.(view);
  }

  function toggle(event: MouseEvent, tick: Tick) {
    // Ticks sit above the open button, but a graph node or other ancestor may
    // listen for clicks too: keep the toggle from opening anything.
    event.stopPropagation();
    ontoggle?.(tick, view);
  }
</script>

<div
  class="tile"
  class:grey={!view.colour}
  class:sheen
  class:lite
  class:faded
  class:square
  style:--rc={rarityColour(dragon.rarity)}
  {title}
>
  {#if !square}
    {#if showArt}
      <img src={src} alt="" loading="lazy" decoding="async" draggable="false" onerror={() => (failedSrc = src)} />
    {:else}
      <svg class="art silhouette" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M8 46c7-2 11-9 13-15 2-7 9-13 17-13 6 0 10 4 12 8l7-2-3 8c2 4 1 10-3 13-5 4-13 3-17 1l-4 7h-6l3-8c-6 0-12 1-19 1z"
        />
      </svg>
    {/if}
  {/if}

  {#if !lite}
    {#if ownedBanner}
      <div class="banner owned">Owned</div>
    {:else if view.banner}
      <div class="banner" class:blocked={bannerBlocks(view.banner)}>{bannerText(view.banner)}</div>
    {/if}
    <div class="name">{dragon.name}</div>
    {#if note}<div class="note">{note}</div>{/if}
  {/if}

  <button type="button" class="open" aria-label="Open {dragon.name}" onclick={open}></button>

  {#if !lite && showTicks && view.ticks.length > 0}
    <div class="ticks nodrag nopan">
      {#each view.ticks as tick (tick.form)}
        <button
          type="button"
          class:on={tick.owned}
          class:rift={tick.label === 'rift'}
          aria-pressed={tick.owned}
          aria-label="{tickText(tick)}: {dragon.name}"
          onclick={(event) => toggle(event, tick)}>{tickText(tick)}</button
        >
      {/each}
    </div>
  {/if}
</div>

<style>
  .tile {
    position: relative;
    width: var(--tile-width, 96px);
    border: 3px solid var(--rc);
    border-radius: 12px;
    background: var(--card);
    color: var(--fg);
    padding: 4px 4px 3px;
    text-align: center;
    overflow: hidden;
    flex: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  img,
  .art {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    display: block;
    pointer-events: none;
  }
  .silhouette {
    fill: var(--muted);
    opacity: 0.6;
  }
  .grey img {
    filter: grayscale(1) opacity(0.5);
  }

  /* Breedable now: a soft white sheen drifting across the card. */
  .sheen::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.22),
      rgba(255, 255, 255, 0.04) 35%,
      rgba(255, 255, 255, 0.18) 55%,
      rgba(255, 255, 255, 0.04) 80%,
      rgba(255, 255, 255, 0.22)
    );
    background-size: 250% 250%;
    mix-blend-mode: screen;
    animation: drift 7s ease-in-out infinite alternate;
  }
  @keyframes drift {
    0% {
      background-position: 0% 0%;
    }
    100% {
      background-position: 100% 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheen::before {
      animation: none;
    }
  }

  .banner {
    position: absolute;
    top: 32%;
    left: 0;
    right: 0;
    z-index: 4;
    pointer-events: none;
    background: var(--banner-bg);
    color: var(--banner-fg);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    padding: 2px 4px;
  }
  .banner.blocked {
    background: var(--banner-blocked-bg);
  }
  .banner.owned {
    background: var(--own);
  }

  .name,
  .note {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    font-size: 11px;
    line-height: 1.2;
  }
  .note {
    font-size: 10px;
    color: var(--muted);
  }

  /* The whole card opens the Dragon; ticks sit above this button. */
  .open {
    position: absolute;
    inset: 0;
    z-index: 2;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }
  .open:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
    border-radius: 9px;
  }

  .ticks {
    position: relative;
    z-index: 5;
    display: flex;
    gap: 3px;
    justify-content: center;
    margin-top: 2px;
  }
  .ticks button {
    cursor: pointer;
    font-size: 10px;
    line-height: 16px;
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: var(--muted);
    white-space: nowrap;
  }
  .ticks button.on {
    background: var(--own);
    border-color: var(--own);
    color: #fff;
  }
  .ticks button.rift.on {
    background: var(--rift);
    border-color: var(--rift);
  }

  /* Lite: a square card of art inside the rarity border. */
  .lite {
    aspect-ratio: 1;
    padding: 4px;
  }
  .faded {
    opacity: 0.1;
  }
  .square {
    background: var(--rc);
  }
</style>
