// The Collection (spec §7): which Dragons the player owns, per form.

/** The Collection format this app writes. Older ones are migrated, newer ones refused. */
export const FORMAT_VERSION = 1;

/** A form of a Dragon. A single-form Dragon has just one: `rift` for Rift dragons, else `normal`. */
export type Form = 'normal' | 'rift';

/** Always both flags, whatever the Dragon's traits. */
export type Entry = { readonly normal: boolean; readonly rift: boolean };

export type Entries = Readonly<Record<string, Entry>>;

/** What `localStorage` holds and what Export downloads. */
export type CollectionBlob = {
  formatVersion: number;
  /** The snapshot this was last reconciled against. */
  snapshotRevision: string;
  /** Keyed by Dragon Name. Orphans included. */
  entries: Record<string, { normal: boolean; rift: boolean }>;
  lastExported?: string;
};

/**
 * The loaded Collection, reconciled against one snapshot. Immutable: every
 * operation returns a new one. Use `isOwned` / `ticks` to read ownership.
 */
export type Collection = {
  readonly snapshotRevision: string;
  /** Entries for Dragons the snapshot knows. Entries with no flag set are dropped. */
  readonly entries: Entries;
  /** Names the snapshot doesn't know. Kept and exported, never owned. */
  readonly orphans: Entries;
  readonly lastExported?: string;
};

/** A rename applied while loading. */
export type Rename = { readonly from: string; readonly to: string };

/** What the "Dragon data updated" banner shows. Only produced when something changed. */
export type LoadNotice = {
  /** `meta.fetchedAt` of the snapshot loaded against: the banner's date. */
  readonly dataDate: string;
  readonly renamed: readonly Rename[];
  /** Every orphan name, sorted. */
  readonly orphans: readonly string[];
};

export type LoadResult = { readonly collection: Collection; readonly notice: LoadNotice | null };

export type CollectionProblem = 'not-json' | 'not-collection' | 'newer-version';

export type CollectionError = { readonly problem: CollectionProblem; readonly message: string };

/** What the import confirm dialog shows, plus the Collection to replace with. */
export type ImportSummary = {
  /** Dragons owned in the file (any form; orphans don't count). */
  readonly fileOwned: number;
  /** Dragons owned now. */
  readonly currentOwned: number;
  /** Dragons whose entry would differ after the import. */
  readonly wouldChange: number;
  readonly renamed: readonly Rename[];
  readonly orphans: readonly string[];
  /** The Collection the import replaces the current one with. */
  readonly collection: Collection;
};

export type ImportPreview =
  | { readonly ok: true; readonly summary: ImportSummary }
  | { readonly ok: false; readonly error: CollectionError };

/** Bulk Mark/Unmark choice: Owned forms Normal → `normal`, Rift → `rift`; Either asks. */
export type MarkChoice = 'normal' | 'rift' | 'both';
