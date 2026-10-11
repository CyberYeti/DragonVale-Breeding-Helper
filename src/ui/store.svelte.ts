// ui/store: the app's state. It holds the snapshot, the Collection plus one
// level of Undo, the Limited overlay and its "as of" time, the Breeding cave
// and the Display settings, and the World built from them. Every Collection
// write goes through it; it persists the Collection, the cave and Display to
// localStorage (each access wrapped, so the app works without storage).
//
// Search, filters, tabs and select mode are not here (ui/nav): they reset on
// reload.
//
// Dates here are never mutated (a new one replaces the old), so SvelteDate
// isn't needed.
/* eslint-disable svelte/prefer-svelte-reactivity */

import { getContext, setContext } from 'svelte';
import {
  CollectionLoadError,
  exportBlob,
  load,
  mark,
  previewImport,
  removeOrphans,
  toBlob,
  toggle,
  unmark,
  type Collection,
  type CollectionBlob,
  type CollectionError,
  type Form,
  type ImportPreview,
  type ImportSummary,
  type LoadNotice,
  type MarkChoice,
} from '../lib/core/collection';
import { emptyOverlay, parseLimited, stageAliases, type Overlay } from '../lib/core/limited';
import { buildWorld, type World } from '../lib/core/world';
import type { Cave } from '../lib/core/breeding';
import type { Display } from '../lib/core/tile';
import { isRecord, loadSnapshot, type Dragon, type Snapshot } from '../lib/snapshot';
import { fetchLimited, readCachedLimited, type LimitedRaw } from './limitedSource';
import { readStored, readStoredJson, writeStored } from './storage';

// Versioned keys: bump a suffix when that stored shape changes.
const COLLECTION_KEY = 'collection:v1';
/** Where an unreadable stored Collection is set aside, so starting afresh never destroys it. */
const UNREADABLE_KEY = 'collection:v1:unreadable';
const SETTINGS_KEY = 'settings:v1';

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/snapshot.json`;

/** How often to check whether the local day has changed (Limited entries expire at midnight). */
const DAY_CHECK_MS = 60_000;

const CAVES: readonly Cave[] = ['normal', 'rift', 'coop'];
const OWNED_FORMS: readonly Display['ownedForms'][] = ['either', 'normal', 'rift'];
const DEFAULT_DISPLAY: Display = { ownedForms: 'either', allInColour: false, elementIcons: true };

/**
 * Where the Limited data came from.
 * - `loading`: the fetch is still running; the cached copy (if any) is in use.
 * - `live`: fetched just now.
 * - `cache`: the fetch failed; running from the cached copy.
 * - `none`: the fetch failed and nothing was cached; the overlay is empty.
 */
export type LimitedStatus = 'loading' | 'live' | 'cache' | 'none';

/** Fetches and checks the snapshot. Throws an Error with a readable message when it can't be used. */
async function fetchSnapshot(): Promise<Snapshot> {
  let json: unknown;
  try {
    const response = await fetch(SNAPSHOT_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    json = await response.json();
  } catch (e) {
    throw new Error(`The Dragon data (${SNAPSHOT_URL}) couldn't be loaded: ${errorText(e)}`, { cause: e });
  }
  return loadSnapshot(json);
}

/**
 * Loads the snapshot and builds the store. Rejects when the snapshot can't
 * be fetched or is refused (wrong schema version); show an error page then.
 * Starts the one Data:Limited.json fetch without waiting for it.
 */
export async function openApp(): Promise<AppStore> {
  const store = new AppStore(await fetchSnapshot());
  void store.refreshLimited();
  return store;
}

export class AppStore {
  readonly snapshot: Snapshot;

  /** The current Collection. Read only: write through the methods below. */
  collection: Collection = $state.raw(null!);
  /** The Collection before the last bulk Mark/Unmark, import or orphan removal (one-level Undo). */
  previous: Collection | null = $state.raw(null);
  /** The "Dragon data updated" banner, shown once after a load that renamed or set aside entries. */
  notice: LoadNotice | null = $state.raw(null);
  /**
   * The stored Collection couldn't be read (not a Collection, or a newer
   * format). The app started with an empty one; the stored value was kept
   * aside under its own key. Show it until dismissed.
   */
  loadError: CollectionError | null = $state.raw(null);
  /** The last localStorage write failed: changes won't survive a reload. */
  storageFailed = $state(false);

  /** Where the Limited data came from; see LimitedStatus. */
  limitedStatus: LimitedStatus = $state('loading');
  #limited: LimitedRaw | null = $state.raw(null);
  #cave: Cave = $state('normal');
  #display: Display = $state.raw(DEFAULT_DISPLAY);
  /** The time the overlay and World were worked out for. Moves on only when the local day changes. */
  #now: Date = $state.raw(new Date());

  #names: readonly string[];
  /** Shared names of staged Dragons ("Dracomancy" -> Dracomancy 1), for the Limited page. */
  #aliases: ReadonlyMap<string, string>;
  #timer: ReturnType<typeof setInterval> | undefined;
  #onVisible = () => this.#checkDay();

  /** The Limited overlay, parsed from the raw page on every load and again each new local day. */
  readonly overlay: Overlay = $derived.by(() =>
    this.#limited ? parseLimited(this.#limited.raw, this.#names, this.#now, this.#aliases) : emptyOverlay(),
  );

  /** Everything core reads. Rebuilt whenever the Collection, overlay or day changes. */
  readonly world: World = $derived.by(() => buildWorld(this.snapshot, this.collection, this.overlay, this.#now));

  /** Set when running from the cached Limited data: show "Limited data as of <time>". */
  readonly limitedAsOf: Date | null = $derived.by(() =>
    this.limitedStatus === 'cache' && this.#limited ? this.#limited.fetchedAt : null,
  );

  constructor(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.#names = snapshot.dragons.map((d) => d.name);
    this.#aliases = stageAliases(snapshot.dragons);
    this.#loadCollection();
    this.#loadSettings();
    this.#limited = readCachedLimited();

    if (typeof window !== 'undefined') {
      this.#timer = setInterval(() => this.#checkDay(), DAY_CHECK_MS);
      document.addEventListener('visibilitychange', this.#onVisible);
    }
  }

  // ---- Settings (kept across reloads) -------------------------------------

  /** The chosen Breeding cave. */
  get cave(): Cave {
    return this.#cave;
  }
  set cave(cave: Cave) {
    this.#cave = cave;
    this.#saveSettings();
  }

  /** The Display popover's settings. Assign a whole new object to change them. */
  get display(): Display {
    return this.#display;
  }
  set display(display: Display) {
    this.#display = {
      ownedForms: display.ownedForms,
      allInColour: display.allInColour,
      elementIcons: display.elementIcons,
    };
    this.#saveSettings();
  }

  // ---- Collection writes ---------------------------------------------------

  /** Flips one tick. Not undoable; it ends any pending Undo. */
  toggle(dragon: Dragon, form: Form): void {
    this.#write(toggle(this.collection, dragon, form), false);
  }

  /** Bulk Mark (select mode). Undoable. Returns false when nothing changed. */
  mark(names: Iterable<string>, choice: MarkChoice): boolean {
    return this.#write(mark(this.collection, names, choice, this.snapshot), true);
  }

  /** Bulk Unmark. Undoable. Returns false when nothing changed. */
  unmark(names: Iterable<string>, choice: MarkChoice): boolean {
    return this.#write(unmark(this.collection, names, choice, this.snapshot), true);
  }

  /** "Remove them": drops the orphans for good. Undoable. */
  removeOrphans(): boolean {
    return this.#write(removeOrphans(this.collection), true);
  }

  /** Checks an import file against the current Collection. Changes nothing. */
  previewImport(text: string): ImportPreview {
    return previewImport(text, this.collection, this.snapshot);
  }

  /** Replaces the Collection with a confirmed import (`preview.summary`). Undoable. */
  applyImport(summary: ImportSummary): void {
    this.#write(summary.collection, true, true);
  }

  /**
   * Export: records "Last exported" and returns the blob to download and its
   * file name (`dragonvale-collection-YYYY-MM-DD.json`). Leaves Undo alone.
   */
  exportCollection(now: Date = new Date()): { blob: CollectionBlob; fileName: string } {
    const { collection, blob, fileName } = exportBlob(this.collection, now);
    this.collection = collection;
    this.#persistCollection();
    return { blob, fileName };
  }

  /** Whether there is something to Undo. */
  get canUndo(): boolean {
    return this.previous !== null;
  }

  /** Restores the Collection before the last undoable action. Keeps "Last exported". */
  undo(): void {
    const previous = this.previous;
    if (!previous) return;
    const { lastExported } = this.collection;
    this.collection = { ...previous, ...(lastExported !== undefined && { lastExported }) };
    this.previous = null;
    this.#persistCollection();
  }

  /** The Undo toast closed without undoing. */
  dismissUndo(): void {
    this.previous = null;
  }

  dismissNotice(): void {
    this.notice = null;
  }

  dismissLoadError(): void {
    this.loadError = null;
  }

  // ---- Limited data -------------------------------------------------------

  /** Runs the Data:Limited.json fetch (openApp calls it once). */
  async refreshLimited(): Promise<void> {
    this.limitedStatus = 'loading';
    const result = await fetchLimited();
    this.limitedStatus = result.source;
    this.#limited = result.source === 'none' ? null : result.data;
    this.#checkDay();
  }

  /** Stops the day clock. */
  destroy(): void {
    clearInterval(this.#timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.#onVisible);
  }

  // ---- Internals ----------------------------------------------------------

  /** Sets the Collection and persists it. Returns false (and changes nothing) when `next` is the same. */
  #write(next: Collection, undoable: boolean, always = false): boolean {
    if (next === this.collection && !always) return false;
    this.previous = undoable ? this.collection : null;
    this.collection = next;
    this.#persistCollection();
    return true;
  }

  #persistCollection(): void {
    // toBlob, not exportBlob: storing must not touch "Last exported".
    this.storageFailed = !writeStored(COLLECTION_KEY, JSON.stringify(toBlob(this.collection)));
  }

  #loadCollection(): void {
    const stored = readStored(COLLECTION_KEY);
    let raw: unknown = null;
    if (stored !== null) {
      try {
        raw = JSON.parse(stored);
      } catch {
        raw = stored; // not JSON: load() refuses it as not a Collection
      }
    }
    try {
      const { collection, notice } = load(raw, this.snapshot);
      this.collection = collection;
      this.notice = notice;
    } catch (e) {
      if (!(e instanceof CollectionLoadError)) throw e;
      // Keep the unreadable value (perhaps from a newer version of the app) before starting afresh.
      if (stored !== null) writeStored(UNREADABLE_KEY, stored);
      this.loadError = e.error;
      this.collection = load(null, this.snapshot).collection;
    }
    // Stores the new snapshotRevision (spec §7 Loading, step 5).
    this.#persistCollection();
  }

  #loadSettings(): void {
    const stored = readStoredJson(SETTINGS_KEY);
    if (!isRecord(stored)) return;
    if (CAVES.includes(stored.cave as Cave)) this.#cave = stored.cave as Cave;
    const display = stored.display;
    if (isRecord(display)) {
      this.#display = {
        ownedForms: OWNED_FORMS.includes(display.ownedForms as Display['ownedForms'])
          ? (display.ownedForms as Display['ownedForms'])
          : DEFAULT_DISPLAY.ownedForms,
        allInColour: typeof display.allInColour === 'boolean' ? display.allInColour : DEFAULT_DISPLAY.allInColour,
        elementIcons: typeof display.elementIcons === 'boolean' ? display.elementIcons : DEFAULT_DISPLAY.elementIcons,
      };
    }
  }

  #saveSettings(): void {
    this.storageFailed = !writeStored(SETTINGS_KEY, JSON.stringify({ cave: this.#cave, display: this.#display }));
  }

  /** Moves `now` on when the local day has changed, so expired Limited entries drop out. */
  #checkDay(): void {
    const now = new Date();
    if (localDay(now) !== localDay(this.#now)) this.#now = now;
  }
}

// ---- Context --------------------------------------------------------------

const STORE_KEY = Symbol('store');

/** Makes `store` available to every component below the caller. */
export function provideStore(store: AppStore): void {
  setContext(STORE_KEY, store);
}

/** The app's store, from inside any component below the one that provided it. */
export function useStore(): AppStore {
  const store = getContext<AppStore | undefined>(STORE_KEY);
  if (!store) throw new Error('useStore() called outside the app (no store provided).');
  return store;
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
