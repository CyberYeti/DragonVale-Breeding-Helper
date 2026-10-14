import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildSnapshot } from './build';
import { REAL_RECORDS_FILE, type RealRecords } from './fixture';
import { PAGE_TITLES, type RawPages } from './pages';
import { applyRenames, confirmRenames } from './renames';
import { needsReview } from './report';

// The scheduled refresh end to end, minus the files and the network: a wiki
// that renames, drops and adds Dragons in one go. Whether the committed
// snapshot is left alone is cli.ts's job; here, what each side of that
// decision sees.

const records: RealRecords = JSON.parse(await readFile(join(import.meta.dirname, '..', REAL_RECORDS_FILE), 'utf8'));

type WikiDragon = Record<string, unknown>;
const primary = (Name: string, Order: number): WikiDragon => ({ Name, Rarity: 'Primary', Order, Elements: ['Fire'] });

function rawPages(dragons: WikiDragon[]): RawPages {
  const content: Record<string, unknown> = {
    'Data:Dragons.json': { dragons },
    'Data:BreedingHints.json': { breedingHints: {} },
    'Data:Game.json': { elements: records.elements },
    'Data:Dragonarium.json': {
      dragonarium: [{ Collection: 'All', Dragons: dragons.map((d) => d.Name), Tags: ['all', 'special'] }],
    },
    'Data:Limited.json': {},
  };
  return {
    source: 'https://dragonvale.fandom.com',
    fetchedAt: '2026-10-01T00:00:00.000Z',
    pages: Object.fromEntries(
      PAGE_TITLES.map((t, i) => [t, { revision: 100 + i, content: JSON.stringify(content[t]) }]),
    ) as RawPages['pages'],
  };
}

const names = (snapshot: { dragons: { name: string }[] }) => snapshot.dragons.map((d) => d.name);

describe('a refresh that renames, loses and adds a Dragon', () => {
  // Flame became Blaze (same Order), Smoke is gone, Ember is new.
  const before = buildSnapshot(rawPages([primary('Fire', 1), primary('Flame', 2), primary('Smoke', 3)]), null).snapshot;
  const wiki = rawPages([primary('Fire', 1), primary('Blaze', 2), primary('Ember', 4)]);

  it('is reported against the old snapshot and needs a person', () => {
    const { report } = buildSnapshot(wiki, before);
    expect(report.added).toEqual(['Blaze', 'Ember']);
    expect(report.removed).toEqual(['Flame', 'Smoke']);
    expect(report.renameCandidates).toEqual([{ from: 'Flame', to: 'Blaze', reason: 'same-order' }]);
    expect(needsReview(report)).toBe(true);
  });

  it("would go unnoticed if the reviewer's run compared against the new snapshot", () => {
    // Why the review PR keeps the old snapshot.json: a snapshot already built
    // from the new data has no removals left to ask about.
    const refreshed = buildSnapshot(wiki, before).snapshot;
    const { report } = buildSnapshot(wiki, refreshed);
    expect(report.removed).toEqual([]);
    expect(report.renameCandidates).toEqual([]);
    expect(needsReview(report)).toBe(false);
  });

  it('records only the confirmed rename, and the next refresh then needs no review', async () => {
    const { snapshot, report } = buildSnapshot(wiki, before);
    const asked: string[] = [];
    const confirmed = await confirmRenames(report.renameCandidates, async ({ from }) => {
      asked.push(from);
      return true;
    });
    const merged = applyRenames(snapshot, confirmed);

    expect(asked).toEqual(['Flame']); // Smoke has no candidate: it is just gone
    expect(merged.renames).toEqual({ Flame: 'Blaze' });
    expect(names(merged)).toEqual(['Fire', 'Blaze', 'Ember']);

    expect(needsReview(buildSnapshot(wiki, merged).report)).toBe(false);
  });

  it('rejecting the rename keeps Flame out of `renames`', async () => {
    const { snapshot, report } = buildSnapshot(wiki, before);
    const confirmed = await confirmRenames(report.renameCandidates, async () => false);
    expect(applyRenames(snapshot, confirmed).renames).toEqual({});
  });
});

describe('a refresh that only adds Dragons', () => {
  it('needs no review', () => {
    const before = buildSnapshot(rawPages([primary('Fire', 1)]), null).snapshot;
    const { report } = buildSnapshot(rawPages([primary('Fire', 1), primary('Ember', 2)]), before);
    expect(report.added).toEqual(['Ember']);
    expect(needsReview(report)).toBe(false);
  });
});
