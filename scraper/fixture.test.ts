import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PAGE_TITLES, type RawPages } from './pages';
import { cutRealRecords, REAL_RECORD_NAMES, REAL_RECORDS_FILE, type RealRecords } from './fixture';

// fixtures/real-records.json is a frozen sample: the refresh doesn't re-cut
// it, so the code tests built on it don't move when the wiki does. Re-cut it
// by hand with `npm run snapshot -- --offline --fixture`.

const root = join(import.meta.dirname, '..');
const committed: RealRecords = JSON.parse(await readFile(join(root, REAL_RECORDS_FILE), 'utf8'));

/** Raw pages holding just the fixture's records, plus a Dragon nobody uses. */
function pagesFrom(records: RealRecords): RawPages {
  const content: Record<string, unknown> = {
    'Data:Dragons.json': {
      dragons: [...records.dragons, ...records.supporting.dragons, { Name: 'Unused', Rarity: 'Common' }],
    },
    'Data:BreedingHints.json': { breedingHints: { ...records.breedingHints, ...records.supporting.breedingHints } },
    'Data:Game.json': { elements: records.elements },
    'Data:Dragonarium.json': { dragonarium: [] },
    'Data:Limited.json': {},
  };
  return {
    source: records.source,
    fetchedAt: records.fetchedAt,
    pages: Object.fromEntries(
      PAGE_TITLES.map((t) => [t, { revision: records.pageRevisions[t], content: JSON.stringify(content[t]) }]),
    ) as RawPages['pages'],
  };
}

describe('fixtures/real-records.json', () => {
  it('is what cutRealRecords cuts from pages holding its records', () => {
    expect(cutRealRecords(pagesFrom(committed))).toEqual(committed);
  });

  it('holds the eight real Dragons with their hints, and every Dragon their hints name', () => {
    expect(committed.dragons.map((d) => d.Name)).toEqual([...REAL_RECORD_NAMES]);
    expect(Object.keys(committed.breedingHints).sort()).toEqual([...REAL_RECORD_NAMES].sort());

    const held = new Set([...committed.dragons, ...committed.supporting.dragons].map((d) => d.Name));
    const named = Object.values(committed.breedingHints).flatMap((h) => (h.RequiredDragons as string[] | undefined) ?? []);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((n) => !held.has(n))).toEqual([]);
    for (const e of committed.elements.primary as string[]) expect(held).toContain(e);
    expect(committed.elements.primary).toHaveLength(10);
  });

  it('fails to cut when a featured Dragon is missing', () => {
    const missing = { ...committed, dragons: committed.dragons.filter((d) => d.Name !== 'Zaffer') };
    expect(() => cutRealRecords(pagesFrom(missing))).toThrow(/no Dragon named Zaffer/);
  });
});
