// Cuts fixtures/real-records.json from the raw pages: a few real Dragon
// records and their hints, kept raw (wiki field names), shared by the scraper
// and core tests. `npm run snapshot -- --offline --fixture` rewrites it.

import { OPPOSITES } from './build';
import { PAGE_TITLES, type RawPages } from './pages';

export const REAL_RECORDS_FILE = 'fixtures/real-records.json';

/** The Dragons the tests use, in this order. */
export const REAL_RECORD_NAMES = [
  'Lava',
  'Rainbow',
  'Zaffer',
  'Sun',
  'Gold Olympus',
  'Seasonal',
  'Ironwood',
  'Nebula',
] as const;

type WikiDragon = { Name: string } & Record<string, unknown>;
type WikiHint = Record<string, unknown>;

export type RealRecords = {
  about: string;
  source: string;
  license: 'CC BY-SA 3.0';
  fetchedAt: string;
  pageRevisions: Record<string, number>;
  /** Data:Dragons.json records for REAL_RECORD_NAMES. */
  dragons: WikiDragon[];
  /** Data:BreedingHints.json entries for REAL_RECORD_NAMES. */
  breedingHints: Record<string, WikiHint>;
  /** Records the featured ones lean on: the 10 basic primaries and every Dragon their hints name. */
  supporting: { dragons: WikiDragon[]; breedingHints: Record<string, WikiHint> };
  /** Data:Game.json `elements`, as-is. */
  elements: Record<string, unknown>;
  opposites: [string, string][];
};

export function cutRealRecords(raw: RawPages): RealRecords {
  const dragons = (JSON.parse(raw.pages['Data:Dragons.json'].content) as { dragons: WikiDragon[] }).dragons;
  const hints = (JSON.parse(raw.pages['Data:BreedingHints.json'].content) as { breedingHints: Record<string, WikiHint> })
    .breedingHints;
  const game = JSON.parse(raw.pages['Data:Game.json'].content) as { elements: Record<string, unknown> };

  const byName = new Map(dragons.map((d) => [d.Name, d]));
  const record = (name: string): WikiDragon => {
    const found = byName.get(name);
    if (!found) throw new Error(`Data:Dragons.json has no Dragon named ${name}`);
    return found;
  };
  const hintsFor = (names: readonly string[]) =>
    Object.fromEntries(names.filter((n) => hints[n] !== undefined).map((n) => [n, hints[n] as WikiHint]));

  const featured = new Set<string>(REAL_RECORD_NAMES);
  const primaries = (game.elements.primary as string[] | undefined) ?? [];
  const named = REAL_RECORD_NAMES.flatMap((n) => (hints[n]?.RequiredDragons as string[] | undefined) ?? []);
  const supportingNames = [...new Set([...primaries, ...named])].filter((n) => !featured.has(n));

  return {
    about:
      'Real records cut from the committed raw pages (public/data/raw) by scraper/fixture.ts. ' +
      'Raw wiki field names. Data from the DragonVale Wiki, CC BY-SA 3.0.',
    source: raw.source,
    license: 'CC BY-SA 3.0',
    fetchedAt: raw.fetchedAt,
    pageRevisions: Object.fromEntries(PAGE_TITLES.map((t) => [t, raw.pages[t].revision])),
    dragons: REAL_RECORD_NAMES.map(record),
    breedingHints: hintsFor(REAL_RECORD_NAMES),
    supporting: {
      dragons: supportingNames.map(record),
      breedingHints: hintsFor(supportingNames),
    },
    elements: game.elements,
    opposites: OPPOSITES,
  };
}
