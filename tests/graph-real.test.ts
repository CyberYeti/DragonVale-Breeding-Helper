// core/graph's Focus view on the real snapshot, built from the committed raw pages.
// Lives outside src/lib/core because core may not import the scraper.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../scraper/build';
import { RAW_DIR, fetchPages } from '../scraper/pages';
import { breedableNow, caveForm, type Cave } from '../src/lib/core/breeding';
import { FORMAT_VERSION, formsOf, load, type CollectionBlob } from '../src/lib/core/collection';
import { focusTree, pullTree, tabGraph, type DragonNode, type GraphModel } from '../src/lib/core/graph';
import { buildWorld } from '../src/lib/core/world';

const raw = await fetchPages({ kind: 'offline', dir: join(import.meta.dirname, '..', RAW_DIR) });
const { snapshot } = buildSnapshot(raw, null);
const NOW = new Date(2026, 9, 5, 12);
const noOverlay = { rotation: [], events: [], notRecognised: [], corrected: [] };

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

describe('tabGraph and pullTree on the real snapshot', () => {
  const caves: Cave[] = ['normal', 'rift', 'coop'];
  const largestPage = [...snapshot.pages].sort((a, b) => b.dragons.length - a.dragons.length)[0]!;
  const everyDragon = snapshot.dragons.map((d) => d.name);

  /** A Dragon's named parents and Evolved bases. */
  const needsOf = (name: string) =>
    snapshot.dragons
      .find((d) => d.name === name)!
      .routes.flatMap((r) => (r.kind === 'bred' ? (r.requirement.parents ?? []) : r.kind === 'evolved' ? [r.from] : []));
  /** Whether `from` needs `to`, directly or through its needs' needs. */
  function reaches(from: string, to: string): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const name = stack.pop()!;
      if (name === to) return true;
      if (seen.has(name)) continue;
      seen.add(name);
      stack.push(...needsOf(name));
    }
    return false;
  }

  for (const [label, names] of [
    [`the largest page (${largestPage.name}, ${largestPage.dragons.length})`, largestPage.dragons],
    [`every Dragon (${everyDragon.length})`, everyDragon],
  ] as const) {
    it(`builds ${label} in every cave and pulls trees out of it`, () => {
      const w = worldOwningEvery(7);
      for (const cave of caves) {
        const start = performance.now();
        const graph = tabGraph(w, names, cave);
        const elapsed = performance.now() - start;
        expectWellFormed(graph);
        expect(graph.members).toHaveLength(new Set(names).size);
        expect(elapsed, `${cave} cave took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);

        // No Dragon feeds its own Route pill (a basic primary breeds only from itself).
        const owners = new Map(graph.nodes.flatMap((n) => (n.kind === 'route' ? [[n.id, n.owner] as const] : [])));
        expect(graph.edges.filter((e) => owners.get(e.target) === e.source).map((e) => e.id)).toEqual([]);

        const dragons = graph.nodes.filter((n): n is DragonNode => n.kind === 'dragon');
        expect(dragons.every((n) => Number.isInteger(n.generation) && n.generation >= 1)).toBe(true);
        // Generations increase upward, except on an edge that closes a cycle (the Chrysalis family).
        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        for (const e of graph.edges) {
          const parent = byId.get(e.source);
          const pill = byId.get(e.target);
          if (parent?.kind !== 'dragon' || pill?.kind !== 'route') continue;
          const child = byId.get(pill.owner) as DragonNode;
          if (parent.generation < child.generation) continue;
          expect(reaches(parent.dragon, child.dragon), `${e.id} closes a cycle`).toBe(true);
        }

        for (const name of names.slice(0, 40)) {
          const node = graph.nodes.find((n) => n.kind === 'dragon' && n.dragon === name && graph.members.includes(n.id)) as DragonNode;
          const pulled = pullTree(graph, { dragon: name, form: node.form });
          expectWellFormed(pulled);
          const lit = pulled.nodes.filter((n) => n.pull === 'lit').map((n) => n.id);
          const focus = focusTree(w, { dragon: name, form: node.form }, cave);
          expect(new Set(lit)).toEqual(new Set(focus.nodes.map((n) => n.id)));
        }
      }
      // Each cave has its own 2s budget above; the sweep over every cave can
      // outgrow vitest's 5s default when the full suite runs in parallel.
    }, 30_000);
  }
});
