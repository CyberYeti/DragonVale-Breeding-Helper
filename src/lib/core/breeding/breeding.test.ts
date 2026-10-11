import { describe, expect, it } from 'vitest';
import type { Dragon, Requirement, Route } from '../../snapshot';
import {
  TOMORROW,
  bred,
  coop,
  dragon,
  evolved,
  limited,
  primaries,
  primary,
  purchased,
  realCast,
  riftDragon,
  summoned,
  world,
  type Owned,
} from '../testing/fixtures';
import type { Form } from '../collection';
import type { World } from '../world';
import {
  basicDragon,
  breedableNow,
  caveCanMake,
  caveForm,
  routeStatus,
  validPairs,
  wouldBeValidPair,
  type Pair,
} from './index';

const flower = () => dragon({ name: 'Flower', elements: ['Plant', 'Fire'] });
const moss = () => dragon({ name: 'Moss', elements: ['Plant', 'Earth'] });
const chrome = () => dragon({ name: 'Chrome', elements: ['Metal', 'Lightning'] });
const ironwood = () => dragon({ name: 'Ironwood', rarity: 'Rare', elements: ['Plant', 'Metal'] });
const clover = () => dragon({ name: 'Clover', elements: ['Plant'], routes: [bred({ parents: ['Moss'], elements: ['Plant'] })] });
const seasonal = () =>
  dragon({
    name: 'Seasonal',
    rarity: 'Epic',
    elements: ['Seasonal'],
    breedingElements: ['Air', 'Fire', 'Plant', 'Seasonal'],
    routes: [bred(['Air', 'Fire', 'Plant'])],
  });
const rainbow = () =>
  dragon({ name: 'Rainbow', rarity: 'Epic', elements: ['Rainbow'], routes: [bred({ minDistinctElements: 4 })] });
const snowflake = () =>
  dragon({ name: 'Snowflake', rarity: 'Epic', elements: ['Snowflake'], routes: [bred({ elementOnBothParents: 'Snowflake' })] });
const motley = () => limited({ name: 'Motley', elements: ['Plant'], routes: [bred({ anyPair: true })] });
const nebula = () =>
  dragon({ name: 'Nebula', rarity: 'Galaxy', elements: ['Galaxy'], breedingElements: ['Air', 'Galaxy'], routes: [coop('Nebula')] });
const solarflare = () =>
  dragon({ name: 'Solarflare', rarity: 'Galaxy', elements: ['Galaxy', 'Sun'], routes: [bred(['Fire', 'Plant'])] });
const solis = () =>
  dragon({ name: 'Solis', rarity: 'Galaxy', elements: ['Galaxy', 'Sun'], routes: [bred(['Fire', 'Plant'])] });
const kampos = () => riftDragon({ name: 'Kampos', elements: ['Water', 'Air'], trait: 'Water' });
const lava = () => dragon({ name: 'Lava', elements: ['Fire', 'Earth'] });
const blueFire = () => dragon({ name: 'Blue Fire', rarity: 'Rare', elements: ['Fire', 'Cold'] });

/** routeStatus of `name`'s first (or `index`th) Route. */
function status(w: World, name: string, form: Form = 'normal', index = 0) {
  const d = w.dragons.get(name)!;
  return routeStatus(w, d, d.routes[index]!, form);
}

const pairNames = (pairs: Iterable<Pair>) => [...pairs].map(([a, b]) => `${a.name}+${b.name}`);

const routeOf = (w: World, name: string, index = 0): Route => w.dragons.get(name)!.routes[index]!;

describe('Valid pair', () => {
  it('Seasonal is not met when Air, Fire and Plant are covered only across three Dragons', () => {
    const w = world({ dragons: [...primaries(), seasonal()], owned: ['Air', 'Fire', 'Plant'] });
    expect(status(w, 'Seasonal')).toEqual({ met: false, pairCount: 0, reason: { kind: 'no-valid-pair' } });
  });

  it('Seasonal is met when two Dragons cover Air, Fire and Plant', () => {
    const w = world({ dragons: [...primaries(), flower(), seasonal()], owned: ['Air', 'Flower'] });
    expect(status(w, 'Seasonal')).toMatchObject({ met: true, pairCount: 1 });
    expect(pairNames(validPairs(w, routeOf(w, 'Seasonal'), 'normal'))).toEqual(['Air+Flower']);
  });

  it('Plant Dragon + Metal Dragon is never a Valid pair', () => {
    const w = world({ dragons: [...primaries(), ironwood()], owned: ['Plant', 'Metal'] });
    expect(status(w, 'Ironwood')).toEqual({
      met: false,
      pairCount: 0,
      reason: { kind: 'opposites', pair: ['Plant', 'Metal'] },
    });
    expect([...validPairs(w, routeOf(w, 'Ironwood'), 'normal')]).toEqual([]);
  });

  it('a primary with a hybrid carrying the opposite Element is a Valid pair', () => {
    const w = world({ dragons: [...primaries(), chrome(), ironwood()], owned: ['Plant', 'Metal', 'Chrome'] });
    expect(pairNames(validPairs(w, routeOf(w, 'Ironwood'), 'normal'))).toEqual(['Plant+Chrome']);
    expect(status(w, 'Ironwood').pairCount).toBe(1);
  });

  it('only primaries are opposites: two hybrids carrying Plant and Metal pair fine', () => {
    const steel = dragon({ name: 'Steel', elements: ['Metal', 'Earth'] });
    const w = world({ dragons: [...primaries(), moss(), steel, ironwood()], owned: ['Moss', 'Steel'] });
    expect(status(w, 'Ironwood')).toMatchObject({ met: true, pairCount: 1 });
  });

  it('a one-parent requirement needs that parent, and the other parent supplies the rest', () => {
    const w = world({ dragons: [...primaries(), moss(), flower(), clover()], owned: ['Flower'] });
    expect(status(w, 'Clover')).toEqual({ met: false, pairCount: 0, reason: { kind: 'missing-parents', dragons: ['Moss'] } });

    const owned = world({ dragons: [...primaries(), moss(), flower(), clover()], owned: ['Moss', 'Flower', 'Fire'] });
    // Moss carries Plant itself, so Moss pairs with every parent, itself included.
    expect(pairNames(validPairs(owned, routeOf(owned, 'Clover'), 'normal')).sort()).toEqual([
      'Moss+Fire',
      'Moss+Flower',
      'Moss+Moss',
    ]);
    expect(status(owned, 'Clover').pairCount).toBe(3);
  });

  it('a two-parent requirement needs exactly that pair (Air = Water + Fire)', () => {
    const cast = realCast();
    expect(status(world({ dragons: cast, owned: ['Water'] }), 'Air').reason).toEqual({
      kind: 'missing-parents',
      dragons: ['Fire'],
    });
    const w = world({ dragons: cast, owned: ['Water', 'Fire', 'Lava'] });
    expect(status(w, 'Air')).toMatchObject({ met: true, pairCount: 1 });
    expect(pairNames(validPairs(w, routeOf(w, 'Air'), 'normal'))).toEqual(['Water+Fire']);
  });

  it('two of the same Dragon count as a pair', () => {
    const w = world({ dragons: [...primaries(), dragon({ name: 'Lava', elements: ['Fire', 'Earth'] })], owned: ['Lava'] });
    expect(status(w, 'Lava')).toMatchObject({ met: true, pairCount: 1 });
    expect(pairNames(validPairs(w, routeOf(w, 'Lava'), 'normal'))).toEqual(['Lava+Lava']);
  });

  it('minDistinctElements counts the pool of the two parents', () => {
    const cast = [...primaries(), flower(), moss(), rainbow()];
    expect(status(world({ dragons: cast, owned: ['Flower'] }), 'Rainbow').reason).toEqual({
      kind: 'too-few-elements',
      needed: 4,
    });
    // Plant, Fire, Earth and Water are all owned, but no two parents hold 4 of them.
    const w = world({ dragons: cast, owned: ['Flower', 'Moss', 'Water'] });
    expect(status(w, 'Rainbow').reason).toEqual({ kind: 'no-valid-pair' });
    expect(pairNames(validPairs(w, routeOf(w, 'Rainbow'), 'normal'))).toEqual([]);
    const four = world({ dragons: [...cast, dragon({ name: 'Mud', elements: ['Earth', 'Water'] })], owned: ['Flower', 'Mud'] });
    expect(status(four, 'Rainbow')).toMatchObject({ met: true, pairCount: 1 });
  });

  it('elementOnBothParents needs the Element on each parent, not just in the pool', () => {
    const flake = dragon({ name: 'Flake', elements: ['Snowflake', 'Cold'] });
    const cast = [...primaries(), flake, snowflake()];
    const w = world({ dragons: cast, owned: ['Flake', 'Cold'] });
    // Flake + Cold has Snowflake in the pool, but only Flake + Flake carries it twice.
    expect(pairNames(validPairs(w, routeOf(w, 'Snowflake'), 'normal'))).toEqual(['Flake+Flake']);
    expect(status(w, 'Snowflake').pairCount).toBe(1);
    expect(status(world({ dragons: cast, owned: ['Cold'] }), 'Snowflake').reason).toEqual({
      kind: 'missing-elements',
      elements: ['Snowflake'],
    });
  });

  it('anyPair passes for any two parents, but still not for opposite primaries', () => {
    const w = world({ dragons: [...primaries(), motley()], owned: ['Plant', 'Metal'] });
    expect(pairNames(validPairs(w, routeOf(w, 'Motley'), 'normal'))).toEqual(['Plant+Plant', 'Metal+Metal']);
    expect(status(w, 'Motley')).toMatchObject({ met: true, pairCount: 2 });
  });

  it('never uses a Dragon that cannot be a parent', () => {
    const ruby = dragon({ name: 'Ruby', rarity: 'Gemstone', elements: ['Gemstone', 'Fire'], canBeParent: false });
    const w = world({ dragons: [...primaries(), ruby, dragon({ name: 'Lava', elements: ['Fire', 'Earth'] })], owned: ['Ruby', 'Earth'] });
    expect(status(w, 'Lava').reason).toEqual({ kind: 'missing-elements', elements: ['Fire'] });
  });

  it('a primary breeds only from itself: Lava + Plant make no Fire', () => {
    const w = world({ dragons: [...primaries(), lava(), blueFire()], owned: ['Lava', 'Plant'] });
    expect(status(w, 'Fire')).toEqual({ met: false, pairCount: 0, reason: { kind: 'needs-owned', dragon: 'Fire' } });
    expect([...validPairs(w, routeOf(w, 'Fire'), 'normal')]).toEqual([]);
    expect(breedableNow(w, 'normal').has('Fire')).toBe(false);
    // Even with nothing owned, the reason is the missing Fire.
    expect(status(world({ dragons: primaries() }), 'Fire').reason).toEqual({ kind: 'needs-owned', dragon: 'Fire' });
  });

  it('a primary breeds from itself plus itself or an opposite hybrid carrying its Element', () => {
    const w = world({ dragons: [...primaries(), lava(), blueFire()], owned: ['Fire', 'Blue Fire'] });
    expect(status(w, 'Fire')).toMatchObject({ met: true, pairCount: 2 });
    expect(pairNames(validPairs(w, routeOf(w, 'Fire'), 'normal')).sort()).toEqual(['Fire+Blue Fire', 'Fire+Fire']);
    // Fire is owned, so it still isn't Breedable now.
    expect(breedableNow(w, 'normal').has('Fire')).toBe(false);
    // Blue Fire carries Cold too, but Cold isn't owned: no Cold.
    expect(status(w, 'Cold').reason).toEqual({ kind: 'needs-owned', dragon: 'Cold' });
  });

  it("a primary's partner is never an opposite primary or a hybrid that isn't opposite", () => {
    const w = world({ dragons: [...primaries(), lava(), blueFire()], owned: ['Fire', 'Cold', 'Lava'] });
    expect(pairNames(validPairs(w, routeOf(w, 'Fire'), 'normal'))).toEqual(['Fire+Fire']);
    expect(pairNames(validPairs(w, routeOf(w, 'Cold'), 'normal'))).toEqual(['Cold+Cold']);
  });

  it('an opposite hybrid with Rift still counts, ignoring Rift', () => {
    const fever = riftDragon({ name: 'Fever', elements: ['Cold', 'Fire'], trait: 'Cold' });
    const w = world({ dragons: [...primaries(), fever], owned: ['Cold', 'Fever'] });
    expect(pairNames(validPairs(w, routeOf(w, 'Cold'), 'normal')).sort()).toEqual(['Cold+Cold', 'Cold+Fever']);
  });

  it('says when no owned Dragon counts as a parent', () => {
    expect(status(world({ dragons: [...primaries(), flower()] }), 'Flower').reason).toEqual({ kind: 'no-parents' });
  });

  it('counts and lists the same pairs as checking every pair by hand', () => {
    const cast = realCast();
    const w = world({ dragons: cast, owned: cast.filter((d) => d.canBeParent).map((d) => d.name) });
    const requirements: Requirement[] = [
      { elements: ['Fire'] },
      { elements: ['Plant', 'Metal'] },
      { elements: ['Air', 'Fire', 'Plant'] },
      { minDistinctElements: 4 },
      { minDistinctElements: 6, elements: ['Cold'] },
      { elementOnBothParents: 'Fire', elements: ['Earth'] },
      { anyPair: true },
      { parents: ['Lava'], elements: ['Cold'] },
      { parents: ['Plant', 'Metal'] },
      { parents: ['Fire'], partner: 'self-or-opposite-hybrid' },
      { parents: ['Plant'], partner: 'self-or-opposite-hybrid' },
      {},
    ];
    for (const requirement of requirements) {
      const route = bred(requirement);
      const listed = [...validPairs(w, route, 'normal')].map(pairKey);
      const expected = bruteForce(w.parents.normal.dragons, requirement).map((p) => pairKey(p));
      expect(new Set(listed), JSON.stringify(requirement)).toEqual(new Set(expected));
      expect(listed.length).toBe(expected.length);
      expect(routeStatus(w, cast[0]!, route, 'normal').pairCount).toBe(expected.length);
    }
  });
});

/** A pair as an order-free key. */
const pairKey = ([a, b]: readonly [{ name: string }, { name: string }]) => [a.name, b.name].sort().join('+');

/** Every unordered pair (same Dragon twice included) meeting `req`, the slow way. */
function bruteForce(parents: readonly Dragon[], req: Requirement): Pair[] {
  const opposite = new Set(['Plant|Metal', 'Metal|Plant', 'Fire|Cold', 'Cold|Fire', 'Earth|Air', 'Air|Earth', 'Lightning|Water', 'Water|Lightning', 'Light|Dark', 'Dark|Light']);
  const out: Pair[] = [];
  for (let i = 0; i < parents.length; i++) {
    for (let j = i; j < parents.length; j++) {
      const a = parents[i]!;
      const b = parents[j]!;
      if (a.rarity === 'Primary' && b.rarity === 'Primary' && opposite.has(`${a.name}|${b.name}`)) continue;
      const pool = new Set([...a.breedingElements, ...b.breedingElements]);
      const names = req.parents ?? [];
      if (names.length === 2 && !((names[0] === a.name && names[1] === b.name) || (names[0] === b.name && names[1] === a.name))) continue;
      if (names.length === 1 && a.name !== names[0] && b.name !== names[0]) continue;
      if (req.partner) {
        const [named, other] = a.name === names[0] ? [a, b] : [b, a];
        const hybrid = other.elements.filter((e) => e !== 'Rift');
        const fits =
          other === named ||
          (hybrid.length === 2 && opposite.has(hybrid.join('|')) && named.elements.every((e) => hybrid.includes(e)));
        if (!fits) continue;
      }
      if (!(req.elements ?? []).every((e) => pool.has(e))) continue;
      if (req.minDistinctElements !== undefined && pool.size < req.minDistinctElements) continue;
      const both = req.elementOnBothParents;
      if (both !== undefined && !(a.breedingElements.includes(both) && b.breedingElements.includes(both))) continue;
      out.push([a, b]);
    }
  }
  return out;
}

describe('which parents count', () => {
  const cast = () => [...primaries(), dragon({ name: 'Lava', elements: ['Fire', 'Earth'] })];

  it('a Rift form Target uses only Rift breeding parents', () => {
    const normalOnly = world({ dragons: cast(), owned: { Fire: true, Earth: true } });
    expect(status(normalOnly, 'Lava', 'normal').met).toBe(true);
    expect(status(normalOnly, 'Lava', 'rift').reason).toEqual({ kind: 'no-parents' });

    const lavaRift = world({ dragons: [...cast(), dragon({ name: 'Magma', elements: ['Fire'] })], owned: { Lava: 'rift', Magma: 'normal' } });
    expect(pairNames(validPairs(lavaRift, routeOf(lavaRift, 'Lava'), 'rift'))).toEqual(['Lava+Lava']);
    expect(pairNames(validPairs(lavaRift, routeOf(lavaRift, 'Lava'), 'normal'))).toEqual(['Lava+Lava', 'Lava+Magma']);
  });

  it('Normal breeding counts Rift forms and Rift dragons as parents', () => {
    const w = world({ dragons: [...cast(), kampos()], owned: { Kampos: true, Fire: true } });
    const pool = dragon({ name: 'Steam', elements: ['Fire', 'Water'] });
    const w2 = world({ dragons: [...cast(), kampos(), pool], owned: { Kampos: true, Fire: true } });
    expect(status(w, 'Lava').met).toBe(false);
    expect(status(w2, 'Steam')).toMatchObject({ met: true, pairCount: 1 });
  });

  it('a rift: "only" Route uses Rift breeding parents whatever form is asked', () => {
    const cast = realCast();
    const owned: Owned = { 'Blue Fire': 'normal', Plasma: 'rift' };
    const w = world({ dragons: cast, owned });
    expect(status(w, 'Zaffer', 'rift').reason).toEqual({ kind: 'missing-parents', dragons: ['Blue Fire'] });
    expect(status(w, 'Zaffer', 'normal').reason).toEqual({ kind: 'missing-parents', dragons: ['Blue Fire'] });
    const both = world({ dragons: cast, owned: { 'Blue Fire': 'rift', Plasma: 'rift' } });
    expect(status(both, 'Zaffer', 'rift')).toMatchObject({ met: true, pairCount: 1 });
  });
});

describe('other Route kinds', () => {
  it('a Co-op bred Route is met by any owned parent and counts them', () => {
    const w = world({ dragons: [...primaries(), nebula()], owned: ['Fire', 'Plant'] });
    expect(status(w, 'Nebula')).toEqual({ met: true, pairCount: 2, reason: { kind: 'met' } });
    expect(pairNames(validPairs(w, routeOf(w, 'Nebula'), 'normal'))).toEqual(['Nebula+Plant', 'Nebula+Fire']);
    expect(status(w, 'Nebula', 'rift').reason).toEqual({ kind: 'normal-form-only' });
    expect(status(world({ dragons: [...primaries(), nebula()] }), 'Nebula').reason).toEqual({ kind: 'no-parents' });
  });

  it('an Evolved Route is met when the base Dragon is owned; Summoned and Purchased never', () => {
    const ghostly = dragon({ name: 'Ghostly Fire', traits: 'none', routes: [evolved('Fire', ['Effigy'])] });
    const kairos = dragon({ name: 'Kairos', rarity: 'Legendary', traits: 'none', routes: [summoned(['Chronolith'])] });
    const w = world({ dragons: [...primaries(), ghostly, kairos], owned: ['Plant'] });
    expect(status(w, 'Ghostly Fire').reason).toEqual({ kind: 'missing-parents', dragons: ['Fire'] });
    expect(status(world({ dragons: [...primaries(), ghostly], owned: ['Fire'] }), 'Ghostly Fire').met).toBe(true);
    expect(status(w, 'Kairos').reason).toEqual({ kind: 'not-bred' });
    expect(status(w, 'Fire', 'normal', 1).reason).toEqual({ kind: 'not-bred' });
  });
});

describe('Breeding caves', () => {
  const galaxyCast = () => [...primaries(), flower(), nebula(), solarflare(), solis(), kampos()];

  it('the Normal cave never makes Rift dragons or Galaxy, except Solis, Lunis and Rigel', () => {
    const [nebulaD, solarflareD, solisD, kamposD] = [nebula(), solarflare(), solis(), kampos()];
    expect(caveCanMake(kamposD, 'normal')).toBe(false);
    expect(caveForm(kamposD, 'normal')).toBeNull();
    expect(caveCanMake(nebulaD, 'normal')).toBe(false);
    expect(caveCanMake(solarflareD, 'normal')).toBe(false);
    expect(caveCanMake(solisD, 'normal')).toBe(true);
    expect(caveCanMake(primary('Fire'), 'normal')).toBe(true);

    const w = world({ dragons: galaxyCast(), owned: ['Flower', 'Water', 'Air'] });
    const normal = breedableNow(w, 'normal');
    expect(normal.has('Solis')).toBe(true);
    expect(normal.has('Solarflare')).toBe(false);
    expect(normal.has('Nebula')).toBe(false);
    expect(normal.has('Kampos')).toBe(false);
  });

  it('the Co-op cave makes Galaxy through Co-op bred and ordinary Bred Routes', () => {
    const w = world({ dragons: galaxyCast(), owned: ['Flower'] });
    const coopCave = breedableNow(w, 'coop');
    expect(coopCave.has('Nebula')).toBe(true);
    expect(coopCave.has('Solarflare')).toBe(true);
    expect(coopCave.has('Kampos')).toBe(false);
    expect(caveCanMake(nebula(), 'coop')).toBe(true);
  });

  it('the Rift cave makes Rift forms and Rift dragons from Rift breeding parents', () => {
    expect(caveForm(flower(), 'rift')).toBe('rift');
    expect(caveForm(primary('Fire'), 'rift')).toBeNull();
    expect(caveCanMake(nebula(), 'rift')).toBe(false);
    const w = world({ dragons: galaxyCast(), owned: { Flower: 'rift', Kampos: true } });
    // Rift parents: the Rift form Flower and Kampos. Primaries have no Rift form;
    // Nebula has only a Co-op bred Route; Flower and Kampos are owned.
    expect([...breedableNow(w, 'rift')].sort()).toEqual(['Solarflare', 'Solis']);
    const w2 = world({ dragons: [...galaxyCast(), dragon({ name: 'Mist', elements: ['Water', 'Air'] })], owned: { Mist: 'rift' } });
    expect(breedableNow(w2, 'rift').has('Kampos')).toBe(true);
    expect(breedableNow(world({ dragons: w2.snapshot.dragons, owned: { Mist: 'normal' } }), 'rift').has('Kampos')).toBe(false);
  });
});

describe('Breedable now', () => {
  it('excludes Dragons owned in the form the cave makes', () => {
    const lava = dragon({ name: 'Lava', elements: ['Fire', 'Earth'] });
    const w = world({ dragons: [...primaries(), lava], owned: { Fire: true, Earth: true, Lava: 'normal' } });
    expect(breedableNow(w, 'normal').has('Lava')).toBe(false);
    expect(breedableNow(w, 'normal').has('Fire')).toBe(false);
    expect(breedableNow(w, 'normal').has('Earth')).toBe(false);
    // Owned only as a Rift form: not Breedable now in the Rift cave, still is in the Normal one.
    const rift = world({ dragons: [...primaries(), lava], owned: { Lava: 'rift' } });
    expect(breedableNow(rift, 'rift').has('Lava')).toBe(false);
    expect(breedableNow(rift, 'normal').has('Lava')).toBe(true);
  });

  it('never includes a primary that is not owned, even when a pair carries its Element', () => {
    const w = world({ dragons: [...primaries(), dragon({ name: 'Lava', elements: ['Fire', 'Earth'] })], owned: ['Lava'] });
    expect([...breedableNow(w, 'normal')]).toEqual([]);
  });

  it('excludes Purchase only and not Available Dragons', () => {
    const haystack = limited({ name: 'Haystack', elements: ['Plant', 'Fire'] });
    const love = limited({ name: 'Love', elements: ['Plant', 'Fire'] });
    const ember = limited({ name: 'Ember', elements: ['Plant', 'Fire'] });
    const dragons = [...primaries(), flower(), haystack, love, ember];
    const w = world({
      dragons,
      owned: ['Flower'],
      overlay: { rotation: ['Love'], events: [{ ends: TOMORROW, shop: [{ dragon: 'Haystack', breedable: false }] }] },
    });
    const now = breedableNow(w, 'normal');
    expect(now.has('Love')).toBe(true);
    expect(now.has('Haystack')).toBe(false);
    expect(now.has('Ember')).toBe(false);
  });

  it('excludes Evolved and Summoned Dragons', () => {
    const ghostly = dragon({ name: 'Ghostly Fire', traits: 'none', routes: [evolved('Fire', ['Effigy'])] });
    const kairos = dragon({ name: 'Kairos', rarity: 'Legendary', traits: 'none', routes: [summoned(), purchased()] });
    const w = world({ dragons: [...primaries(), ghostly, kairos], owned: ['Fire'] });
    expect(breedableNow(w, 'normal').has('Ghostly Fire')).toBe(false);
    expect(breedableNow(w, 'normal').has('Kairos')).toBe(false);
  });

  it('a limited parent that is owned is usable even when not Available', () => {
    const love = limited({ name: 'Love', elements: ['Plant', 'Light'] });
    const wrath = dragon({ name: 'Wrath', elements: ['Fire'], routes: [bred({ parents: ['Love'], elements: ['Fire'] })] });
    const w = world({ dragons: [...primaries(), love, wrath], owned: ['Love', 'Fire'] });
    expect(breedableNow(w, 'normal').has('Wrath')).toBe(true);
  });

  it('returns the same Set for the same World and cave', () => {
    const w = world({ owned: ['Fire'] });
    expect(breedableNow(w, 'normal')).toBe(breedableNow(w, 'normal'));
  });
});

describe('basicDragon', () => {
  it('is the carrier with the fewest breeding Elements, ties to the lowest order', () => {
    const w = world({ dragons: realCast() });
    expect(basicDragon(w, 'Plant')?.name).toBe('Plant');
    expect(basicDragon(w, 'Sun')?.name).toBe('Sun');
    expect(basicDragon(w, 'Unknown')).toBeNull();
    const tie = world({
      dragons: [dragon({ name: 'Later', order: 5, elements: ['Fire', 'Odd'] }), dragon({ name: 'Earlier', order: 2, elements: ['Earth', 'Odd'] })],
    });
    expect(basicDragon(tie, 'Odd')?.name).toBe('Earlier');
  });

  it('prefers a Dragon that can be a parent', () => {
    const ruby = dragon({ name: 'Ruby', order: 1, rarity: 'Gemstone', elements: ['Gem'], canBeParent: false });
    const shiny = dragon({ name: 'Shiny', order: 2, elements: ['Gem', 'Fire'] });
    expect(basicDragon(world({ dragons: [ruby, shiny] }), 'Gem')?.name).toBe('Shiny');
    expect(basicDragon(world({ dragons: [ruby] }), 'Gem')?.name).toBe('Ruby');
  });
});

describe('wouldBeValidPair', () => {
  it('checks two Dragons against a Requirement whoever owns them', () => {
    const w = world({ dragons: [...primaries(), ironwood(), chrome(), moss()] });
    const d = (name: string) => w.dragons.get(name)!;
    const plantMetal: Requirement = { elements: ['Plant', 'Metal'] };

    expect(wouldBeValidPair(w, plantMetal, d('Plant'), d('Chrome'))).toBe(true);
    expect(wouldBeValidPair(w, plantMetal, d('Plant'), d('Metal'))).toBe(false); // opposites
    expect(wouldBeValidPair(w, plantMetal, d('Plant'), d('Moss'))).toBe(false); // no Metal
    expect(wouldBeValidPair(w, { parents: ['Moss'], elements: ['Metal'] }, d('Chrome'), d('Moss'))).toBe(true);
    expect(wouldBeValidPair(w, { parents: ['Moss'], elements: ['Metal'] }, d('Chrome'), d('Metal'))).toBe(false);
    expect(wouldBeValidPair(w, { parents: ['Moss', 'Chrome'] }, d('Chrome'), d('Moss'))).toBe(true);
    expect(wouldBeValidPair(w, { parents: ['Moss', 'Chrome'] }, d('Moss'), d('Moss'))).toBe(false);
  });

  it("follows a primary's partner rule: itself, or an opposite hybrid carrying its Element", () => {
    const w = world({ dragons: [...primaries(), ironwood(), chrome(), moss()] });
    const d = (name: string) => w.dragons.get(name)!;
    const req = (name: string) => (routeOf(w, name) as Route & { kind: 'bred' }).requirement;
    expect(wouldBeValidPair(w, req('Plant'), d('Plant'), d('Plant'))).toBe(true);
    expect(wouldBeValidPair(w, req('Plant'), d('Ironwood'), d('Plant'))).toBe(true);
    expect(wouldBeValidPair(w, req('Metal'), d('Metal'), d('Ironwood'))).toBe(true);
    expect(wouldBeValidPair(w, req('Plant'), d('Plant'), d('Moss'))).toBe(false); // not an opposite hybrid
    expect(wouldBeValidPair(w, req('Plant'), d('Ironwood'), d('Ironwood'))).toBe(false); // no Plant Dragon
    expect(wouldBeValidPair(w, req('Plant'), d('Plant'), d('Metal'))).toBe(false); // opposites
  });
});
