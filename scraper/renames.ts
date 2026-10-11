// Renames between snapshots (spec §4). Data:Dragons.json has no ID besides
// Name, so a rename shows up as one Dragon removed and another added. This
// module finds the likely pairs; the person running the scraper confirms or
// rejects each one. Nothing here guesses.
//
//   compareWithPrevious  pure: added/removed names and the rename candidates
//   confirmRenames       asks about each candidate through an injected `ask`
//   applyRenames         pure: adds confirmed pairs to `renames`, never removes

import type { Dragon, Snapshot } from '../src/lib/snapshot';

export type RenamePair = { from: string; to: string };

export type RenameCandidate = RenamePair & {
  /**
   * same-order: the removed and the added Dragon share `order`.
   * only-change: exactly one Dragon was removed and one added in this run.
   */
  reason: 'same-order' | 'only-change';
};

export type SnapshotChanges = {
  /** Names in the new data but not in the previous snapshot. */
  added: string[];
  /** Names in the previous snapshot but not in the new data. */
  removed: string[];
  renameCandidates: RenameCandidate[];
};

/** With no previous snapshot there is nothing to compare: no changes, no candidates. */
export function compareWithPrevious(previous: Snapshot | null, dragons: readonly Dragon[]): SnapshotChanges {
  if (!previous) return { added: [], removed: [], renameCandidates: [] };

  const newNames = new Set(dragons.map((d) => d.name));
  const oldNames = new Set(previous.dragons.map((d) => d.name));
  const removed = previous.dragons.filter((d) => !newNames.has(d.name));
  const added = dragons.filter((d) => !oldNames.has(d.name));

  const renameCandidates: RenameCandidate[] = [];
  for (const old of removed) {
    for (const now of added) {
      if (now.order === old.order) renameCandidates.push({ from: old.name, to: now.name, reason: 'same-order' });
    }
  }
  if (removed.length === 1 && added.length === 1 && renameCandidates.length === 0) {
    renameCandidates.push({ from: removed[0]!.name, to: added[0]!.name, reason: 'only-change' });
  }

  return { added: added.map((d) => d.name), removed: removed.map((d) => d.name), renameCandidates };
}

/** Answers one candidate: true confirms the rename, false rejects it. */
export type AskRename = (candidate: RenameCandidate) => Promise<boolean>;

/**
 * Asks about each candidate in turn and returns the confirmed pairs. Once a
 * name is part of a confirmed pair, later candidates using it aren't asked.
 */
export async function confirmRenames(candidates: readonly RenameCandidate[], ask: AskRename): Promise<RenamePair[]> {
  const confirmed: RenamePair[] = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();
  for (const candidate of candidates) {
    const { from, to } = candidate;
    if (usedFrom.has(from) || usedTo.has(to)) continue;
    if (!(await ask(candidate))) continue;
    confirmed.push({ from, to });
    usedFrom.add(from);
    usedTo.add(to);
  }
  return confirmed;
}

/**
 * Adds confirmed pairs to `renames` (old Name -> new Name). `renames` never
 * shrinks: existing entries, hand edits included, are kept as they are, and a
 * pair whose old name already has an entry is skipped.
 */
export function applyRenames(snapshot: Snapshot, confirmed: readonly RenamePair[]): Snapshot {
  const renames = { ...snapshot.renames };
  for (const { from, to } of confirmed) {
    if (from === to || Object.hasOwn(renames, from)) continue;
    renames[from] = to;
  }
  return { ...snapshot, renames };
}
