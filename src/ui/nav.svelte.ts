// ui/nav: where the player is in the app. It holds the current tab, the
// search text, the filters, select mode and its selection, and the graph
// level stack (tiles → tab graph → pulled tree, or a tile's Focus view).
//
// Search, filters, select mode and graphs reset on reload. The tab is kept
// (a per-browser convenience, like the cave), so a reload lands on the same
// page.
//
// Browser history: once `connectHistory` runs, every tab change and every
// graph level opened pushes a history entry holding the tab and the level
// stack; re-targeting the level on top replaces the entry instead. The
// browser's back (button, mouse, gesture) pops an entry and `popstate` puts
// that entry's tab and levels back. The app's own back (← Back, Escape, the
// graph background) goes through `history.go` too, so both kinds of back
// step through the same entries. The URL never changes.
/* eslint-disable svelte/prefer-svelte-reactivity -- sets here are replaced, never mutated */

import { getContext, setContext } from 'svelte';
import type { Form } from '../lib/core/collection';
import { NO_FILTERS, type Filters, type Tab } from '../lib/core/menu';
import { isRecord, type Snapshot } from '../lib/snapshot';
import { readStoredJson, writeStored } from './storage';

const TAB_KEY = 'nav:v1';

/** Marks a history entry as one of ours. */
const ENTRY_MARK = 'dvbh-nav';

/** What a history entry holds: the tab and graph levels to show on returning to it. */
interface HistoryEntry {
  readonly mark: typeof ENTRY_MARK;
  readonly tab: Tab;
  readonly levels: readonly GraphLevel[];
}

/** The parts of `window.history` Nav uses (tests pass a fake). */
export interface HistoryPort {
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  go(delta: number): void;
}

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
  /** The browser history, once connected. Without it, back works on `levels` alone. */
  #history: HistoryPort | null = null;
  /** Steps back asked of the history whose `popstate` hasn't arrived yet. */
  #pendingBack = 0;

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

  /** Shows `tab`: clears search, leaves select mode and closes any graph. A new tab is a history step. */
  goTo(tab: Tab): void {
    const step = tabKey(tab) !== tabKey(this.tab) || this.levels.length > 0;
    this.#showTab(tab);
    this.levels = [];
    this.#record(step ? 'push' : 'replace');
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
    this.#record('push');
  }

  /** A new Target for the Focus view on top: replaces that level, so back still goes straight to the tiles. */
  retarget(target: string, form: Form): void {
    if (this.level?.kind !== 'focus') {
      this.openFocus(target, form);
      return;
    }
    this.levels = [...this.levels.slice(0, -1), { kind: 'focus', target, form }];
    this.#record('replace');
  }

  /** The Graph button: the current tab's graph. */
  openTabGraph(): void {
    this.levels = [{ kind: 'tab-graph', tab: this.tab }];
    this.#record('push');
  }

  /** A click on a Dragon in a tab graph: pulls its tree, replacing any tree already pulled. */
  pullTree(target: string, form: Form): void {
    const replacing = this.level?.kind === 'tree';
    const below = this.levels.filter((l) => l.kind !== 'tree');
    this.levels = [...below, { kind: 'tree', target, form }];
    this.#record(replacing ? 'replace' : 'push');
  }

  /** Back one level (Escape, the background, ← Back): tree → tab graph → tiles. */
  back(): void {
    this.#stepBack(1);
  }

  /** Back to the tiles. */
  closeGraphs(): void {
    this.#stepBack(this.levels.length);
  }

  // ---- Browser history ------------------------------------------------------

  /**
   * Ties the tab and graph levels to the browser history (see the file
   * comment). The current entry becomes the current tab's tiles, so a reload
   * never reopens a graph. `events` is where `popstate` fires (the window).
   * Returns the disconnect.
   */
  connectHistory(history: HistoryPort, events: EventTarget): () => void {
    this.#history = history;
    this.#pendingBack = 0;
    this.levels = [];
    this.#record('replace');
    const onpopstate = (event: Event) => this.#restore('state' in event ? event.state : null);
    events.addEventListener('popstate', onpopstate);
    return () => {
      events.removeEventListener('popstate', onpopstate);
      if (this.#history === history) this.#history = null;
    };
  }

  /**
   * Goes back `count` levels. Connected, it asks the history and lets
   * `popstate` change the levels; steps already asked for count against the
   * levels left, so a quick double Escape never backs out past the tiles.
   */
  #stepBack(count: number): void {
    const steps = Math.min(count, this.levels.length - this.#pendingBack);
    if (steps <= 0) return;
    const history = this.#history;
    if (!history) {
      this.levels = this.levels.slice(0, -steps);
      return;
    }
    this.#pendingBack += steps;
    history.go(-steps);
  }

  /** Writes the current tab and levels to the history: as a new entry, or over the current one. */
  #record(how: 'push' | 'replace'): void {
    const history = this.#history;
    if (!history) return;
    const entry: HistoryEntry = {
      mark: ENTRY_MARK,
      tab: $state.snapshot(this.tab),
      levels: $state.snapshot(this.levels),
    };
    if (how === 'push') history.pushState(entry, '');
    else history.replaceState(entry, '');
  }

  /** `popstate`: shows the entry's tab and levels (an entry that isn't ours shows the tiles). */
  #restore(state: unknown): void {
    this.#pendingBack = 0;
    if (!isRecord(state) || state.mark !== ENTRY_MARK) {
      this.levels = [];
      return;
    }
    if (this.#valid(state.tab) && tabKey(state.tab) !== tabKey(this.tab)) this.#showTab(state.tab);
    this.levels = Array.isArray(state.levels) ? state.levels.filter((l) => this.#validLevel(l)) : [];
  }

  #showTab(tab: Tab): void {
    this.tab = tab;
    this.query = '';
    this.exitSelect();
    writeStored(TAB_KEY, JSON.stringify({ tab }));
  }

  #validLevel(level: unknown): level is GraphLevel {
    if (!isRecord(level)) return false;
    if (level.kind === 'tab-graph') return this.#valid(level.tab);
    return (
      (level.kind === 'focus' || level.kind === 'tree') &&
      typeof level.target === 'string' &&
      (level.form === 'normal' || level.form === 'rift')
    );
  }

  #valid(tab: unknown): tab is Tab {
    if (!isRecord(tab)) return false;
    if (tab.kind === 'breedable' || tab.kind === 'limited' || tab.kind === 'event') return true;
    return tab.kind === 'page' && this.#snapshot.pages.some((p) => p.name === tab.page);
  }
}

/** Equal for the same tab. */
function tabKey(tab: Tab): string {
  return tab.kind === 'page' ? `page:${tab.page}` : tab.kind;
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
