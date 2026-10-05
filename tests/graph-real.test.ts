// core/graph's Focus view on the real snapshot, built from the committed raw pages.
// Lives outside src/lib/core because core may not import the scraper.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../scraper/build';
import { RAW_DIR, fetchPages } from '../scraper/pages';
import { breedableNow, caveForm, type Cave } from '../src/lib/core/breeding';
import { FORMAT_VERSION, formsOf, load, type CollectionBlob } from '../src/lib/core/collection';
import { focusTree, type GraphModel } from '../src/lib/core/graph';
import { buildWorld } from '../src/lib/core/world';

const raw = await fetchPages({ kind: 'offline', dir: join(import.meta.dirname, '..', RAW_DIR) });
const { snapshot } = buildSnapshot(raw, null);
const NOW = new Date(2026, 9, 5, 12);
const noOverlay = { rotation: [], events: [], notRecognised: [] };

/** A World owning every `step`-th Dragon that can be a parent, in every form. */
function worldOwningEvery(step: number) {
  const entries: CollectionBlob['entries'] = {};
  snapshot.dragons
    .filter((d) => d.canBeParent)
    .forEach((d, i) => {
      if (i % step === 0) entries[d.name] = { normal: true, rift: true };
    });
  const blob: CollectionBlob = { formatVersion: FORMAT_VERSION, snapshotRevision: snapshot.meta.revision, entries };
  return buildWorld(snapshot, load(blob, snapshot).collection, noOverlay, NOW);
}

function expectWellFormed(m: GraphModel) {
  const ids = new Set(m.nodes.map((n) => n.id));
  expect(ids.size).toBe(m.nodes.length);
  for (const e of m.edges) expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
}

describe('focusTree on the real snapshot', () => {
  const caves: Cave[] = ['normal', 'rift', 'coop'];

  for (const [label, w] of [
    ['an empty Collection', worldOwningEvery(Infinity)],
    ['a few owned', worldOwningEvery(7)],
  ] as const) {
    it(`builds every Target in every cave and form with ${label}`, () => {
      for (const cave of caves) {
        const breedable = breedableNow(w, cave);
        for (const dragon of snapshot.dragons) {
          for (const form of formsOf(dragon)) {
            const m = focusTree(w, { dragon: dragon.name, form }, cave);
            expectWellFormed(m);
            // The Target's reasons agree with core/breeding's Breedable now.
            if (caveForm(dragon, cave) === form) {
              expect(m.target!.breedableNow, `${dragon.name} (${form}) in ${cave}`).toBe(breedable.has(dragon.name));
            }
          }
        }
      }
    });
  }
});
