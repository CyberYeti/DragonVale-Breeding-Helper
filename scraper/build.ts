// buildSnapshot(raw, previous): turns the raw Data:*.json pages into the
// snapshot (spec §4). Pure: no I/O, no clock, no prompts. It throws on
// fail-level problems and returns everything else in `report`.
//
// Seams for later tickets:
//   - Routes (#26): `routes` is [] here. The hint mapping fills it per Dragon,
//     reports its own problems through the same Problems collector, and then
//     narrows `elements` to the ones some Route uses.
//   - Renames (#27): `renames` is carried over from `previous`; the report
//     lists added/removed names and rename candidates (see ./renames).
//   - Images (#28): `image` and `icon` are null here; downloadImages fills them.

import { createHash } from 'node:crypto';
import {
  SCHEMA_VERSION,
  type Dragon,
  type DragonariumPage,
  type Element,
  type ElementKind,
  type Rarity,
  type Snapshot,
  type Traits,
} from '../src/lib/snapshot';
import { PAGE_TITLES, type RawPages } from './pages';
import { compareWithPrevious, type SnapshotChanges } from './renames';

/** Spec §6: the five opposite primary pairs. Not in the wiki data; hard-coded. */
export const OPPOSITES: [string, string][] = [
  ['Plant', 'Metal'],
  ['Fire', 'Cold'],
  ['Earth', 'Air'],
  ['Lightning', 'Water'],
  ['Light', 'Dark'],
];

/** The 8 rarities the snapshot knows. Data:Game.json's list leaves out Galaxy, so it isn't used. */
export const RARITIES: readonly Rarity[] = [
  'Primary',
  'Hybrid',
  'Rare',
  'Epic',
  'Galaxy',
  'Gemstone',
  'Legendary',
  'Mythic',
];

const ELEMENT_KINDS: readonly ElementKind[] = ['primary', 'epic', 'gem', 'legendary', 'mythic', 'rift', 'other'];
const PAGE_GROUPS: readonly DragonariumPage['group'][] = ['elemental', 'epic', 'special'];
/** Rarities whose Dragons are never parents. Crystalline Dragons have rarity Gemstone too. */
const NON_PARENT_RARITIES: ReadonlySet<Rarity> = new Set<Rarity>(['Gemstone', 'Legendary', 'Mythic']);
/** Rarities whose wiki page is the bare name (Dragons with powers). */
const BARE_PAGE_RARITIES: ReadonlySet<Rarity> = new Set<Rarity>(['Legendary', 'Mythic']);
const RIFT = 'Rift';

export type BuildReport = SnapshotChanges & {
  /** Problems that don't stop the run. */
  warnings: string[];
  counts: {
    dragons: number;
    pages: Record<DragonariumPage['group'], number>;
    traits: Record<Traits['kind'], number>;
    /** Spec §4 asks for this count so it can be checked against the wiki (29 when written). */
    gemstoneAndCrystalline: number;
    cannotBeParent: number;
    limited: number;
  };
};

export type BuildResult = { snapshot: Snapshot; report: BuildReport };

/** Thrown when the raw pages have fail-level problems. Lists every one found. */
export class SnapshotBuildError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`The snapshot can't be built (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n` +
      problems.map((p) => `  - ${p}`).join('\n'));
    this.name = 'SnapshotBuildError';
    this.problems = problems;
  }
}

/** Collects fail-level problems and warnings, so one run reports all of them. */
class Problems {
  readonly failures: string[] = [];
  readonly warnings: string[] = [];
  fail(message: string): void {
    this.failures.push(message);
  }
  warn(message: string): void {
    this.warnings.push(message);
  }
  throwIfAny(): void {
    if (this.failures.length > 0) throw new SnapshotBuildError(this.failures);
  }
}

export function buildSnapshot(raw: RawPages, previous: Snapshot | null): BuildResult {
  const problems = new Problems();

  const game = parsePage(raw, 'Data:Game.json') as { elements?: unknown };
  const elements = readElements(game.elements);
  const elementKind = new Map(elements.map((e) => [e.name, e.kind]));

  const wikiDragons = readArray(parsePage(raw, 'Data:Dragons.json'), 'dragons', 'Data:Dragons.json');
  const dragons = wikiDragons.flatMap((record, i) => {
    const dragon = readDragon(record, i, elementKind, problems);
    return dragon ? [dragon] : [];
  });
  // Every named record counts as known, so a bad record fails once, not again on each page naming it.
  const seen = new Set<string>();
  for (const record of wikiDragons) {
    const name = isRecord(record) ? record.Name : undefined;
    if (typeof name !== 'string') continue;
    if (seen.has(name)) problems.fail(`Data:Dragons.json names ${name} more than once`);
    seen.add(name);
  }

  const wikiPages = readArray(parsePage(raw, 'Data:Dragonarium.json'), 'dragonarium', 'Data:Dragonarium.json');
  const pages = wikiPages.flatMap((record, i) => {
    const page = readPage(record, i, seen, problems);
    return page ? [page] : [];
  });

  problems.throwIfAny();

  const onAPage = new Set(pages.flatMap((p) => p.dragons));
  for (const d of dragons) {
    if (!onAPage.has(d.name)) problems.warn(`${d.name} is on no Dragonarium page (search still finds it)`);
  }

  const pageRevisions = Object.fromEntries(PAGE_TITLES.map((t) => [t, raw.pages[t].revision]));
  const snapshot: Snapshot = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      revision: revisionOf(pageRevisions),
      source: raw.source,
      license: 'CC BY-SA 3.0',
      pageRevisions,
      fetchedAt: raw.fetchedAt,
    },
    // TODO(#26): only Elements used by at least one Route, once Routes exist.
    elements,
    opposites: OPPOSITES.map(([a, b]) => [a, b]),
    dragons,
    pages,
    renames: { ...previous?.renames },
  };

  const report = { ...reportOn(snapshot, elementKind, problems.warnings), ...compareWithPrevious(previous, dragons) };
  return { snapshot, report };
}

// ---- Elements ----------------------------------------------------------------

/** Data:Game.json `elements`: kind -> names. Non-array entries (boostable, …) aren't kinds. */
function readElements(groups: unknown): Element[] {
  if (!isRecord(groups)) throw new SnapshotBuildError(['Data:Game.json has no elements object']);
  const elements: Element[] = [];
  const problems: string[] = [];
  for (const [kind, names] of Object.entries(groups)) {
    if (!Array.isArray(names)) continue;
    if (!(ELEMENT_KINDS as readonly string[]).includes(kind)) {
      problems.push(`Data:Game.json lists an unknown kind of Element: ${kind}`);
      continue;
    }
    for (const name of names) {
      if (typeof name !== 'string') problems.push(`Data:Game.json elements.${kind} holds a non-string`);
      else elements.push({ name, kind: kind as ElementKind, icon: null });
    }
  }
  if (problems.length > 0) throw new SnapshotBuildError(problems);
  return elements;
}

// ---- Dragons -----------------------------------------------------------------

type WikiDragon = {
  Name: string;
  Alias?: string;
  Rarity: string;
  Order: number;
  Elements: string[];
  BreedingElements?: string[];
  IsLimited?: boolean;
  Traits?: unknown;
};

function readDragon(
  record: unknown,
  index: number,
  elementKind: ReadonlyMap<string, ElementKind>,
  problems: Problems,
): Dragon | null {
  if (!isWikiDragon(record)) {
    problems.fail(`Data:Dragons.json dragons[${index}] lacks a Name, Rarity, Order or Elements, or has the wrong types`);
    return null;
  }
  const name = record.Name;
  let ok = true;

  if (!(RARITIES as readonly string[]).includes(record.Rarity)) {
    problems.fail(`${name} has unknown rarity "${record.Rarity}"`);
    ok = false;
  }
  for (const [field, list] of [
    ['Elements', record.Elements],
    ['BreedingElements', record.BreedingElements ?? []],
  ] as const) {
    for (const e of list) {
      if (!elementKind.has(e)) {
        problems.fail(`${name} has unknown Element "${e}" in ${field}`);
        ok = false;
      }
    }
  }
  const traits = readTraits(record, elementKind, problems);
  if (!ok || !traits) return null;

  const rarity = record.Rarity as Rarity;
  const epics = record.Elements.filter((e) => elementKind.get(e) === 'epic');
  return {
    name,
    wikiPage: BARE_PAGE_RARITIES.has(rarity) ? name : `${record.Alias ?? name} Dragon`,
    rarity,
    order: record.Order,
    elements: [...record.Elements],
    breedingElements: unique([...(record.BreedingElements ?? record.Elements), ...epics]),
    isLimited: record.IsLimited === true,
    traits,
    canBeParent: !isGemstoneOrCrystalline(rarity, record.Elements, elementKind) && !NON_PARENT_RARITIES.has(rarity),
    image: null,
    routes: [], // TODO(#26): from Data:BreedingHints.json
  };
}

/**
 * `{Available: "All"}` -> all (normal + Rift form). `{Default: X}` on a Dragon
 * with the Rift element -> fixed X (a Rift dragon). Absent or null -> none.
 */
function readTraits(record: WikiDragon, elementKind: ReadonlyMap<string, ElementKind>, problems: Problems): Traits | null {
  const traits = record.Traits;
  if (traits === undefined || traits === null) return { kind: 'none' };
  if (isRecord(traits) && Object.keys(traits).length === 1) {
    if (traits.Available === 'All') return { kind: 'all' };
    const element = traits.Default;
    if (typeof element === 'string') {
      if (!elementKind.has(element)) {
        problems.fail(`${record.Name} has unknown Element "${element}" in Traits`);
        return null;
      }
      if (!record.Elements.includes(RIFT)) {
        problems.fail(`${record.Name} has a fixed trait (${element}) but no Rift element`);
        return null;
      }
      return { kind: 'fixed', element };
    }
  }
  problems.fail(`${record.Name} has Traits the scraper doesn't know: ${JSON.stringify(traits)}`);
  return null;
}

/** Gemstone and Crystalline Dragons: rarity Gemstone, or a gem Element (Gemstone, Crystalline). */
function isGemstoneOrCrystalline(rarity: string, elements: string[], elementKind: ReadonlyMap<string, ElementKind>): boolean {
  return rarity === 'Gemstone' || elements.some((e) => elementKind.get(e) === 'gem');
}

function isWikiDragon(value: unknown): value is WikiDragon {
  return (
    isRecord(value) &&
    typeof value.Name === 'string' &&
    typeof value.Rarity === 'string' &&
    typeof value.Order === 'number' &&
    isStringArray(value.Elements) &&
    (value.BreedingElements === undefined || isStringArray(value.BreedingElements)) &&
    (value.Alias === undefined || typeof value.Alias === 'string')
  );
}

// ---- Dragonarium pages ---------------------------------------------------------

function readPage(
  record: unknown,
  index: number,
  dragonNames: ReadonlySet<string>,
  problems: Problems,
): DragonariumPage | null {
  if (!isRecord(record) || typeof record.Collection !== 'string' || !isStringArray(record.Dragons)) {
    problems.fail(`Data:Dragonarium.json dragonarium[${index}] lacks a Collection or Dragons list`);
    return null;
  }
  const name = record.Collection;
  const tags = isStringArray(record.Tags) ? record.Tags : [];
  const groups = PAGE_GROUPS.filter((g) => tags.includes(g));
  if (groups.length !== 1) {
    problems.fail(`Dragonarium page ${name} needs exactly one group tag (elemental, epic, special); it has ${JSON.stringify(tags)}`);
    return null;
  }
  const unknown = record.Dragons.filter((d) => !dragonNames.has(d));
  for (const d of unknown) problems.fail(`Dragonarium page ${name} names unknown Dragon "${d}"`);
  if (unknown.length > 0) return null;
  return { name, group: groups[0]!, dragons: [...record.Dragons], icon: null };
}

// ---- Helpers -------------------------------------------------------------------

function parsePage(raw: RawPages, title: (typeof PAGE_TITLES)[number]): unknown {
  try {
    return JSON.parse(raw.pages[title].content);
  } catch (error) {
    throw new SnapshotBuildError([`${title} isn't valid JSON: ${(error as Error).message}`]);
  }
}

function readArray(page: unknown, key: string, title: string): unknown[] {
  const list = isRecord(page) ? page[key] : undefined;
  if (!Array.isArray(list)) throw new SnapshotBuildError([`${title} has no ${key} array`]);
  return list;
}

/** Identifies the snapshot by the page revisions it was built from. */
function revisionOf(pageRevisions: Record<string, number>): string {
  const input = JSON.stringify({ schemaVersion: SCHEMA_VERSION, pageRevisions });
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

function reportOn(
  snapshot: Snapshot,
  elementKind: ReadonlyMap<string, ElementKind>,
  warnings: string[],
): Omit<BuildReport, keyof SnapshotChanges> {
  const count = <T>(items: T[], test: (item: T) => boolean) => items.filter(test).length;
  const { dragons, pages } = snapshot;
  return {
    warnings,
    counts: {
      dragons: dragons.length,
      pages: {
        elemental: count(pages, (p) => p.group === 'elemental'),
        epic: count(pages, (p) => p.group === 'epic'),
        special: count(pages, (p) => p.group === 'special'),
      },
      traits: {
        all: count(dragons, (d) => d.traits.kind === 'all'),
        fixed: count(dragons, (d) => d.traits.kind === 'fixed'),
        none: count(dragons, (d) => d.traits.kind === 'none'),
      },
      gemstoneAndCrystalline: count(dragons, (d) => isGemstoneOrCrystalline(d.rarity, d.elements, elementKind)),
      cannotBeParent: count(dragons, (d) => !d.canBeParent),
      limited: count(dragons, (d) => d.isLimited),
    },
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
