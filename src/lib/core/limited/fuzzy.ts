// Tolerant name matching for the hand-edited Data:Limited.json page, where a
// Dragon's name is sometimes mistyped ("Outride" for Outrider). A name matches
// a Dragon only when it is clearly a typo of exactly one: otherwise it stays
// unrecognised, because a wrong match would mark the wrong Dragon Available.

/** Names shorter than this (once normalised) are never fuzzy matched: a single edit changes too much. */
const MIN_LENGTH = 5;

/** Lower case, letters and digits only, so "Fire  Dragon" and "fire-dragon" are the same. */
const normalise = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The most edits a typo of this length may have: 1 up to 9 characters, 2 from 10. */
const allowedEdits = (length: number): number => (length >= 10 ? 2 : 1);

/**
 * Edit distance counting an insertion, deletion, substitution or swap of two
 * neighbouring letters as one edit. Gives up (returns `limit + 1`) once it
 * must exceed `limit`.
 */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous: number[] = [];
  let current = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const before = previous;
    previous = current;
    current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2]! + 1);
      current[j] = d;
      best = Math.min(best, d);
    }
    if (best > limit) return limit + 1;
  }
  return current[b.length]!;
}

/** Matches mistyped names against `known`, remembering each answer. */
export class NameMatcher {
  private readonly exact: ReadonlySet<string>;
  private readonly normalised: readonly { name: string; key: string }[];
  private readonly answers = new Map<string, string | null>();

  constructor(known: Iterable<string>) {
    const names = [...known];
    this.exact = new Set(names);
    this.normalised = names.map((name) => ({ name, key: normalise(name) }));
  }

  /** The Dragon `name` is a typo of, or null when it is exact (nothing to fix), unknown or ambiguous. */
  typoOf(name: string): string | null {
    if (this.exact.has(name)) return null;
    const cached = this.answers.get(name);
    if (cached !== undefined) return cached;
    const found = this.search(name);
    this.answers.set(name, found);
    return found;
  }

  private search(name: string): string | null {
    const key = normalise(name);
    // Same letters in another case or spacing: always a match, if only one Dragon has them.
    const same = this.normalised.filter((n) => n.key === key);
    if (same.length > 0) return same.length === 1 ? same[0]!.name : null;
    if (key.length < MIN_LENGTH) return null;

    const limit = allowedEdits(key.length);
    let best: string | null = null;
    let bestDistance = limit + 1;
    let tied = false;
    for (const n of this.normalised) {
      const distance = editDistance(key, n.key, limit);
      if (distance < bestDistance) {
        best = n.name;
        bestDistance = distance;
        tied = false;
      } else if (distance === bestDistance && distance <= limit) {
        tied = true;
      }
    }
    return best !== null && !tied ? best : null;
  }
}
