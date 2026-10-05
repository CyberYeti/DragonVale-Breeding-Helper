// Reading and writing ownership, and the blob for storage and Export.
import type { Dragon, Snapshot } from '../../snapshot';
import {
  FORMAT_VERSION,
  type Collection,
  type CollectionBlob,
  type Entry,
  type Form,
  type MarkChoice,
} from './types';

const NONE: Entry = { normal: false, rift: false };

/** The forms a Dragon's ticks show: Normal + Rift form for `traits: all`, else its one form. */
export function formsOf(dragon: Dragon): readonly Form[] {
  switch (dragon.traits.kind) {
    case 'all':
      return ['normal', 'rift'];
    case 'fixed':
      return ['rift'];
    case 'none':
      return ['normal'];
  }
}

/**
 * Whether `dragon` is owned in `form`, or in any form when `form` is left out.
 * A single-form Dragon is owned in its one form when either flag is set (a
 * shape change can leave the other flag behind), and never in the other form.
 */
export function isOwned(collection: Collection, dragon: Dragon, form?: Form): boolean {
  const entry = collection.entries[dragon.name] ?? NONE;
  const forms = formsOf(dragon);
  if (form === undefined || forms.length === 1) {
    return (form === undefined || forms.includes(form)) && (entry.normal || entry.rift);
  }
  return entry[form];
}

/** One tick per form the Dragon shows, with whether it is owned in that form. */
export function ticks(collection: Collection, dragon: Dragon): { form: Form; owned: boolean }[] {
  return formsOf(dragon).map((form) => ({ form, owned: isOwned(collection, dragon, form) }));
}

/** Flips the tick for `form`. Does nothing when the Dragon has no such form. */
export function toggle(collection: Collection, dragon: Dragon, form: Form): Collection {
  if (!formsOf(dragon).includes(form)) return collection;
  return withEntries(collection, [[dragon, form, !isOwned(collection, dragon, form)]]);
}

/**
 * Bulk Mark (select mode). `normal` sets normal flags and the flag of `none`
 * Dragons; `rift` sets Rift form flags and Rift dragons' flag; `both` sets
 * every flag. A single-form Dragon changes only when the choice includes its
 * one form. Names the snapshot doesn't know are skipped.
 */
export function mark(
  collection: Collection,
  names: Iterable<string>,
  choice: MarkChoice,
  snapshot: Snapshot,
): Collection {
  return setMany(collection, names, choice, snapshot, true);
}

/** Bulk Unmark: clears the same flags `mark` would set. */
export function unmark(
  collection: Collection,
  names: Iterable<string>,
  choice: MarkChoice,
  snapshot: Snapshot,
): Collection {
  return setMany(collection, names, choice, snapshot, false);
}

/** Drops the orphans for good ("Remove them"). */
export function removeOrphans(collection: Collection): Collection {
  return { ...collection, orphans: {} };
}

/** The blob to keep in `localStorage`. Orphans included. */
export function toBlob(collection: Collection): CollectionBlob {
  return {
    formatVersion: FORMAT_VERSION,
    snapshotRevision: collection.snapshotRevision,
    entries: Object.fromEntries(
      [...Object.entries(collection.orphans), ...Object.entries(collection.entries)].map(
        ([name, e]) => [name, { normal: e.normal, rift: e.rift }],
      ),
    ),
    ...(collection.lastExported !== undefined && { lastExported: collection.lastExported }),
  };
}

/**
 * Export: sets `lastExported` to `now` and returns the updated Collection,
 * the blob to download (orphans included) and its file name.
 */
export function exportBlob(
  collection: Collection,
  now: Date,
): { collection: Collection; blob: CollectionBlob; fileName: string } {
  const updated: Collection = { ...collection, lastExported: now.toISOString() };
  return { collection: updated, blob: toBlob(updated), fileName: exportFileName(now) };
}

/** `dragonvale-collection-YYYY-MM-DD.json`, in local time. */
function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `dragonvale-collection-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function setMany(
  collection: Collection,
  names: Iterable<string>,
  choice: MarkChoice,
  snapshot: Snapshot,
  value: boolean,
): Collection {
  const byName = new Map(snapshot.dragons.map((d) => [d.name, d]));
  const writes: [Dragon, Form, boolean][] = [];
  for (const name of names) {
    const dragon = byName.get(name);
    if (!dragon) continue;
    for (const form of formsOf(dragon)) {
      if (choice === 'both' || choice === form) writes.push([dragon, form, value]);
    }
  }
  return writes.length === 0 ? collection : withEntries(collection, writes);
}

/**
 * Applies writes of one form's flag each. A single-form Dragon's entry is
 * rewritten whole, so a flag its shape can't show is cleared rather than
 * left to keep it owned. Entries with no flag set are dropped.
 */
function withEntries(collection: Collection, writes: [Dragon, Form, boolean][]): Collection {
  const entries = new Map(Object.entries(collection.entries));
  for (const [dragon, form, value] of writes) {
    const before = entries.get(dragon.name) ?? NONE;
    const after: Entry =
      formsOf(dragon).length === 1
        ? { normal: form === 'normal' && value, rift: form === 'rift' && value }
        : { ...before, [form]: value };
    if (after.normal || after.rift) entries.set(dragon.name, after);
    else entries.delete(dragon.name);
  }
  return { ...collection, entries: Object.fromEntries(entries) };
}
