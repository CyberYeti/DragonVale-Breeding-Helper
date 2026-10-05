<!--
  Dev-only DragonTile gallery: `npm run dev`, then open the app with ?gallery.
  Not in production builds (src/main.ts only loads it under import.meta.env.DEV).
  The TileViews are made up here; real ones come from core/tile's describeTile.
-->
<script lang="ts">
  import type { Banner, Tick, TileView } from '../../lib/core/tile';
  import type { Dragon, Rarity } from '../../lib/snapshot';
  import DragonTile from '../tile/DragonTile.svelte';

  const RARITIES: Rarity[] = ['Primary', 'Hybrid', 'Rare', 'Epic', 'Galaxy', 'Gemstone', 'Legendary', 'Mythic'];

  /** Stand-in art (no Dragon images ship yet): a coloured shape, so greyscale shows. */
  function art(fill: string): string {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#ffd54f"/>` +
      `<path fill="${fill}" d="M8 46c7-2 11-9 13-15 2-7 9-13 17-13 6 0 10 4 12 8l7-2-3 8c2 4 1 10-3 13-5 4-13 3-17 1l-4 7h-6l3-8c-6 0-12 1-19 1z"/>` +
      `<circle cx="44" cy="27" r="2.5" fill="#fff"/></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function dragon(name: string, rarity: Rarity = 'Hybrid', image: string | null = art('#d84315')): Dragon {
    return {
      name,
      wikiPage: name,
      rarity,
      order: 0,
      elements: [],
      breedingElements: [],
      isLimited: false,
      traits: { kind: 'all' },
      canBeParent: true,
      image,
      routes: [],
    };
  }

  const one = (owned: boolean, form: Tick['form'] = 'normal'): Tick[] => [{ label: 'owned', form, owned }];
  const two = (normal: boolean, rift: boolean): Tick[] => [
    { label: 'normal', form: 'normal', owned: normal },
    { label: 'rift', form: 'rift', owned: rift },
  ];

  function view(d: Dragon, over: Partial<Omit<TileView, 'dragon'>> = {}): TileView {
    return { dragon: d, owned: false, colour: false, sheen: false, banner: null, ticks: one(false), opensAs: 'normal', ownedBanner: false, ...over };
  }

  const banners: [string, Banner | null][] = [
    ['None', null],
    ['Summoning only', { kind: 'summoning-only' }],
    ['Evolution only', { kind: 'evolution-only' }],
    ['Shop only', { kind: 'shop-only' }],
    ['Not available', { kind: 'not-available' }],
    ['Normal cave', { kind: 'not-breedable-in-cave', cave: 'normal' }],
    ['Rift cave', { kind: 'not-breedable-in-cave', cave: 'rift' }],
    ['Co-op cave', { kind: 'not-breedable-in-cave', cave: 'coop' }],
    ['Purchase only', { kind: 'purchase-only' }],
  ];

  let sections = $state<{ title: string; tiles: { caption: string; view: TileView; note?: string }[] }[]>([
    {
      title: 'Banners',
      tiles: banners.map(([caption, banner], i) => ({
        caption,
        view: view(dragon(caption === 'None' ? 'Lava' : `Banner ${i}`, RARITIES[i % RARITIES.length]), { banner }),
      })),
    },
    {
      title: 'Owned and not owned',
      tiles: [
        { caption: 'Not owned (grey)', view: view(dragon('Lava')) },
        { caption: 'Owned (colour)', view: view(dragon('Lava'), { owned: true, colour: true, ticks: one(true) }) },
        { caption: 'Not owned, all in colour', view: view(dragon('Lava'), { colour: true }) },
        { caption: 'Normal + Rift ticks', view: view(dragon('Rainbow', 'Rare', art('#7b1fa2')), { owned: true, colour: true, ticks: two(true, false) }) },
        { caption: 'Rift form owned', view: view(dragon('Rainbow', 'Rare', art('#7b1fa2')), { owned: true, colour: true, ticks: two(false, true), opensAs: 'rift' }) },
        { caption: 'Rift dragon', view: view(dragon('Plumewing', 'Epic', art('#0288d1')), { ticks: one(false, 'rift'), opensAs: 'rift' }) },
        { caption: 'With a note', view: view(dragon('Haystack', 'Hybrid', art('#8d6e63')), { owned: true, colour: true, ticks: one(true) }), note: 'ends in 3 days' },
      ],
    },
    {
      title: 'Breedable now (sheen)',
      tiles: [
        { caption: 'Sheen, not owned', view: view(dragon('Lava'), { sheen: true }) },
        { caption: 'Sheen, all in colour', view: view(dragon('Sun', 'Epic', art('#ff8f00')), { sheen: true, colour: true }) },
        { caption: 'Sheen + Rift ticks', view: view(dragon('Rainbow', 'Rare', art('#7b1fa2')), { sheen: true, ticks: two(true, false), opensAs: 'rift' }) },
      ],
    },
    {
      title: 'Silhouette',
      tiles: [
        { caption: 'image: null', view: view(dragon('Kairos', 'Legendary', null), { banner: { kind: 'summoning-only' } }) },
        { caption: 'image fails to load', view: view(dragon('Missing', 'Mythic', 'images/NoSuchDragonAdult.png'), { owned: true, colour: true, ticks: one(true) }) },
      ],
    },
  ]);

  const liteViews = RARITIES.map((rarity, i) => view(dragon(rarity, rarity, i === 3 ? null : art('#d84315')), { colour: i % 2 === 0 }));

  let log = $state('Click a tile or a tick.');

  function toggle(tile: { view: TileView }, tick: Tick) {
    const ticks = tile.view.ticks.map((t) => (t.form === tick.form ? { ...t, owned: !t.owned } : t));
    const owned = ticks.some((t) => t.owned);
    tile.view = { ...tile.view, ticks, owned, colour: owned };
    log = `Toggled ${tick.label} on ${tile.view.dragon.name} (no open)`;
  }
</script>

<main>
  <h1>DragonTile gallery</h1>
  <p class="log" aria-live="polite">{log}</p>

  {#each sections as section (section.title)}
    <section>
      <h2>{section.title}</h2>
      <div class="row">
        {#each section.tiles as tile, i (i)}
          <figure>
            <DragonTile
              view={tile.view}
              note={tile.note}
              onopen={(v) => (log = `Opened ${v.dragon.name} as ${v.opensAs}`)}
              ontoggle={(tick) => toggle(tile, tick)}
            />
            <figcaption>{tile.caption}</figcaption>
          </figure>
        {/each}
      </div>
    </section>
  {/each}

  <section>
    <h2>Lite (graphs), per rarity</h2>
    {#each [{ label: 'Lite', faded: false, far: false }, { label: 'Lite, faded', faded: true, far: false }, { label: 'Lite, faded, far zoom (square)', faded: true, far: true }] as mode (mode.label)}
      <h3>{mode.label}</h3>
      <div class="row lite-row">
        {#each liteViews as v (v.dragon.name)}
          <figure>
            <DragonTile view={v} lite faded={mode.faded} far={mode.far} onopen={(o) => (log = `Opened ${o.dragon.name} (lite)`)} />
            <figcaption>{v.dragon.rarity}</figcaption>
          </figure>
        {/each}
      </div>
    {/each}
  </section>
</main>

<style>
  main {
    padding: 16px;
    max-width: 1100px;
    margin: 0 auto;
  }
  h1 {
    font-size: 20px;
  }
  h2 {
    font-size: 16px;
    margin: 24px 0 8px;
  }
  h3 {
    font-size: 13px;
    color: var(--muted);
    margin: 12px 0 6px;
  }
  .log {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    padding: 4px 0;
    color: var(--muted);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .lite-row {
    --tile-width: 64px;
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  figcaption {
    font-size: 11px;
    color: var(--muted);
    max-width: 96px;
    text-align: center;
  }
</style>
