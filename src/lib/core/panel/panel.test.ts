import { describe, expect, it } from 'vitest';
import { bred, coop, dragon, limited, primaries, summoned, world } from '../testing/fixtures';
import type { Cave } from '../breeding';
import type { World } from '../world';
import {
  panelFor,
  type Clicked,
  type DragonPanel,
  type ElementPanel,
  type PairGroup,
  type RoutePanel,
  type Target,
} from './index';

const moss = () => dragon({ name: 'Moss', order: 100, elements: ['Plant', 'Earth'] });
const flower = () => dragon({ name: 'Flower', order: 101, elements: ['Plant', 'Fire'] });
const lava = () => dragon({ name: 'Lava', order: 102, elements: ['Fire', 'Earth'] });
const ironwood = () => dragon({ name: 'Ironwood', rarity: 'Rare', order: 103, elements: ['Plant', 'Metal'] });

function routePanel(w: World, dragonName: string, target: Target = { dragon: dragonName, form: 'normal' }, cave: Cave = 'normal', route = 0) {
  const clicked: Clicked = { kind: 'route', dragon: dragonName, form: target.form, route };
  const panel = panelFor(w, cave, target, clicked);
  expect(panel.kind).toBe('route');
  return panel as RoutePanel;
}

const groupNames = (groups: readonly PairGroup[]) =>
  groups.map((g) => [g.parent.dragon.name, g.with.map((l) => l.dragon.name)]);

describe('Route panel: a met Route', () => {
  it('lists every owned Valid pair, grouped by the simpler parent, simplest first, with the count', () => {
    const w = world({ dragons: [...primaries(), moss(), flower(), lava()], owned: ['Fire', 'Earth', 'Moss', 'Flower'] });
    const panel = routePanel(w, 'Lava');

    expect(panel.headline).toBe('✔ Met · 4 Valid pairs');
    expect(panel.tone).toBe('ok');
    expect(panel.status.pairCount).toBe(4);
    expect(groupNames(panel.pairs)).toEqual([
      ['Fire', ['Earth', 'Moss']],
      ['Earth', ['Flower']],
      ['Moss', ['Flower']],
    ]);
    expect(panel.suggestions).toEqual([]);
    expect(panel.reason).toBeNull();
  });

  it('puts a named parent at the head of its one group', () => {
    const clover = dragon({ name: 'Clover', order: 200, elements: ['Plant'], routes: [bred({ parents: ['Moss'], elements: ['Plant'] })] });
    const w = world({ dragons: [...primaries(), moss(), flower(), clover], owned: ['Plant', 'Moss', 'Flower'] });
    const panel = routePanel(w, 'Clover');

    expect(panel.headline).toBe('✔ Met · 3 Valid pairs');
    expect(groupNames(panel.pairs)).toEqual([['Moss', ['Plant', 'Moss', 'Flower']]]);
  });

  it('heads a Co-op bred Route with the friend’s Dragon', () => {
    const nebula = dragon({ name: 'Nebula', rarity: 'Galaxy', elements: ['Galaxy'], routes: [coop('Nebula')] });
    const w = world({ dragons: [...primaries(), moss(), nebula], owned: ['Moss', 'Fire'] });
    const panel = routePanel(w, 'Nebula', undefined, 'coop');

    expect(panel.headline).toBe('✔ Met · 2 Valid pairs');
    expect(groupNames(panel.pairs)).toEqual([['Nebula', ['Fire', 'Moss']]]);
  });

  it('writes the count with a thousands separator', () => {
    const many = Array.from({ length: 60 }, (_, i) => dragon({ name: `Quad ${i}`, elements: ['Plant', 'Fire', 'Earth', 'Cold'] }));
    const rainbow = dragon({ name: 'Rainbow', rarity: 'Epic', elements: ['Rainbow'], routes: [bred({ minDistinctElements: 4 })] });
    const w = world({ dragons: [...primaries(), ...many, rainbow], owned: many.map((d) => d.name) });

    expect(routePanel(w, 'Rainbow').headline).toBe('✔ Met · 1,830 Valid pairs');
  });

  it('says "1 Valid pair" for one', () => {
    const w = world({ dragons: [...primaries(), lava()], owned: ['Fire', 'Earth'] });
    expect(routePanel(w, 'Lava').headline).toBe('✔ Met · 1 Valid pair');
  });
});

describe('Route panel: not met', () => {
  it('gives opposite primaries as the reason when they are the only pair', () => {
    const w = world({ dragons: [...primaries(), ironwood()], owned: ['Plant', 'Metal'] });
    const panel = routePanel(w, 'Ironwood');

    expect(panel.headline).toBe('No Valid pair yet');
    expect(panel.tone).toBe('warn');
    expect(panel.reason).toBe('Plant Dragon + Metal Dragon are opposites');
    expect(panel.pairs).toEqual([]);
  });

  it('is "Not met" with the missing Element when nothing owned carries it', () => {
    const w = world({ dragons: [...primaries(), lava()], owned: ['Fire'] });
    const panel = routePanel(w, 'Lava');

    expect(panel.headline).toBe('Not met');
    expect(panel.tone).toBe('bad');
    expect(panel.reason).toBe('Nothing you own carries Earth');
    expect(panel.suggestions.map((s) => [s.dragon.name, s.with.dragon.name])).toEqual([['Earth', 'Fire']]);
  });

  it('names missing named parents', () => {
    const zaffer = dragon({ name: 'Zaffer', elements: ['Cold'], routes: [bred({ parents: ['Moss', 'Flower'] })] });
    const w = world({ dragons: [...primaries(), moss(), flower(), zaffer], owned: ['Fire'] });
    const panel = routePanel(w, 'Zaffer');

    expect(panel.reason).toBe('Needs Moss Dragon and Flower Dragon');
    // Both are missing, so no single Dragon makes a Valid pair with something owned.
    expect(panel.suggestions).toEqual([]);
  });

  it('suggests Breedable now, then Available, then not Available, then the basic-dragon order, never the Target', () => {
    const chrome = dragon({ name: 'Chrome', order: 500, elements: ['Metal', 'Lightning'] });
    const gild = dragon({ name: 'Gild', order: 50, elements: ['Metal', 'Fire', 'Earth'] });
    const bloom = limited({ name: 'Bloom', order: 10, elements: ['Plant', 'Earth'] });
    // The Target: needs Ironwood, and would itself pair with Plant.
    const steelwood = dragon({
      name: 'Steelwood',
      order: 20,
      elements: ['Plant', 'Metal', 'Earth'],
      routes: [bred({ parents: ['Ironwood'] })],
    });
    const w = world({
      dragons: [...primaries(), flower(), ironwood(), chrome, gild, bloom, steelwood],
      owned: ['Plant', 'Metal', 'Fire'],
    });
    const panel = routePanel(w, 'Ironwood', { dragon: 'Steelwood', form: 'normal' });

    expect(panel.reason).toBe('Plant Dragon + Metal Dragon are opposites');
    expect(panel.suggestions.map((s) => [s.dragon.name, s.with.dragon.name, s.breedableNow, s.available])).toEqual([
      ['Flower', 'Metal', true, true],
      ['Chrome', 'Plant', false, true],
      ['Gild', 'Plant', false, true],
      ['Bloom', 'Metal', false, false],
    ]);
  });

  it('never suggests the Route’s own Dragon', () => {
    const w = world({ dragons: [...primaries(), ironwood()], owned: ['Plant', 'Metal'] });
    expect(routePanel(w, 'Ironwood').suggestions.map((s) => s.dragon.name)).not.toContain('Ironwood');
  });

  it('shows a Summoned Route as not bred', () => {
    const kairos = dragon({ name: 'Kairos', rarity: 'Legendary', traits: 'none', routes: [summoned(['Time Shard'])] });
    const w = world({ dragons: [...primaries(), kairos] });
    const panel = routePanel(w, 'Kairos');

    expect(panel.headline).toBe('Summoned');
    expect(panel.reason).toBe('Summoned with Time Shard');
    expect(panel.suggestions).toEqual([]);
  });
});

describe('Element panel', () => {
  const thorn = () => dragon({ name: 'Thorn', order: 300, elements: ['Plant', 'Fire', 'Earth'] });
  const bloom = () => limited({ name: 'Bloom', order: 5, elements: ['Plant', 'Earth'] });
  const seasonal = () =>
    dragon({ name: 'Seasonal', rarity: 'Epic', order: 6, elements: ['Seasonal'], breedingElements: ['Air', 'Fire', 'Plant', 'Seasonal'] });

  function elementPanel(w: World, element: string, target: Target, cave: Cave = 'normal') {
    const panel = panelFor(w, cave, target, { kind: 'element', element });
    expect(panel.kind).toBe('element');
    return panel as ElementPanel;
  }

  it('lists the owned carriers, then the basic dragon, then the alternatives in suggestion order', () => {
    const w = world({
      dragons: [...primaries(), moss(), flower(), ironwood(), thorn(), bloom(), seasonal()],
      owned: ['Flower', 'Moss'],
    });
    const panel = elementPanel(w, 'Plant', { dragon: 'Seasonal', form: 'normal' });

    expect(panel.headline).toBe('You own 2 carrying it');
    expect(panel.carriers.map((l) => l.dragon.name)).toEqual(['Moss', 'Flower']);
    expect(panel.basic?.dragon.name).toBe('Plant');
    expect(panel.basic?.ticks).toEqual([{ form: 'normal', owned: false }]);
    // Thorn is Breedable now (Moss + Flower), Ironwood is Available, Bloom isn't; Seasonal is the Target.
    expect(panel.alternatives.map((c) => c.dragon.name)).toEqual(['Thorn', 'Ironwood', 'Bloom']);
  });

  it('says when nothing owned carries it', () => {
    const w = world({ dragons: [...primaries(), moss()], owned: ['Fire'] });
    const panel = elementPanel(w, 'Plant', { dragon: 'Moss', form: 'normal' });

    expect(panel.headline).toBe('You own nothing that carries it');
    expect(panel.tone).toBe('bad');
    expect(panel.carriers).toEqual([]);
  });

  it('in Rift breeding, counts only Rift forms and picks a basic dragon that has one', () => {
    const w = world({ dragons: [...primaries(), moss(), flower()], owned: { Moss: 'normal', Flower: 'rift' } });
    const panel = elementPanel(w, 'Plant', { dragon: 'Lava', form: 'rift' }, 'rift');

    expect(panel.breeding).toBe('rift');
    expect(panel.carriers.map((l) => [l.dragon.name, l.form])).toEqual([['Flower', 'rift']]);
    // The Plant primary has no Rift form.
    expect(panel.basic?.dragon.name).toBe('Moss');
    expect(panel.basic?.form).toBe('rift');
  });
});

describe('Dragon panel', () => {
  function dragonPanel(w: World, name: string, cave: Cave = 'normal', form: 'normal' | 'rift' = 'normal') {
    const panel = panelFor(w, cave, { dragon: 'Lava', form: 'normal' }, { kind: 'dragon', dragon: name, form });
    expect(panel.kind).toBe('dragon');
    return panel as DragonPanel;
  }

  it('shows owned, Breedable now, or why it can’t be bred, with a Routes summary', () => {
    const w = world({ dragons: [...primaries(), lava(), moss()], owned: { Fire: true, Earth: true, Moss: 'rift' } });

    const lavaPanel = dragonPanel(w, 'Lava');
    expect(lavaPanel.isTarget).toBe(true);
    expect([lavaPanel.status, lavaPanel.headline]).toEqual(['breedable-now', 'Breedable now']);
    // Moss's Rift form counts in Normal breeding: Fire + Earth, Fire + Moss.
    expect(lavaPanel.routes.map((r) => r.headline)).toEqual(['✔ Met · 2 Valid pairs']);

    const mossPanel = dragonPanel(w, 'Moss', 'rift', 'rift');
    expect([mossPanel.status, mossPanel.headline]).toEqual(['owned', 'Owned (Rift form)']);

    const lavaRift = dragonPanel(w, 'Lava', 'rift', 'rift');
    expect(lavaRift.status).toBe('not-breedable');
    expect(lavaRift.reasons).toEqual(['No Route is met yet']);
    expect(lavaRift.routes[0]!.status.reason).toEqual({ kind: 'missing-elements', elements: ['Fire'] });
  });

  it('gives each reason it can’t be bred', () => {
    const haze = limited({ name: 'Haze', elements: ['Fire', 'Earth'] });
    const kairos = dragon({ name: 'Kairos', rarity: 'Legendary', traits: 'none', routes: [summoned()] });
    const w = world({ dragons: [...primaries(), haze, kairos], owned: ['Fire', 'Earth'] });

    expect(dragonPanel(w, 'Haze').reasons).toEqual(['Not available right now']);
    expect(dragonPanel(w, 'Kairos').reasons).toEqual(['Summoning only']);
  });
});
