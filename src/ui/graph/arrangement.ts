// A main graph's arrangement (spec §9): the nodes the player dragged
// somewhere else, saved per tab graph and cave as overrides on top of the
// automatic layout. Pure helpers for the storage key, the stored form and
// merging the overrides in; arrangement.svelte.ts keeps them in localStorage.

import type { Cave } from '../../lib/core/breeding';
import type { NodeId } from '../../lib/core/graph';
import type { Position } from '../../lib/core/layout';
import type { Tab } from '../../lib/core/menu';

/** Bumped when the stored form or the node ids change meaning; older arrangements are then ignored. */
export const ARRANGEMENT_VERSION = 1;

/** Moved nodes: where the player left each one. */
export type Moves = ReadonlyMap<NodeId, Position>;

/** Names a tab's graph: `page:<page>`, `all`, `breedable`, `limited` or `event`. */
export function tabGraphName(tab: Tab): string {
  return tab.kind === 'page' ? `page:${tab.page}` : tab.kind;
}

/**
 * The storage key (after the app's `dvbh:` prefix) for one tab graph in one
 * cave: `arrangement:v1:<tab graph>:<cave>`. The cave is part of it because
 * the cave changes which forms and nodes are drawn.
 */
export function arrangementKey(tab: Tab, cave: Cave): string {
  return `arrangement:v${ARRANGEMENT_VERSION}:${tabGraphName(tab)}:${cave}`;
}

/** The stored form: `{ "<node id>": [x, y] }`, whole px. */
export function serializeMoves(moves: Moves): string {
  const out: Record<string, [number, number]> = {};
  for (const [id, p] of moves) out[id] = [Math.round(p.x), Math.round(p.y)];
  return JSON.stringify(out);
}

/** Moves from their stored form. Anything malformed is dropped, entry by entry. */
export function parseMoves(stored: unknown): Map<NodeId, Position> {
  const moves = new Map<NodeId, Position>();
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return moves;
  for (const [id, value] of Object.entries(stored as Record<string, unknown>)) {
    if (!Array.isArray(value) || value.length !== 2) continue;
    const [x, y] = value as unknown[];
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      moves.set(id, { x, y });
    }
  }
  return moves;
}

/**
 * `base` with each moved node where the player left it. Moves for nodes
 * `base` doesn't have (a Dragon no longer on the tab) are ignored. Returns
 * `base` itself when nothing applies.
 */
export function withMoves(base: ReadonlyMap<NodeId, Position>, moves: Moves): ReadonlyMap<NodeId, Position> {
  let out: Map<NodeId, Position> | null = null;
  for (const [id, p] of moves) {
    if (!base.has(id)) continue;
    out ??= new Map(base);
    out.set(id, p);
  }
  return out ?? base;
}

/** `moves` plus `more`; a node in both takes its place from `more`. */
export function addMoves(moves: Moves, more: Moves): Map<NodeId, Position> {
  const out = new Map(moves);
  for (const [id, p] of more) out.set(id, p);
  return out;
}
