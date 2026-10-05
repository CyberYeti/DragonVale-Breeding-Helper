// core/breeding against the real snapshot, built from the committed raw pages.
// Lives outside src/lib/core because core may not import the scraper.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../scraper/build';
import { RAW_DIR, fetchPages } from '../scraper/pages';
import { breedableNow, routeStatus, type Cave } from '../src/lib/core/breeding';
import { FORMAT_VERSION, load, type CollectionBlob } from '../src/lib/core/collection';
import { buildWorld } from '../src/lib/core/world';

const raw = await fetchPages({ kind: 'offline', dir: join(import.meta.dirname, '..', RAW_DIR) });
const { snapshot } = buildSnapshot(raw, null);
const NOW = new Date(2026, 9, 5, 12);
const noOverlay = { rotation: [], events: [], notRecognised: [] };

/** A World owning `count` Dragons that can be parents, spread across the snapshot, in every form. */
function worldOwning(count: number) {
  const parents = snapshot.dragons.filter((d) => d.canBeParent);
  const step = parents.length / count;
  const entries: CollectionBlob['entries'] = {};
  for (let i = 0; i < count; i++) entries[parents[Math.floor(i * step)]!.name] = { normal: true, rift: true };
  const blob: CollectionBlob = { formatVersion: FORMAT_VERSION, snapshotRevision: snapshot.meta.revision, entries };
  return buildWorld(snapshot, load(blob, snapshot).collection, noOverlay, NOW);
}

describe('breeding on the real snapshot', () => {
  it('works out Breedable now for ~400 owned in well under a second', () => {
    const caves: Cave[] = ['normal', 'rift', 'coop'];
    for (const cave of caves) {
      const w = worldOwning(400); // fresh World: nothing cached
      expect(w.parents.normal.dragons.length).toBe(400);
      const start = performance.now();
      const result = breedableNow(w, cave);
      const elapsed = performance.now() - start;
      expect(result.size).toBeGreaterThan(0);
      expect(elapsed, `${cave} cave took ${elapsed.toFixed(0)} ms`).toBeLessThan(500);
    }
  });

  it('counts the Valid pairs of every Bred Route quickly', () => {
    const w = worldOwning(400);
    const start = performance.now();
    for (const dragon of snapshot.dragons) {
      for (const route of dragon.routes) routeStatus(w, dragon, route, 'normal');
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('meets real Routes the way the spec says', () => {
    const named = (names: string[]) => {
      const entries: CollectionBlob['entries'] = Object.fromEntries(names.map((n) => [n, { normal: true, rift: false }]));
      const blob: CollectionBlob = { formatVersion: FORMAT_VERSION, snapshotRevision: snapshot.meta.revision, entries };
      return buildWorld(snapshot, load(blob, snapshot).collection, noOverlay, NOW);
    };
    const seasonal = snapshot.dragons.find((d) => d.name === 'Seasonal')!;
    const bredRoute = seasonal.routes.find((r) => r.kind === 'bred')!;
    expect(routeStatus(named(['Air', 'Fire', 'Plant']), seasonal, bredRoute, 'normal').met).toBe(false);

    const ironwood = snapshot.dragons.find((d) => d.name === 'Ironwood')!;
    const ironwoodRoute = ironwood.routes.find((r) => r.kind === 'bred')!;
    expect(routeStatus(named(['Plant', 'Metal']), ironwood, ironwoodRoute, 'normal').reason).toEqual({
      kind: 'opposites',
      pair: ['Plant', 'Metal'],
    });
  });
});
