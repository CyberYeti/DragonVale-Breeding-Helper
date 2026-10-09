import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  currencyIconPath,
  loadSnapshot,
  type Route,
  type RouteKind,
  type Snapshot,
} from './index';

const snapshot = (schemaVersion: unknown) => ({
  meta: {
    schemaVersion,
    revision: 'r1',
    source: 'https://dragonvale.fandom.com',
    license: 'CC BY-SA 3.0',
    pageRevisions: { 'Data:Dragons.json': 1 },
    fetchedAt: '2026-10-05T00:00:00Z',
  },
  elements: [{ name: 'Fire', kind: 'primary', icon: null }],
  opposites: [['Fire', 'Cold']],
  dragons: [
    {
      name: 'Fire',
      wikiPage: 'Fire Dragon',
      rarity: 'Primary',
      order: 1,
      elements: ['Fire'],
      breedingElements: ['Fire'],
      isLimited: false,
      traits: { kind: 'none' },
      canBeParent: true,
      image: null,
      routes: [{ kind: 'bred', requirement: { elements: ['Fire'] } }, { kind: 'purchased' }],
    },
  ],
  pages: [{ name: 'Fire', group: 'elemental', dragons: ['Fire'], icon: null }],
  renames: {},
});

// Type-checked by `npm run check`: one of each Route the spec allows.
const everyRoute: Route[] = [
  { kind: 'bred', requirement: { elements: ['Fire', 'Earth'] } },
  { kind: 'bred', requirement: { parents: ['Fire Rift'] }, rift: 'only' },
  {
    kind: 'bred',
    requirement: { minDistinctElements: 4, elementOnBothParents: 'Water' },
    conditions: { time: 'Night', namedParentTraits: [{ dragon: 'Lava', trait: 'Fire' }] },
  },
  { kind: 'bred', requirement: { anyPair: true } },
  { kind: 'coop', friendsDragon: 'Nebula', conditions: { prerequisite: 'All Galaxy' } },
  { kind: 'evolved', from: 'Fire', decorations: ['Ghostly Shrine'] },
  { kind: 'summoned', artifacts: ['Clock'] },
  { kind: 'purchased' },
];

describe('Route', () => {
  it('covers the five kinds', () => {
    const kinds: Set<RouteKind> = new Set(everyRoute.map((r) => r.kind));
    expect([...kinds].sort()).toEqual(['bred', 'coop', 'evolved', 'purchased', 'summoned']);
  });
});

describe('loadSnapshot', () => {
  it('accepts the current schema version', () => {
    const json = snapshot(SCHEMA_VERSION);
    const loaded: Snapshot = loadSnapshot(json);
    expect(loaded).toEqual(json);
  });

  it('refuses a newer schema version, naming it', () => {
    const newer = SCHEMA_VERSION + 1;
    expect(() => loadSnapshot(snapshot(newer))).toThrow(`version ${newer} can't be read`);
  });

  it('refuses an older schema version, naming it', () => {
    const older = SCHEMA_VERSION - 1;
    expect(() => loadSnapshot(snapshot(older))).toThrow(`version ${older} can't be read`);
  });

  it('refuses a non-numeric schema version, naming it', () => {
    expect(() => loadSnapshot(snapshot('1'))).toThrow(`version "1" can't be read`);
  });

  it('refuses a missing schema version', () => {
    const json: { meta: { schemaVersion?: unknown } } = snapshot(SCHEMA_VERSION);
    delete json.meta.schemaVersion;
    expect(() => loadSnapshot(json)).toThrow(/no meta\.schemaVersion/);
  });

  it('refuses input with no meta at all', () => {
    expect(() => loadSnapshot({})).toThrow(/no meta\.schemaVersion/);
    expect(() => loadSnapshot(null)).toThrow(/no meta\.schemaVersion/);
    expect(() => loadSnapshot([])).toThrow(/no meta\.schemaVersion/);
  });
});

describe('currencyIconPath', () => {
  it('saves a currency under its name squashed and lower-cased', () => {
    expect(currencyIconPath('Candy')).toBe('images/currencies/candy.png');
    expect(currencyIconPath('Pine Cone')).toBe('images/currencies/pinecone.png');
  });
});
