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

/** A World owning exactly `names`, in normal form. */
function named(names: string[]) {
  const entries: CollectionBlob['entries'] = Object.fromEntries(names.map((n) => [n, { normal: true, rift: false }]));
  const blob: CollectionBlob = { formatVersion: FORMAT_VERSION, snapshotRevision: snapshot.meta.revision, entries };
  return buildWorld(snapshot, load(blob, snapshot).collection, noOverlay, NOW);
}

const dragonNamed = (name: string) => snapshot.dragons.find((d) => d.name === name)!;

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

  it('breeds a primary only from one already owned (Module:BreedingSandbox primary_dragons_rule)', () => {
    const fire = dragonNamed('Fire');
    const fireRoute = fire.routes.find((r) => r.kind === 'bred')!;

    // Lava + Plant carry Fire, but no Fire is owned: no Fire.
    const lavaPlant = named(['Lava', 'Plant']);
    expect(routeStatus(lavaPlant, fire, fireRoute, 'normal')).toEqual({
      met: false,
      pairCount: 0,
      reason: { kind: 'needs-owned', dragon: 'Fire' },
    });
    expect(breedableNow(lavaPlant, 'normal').has('Fire')).toBe(false);

    // Fire + Blue Fire: Fire + Fire and Fire + Blue Fire. Fire is owned, so still not Breedable now.
    const fireBlueFire = named(['Fire', 'Blue Fire']);
    expect(routeStatus(fireBlueFire, fire, fireRoute, 'normal')).toMatchObject({ met: true, pairCount: 2 });
    expect(breedableNow(fireBlueFire, 'normal').has('Fire')).toBe(false);
    expect(routeStatus(named(['Fire', 'Frostfire', 'Lava']), fire, fireRoute, 'normal').pairCount).toBe(2);
  });

  it('never makes a basic primary Breedable now through its Bred Route, whatever is owned', () => {
    const primaries = snapshot.dragons.filter((d) => d.rarity === 'Primary').map((d) => d.name);
    expect(primaries).toHaveLength(10);
    for (const cave of ['normal', 'rift', 'coop'] as const) {
      const breedable = breedableNow(worldOwning(400), cave);
      // Air's own Route is Water + Fire; the other 9 need themselves.
      expect(primaries.filter((p) => p !== 'Air' && breedable.has(p)), cave).toEqual([]);
    }
  });
});
