// The saved arrangements of the main graphs (tab graphs), kept in
// localStorage under arrangementKey(). GraphLayer provides one for its tab
// graph and the header's Reset arrangement button.

import { getContext, setContext } from 'svelte';
import type { Cave } from '../../lib/core/breeding';
import type { Tab } from '../../lib/core/menu';
import { readStoredJson, removeStored, writeStored } from '../storage';
import { addMoves, arrangementKey, parseMoves, serializeMoves, type Moves } from './arrangement';

const NONE: Moves = new Map();

export class SavedArrangements {
  /** Arrangements read so far, by key. Not reactive: `#version` is. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache; #version carries the changes
  readonly #cache = new Map<string, Moves>();
  #version = $state(0);
  /** Bumped by every reset, so the canvas moves the nodes back instead of jumping. */
  resets = $state(0);

  /** The moves saved for a tab graph in a cave; empty when there are none. */
  moves(tab: Tab, cave: Cave): Moves {
    void this.#version;
    const key = arrangementKey(tab, cave);
    let moves = this.#cache.get(key);
    if (!moves) {
      const read = parseMoves(readStoredJson(key));
      moves = read.size > 0 ? read : NONE;
      this.#cache.set(key, moves);
    }
    return moves;
  }

  /** Whether the tab graph has saved moves to reset. */
  has(tab: Tab, cave: Cave): boolean {
    return this.moves(tab, cave).size > 0;
  }

  /** Saves `more` on top of the tab graph's moves. Kept for this session even when storage refuses it. */
  move(tab: Tab, cave: Cave, more: Moves): void {
    if (more.size === 0) return;
    const key = arrangementKey(tab, cave);
    const moves = addMoves(this.moves(tab, cave), more);
    this.#cache.set(key, moves);
    writeStored(key, serializeMoves(moves));
    this.#version++;
  }

  /** Forgets the tab graph's moves: back to the automatic layout. */
  reset(tab: Tab, cave: Cave): void {
    const key = arrangementKey(tab, cave);
    this.#cache.set(key, NONE);
    removeStored(key);
    this.#version++;
    this.resets++;
  }
}

const KEY = Symbol('saved-arrangements');

export function provideArrangements(arrangements: SavedArrangements): void {
  setContext(KEY, arrangements);
}

/** The enclosing GraphLayer's arrangements; outside one, a fresh set. */
export function useArrangements(): SavedArrangements {
  return getContext<SavedArrangements | undefined>(KEY) ?? new SavedArrangements();
}
