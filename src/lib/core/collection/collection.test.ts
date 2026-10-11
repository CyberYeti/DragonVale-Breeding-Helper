import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Dragon, type Snapshot, type Traits } from '../../snapshot';
import {
  CollectionLoadError,
  FORMAT_VERSION,
  exportBlob,
  isOwned,
  load,
  mark,
  previewImport,
  removeOrphans,
  ticks,
  toBlob,
  toggle,
  unmark,
  type Collection,
  type CollectionBlob,
  type MarkChoice,
} from './index';

const dragon = (name: string, traits: Traits['kind'] = 'all'): Dragon => ({
  name,
  wikiPage: `${name} Dragon`,
  rarity: 'Hybrid',
  order: 1,
  elements: ['Fire'],
  breedingElements: ['Fire'],
  isLimited: false,
  traits: traits === 'fixed' ? { kind: 'fixed', element: 'Fire' } : { kind: traits },
  canBeParent: true,
  image: null,
  routes: [{ kind: 'purchased' }],
});

// Lava has Rift form ticks, Fire (a primary) one normal tick, Kampos (a Rift dragon) one rift tick.
const lava = dragon('Lava', 'all');
const fire = dragon('Fire', 'none');
const kampos = dragon('Kampos', 'fixed');

const snap = (
  dragons: Dragon[] = [lava, fire, kampos],
  renames: Record<string, string> = {},
  revision = 'r2',
): Snapshot => ({
  meta: {
    schemaVersion: SCHEMA_VERSION,
    revision,
    source: 'https://dragonvale.fandom.com',
    license: 'CC BY-SA 3.0',
    pageRevisions: {},
    fetchedAt: '2026-10-01T00:00:00Z',
  },
  elements: [],
  opposites: [],
  dragons,
  pages: [],
  renames,
});

const blob = (
  entries: CollectionBlob['entries'],
  extra: Partial<CollectionBlob> = {},
): CollectionBlob => ({ formatVersion: FORMAT_VERSION, snapshotRevision: 'r1', entries, ...extra });

const N = { normal: true, rift: false };
const R = { normal: false, rift: true };
const B = { normal: true, rift: true };

const loaded = (entries: CollectionBlob['entries'], snapshot = snap()) =>
  load(blob(entries, { snapshotRevision: snapshot.meta.revision }), snapshot).collection;

describe('load', () => {
  it('gives an empty Collection on first run, with no notice', () => {
    const { collection, notice } = load(null, snap());
    expect(collection).toEqual({ snapshotRevision: 'r2', entries: {}, orphans: {} });
    expect(notice).toBeNull();
  });

  it('follows a rename chain A → B → C', () => {
    const s = snap([dragon('C')], { A: 'B', B: 'C' });
    const { collection, notice } = load(blob({ A: N }), s);
    expect(collection.entries).toEqual({ C: N });
    expect(notice?.renamed).toEqual([{ from: 'A', to: 'C' }]);
  });

  it('stops at a rename cycle instead of looping', () => {
    const s = snap([dragon('A')], { A: 'B', B: 'A' });
    expect(load(blob({ A: N }), s).collection.entries).toEqual({ A: N });
  });

  it('ORs the flags when a rename lands on an existing entry', () => {
    const s = snap([dragon('New')], { Old: 'New' });
    const { collection } = load(blob({ Old: R, New: N }), s);
    expect(collection.entries).toEqual({ New: B });
  });

  it("doesn't apply renames when the snapshot revision is unchanged", () => {
    const s = snap([dragon('Old'), dragon('New')], { Old: 'New' }, 'r1');
    const { collection, notice } = load(blob({ Old: N }), s);
    expect(collection.entries).toEqual({ Old: N });
    expect(notice).toBeNull();
  });

  it('sets orphans aside: kept, never owned', () => {
    const { collection, notice } = load(blob({ Lava: N, Gone: B }), snap());
    expect(collection.entries).toEqual({ Lava: N });
    expect(collection.orphans).toEqual({ Gone: B });
    expect(isOwned(collection, dragon('Gone'))).toBe(false);
    expect(notice).toEqual({ dataDate: '2026-10-01T00:00:00Z', renamed: [], orphans: ['Gone'] });
  });

  it('brings an orphan back once a rename covers it', () => {
    const first = load(blob({ Gone: N }), snap()).collection;
    const s = snap([lava, dragon('Back')], { Gone: 'Back' }, 'r3');
    const { collection } = load(toBlob(first), s);
    expect(collection.entries).toEqual({ Back: N });
    expect(collection.orphans).toEqual({});
  });

  it('keeps orphans through export, unchanged', () => {
    const { collection } = load(blob({ Lava: N, Gone: R }), snap());
    const { blob: out } = exportBlob(collection, new Date(2026, 9, 5));
    expect(out.entries).toEqual({ Lava: N, Gone: R });
  });

  it('gives a notice only when something changed', () => {
    // Same revision, nothing to do.
    expect(load(blob({ Lava: N }, { snapshotRevision: 'r2' }), snap()).notice).toBeNull();
    // New revision, but no renames or orphans.
    expect(load(blob({ Lava: N }), snap()).notice).toBeNull();
    // Same revision with an orphan already set aside: announced before, not again.
    expect(load(blob({ Gone: N }, { snapshotRevision: 'r2' }), snap()).notice).toBeNull();
    // New revision with a rename.
    const s = snap([dragon('New')], { Old: 'New' });
    expect(load(blob({ Old: N }), s).notice).toEqual({
      dataDate: '2026-10-01T00:00:00Z',
      renamed: [{ from: 'Old', to: 'New' }],
      orphans: [],
    });
  });

  it('stores the new snapshot revision', () => {
    expect(load(blob({ Lava: N }), snap()).collection.snapshotRevision).toBe('r2');
    expect(toBlob(load(blob({ Lava: N }), snap()).collection).snapshotRevision).toBe('r2');
  });

  it('keeps lastExported', () => {
    const c = load(blob({}, { lastExported: '2026-09-01T00:00:00.000Z' }), snap()).collection;
    expect(c.lastExported).toBe('2026-09-01T00:00:00.000Z');
  });

  it('refuses a newer formatVersion', () => {
    const newer = { ...blob({}), formatVersion: FORMAT_VERSION + 1 };
    expect(() => load(newer, snap())).toThrow(CollectionLoadError);
    try {
      load(newer, snap());
    } catch (e) {
      expect((e as CollectionLoadError).error.problem).toBe('newer-version');
    }
  });

  it('refuses something that isn\'t a Collection', () => {
    for (const raw of [42, [], {}, { formatVersion: 1 }, { ...blob({}), entries: { Lava: true } }]) {
      expect(() => load(raw, snap())).toThrow(/isn't a DragonVale Breeding Helper Collection/);
    }
  });
});

describe('previewImport', () => {
  const current = loaded({ Lava: N, Fire: N });

  it('names the problem: not JSON', () => {
    const r = previewImport('{oops', current, snap());
    expect(r).toEqual({ ok: false, error: { problem: 'not-json', message: "The file isn't JSON." } });
  });

  it('names the problem: not a Collection', () => {
    const r = previewImport('{"hello": 1}', current, snap());
    expect(r.ok === false && r.error.problem).toBe('not-collection');
  });

  it('names the problem: a newer version', () => {
    const r = previewImport(JSON.stringify({ ...blob({}), formatVersion: 99 }), current, snap());
    expect(r.ok === false && r.error.problem).toBe('newer-version');
    expect(r.ok === false && r.error.message).toMatch(/format 99/);
  });

  it('counts owned, changes, renames and orphans', () => {
    const s = snap([lava, fire, kampos, dragon('New')], { Old: 'New' });
    // File: Lava both (changed), Fire same, Old → New (new), Kampos (new), Gone orphan.
    const file = blob({ Lava: B, Fire: N, Old: N, Kampos: R, Gone: N });
    const r = previewImport(JSON.stringify(file), loaded({ Lava: N, Fire: N }, s), s);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.summary).toMatchObject({
      fileOwned: 4,
      currentOwned: 2,
      wouldChange: 3,
      renamed: [{ from: 'Old', to: 'New' }],
      orphans: ['Gone'],
    });
    expect(r.summary.collection.entries).toEqual({ Lava: B, Fire: N, New: N, Kampos: R });
  });

  it('counts Dragons dropped by the import as changes', () => {
    const r = previewImport(JSON.stringify(blob({})), current, snap());
    expect(r.ok && r.summary.wouldChange).toBe(2);
  });

  it('accepts a backup made against a different snapshot', () => {
    const r = previewImport(JSON.stringify(blob({ Lava: N }, { snapshotRevision: 'r0' })), current, snap());
    expect(r.ok).toBe(true);
  });
});

describe('reading ownership by traits', () => {
  it('reads Normal and Rift form separately for traits: all', () => {
    const c = loaded({ Lava: R });
    expect(isOwned(c, lava, 'normal')).toBe(false);
    expect(isOwned(c, lava, 'rift')).toBe(true);
    expect(isOwned(c, lava)).toBe(true);
    expect(ticks(c, lava)).toEqual([
      { form: 'normal', owned: false },
      { form: 'rift', owned: true },
    ]);
  });

  it('reads a Rift dragon from rift and a none Dragon from normal', () => {
    const c = loaded({ Kampos: R, Fire: N });
    expect(ticks(c, kampos)).toEqual([{ form: 'rift', owned: true }]);
    expect(ticks(c, fire)).toEqual([{ form: 'normal', owned: true }]);
    expect(isOwned(c, kampos, 'normal')).toBe(false);
    expect(isOwned(c, fire, 'rift')).toBe(false);
  });

  it('reads owned = normal || rift when a shape change leaves an unshowable flag', () => {
    // Fire lost its Rift form; Kampos used to be a normal Dragon.
    const c = loaded({ Fire: R, Kampos: N });
    expect(ticks(c, fire)).toEqual([{ form: 'normal', owned: true }]);
    expect(ticks(c, kampos)).toEqual([{ form: 'rift', owned: true }]);
  });
});

describe('toggle', () => {
  it('flips one form of a traits: all Dragon', () => {
    const c = toggle(loaded({ Lava: N }), lava, 'rift');
    expect(c.entries).toEqual({ Lava: B });
    expect(toggle(c, lava, 'normal').entries).toEqual({ Lava: R });
  });

  it("writes a single-form Dragon's own flag", () => {
    expect(toggle(loaded({}), kampos, 'rift').entries).toEqual({ Kampos: R });
    expect(toggle(loaded({}), fire, 'normal').entries).toEqual({ Fire: N });
  });

  it('un-owns a single-form Dragon held by a leftover flag', () => {
    expect(toggle(loaded({ Fire: R }), fire, 'normal').entries).toEqual({});
  });

  it('ignores a form the Dragon has no tick for', () => {
    const c = loaded({});
    expect(toggle(c, fire, 'rift')).toBe(c);
  });

  it("doesn't change the Collection it was given", () => {
    const c = loaded({ Lava: N });
    toggle(c, lava, 'rift');
    expect(c.entries).toEqual({ Lava: N });
  });
});

describe('mark and unmark', () => {
  const all = ['Lava', 'Fire', 'Kampos'];
  const cases: [MarkChoice, Record<string, { normal: boolean; rift: boolean }>][] = [
    ['normal', { Lava: N, Fire: N }],
    ['rift', { Lava: R, Kampos: R }],
    ['both', { Lava: B, Fire: N, Kampos: R }],
  ];

  for (const [choice, expected] of cases) {
    it(`Mark ${choice} sets the right flag for every traits shape`, () => {
      expect(mark(loaded({}), all, choice, snap()).entries).toEqual(expected);
    });
  }

  const unmarked: [MarkChoice, Record<string, { normal: boolean; rift: boolean }>][] = [
    ['normal', { Lava: R, Kampos: R }],
    ['rift', { Lava: N, Fire: N }],
    ['both', {}],
  ];

  for (const [choice, expected] of unmarked) {
    it(`Unmark ${choice} clears the right flag for every traits shape`, () => {
      const full = loaded({ Lava: B, Fire: N, Kampos: R });
      expect(unmark(full, all, choice, snap()).entries).toEqual(expected);
    });
  }

  it('keeps flags it was not asked to touch', () => {
    expect(mark(loaded({ Lava: R }), ['Lava'], 'normal', snap()).entries).toEqual({ Lava: B });
  });

  it('only touches the named Dragons and skips unknown names', () => {
    const c = mark(loaded({ Fire: N }), ['Kampos', 'Nobody'], 'both', snap());
    expect(c.entries).toEqual({ Fire: N, Kampos: R });
  });

  it('clears a leftover flag when unmarking a single-form Dragon', () => {
    expect(unmark(loaded({ Fire: R }), ['Fire'], 'normal', snap()).entries).toEqual({});
  });
});

describe('orphans and export', () => {
  it('removeOrphans drops them and keeps the rest', () => {
    const { collection } = load(blob({ Lava: N, Gone: N }), snap());
    const c = removeOrphans(collection);
    expect(c.orphans).toEqual({});
    expect(toBlob(c).entries).toEqual({ Lava: N });
  });

  it('exportBlob sets lastExported and names the file by local date', () => {
    const now = new Date(2026, 9, 5, 14, 30);
    const before: Collection = loaded({ Lava: N });
    const { collection, blob: out, fileName } = exportBlob(before, now);
    expect(collection.lastExported).toBe(now.toISOString());
    expect(out).toEqual({
      formatVersion: FORMAT_VERSION,
      snapshotRevision: 'r2',
      entries: { Lava: N },
      lastExported: now.toISOString(),
    });
    expect(fileName).toBe('dragonvale-collection-2026-10-05.json');
    expect(before.lastExported).toBeUndefined();
  });

  it('round-trips through toBlob and load', () => {
    const { collection } = load(blob({ Lava: B, Kampos: R, Gone: N }), snap());
    expect(load(JSON.parse(JSON.stringify(toBlob(collection))), snap())).toEqual({
      collection,
      notice: null,
    });
  });
});
