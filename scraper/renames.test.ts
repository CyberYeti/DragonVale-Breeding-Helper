import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Dragon, type Snapshot } from '../src/lib/snapshot';
import { applyRenames, compareWithPrevious, confirmRenames, type RenameCandidate } from './renames';

const dragon = (name: string, order: number): Dragon => ({
  name,
  wikiPage: `${name} Dragon`,
  rarity: 'Primary',
  order,
  elements: ['Fire'],
  breedingElements: ['Fire'],
  isLimited: false,
  traits: { kind: 'none' },
  canBeParent: true,
  image: null,
  routes: [],
});

const snapshot = (dragons: Dragon[], renames: Record<string, string> = {}): Snapshot => ({
  meta: {
    schemaVersion: SCHEMA_VERSION,
    revision: 'r1',
    source: 'https://dragonvale.fandom.com',
    license: 'CC BY-SA 3.0',
    pageRevisions: {},
    fetchedAt: '2026-10-01T00:00:00.000Z',
  },
  elements: [{ name: 'Fire', kind: 'primary', icon: null }],
  opposites: [],
  dragons,
  pages: [],
  renames,
});

describe('compareWithPrevious', () => {
  it('finds nothing without a previous snapshot', () => {
    expect(compareWithPrevious(null, [dragon('Fire', 1)])).toEqual({ added: [], removed: [], renameCandidates: [] });
  });

  it('finds a rename under the same order', () => {
    const previous = snapshot([dragon('Fire', 1), dragon('Flame', 2)]);
    const changes = compareWithPrevious(previous, [dragon('Fire', 1), dragon('Blaze', 2), dragon('Ember', 3)]);
    expect(changes.removed).toEqual(['Flame']);
    expect(changes.added).toEqual(['Blaze', 'Ember']);
    expect(changes.renameCandidates).toEqual([{ from: 'Flame', to: 'Blaze', reason: 'same-order' }]);
  });

  it('offers one removed and one added as a pair, even when the order changed', () => {
    const previous = snapshot([dragon('Fire', 1), dragon('Flame', 2)]);
    const changes = compareWithPrevious(previous, [dragon('Fire', 1), dragon('Blaze', 7)]);
    expect(changes).toEqual({
      added: ['Blaze'],
      removed: ['Flame'],
      renameCandidates: [{ from: 'Flame', to: 'Blaze', reason: 'only-change' }],
    });
  });

  it('offers the one-each pair only once when it also shares the order', () => {
    const changes = compareWithPrevious(snapshot([dragon('Flame', 2)]), [dragon('Blaze', 2)]);
    expect(changes.renameCandidates).toEqual([{ from: 'Flame', to: 'Blaze', reason: 'same-order' }]);
  });

  it("doesn't pair two removed and one added, but still lists them", () => {
    const previous = snapshot([dragon('Fire', 1), dragon('Flame', 2), dragon('Smoke', 3)]);
    const changes = compareWithPrevious(previous, [dragon('Fire', 1), dragon('Blaze', 9)]);
    expect(changes).toEqual({ added: ['Blaze'], removed: ['Flame', 'Smoke'], renameCandidates: [] });
  });

  it('finds nothing when the names are unchanged', () => {
    const previous = snapshot([dragon('Fire', 1)]);
    expect(compareWithPrevious(previous, [dragon('Fire', 4)])).toEqual({ added: [], removed: [], renameCandidates: [] });
  });
});

describe('confirmRenames', () => {
  const candidates: RenameCandidate[] = [
    { from: 'Flame', to: 'Blaze', reason: 'same-order' },
    { from: 'Smoke', to: 'Ash', reason: 'same-order' },
  ];

  it('asks about every candidate and keeps only the confirmed ones', async () => {
    const asked: string[] = [];
    const confirmed = await confirmRenames(candidates, async (c) => {
      asked.push(c.from);
      return c.from === 'Smoke';
    });
    expect(asked).toEqual(['Flame', 'Smoke']);
    expect(confirmed).toEqual([{ from: 'Smoke', to: 'Ash' }]);
  });

  it("doesn't ask about a name already used by a confirmed rename", async () => {
    const clashing: RenameCandidate[] = [
      { from: 'Flame', to: 'Blaze', reason: 'same-order' },
      { from: 'Flame', to: 'Ember', reason: 'same-order' },
      { from: 'Smoke', to: 'Blaze', reason: 'same-order' },
    ];
    const asked: RenameCandidate[] = [];
    const confirmed = await confirmRenames(clashing, async (c) => {
      asked.push(c);
      return true;
    });
    expect(asked).toEqual([clashing[0]]);
    expect(confirmed).toEqual([{ from: 'Flame', to: 'Blaze' }]);
  });

  it('asks nothing when there are no candidates', async () => {
    let asked = 0;
    const confirmed = await confirmRenames([], async () => {
      asked++;
      return true;
    });
    expect(asked).toBe(0);
    expect(confirmed).toEqual([]);
  });
});

describe('applyRenames', () => {
  it('adds confirmed pairs and keeps existing entries', () => {
    const before = snapshot([dragon('Blaze', 2)], { Spark: 'Flame', Old: 'Older' });
    const after = applyRenames(before, [{ from: 'Flame', to: 'Blaze' }]);
    expect(after.renames).toEqual({ Spark: 'Flame', Old: 'Older', Flame: 'Blaze' });
  });

  it("never overwrites an entry and doesn't change the snapshot it's given", () => {
    const before = snapshot([], { Flame: 'Blaze' });
    const after = applyRenames(before, [{ from: 'Flame', to: 'Ember' }]);
    expect(after.renames).toEqual({ Flame: 'Blaze' });
    expect(before.renames).toEqual({ Flame: 'Blaze' });
    expect(applyRenames(before, [{ from: 'Ash', to: 'Cinder' }]).renames).toEqual({ Flame: 'Blaze', Ash: 'Cinder' });
    expect(before.renames).toEqual({ Flame: 'Blaze' });
  });
});
