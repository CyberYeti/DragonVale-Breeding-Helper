// The load pipeline (spec §7 "Loading (and importing)"), shared by `load`
// and `previewImport`: migrate → renames → orphans → notice → new revision.
import type { Snapshot } from '../../snapshot';
import {
  FORMAT_VERSION,
  type Collection,
  type CollectionBlob,
  type CollectionError,
  type Entry,
  type ImportPreview,
  type LoadResult,
  type Rename,
} from './types';

/** Thrown by `load` when the stored value can't be read. */
export class CollectionLoadError extends Error {
  constructor(readonly error: CollectionError) {
    super(error.message);
    this.name = 'CollectionLoadError';
  }
}

/** One step per older version: `migrations[v]` turns a version `v` blob into `v + 1`. */
const migrations: Record<number, (blob: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Loads the stored Collection (parsed JSON) against `snapshot`. `null` or
 * `undefined` (first run) gives an empty Collection. Throws
 * `CollectionLoadError` when `raw` isn't a Collection or is a newer format.
 */
export function load(raw: unknown, snapshot: Snapshot): LoadResult {
  if (raw === null || raw === undefined) {
    return { collection: { snapshotRevision: snapshot.meta.revision, entries: {}, orphans: {} }, notice: null };
  }
  const blob = readBlob(raw);
  if ('problem' in blob) throw new CollectionLoadError(blob);
  return reconcile(blob, snapshot);
}

/**
 * Checks an import file and works out what importing it would do. Changes
 * nothing; on confirm, replace the Collection with `summary.collection`.
 */
export function previewImport(text: string, current: Collection, snapshot: Snapshot): ImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: { problem: 'not-json', message: "The file isn't JSON." } };
  }
  const blob = readBlob(parsed);
  if ('problem' in blob) return { ok: false, error: blob };

  const { collection, renamed } = reconcileSteps(blob, snapshot);
  const names = new Set([...Object.keys(current.entries), ...Object.keys(collection.entries)]);
  let wouldChange = 0;
  for (const name of names) {
    if (!sameEntry(current.entries[name], collection.entries[name])) wouldChange++;
  }
  return {
    ok: true,
    summary: {
      fileOwned: Object.keys(collection.entries).length,
      currentOwned: Object.keys(current.entries).length,
      wouldChange,
      renamed,
      orphans: Object.keys(collection.orphans).sort(),
      collection,
    },
  };
}

function reconcile(blob: CollectionBlob, snapshot: Snapshot): LoadResult {
  const { collection, renamed } = reconcileSteps(blob, snapshot);
  const orphans = Object.keys(collection.orphans).sort();
  const changed =
    blob.snapshotRevision !== snapshot.meta.revision && (renamed.length > 0 || orphans.length > 0);
  return {
    collection,
    notice: changed ? { dataDate: snapshot.meta.fetchedAt, renamed, orphans } : null,
  };
}

function reconcileSteps(
  blob: CollectionBlob,
  snapshot: Snapshot,
): { collection: Collection; renamed: Rename[] } {
  const renamed: Rename[] = [];
  const merged = new Map<string, Entry>();
  const sameRevision = blob.snapshotRevision === snapshot.meta.revision;
  for (const [name, entry] of Object.entries(blob.entries)) {
    const to = sameRevision ? name : followRenames(name, snapshot.renames);
    if (to !== name) renamed.push({ from: name, to });
    const existing = merged.get(to);
    merged.set(
      to,
      existing ? { normal: existing.normal || entry.normal, rift: existing.rift || entry.rift } : entry,
    );
  }

  const known = new Set(snapshot.dragons.map((d) => d.name));
  const entries: [string, Entry][] = [];
  const orphans: [string, Entry][] = [];
  for (const [name, entry] of merged) {
    if (!known.has(name)) orphans.push([name, entry]);
    else if (entry.normal || entry.rift) entries.push([name, entry]);
  }

  const collection: Collection = {
    snapshotRevision: snapshot.meta.revision,
    entries: Object.fromEntries(entries),
    orphans: Object.fromEntries(orphans),
    ...(blob.lastExported !== undefined && { lastExported: blob.lastExported }),
  };
  return { collection, renamed };
}

/** Follows A → B → C to the end. A cycle (bad hand edit) leaves the name as it is. */
function followRenames(name: string, renames: Record<string, string>): string {
  const seen = new Set([name]);
  let current = name;
  for (;;) {
    const next = Object.hasOwn(renames, current) ? renames[current] : undefined;
    if (next === undefined) return current;
    if (seen.has(next)) return name;
    seen.add(next);
    current = next;
  }
}

/** Validates and migrates; returns the problem instead when it can't. */
function readBlob(raw: unknown): CollectionBlob | CollectionError {
  const notCollection: CollectionError = {
    problem: 'not-collection',
    message: "The file isn't a DragonVale Breeding Helper Collection.",
  };
  if (!isRecord(raw)) return notCollection;

  let version = raw.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return notCollection;
  if (version > FORMAT_VERSION) {
    return {
      problem: 'newer-version',
      message: `The file is Collection format ${version}, made by a newer version of this app; this app reads format ${FORMAT_VERSION} and older.`,
    };
  }

  let blob: Record<string, unknown> = raw;
  while (version < FORMAT_VERSION) {
    const step = migrations[version];
    if (!step) return notCollection;
    blob = step(blob);
    version++;
  }

  const { snapshotRevision, entries, lastExported } = blob;
  if (typeof snapshotRevision !== 'string' || !isRecord(entries)) return notCollection;
  if (lastExported !== undefined && typeof lastExported !== 'string') return notCollection;
  const clean: [string, Entry][] = [];
  for (const [name, entry] of Object.entries(entries)) {
    if (!isRecord(entry) || typeof entry.normal !== 'boolean' || typeof entry.rift !== 'boolean') {
      return notCollection;
    }
    clean.push([name, { normal: entry.normal, rift: entry.rift }]);
  }
  return {
    formatVersion: FORMAT_VERSION,
    snapshotRevision,
    entries: Object.fromEntries(clean),
    ...(lastExported !== undefined && { lastExported }),
  };
}

function sameEntry(a: Entry | undefined, b: Entry | undefined): boolean {
  return (a?.normal ?? false) === (b?.normal ?? false) && (a?.rift ?? false) === (b?.rift ?? false);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
