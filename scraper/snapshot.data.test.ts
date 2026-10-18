import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { buildSnapshot } from './build';
import { fetchPages, PAGE_TITLES, RAW_DIR, readManifestRevisions, type RawPages } from './pages';

// The data tests: the only tests that read the committed raw pages, so the
// only ones the scheduled refresh runs (`npm run test:data`). The wiki adds
// Dragons and pages over time, so nothing here pins a count that grows with
// it. Each test states a rule the data must keep, however large it gets.
// (On 2026-10 the wiki had 986 Dragons and 52 pages; spec §8 and §4 give the
// expected shape.) Code tests use fixtures/real-records.json and made-up
// Dragons instead, and never see a refresh.

const rawDir = join(import.meta.dirname, '..', RAW_DIR);
const raw: RawPages = await fetchPages({ kind: 'offline', dir: rawDir });
const { snapshot, report } = buildSnapshot(raw, null);
const { dragons, pages } = snapshot;
const names = new Set(dragons.map((d) => d.name));
const primaryElements = (JSON.parse(raw.pages['Data:Game.json'].content) as { elements: { primary: string[] } }).elements
  .primary;

describe('the committed raw pages', () => {
  it('are read without network access, and every page parses', async () => {
    const noNetwork = vi.fn(() => {
      throw new Error('network used');
    });
    vi.stubGlobal('fetch', noNetwork);
    try {
      const again = await fetchPages({ kind: 'offline', dir: rawDir });
      expect(noNetwork).not.toHaveBeenCalled();
      expect(Object.keys(again.pages)).toEqual(PAGE_TITLES);
      for (const title of PAGE_TITLES) {
        expect(again.pages[title].revision).toBeGreaterThan(0);
        expect(() => JSON.parse(again.pages[title].content)).not.toThrow();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('match the revisions in pages.json', async () => {
    const committed = await readManifestRevisions(join(rawDir, 'pages.json'));
    for (const title of PAGE_TITLES) expect(committed[title]).toBe(raw.pages[title].revision);
  });
});

describe('the snapshot built from them', () => {
  it('holds a full game, not a truncated page', () => {
    // Floors well under the real counts: they catch a half-empty wiki page, not growth.
    expect(dragons.length).toBeGreaterThan(900);
    expect(pages.length).toBeGreaterThan(40);
    expect(primaryElements).toHaveLength(10);
  });

  it('gives every Dragon a Route, and every Route names known Dragons', () => {
    expect(dragons.filter((d) => d.routes.length === 0).map((d) => d.name)).toEqual([]);
    const unknown = dragons.flatMap((d) =>
      d.routes.flatMap((r) => {
        const named = r.kind === 'bred' ? (r.requirement.parents ?? []) : r.kind === 'evolved' ? [r.from] : [];
        return named.filter((n) => !names.has(n)).map((n) => `${d.name} → ${n}`);
      }),
    );
    expect(unknown).toEqual([]);
  });

  it('puts every page in one group, with one elemental page per primary Element', () => {
    const { elemental, epic, special } = report.counts.pages;
    expect(elemental + epic + special).toBe(pages.length);
    expect(elemental).toBe(primaryElements.length);
    expect(pages.find((p) => p.name === 'Rift')?.group).toBe('special');
  });

  it('lists only known Dragons on pages', () => {
    expect(pages.flatMap((p) => p.dragons.filter((n) => !names.has(n)).map((n) => `${p.name}: ${n}`))).toEqual([]);
  });

  it('keeps the Rift page, the Rift Element and fixed traits in step', () => {
    const rift = dragons.filter((d) => d.elements.includes('Rift')).map((d) => d.name).sort();
    expect(rift.length).toBeGreaterThan(0);
    expect([...(pages.find((p) => p.name === 'Rift')?.dragons ?? [])].sort()).toEqual(rift);
    expect(dragons.filter((d) => d.traits.kind === 'fixed').map((d) => d.name).sort()).toEqual(rift);
  });

  it('counts each Dragon once in the trait counts', () => {
    const { all, fixed, none } = report.counts.traits;
    expect(all + fixed + none).toBe(dragons.length);
  });

  it('sells the basic and Rift primaries, two per primary Element', () => {
    // Spec §4: Purchased are the 10 basic and 10 Rift primaries.
    expect(report.counts.routes.purchased).toBe(primaryElements.length * 2);
  });
});
