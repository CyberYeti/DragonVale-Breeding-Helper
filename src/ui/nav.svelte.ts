// ui/nav: where the player is in the app. It holds the current tab, the
// search text, the filters, select mode and its selection, and the graph
// level stack (tiles → tab graph → pulled tree, or a tile's Focus view).
//
// Search, filters, select mode and graphs reset on reload. The tab is kept
// (a per-browser convenience, like the cave), so a reload lands on the same
// page.
/* eslint-disable svelte/prefer-svelte-reactivity -- sets here are replaced, never mutated */

import { getContext, setContext } from 'svelte';
import type { Form } from '../lib/core/collection';
import { NO_FILTERS, type Filters, type Tab } from '../lib/core/menu';
import type { Snapshot } from '../lib/snapshot';
import { isRecord, readStoredJson, writeStored } from './storage';

const TAB_KEY = 'nav:v1';

/**
 * One level above the tiles. The top of the stack is what's on screen.
 * - `focus`: a tile's Focus view (the Target's tree on its own).
 * - `tab-graph`: the Graph button's graph of the current tab.
 * - `tree`: a Dragon's path pulled out of the tab graph below it.
 */
export type GraphLevel =
  | { readonly kind: 'focus'; readonly target: string; readonly form: Form }
  | { readonly kind: 'tab-graph'; readonly tab: Tab }
  | { readonly kind: 'tree'; readonly target: string; readonly form: Form };

export class Nav {
  /** The tab on show. Change it with `goTo`, which also clears search and the selection. */
  tab: Tab = $state.raw({ kind: 'breedable' });
  /** The header search. Non-blank: results over every Dragon replace the tab's tiles. */
  query = $state('');
  /** The Filters popover's settings. Assign a whole new object. */
  filters: Filters = $state.raw(NO_FILTERS);
  /** Select mode is on. */
  selecting = $state(false);
  /** The selected Dragons' names. Replaced, never mutated. */
  selected: ReadonlySet<string> = $state.raw(new Set());
  /** The graph levels open above the tiles, bottom first. Empty: the tiles. */
  levels: readonly GraphLevel[] = $state.raw([]);

  readonly #snapshot: Snapshot;

  constructor(snapshot: Snapshot) {
    this.#snapshot = snapshot;
    const stored = readStoredJson(TAB_KEY);
    if (isRecord(stored) && this.#valid(stored.tab)) this.tab = stored.tab;
  }

  /** Whether search results are showing instead of the tab. */
  get searching(): boolean {
    return this.query.trim() !== '';
  }

  /** The graph level on screen, or null when the tiles are. */
  get level(): GraphLevel | null {
    return this.levels.at(-1) ?? null;
  }

  /** Shows `tab`: clears search, leaves select mode and closes any graph. */
  goTo(tab: Tab): void {
    this.tab = tab;
    this.query = '';
    this.exitSelect();
    this.levels = [];
    writeStored(TAB_KEY, JSON.stringify({ tab }));
  }

  /** Sets the search text. Leaving the view clears the selection. */
  search(query: string): void {
    if (query.trim() !== this.query.trim()) this.selected = new Set();
    this.query = query;
  }

  // ---- Select mode (spec §8 Select mode) -----------------------------------

  enterSelect(): void {
    this.selecting = true;
  }

  /** Leaves select mode; the selection clears. */
  exitSelect(): void {
    this.selecting = false;
    this.selected = new Set();
  }

  toggleSelected(name: string): void {
    const next = new Set(this.selected);
    if (!next.delete(name)) next.add(name);
    this.selected = next;
  }

  /** Adds `names` to the selection ("Select all shown"). */
  selectAll(names: Iterable<string>): void {
    this.selected = new Set([...this.selected, ...names]);
  }

  // ---- Graph levels ---------------------------------------------------------

  /** A tile click: the Dragon's Focus view, in the form the tile opens as. */
  openFocus(target: string, form: Form): void {
    this.levels = [...this.levels, { kind: 'focus', target, form }];
  }

  /** The Graph button: the current tab's graph. */
  openTabGraph(): void {
    this.levels = [{ kind: 'tab-graph', tab: this.tab }];
  }

  /** A click on a Dragon in a tab graph: pulls its tree, replacing any tree already pulled. */
  pullTree(target: string, form: Form): void {
    const below = this.levels.filter((l) => l.kind !== 'tree');
    this.levels = [...below, { kind: 'tree', target, form }];
  }

  /** Back one level (Escape, the background, ← Back): tree → tab graph → tiles. */
  back(): void {
    this.levels = this.levels.slice(0, -1);
  }

  /** Back to the tiles. */
  closeGraphs(): void {
    this.levels = [];
  }

  #valid(tab: unknown): tab is Tab {
    if (!isRecord(tab)) return false;
    if (tab.kind === 'breedable' || tab.kind === 'limited' || tab.kind === 'event') return true;
    return tab.kind === 'page' && this.#snapshot.pages.some((p) => p.name === tab.page);
  }
}

// ---- Context ----------------------------------------------------------------

const NAV_KEY = Symbol('nav');

/** Makes `nav` available to every component below the caller. */
export function provideNav(nav: Nav): void {
  setContext(NAV_KEY, nav);
}

/** The app's nav state, from inside any component below the one that provided it. */
export function useNav(): Nav {
  const nav = getContext<Nav | undefined>(NAV_KEY);
  if (!nav) throw new Error('useNav() called outside the app (no nav provided).');
  return nav;
}
