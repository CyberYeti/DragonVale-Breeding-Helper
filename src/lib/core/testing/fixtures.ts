// Test builders for core tests. Only *.test.ts files import this.
//
//   const w = world({
//     dragons: [...primaries(), dragon({ name: 'Lava', elements: ['Fire', 'Earth'] })],
//     owned: { Fire: true, Lava: 'rift' },
//     overlay: { rotation: ['Love'], events: [{ ends: '2026-10-07', shop: [{ dragon: 'Haystack', breedable: false }] }] },
//   });

import {
  SCHEMA_VERSION,
  type BredRoute,
  type Conditions,
  type CoopRoute,
  type Dragon,
  type Element,
  type ElementKind,
  type EvolvedRoute,
  type PurchasedRoute,
  type Requirement,
  type Snapshot,
  type SummonedRoute,
  type Traits,
} from '../../snapshot';
import { FORMAT_VERSION, load, type Collection, type CollectionBlob, type Form } from '../collection';
import type { EndDate, LimitedEvent, Overlay, RotationEntry, ShopEntry } from '../limited';
import { buildWorld, type World } from '../world';

// ---- Constants --------------------------------------------------------------

/** Local noon on 5 October 2026: the default `now`. */
export const NOW = new Date(2026, 9, 5, 12);

/** `NOW`'s local day, and the days either side, as EndDates. */
export const TODAY = '2026-10-05';
export const YESTERDAY = '2026-10-04';
export const TOMORROW = '2026-10-06';

/** The 10 primary Elements, in the game's order. */
export const PRIMARY_ELEMENTS = [
  'Plant', 'Fire', 'Earth', 'Cold', 'Lightning', 'Water', 'Air', 'Metal', 'Light', 'Dark',
] as const;

/** Spec §6: the five opposite primary pairs. */
export const OPPOSITES: [string, string][] = [
  ['Plant', 'Metal'],
  ['Fire', 'Cold'],
  ['Earth', 'Air'],
  ['Lightning', 'Water'],
  ['Light', 'Dark'],
];

// ---- Routes -----------------------------------------------------------------

/**
 * A Bred Route. Pass the required Elements as an array, or a full Requirement.
 * `bred(['Fire', 'Earth'])`, `bred({ parents: ['Water', 'Fire'] })`,
 * `bred({ parents: ['Blue Fire', 'Plasma'] }, { rift: 'only' })`.
 */
export function bred(
  requirement: Requirement | readonly string[],
  extra: { rift?: 'only'; conditions?: Conditions } = {},
): BredRoute {
  return {
    kind: 'bred',
    requirement: isElementList(requirement) ? { elements: [...requirement] } : { ...requirement },
    ...extra,
  };
}

export const coop = (friendsDragon: string, conditions?: Conditions): CoopRoute => ({
  kind: 'coop',
  friendsDragon,
  ...(conditions && { conditions }),
});

export const evolved = (from: string, decorations: string[] = []): EvolvedRoute => ({
  kind: 'evolved',
  from,
  decorations,
});

export const summoned = (artifacts: string[] = []): SummonedRoute => ({ kind: 'summoned', artifacts });

export const purchased = (): PurchasedRoute => ({ kind: 'purchased' });

// ---- Dragons ----------------------------------------------------------------

export type DragonSpec = Partial<Omit<Dragon, 'traits'>> & {
  name: string;
  /** A Traits value, or `'all'` / `'none'` for short. */
  traits?: Traits | 'all' | 'none';
};

let nextOrder = 1000;

/**
 * A Dragon with test defaults. Only `name` is needed:
 *
 * - `elements`: `[]`; `breedingElements`: the `elements`.
 * - `traits`: `'all'` (normal + Rift form); `rarity`: Hybrid; `canBeParent`: true.
 * - `routes`: a Bred Route needing the `breedingElements`, or Purchased if there are none.
 * - `order`: increasing in creation order, from 1000. Set it when ties matter.
 */
export function dragon(spec: DragonSpec): Dragon {
  const elements = spec.elements ?? [];
  const breedingElements = spec.breedingElements ?? elements;
  const traits = spec.traits ?? 'all';
  return {
    wikiPage: `${spec.name} Dragon`,
    rarity: 'Hybrid',
    order: nextOrder++,
    isLimited: false,
    canBeParent: true,
    image: null,
    routes: [breedingElements.length > 0 ? bred(breedingElements) : purchased()],
    ...spec,
    elements,
    breedingElements,
    traits: typeof traits === 'string' ? { kind: traits } : traits,
  };
}

/**
 * A Rift dragon: Elements include Rift, one fixed Trait, and (by default) a
 * `rift: 'only'` Bred Route needing its other Elements.
 */
export function riftDragon(spec: Omit<DragonSpec, 'traits'> & { trait: string }): Dragon {
  const { trait, ...rest } = spec;
  const elements = rest.elements ?? [];
  const withRift = elements.includes('Rift') ? elements : [...elements, 'Rift'];
  return dragon({
    rarity: 'Rare',
    routes: [bred(withRift.filter((e) => e !== 'Rift'), { rift: 'only' })],
    ...rest,
    elements: withRift,
    traits: { kind: 'fixed', element: trait },
  });
}

/**
 * A basic primary such as Fire: one form, Bred only from itself plus itself
 * or an opposite hybrid (`partner`), also Purchased. `order` follows
 * PRIMARY_ELEMENTS.
 */
export function primary(element: string, spec: Partial<DragonSpec> = {}): Dragon {
  const index = (PRIMARY_ELEMENTS as readonly string[]).indexOf(element);
  return dragon({
    name: element,
    rarity: 'Primary',
    order: index >= 0 ? index + 1 : nextOrder++,
    elements: [element],
    traits: 'none',
    routes: [bred({ parents: [element], partner: 'self-or-opposite-hybrid' }), purchased()],
    ...spec,
  });
}

/** The 10 basic primaries, fresh each call. */
export const primaries = (): Dragon[] => PRIMARY_ELEMENTS.map((e) => primary(e));

/** A limited Dragon: `dragon` with `isLimited: true`. */
export const limited = (spec: DragonSpec): Dragon => dragon({ ...spec, isLimited: true });

/**
 * The Dragons in fixtures/real-records.json, hand-mapped to snapshot Dragons
 * by the rules in spec §4: Lava, Rainbow, Zaffer, Sun, Gold Olympus,
 * Seasonal, Ironwood, Nebula, plus the 10 basic primaries, Blue Fire and
 * Plasma that their hints lean on. Fresh each call.
 *
 * This is a hand mapping, not the scraper's (core can't import the scraper).
 * Zaffer's trait requirement (RequiredDragonTraits Air + Metal) and its
 * "Rift" required Element are left out: only its named parents are kept.
 */
export function realCast(): Dragon[] {
  return [
    ...PRIMARY_ELEMENTS.map((e) =>
      e === 'Air'
        ? primary('Air', { order: 21, routes: [bred({ parents: ['Water', 'Fire'] }), purchased()] })
        : primary(e, { order: REAL_PRIMARY_ORDER[e] }),
    ),
    dragon({ name: 'Lava', order: 8, elements: ['Fire', 'Earth'], routes: [bred(['Earth', 'Fire'])] }),
    dragon({ name: 'Blue Fire', rarity: 'Rare', order: 27, elements: ['Fire', 'Cold'] }),
    dragon({ name: 'Plasma', rarity: 'Rare', order: 54, elements: ['Lightning', 'Water'] }),
    dragon({ name: 'Ironwood', rarity: 'Rare', order: 76, elements: ['Plant', 'Metal'] }),
    dragon({
      name: 'Rainbow',
      rarity: 'Epic',
      order: 26,
      elements: ['Rainbow'],
      breedingElements: [...PRIMARY_ELEMENTS, 'Rainbow'],
      routes: [bred({ minDistinctElements: 4 })],
    }),
    dragon({
      name: 'Sun',
      rarity: 'Epic',
      order: 32,
      elements: ['Sun'],
      breedingElements: ['Cold', 'Lightning', 'Sun'],
      routes: [bred(['Cold', 'Lightning'], { conditions: { time: 'Day' } })],
    }),
    dragon({
      name: 'Gold Olympus',
      rarity: 'Epic',
      order: 72,
      elements: ['Olympus'],
      breedingElements: ['Earth', 'Lightning', 'Olympus'],
      routes: [bred(['Earth', 'Lightning', 'Air'])],
    }),
    dragon({
      name: 'Seasonal',
      rarity: 'Epic',
      order: 74,
      elements: ['Seasonal'],
      breedingElements: ['Air', 'Fire', 'Plant', 'Seasonal'],
      routes: [bred(['Air', 'Fire', 'Plant'])],
    }),
    dragon({
      name: 'Nebula',
      rarity: 'Galaxy',
      order: 282,
      elements: ['Galaxy'],
      breedingElements: ['Air', 'Cold', 'Plant', 'Water', 'Galaxy'],
      routes: [coop('Nebula')],
    }),
    riftDragon({
      name: 'Zaffer',
      order: 382,
      elements: ['Cold', 'Lightning', 'Rift'],
      trait: 'Metal',
      routes: [bred({ parents: ['Blue Fire', 'Plasma'] }, { rift: 'only' })],
    }),
  ];
}

const REAL_PRIMARY_ORDER: Record<string, number> = {
  Plant: 1, Fire: 2, Earth: 5, Cold: 9, Lightning: 11, Water: 16, Air: 21, Metal: 43, Light: 129, Dark: 138,
};

// ---- Snapshot -----------------------------------------------------------------

const ELEMENT_KINDS: Record<string, ElementKind> = {
  ...Object.fromEntries(PRIMARY_ELEMENTS.map((e) => [e, 'primary' as const])),
  ...Object.fromEntries(
    ['Rainbow', 'Sun', 'Moon', 'Treasure', 'Olympus', 'Seasonal', 'Galaxy', 'Dream', 'Snowflake', 'Monolith'].map(
      (e) => [e, 'epic' as const],
    ),
  ),
  Gemstone: 'gem',
  Crystalline: 'gem',
  Mythic: 'mythic',
  Rift: 'rift',
};

/**
 * A Snapshot holding `dragons`. `elements` lists every Element the Dragons
 * display or carry; `opposites` are the real five. Override anything via `extra`.
 */
export function snapshot(dragons: Dragon[], extra: Partial<Snapshot> = {}): Snapshot {
  const names = new Set(dragons.flatMap((d) => [...d.elements, ...d.breedingElements]));
  const elements: Element[] = [...names].map((name) => ({ name, kind: ELEMENT_KINDS[name] ?? 'other', icon: null }));
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      revision: 'test',
      source: 'https://dragonvale.fandom.com',
      license: 'CC BY-SA 3.0',
      pageRevisions: {},
      fetchedAt: '2026-10-01T00:00:00Z',
    },
    elements,
    opposites: OPPOSITES.map(([a, b]) => [a, b]),
    dragons,
    pages: [],
    renames: {},
    ...extra,
  };
}

// ---- Collection ---------------------------------------------------------------

/** Which forms of a Dragon are owned. `true` = every form it has. */
export type OwnedForms = Form | 'both' | true;

/**
 * What the player owns: a list of names (every form owned), or Name →
 * forms. For a single-form Dragon any value means its one form is owned.
 */
export type Owned = Iterable<string> | Readonly<Record<string, OwnedForms>>;

/**
 * A Collection against `snap`, loaded through core/collection's `load`.
 * `owned` names must be snapshot Dragons (a typo throws); `orphans` are
 * names the snapshot doesn't know, kept as orphan entries.
 */
export function collection(snap: Snapshot, owned: Owned = [], orphans: Iterable<string> = []): Collection {
  const known = new Set(snap.dragons.map((d) => d.name));
  const entries: CollectionBlob['entries'] = {};
  for (const [name, forms] of ownedEntries(owned)) {
    if (!known.has(name)) throw new Error(`owned: no Dragon named ${name} in the snapshot`);
    entries[name] = {
      normal: forms === true || forms === 'both' || forms === 'normal',
      rift: forms === true || forms === 'both' || forms === 'rift',
    };
  }
  for (const name of orphans) {
    if (known.has(name)) throw new Error(`orphans: ${name} is in the snapshot`);
    entries[name] = { normal: true, rift: false };
  }
  const blob: CollectionBlob = { formatVersion: FORMAT_VERSION, snapshotRevision: snap.meta.revision, entries };
  return load(blob, snap).collection;
}

function ownedEntries(owned: Owned): [string, OwnedForms][] {
  if (typeof owned === 'string') return [[owned, true]];
  if (typeof (owned as Iterable<string>)[Symbol.iterator] === 'function') {
    return [...(owned as Iterable<string>)].map((name) => [name, true]);
  }
  return Object.entries(owned as Record<string, OwnedForms>);
}

// ---- Overlay ------------------------------------------------------------------

export type ShopSpec = { dragon: string; cost?: number | null; breedable?: boolean; ends?: EndDate };

export type EventSpec = {
  name?: string;
  ends?: EndDate;
  currency?: string | null;
  /** Names (breedable, the Event's end date) or full entries. */
  shop?: (string | ShopSpec)[];
};

export type OverlaySpec = {
  /** Names (no end date) or full entries. */
  rotation?: (string | RotationEntry)[];
  events?: EventSpec[];
  notRecognised?: string[];
};

/**
 * An Overlay, as parseLimited would give it. Shop entries default to
 * breedable, cost 1000 and the Event's end date. An Overlay passes through
 * unchanged, so `world({ overlay })` takes either.
 */
export function overlay(spec: OverlaySpec | Overlay = {}): Overlay {
  return {
    rotation: (spec.rotation ?? []).map((e) => (typeof e === 'string' ? { dragon: e, ends: null } : e)),
    events: (spec.events ?? []).map((e, i) => event(e, i)),
    notRecognised: spec.notRecognised ?? [],
    corrected: [],
  };
}

function event(spec: EventSpec, index: number): LimitedEvent {
  const ends = spec.ends ?? null;
  const shop = (spec.shop ?? []).map((s): ShopEntry => {
    const entry = typeof s === 'string' ? { dragon: s } : s;
    return {
      dragon: entry.dragon,
      cost: entry.cost === undefined ? 1000 : entry.cost,
      breedable: entry.breedable ?? true,
      ends: entry.ends ?? ends,
    };
  });
  const currency = spec.currency === undefined ? 'Spice' : spec.currency;
  return { name: spec.name ?? `Event ${index + 1}`, ends, currency, shop };
}

// ---- World --------------------------------------------------------------------

export type WorldSpec = {
  /** Default: the 10 basic primaries. */
  dragons?: Dragon[];
  /** Overrides the snapshot built from `dragons`. */
  snapshot?: Snapshot;
  owned?: Owned;
  orphans?: Iterable<string>;
  /** An Overlay or an OverlaySpec. Default: empty. */
  overlay?: Overlay | OverlaySpec;
  /** Default: NOW. */
  now?: Date;
};

/** A World built by `buildWorld` from test inputs. */
export function world(spec: WorldSpec = {}): World {
  const snap = spec.snapshot ?? snapshot(spec.dragons ?? primaries());
  const coll = collection(snap, spec.owned, spec.orphans);
  return buildWorld(snap, coll, overlay(spec.overlay), spec.now ?? NOW);
}

const isElementList = (value: Requirement | readonly string[]): value is readonly string[] => Array.isArray(value);
