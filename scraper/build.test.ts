import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SCHEMA_VERSION, type Snapshot } from '../src/lib/snapshot';
import { buildSnapshot, SnapshotBuildError } from './build';
import { fetchPages, PAGE_TITLES, RAW_DIR, type RawPages } from './pages';
import { REAL_RECORDS_FILE, type RealRecords } from './fixture';

const root = join(import.meta.dirname, '..');

type WikiDragon = Record<string, unknown>;
type WikiPage = { Collection: string; Dragons: string[]; Tags: string[] };

const records: RealRecords = JSON.parse(await readFile(join(root, REAL_RECORDS_FILE), 'utf8'));
const realDragons = [...records.dragons, ...records.supporting.dragons];
const realHints: Record<string, unknown> = { ...records.breedingHints, ...records.supporting.breedingHints };

/**
 * The hints for `dragons`: the real hint where there is one, else `{Any: true}`
 * for a Dragon that isn't a primary, so every Dragon has a Route.
 */
function hintsFor(dragons: WikiDragon[]): Record<string, unknown> {
  return Object.fromEntries(
    dragons.flatMap((d) => {
      const name = d.Name as string;
      const hint = realHints[name] ?? (d.Rarity === 'Primary' ? undefined : { Any: true });
      return hint === undefined ? [] : [[name, hint]];
    }),
  );
}

/** RawPages built from wiki-shaped records. Every Dragon sits on one Special page unless `pages` is given. */
function rawPages({
  dragons = realDragons,
  pages,
  elements = records.elements,
  hints = hintsFor(dragons),
}: {
  dragons?: WikiDragon[];
  pages?: WikiPage[];
  elements?: Record<string, unknown>;
  hints?: Record<string, unknown>;
} = {}): RawPages {
  const content: Record<string, unknown> = {
    'Data:Dragons.json': { dragons },
    'Data:BreedingHints.json': { breedingHints: hints },
    'Data:Game.json': { elements },
    'Data:Dragonarium.json': {
      dragonarium: pages ?? [{ Collection: 'All', Dragons: dragons.map((d) => d.Name), Tags: ['all', 'special'] }],
    },
    'Data:Limited.json': {},
  };
  return {
    source: 'https://dragonvale.fandom.com',
    fetchedAt: '2026-10-01T00:00:00.000Z',
    pages: Object.fromEntries(
      PAGE_TITLES.map((t, i) => [t, { revision: 100 + i, content: JSON.stringify(content[t]) }]),
    ) as RawPages['pages'],
  };
}

const dragon = (snapshot: Snapshot, name: string) => {
  const found = snapshot.dragons.find((d) => d.name === name);
  if (!found) throw new Error(`no ${name} in the snapshot`);
  return found;
};

const fire: WikiDragon = { Name: 'Fire', Rarity: 'Primary', Order: 2, Elements: ['Fire'] };

/** The problems a build fails with. */
function failures(raw: RawPages): string[] {
  try {
    buildSnapshot(raw, null);
  } catch (error) {
    if (error instanceof SnapshotBuildError) return error.problems;
    throw error;
  }
  throw new Error('buildSnapshot did not fail');
}

describe('buildSnapshot on the real records', () => {
  const { snapshot, report } = buildSnapshot(rawPages(), null);

  it('works out breedingElements: BreedingElements (else Elements) plus displayed epic elements', () => {
    expect(dragon(snapshot, 'Sun').breedingElements).toEqual(['Cold', 'Lightning', 'Sun']);
    expect(dragon(snapshot, 'Gold Olympus').breedingElements).toEqual(['Earth', 'Lightning', 'Olympus']);
    expect([...dragon(snapshot, 'Rainbow').breedingElements].sort()).toEqual(
      [...(records.elements.primary as string[]), 'Rainbow'].sort(),
    );
    expect(dragon(snapshot, 'Lava').breedingElements).toEqual(['Fire', 'Earth']);
  });

  it('keeps the displayed elements, rarity and order as they are', () => {
    expect(dragon(snapshot, 'Sun')).toMatchObject({ elements: ['Sun'], rarity: 'Epic', order: 32 });
    expect(dragon(snapshot, 'Nebula').rarity).toBe('Galaxy');
  });

  it('maps traits', () => {
    expect(dragon(snapshot, 'Lava').traits).toEqual({ kind: 'all' });
    expect(dragon(snapshot, 'Zaffer').traits).toMatchObject({ kind: 'fixed' });
    expect(dragon(snapshot, 'Plant').traits).toEqual({ kind: 'none' });
  });

  it('leaves images and icons for later', () => {
    expect(snapshot.dragons.every((d) => d.image === null)).toBe(true);
    expect(snapshot.elements.every((e) => e.icon === null)).toBe(true);
  });

  it('fills meta from the raw pages', () => {
    expect(snapshot.meta).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      source: 'https://dragonvale.fandom.com',
      license: 'CC BY-SA 3.0',
      fetchedAt: '2026-10-01T00:00:00.000Z',
      pageRevisions: { 'Data:Dragons.json': 100, 'Data:Limited.json': 104 },
    });
    expect(snapshot.meta.revision).toMatch(/^[0-9a-f]{12}$/);
    expect(buildSnapshot(rawPages(), null).snapshot.meta.revision).toBe(snapshot.meta.revision);
  });

  it('hard-codes the 5 opposite pairs', () => {
    expect(snapshot.opposites).toEqual([
      ['Plant', 'Metal'],
      ['Fire', 'Cold'],
      ['Earth', 'Air'],
      ['Lightning', 'Water'],
      ['Light', 'Dark'],
    ]);
  });

  it('gives every Element its kind from Data:Game.json', () => {
    expect(snapshot.elements).toContainEqual({ name: 'Fire', kind: 'primary', icon: null });
    expect(snapshot.elements).toContainEqual({ name: 'Rift', kind: 'rift', icon: null });
  });

  it('warns about nothing when every Dragon is on a page', () => {
    expect(report.warnings).toEqual([]);
  });

  it('keeps only the Elements some Route uses, in Data:Game.json order', () => {
    // Sun and Olympus are displayed (Sun, Gold Olympus) but no Route here needs them.
    expect(snapshot.elements.map((e) => e.name)).toEqual([
      'Plant', 'Fire', 'Earth', 'Cold', 'Lightning', 'Water', 'Air', 'Metal', 'Light', 'Dark', 'Rift',
    ]);
  });

  it('maps an Element hint to a Bred Route', () => {
    expect(dragon(snapshot, 'Lava').routes).toEqual([{ kind: 'bred', requirement: { elements: ['Earth', 'Fire'] } }]);
    expect(dragon(snapshot, 'Ironwood').routes).toEqual([
      { kind: 'bred', requirement: { elements: ['Plant', 'Metal'] } },
    ]);
    expect(dragon(snapshot, 'Seasonal').routes).toEqual([
      { kind: 'bred', requirement: { elements: ['Air', 'Fire', 'Plant'] } },
    ]);
  });

  it("marks a Rift dragon's Route rift-only, with each named parent's trait as a badge", () => {
    expect(dragon(snapshot, 'Zaffer').routes).toEqual([
      {
        kind: 'bred',
        requirement: { parents: ['Blue Fire', 'Plasma'], elements: ['Rift'] },
        rift: 'only',
        conditions: {
          namedParentTraits: [
            { dragon: 'Blue Fire', trait: 'Air' },
            { dragon: 'Plasma', trait: 'Metal' },
          ],
        },
      },
    ]);
  });

  it("gives Nebula a Co-op bred Route: a friend's Nebula plus any Dragon", () => {
    expect(dragon(snapshot, 'Nebula').routes).toEqual([{ kind: 'coop', friendsDragon: 'Nebula' }]);
  });

  it('gives the basic primaries a Bred and a Purchased Route; Air keeps its hint', () => {
    expect(dragon(snapshot, 'Plant').routes).toEqual([
      { kind: 'bred', requirement: { elements: ['Plant'] } },
      { kind: 'purchased' },
    ]);
    expect(dragon(snapshot, 'Air').routes).toEqual([
      { kind: 'bred', requirement: { parents: ['Water', 'Fire'] } },
      { kind: 'purchased' },
    ]);
  });
});

describe('buildSnapshot rules on small records', () => {
  it('takes wikiPage from Alias, else the name, with the bare name for Legendary and Mythic', () => {
    const { snapshot } = buildSnapshot(
      rawPages({
        dragons: [
          fire,
          { Name: 'Snowflake 1', Alias: 'Snowflake', Rarity: 'Epic', Order: 3, Elements: ['Snowflake'] },
          { Name: 'Kairos', Alias: 'Dragon of Time', Rarity: 'Legendary', Order: 4, Elements: ['Time'] },
          { Name: 'Tiamat', Rarity: 'Mythic', Order: 5, Elements: ['Mythic'] },
        ],
      }),
      null,
    );
    expect(snapshot.dragons.map((d) => d.wikiPage)).toEqual(['Fire Dragon', 'Snowflake Dragon', 'Kairos', 'Tiamat']);
  });

  it('marks Gemstone, Crystalline, Legendary and Mythic Dragons as never parents, and counts the gems', () => {
    const { snapshot, report } = buildSnapshot(
      rawPages({
        dragons: [
          fire,
          { Name: 'Emerald', Rarity: 'Gemstone', Order: 3, Elements: ['Gemstone'], BreedingElements: ['Plant'] },
          { Name: 'Jasper', Rarity: 'Gemstone', Order: 4, Elements: ['Crystalline'], BreedingElements: ['Metal'] },
          { Name: 'Kairos', Rarity: 'Legendary', Order: 5, Elements: ['Time'] },
          { Name: 'Bahamut', Rarity: 'Mythic', Order: 6, Elements: ['Mythic'] },
        ],
      }),
      null,
    );
    expect(snapshot.dragons.map((d) => [d.name, d.canBeParent])).toEqual([
      ['Fire', true],
      ['Emerald', false],
      ['Jasper', false],
      ['Kairos', false],
      ['Bahamut', false],
    ]);
    expect(report.counts.gemstoneAndCrystalline).toBe(2);
    expect(report.counts.cannotBeParent).toBe(4);
  });

  it('reads IsLimited, absent meaning not limited', () => {
    const { snapshot } = buildSnapshot(
      rawPages({ dragons: [fire, { Name: 'Bone', Rarity: 'Rare', Order: 3, Elements: ['Dark'], IsLimited: true }] }),
      null,
    );
    expect(snapshot.dragons.map((d) => d.isLimited)).toEqual([false, true]);
  });

  it('builds pages with their group, Dragons in the game order, and no icon yet', () => {
    const { snapshot, report } = buildSnapshot(
      rawPages({
        dragons: [fire, { Name: 'Lava', Rarity: 'Hybrid', Order: 9, Elements: ['Fire', 'Earth'] }],
        pages: [
          { Collection: 'Fire', Dragons: ['Lava', 'Fire'], Tags: ['all', 'elemental'] },
          { Collection: 'Vintage', Dragons: ['Lava'], Tags: ['all', 'special'] },
        ],
      }),
      null,
    );
    expect(snapshot.pages).toEqual([
      { name: 'Fire', group: 'elemental', dragons: ['Lava', 'Fire'], icon: null },
      { name: 'Vintage', group: 'special', dragons: ['Lava'], icon: null },
    ]);
    expect(report.counts.pages).toEqual({ elemental: 1, epic: 0, special: 1 });
  });

  it('carries renames over from the previous snapshot', () => {
    const first = buildSnapshot(rawPages({ dragons: [fire] }), null).snapshot;
    expect(first.renames).toEqual({});
    const previous: Snapshot = { ...first, renames: { Flame: 'Fire' } };
    expect(buildSnapshot(rawPages({ dragons: [fire] }), previous).snapshot.renames).toEqual({ Flame: 'Fire' });
  });

  it('reports added and removed names and rename candidates against the previous snapshot', () => {
    expect(buildSnapshot(rawPages({ dragons: [fire] }), null).report).toMatchObject({
      added: [],
      removed: [],
      renameCandidates: [],
    });
    const previous = buildSnapshot(rawPages({ dragons: [{ ...fire, Name: 'Flame' }] }), null).snapshot;
    const { snapshot, report } = buildSnapshot(rawPages({ dragons: [fire] }), previous);
    expect(report).toMatchObject({
      added: ['Fire'],
      removed: ['Flame'],
      renameCandidates: [{ from: 'Flame', to: 'Fire', reason: 'same-order' }],
    });
    expect(snapshot.renames).toEqual({});
  });

  it('warns about a Dragon on no Dragonarium page', () => {
    const { snapshot, report } = buildSnapshot(
      rawPages({
        dragons: [fire, { Name: 'Lava', Rarity: 'Hybrid', Order: 9, Elements: ['Fire', 'Earth'] }],
        pages: [{ Collection: 'Fire', Dragons: ['Fire'], Tags: ['all', 'elemental'] }],
      }),
      null,
    );
    expect(snapshot.dragons.map((d) => d.name)).toContain('Lava');
    expect(report.warnings).toEqual([expect.stringContaining('Lava is on no Dragonarium page')]);
  });
});

describe('Routes from hand-built hints', () => {
  const water: WikiDragon = { Name: 'Water', Rarity: 'Primary', Order: 3, Elements: ['Water'] };
  const odd = (fields: WikiDragon = {}): WikiDragon => ({ Name: 'Odd', Rarity: 'Rare', Order: 9, Elements: ['Fire'], ...fields });
  /** The Routes of `target`, built with Fire, Water and `more` next to it. */
  const routesOf = (target: WikiDragon, hint: unknown, more: WikiDragon[] = []) => {
    const name = target.Name as string;
    const raw = rawPages({ dragons: [fire, water, ...more, target], hints: { ...hintsFor(more), [name]: hint } });
    return dragon(buildSnapshot(raw, null).snapshot, name).routes;
  };

  it('maps an evolution to an Evolved Route from the Devolution Dragon', () => {
    const hint = { BuyPrice: 5, BuyPriceType: 'Gems', IsEvolution: true, RequiredDecorations: ['Effigy of the Flame'] };
    expect(routesOf(odd({ Name: 'Ghostly Fire', Devolution: 'Fire' }), hint)).toEqual([
      { kind: 'evolved', from: 'Fire', decorations: ['Effigy of the Flame'] },
    ]);
  });

  it('maps artifacts to a Summoned Route', () => {
    const hint = { RequiredArtifacts: ['Chronolith', 'Time Claw', 'Statue of Kairos'] };
    expect(routesOf(odd({ Name: 'Kairos', Rarity: 'Legendary', Elements: ['Time'] }), hint)).toEqual([
      { kind: 'summoned', artifacts: ['Chronolith', 'Time Claw', 'Statue of Kairos'] },
    ]);
  });

  it('maps MinimumRequiredElements to minDistinctElements', () => {
    const hint = { MinimumRequiredElements: 4, RequiredElements: ['Light', 'Dark'] };
    expect(routesOf(odd({ Name: 'Dream' }), hint)).toEqual([
      { kind: 'bred', requirement: { elements: ['Light', 'Dark'], minDistinctElements: 4 } },
    ]);
  });

  it('maps RequiredElementsForBothParents to elementOnBothParents, without repeating elements', () => {
    const hint = { RequiredElements: ['Snowflake', 'Snowflake'], RequiredElementsForBothParents: ['Snowflake'] };
    const snowflake = odd({ Name: 'Snowflake 1', Elements: ['Snowflake'] });
    const { snapshot } = buildSnapshot(rawPages({ dragons: [fire, snowflake], hints: { 'Snowflake 1': hint } }), null);
    expect(dragon(snapshot, 'Snowflake 1').routes).toEqual([
      { kind: 'bred', requirement: { elements: ['Snowflake'], elementOnBothParents: 'Snowflake' } },
    ]);
    expect(snapshot.elements).toEqual([
      { name: 'Fire', kind: 'primary', icon: null },
      { name: 'Snowflake', kind: 'epic', icon: null },
    ]);
  });

  it('maps a bare Any to any pair (Motley, Dargon)', () => {
    expect(routesOf(odd({ Name: 'Motley' }), { BuyPrice: 10, BuyPriceType: 'Gems', Any: true })).toEqual([
      { kind: 'bred', requirement: { anyPair: true } },
    ]);
  });

  it('turns time, weather, alignment and parent trait into badges', () => {
    expect(routesOf(odd({ Name: 'Sun' }), { RequiredTime: 'Day', RequiredElements: ['Cold', 'Lightning'] })).toEqual([
      { kind: 'bred', requirement: { elements: ['Cold', 'Lightning'] }, conditions: { time: 'Day' } },
    ]);
    const tranquil = { RequiredDragons: ['Water'], RequiredElements: ['Fire'], RequiredWeather: 'Blossoms' };
    expect(routesOf(odd(), tranquil)).toEqual([
      { kind: 'bred', requirement: { parents: ['Water'], elements: ['Fire'] }, conditions: { weather: 'Blossoms' } },
    ]);
    const rift = odd({ Elements: ['Light', 'Rift'], Traits: { Default: 'Dark' } });
    const antumbra = { RiftAlignment: 'Earth', RequiredTraits: ['Fire'], RequiredElements: ['Light', 'Rift'] };
    expect(routesOf(rift, antumbra)).toEqual([
      {
        kind: 'bred',
        requirement: { elements: ['Light', 'Rift'] },
        rift: 'only',
        conditions: { alignment: 'Earth', parentTrait: 'Fire' },
      },
    ]);
  });

  it('maps Rigel and Solis: Rift on both parents, the prerequisite and the clone cave', () => {
    const galaxy = (name: string, elements: string[], fields: WikiDragon = {}) =>
      odd({ Name: name, Rarity: 'Galaxy', Elements: elements, ...fields });
    const rigel = galaxy('Rigel', ['Galaxy', 'Rift'], { Traits: { Default: 'Cold' } });
    const rigelHint = {
      RequiredElementsForBothParents: ['Galaxy', 'Rift'],
      RequiredCave: 'Rift',
      Prerequisites: { Owned: { Elements: ['Galaxy'] } },
    };
    expect(routesOf(rigel, rigelHint, [galaxy('Nebula', ['Galaxy']), galaxy('Comet', ['Galaxy'])])).toEqual([
      {
        kind: 'bred',
        requirement: { elementOnBothParents: 'Galaxy' },
        rift: 'only',
        conditions: { prerequisite: 'Own all 2 other Galaxy Dragons' },
      },
    ]);
    const solisHint = {
      RequiredDragons: ['Water'],
      RequiredElements: ['Galaxy'],
      RequiredCave: 'Any',
      RequiredCloneCave: 'Cooperative',
    };
    expect(routesOf(galaxy('Solis', ['Galaxy']), solisHint)).toEqual([
      { kind: 'bred', requirement: { parents: ['Water'], elements: ['Galaxy'] }, conditions: { cloneCave: 'Cooperative' } },
    ]);
  });

  it('gives a rift primary only a Purchased Route', () => {
    const fireRift = { Name: 'Fire Rift', Rarity: 'Rare', Order: 9, Elements: ['Fire', 'Rift'], Traits: { Default: 'Fire' } };
    const { snapshot } = buildSnapshot(rawPages({ dragons: [fire, fireRift], hints: {} }), null);
    expect(dragon(snapshot, 'Fire Rift').routes).toEqual([{ kind: 'purchased' }]);
  });
});

describe('buildSnapshot fails the run', () => {
  const odd = { Name: 'Odd', Rarity: 'Rare', Order: 3, Elements: ['Fire'] };
  const failuresWith = (hints: Record<string, unknown>) => failures(rawPages({ dragons: [fire, odd], hints }));

  it('on an unknown hint key, naming the key and the Dragon', () => {
    expect(failuresWith({ Odd: { RequiredElements: ['Fire'], RequiredMoon: 'Full' } })).toEqual([
      `Odd's breeding hint has unknown key "RequiredMoon"`,
    ]);
  });

  it('on a hint naming an unknown Element or Dragon, an evolution without a Devolution, or no hint at all', () => {
    expect(failuresWith({ Odd: { RequiredElements: ['Glitter'] } })).toEqual([
      `Odd has unknown Element "Glitter" in its breeding hint's RequiredElements`,
    ]);
    expect(failuresWith({ Odd: { RequiredDragons: ['Nobody'] } })).toEqual([
      'Odd names unknown Dragon "Nobody" in RequiredDragons',
    ]);
    expect(failuresWith({ Odd: { IsEvolution: true, RequiredDecorations: ['Set'] } })).toEqual([
      'Odd evolves (IsEvolution) but has no Devolution to evolve from',
    ]);
    expect(failuresWith({})).toEqual([
      "Odd has no breeding hint and isn't a primary or rift primary, so it has no Route",
    ]);
  });

  it('on an unknown Element name in Elements', () => {
    const raw = rawPages({ dragons: [fire, { Name: 'Odd', Rarity: 'Rare', Order: 3, Elements: ['Fire', 'Glitter'] }] });
    expect(failures(raw)).toEqual(['Odd has unknown Element "Glitter" in Elements']);
  });

  it('on an unknown Element name in BreedingElements', () => {
    const raw = rawPages({
      dragons: [fire, { Name: 'Odd', Rarity: 'Rare', Order: 3, Elements: ['Fire'], BreedingElements: ['Glitter'] }],
    });
    expect(failures(raw)).toEqual(['Odd has unknown Element "Glitter" in BreedingElements']);
  });

  it('on an unknown Element name in a fixed trait', () => {
    const raw = rawPages({
      dragons: [fire, { Name: 'Odd', Rarity: 'Rare', Order: 3, Elements: ['Fire', 'Rift'], Traits: { Default: 'Glitter' } }],
    });
    expect(failures(raw)).toEqual(['Odd has unknown Element "Glitter" in Traits']);
  });

  it('on an unknown rarity', () => {
    const raw = rawPages({ dragons: [fire, { Name: 'Odd', Rarity: 'Shiny', Order: 3, Elements: ['Fire'] }] });
    expect(failures(raw)).toEqual(['Odd has unknown rarity "Shiny"']);
  });

  it('on a Dragonarium page naming an unknown Dragon', () => {
    const raw = rawPages({
      dragons: [fire],
      pages: [{ Collection: 'Fire', Dragons: ['Fire', 'Nobody'], Tags: ['all', 'elemental'] }],
    });
    expect(failures(raw)).toEqual(['Dragonarium page Fire names unknown Dragon "Nobody"']);
  });

  it('with every problem listed in one clear message', () => {
    const raw = rawPages({
      dragons: [fire, { Name: 'Odd', Rarity: 'Shiny', Order: 3, Elements: ['Glitter'] }],
      pages: [{ Collection: 'Fire', Dragons: ['Fire', 'Nobody'], Tags: ['all', 'elemental'] }],
    });
    expect(() => buildSnapshot(raw, null)).toThrow(
      /3 problems[\s\S]*unknown rarity "Shiny"[\s\S]*unknown Element "Glitter"[\s\S]*unknown Dragon "Nobody"/,
    );
  });

  it('on traits it does not know, a fixed trait without the Rift element, a page with no group, or a duplicate name', () => {
    expect(failures(rawPages({ dragons: [fire, { ...fire, Name: 'Odd', Traits: { Available: 'Some' } }] }))).toEqual([
      expect.stringContaining("Odd has Traits the scraper doesn't know"),
    ]);
    expect(failures(rawPages({ dragons: [fire, { ...fire, Name: 'Odd', Traits: { Default: 'Fire' } }] }))).toEqual([
      'Odd has a fixed trait (Fire) but no Rift element',
    ]);
    expect(failures(rawPages({ dragons: [fire], pages: [{ Collection: 'Fire', Dragons: ['Fire'], Tags: ['all'] }] }))).toEqual([
      expect.stringContaining('Dragonarium page Fire needs exactly one group tag'),
    ]);
    expect(failures(rawPages({ dragons: [fire, fire] }))).toEqual(['Data:Dragons.json names Fire more than once']);
  });
});

describe('buildSnapshot on the full raw pages', () => {
  it('builds 983 Dragons and 52 pages, with the Rift page holding exactly the Rift dragons', async () => {
    const raw = await fetchPages({ kind: 'offline', dir: join(root, RAW_DIR) });
    const { snapshot, report } = buildSnapshot(raw, null);

    expect(snapshot.dragons).toHaveLength(983);
    expect(snapshot.pages).toHaveLength(52);
    // Spec §8 says 25 Epic and 17 Special; the wiki's own tags give 26 and 16
    // (Rift is tagged special, as the spec expects, so the difference is elsewhere).
    expect(report.counts.pages).toEqual({ elemental: 10, epic: 26, special: 16 });

    const riftDragons = snapshot.dragons.filter((d) => d.elements.includes('Rift')).map((d) => d.name);
    const riftPage = snapshot.pages.find((p) => p.name === 'Rift');
    expect(riftPage?.group).toBe('special');
    expect(riftDragons).toHaveLength(37);
    expect([...(riftPage?.dragons ?? [])].sort()).toEqual([...riftDragons].sort());

    expect(report.counts.traits).toEqual({ all: 905, fixed: 37, none: 41 });
    expect(snapshot.dragons.filter((d) => d.traits.kind === 'fixed').map((d) => d.name).sort()).toEqual(
      [...riftDragons].sort(),
    );
    expect(report.counts.gemstoneAndCrystalline).toBe(29);
    expect(report.warnings).toEqual([]);

    // Spec §4: 35 Evolved, 5 Summoned; Purchased are the 10 basic and 10 rift primaries.
    expect(snapshot.dragons.filter((d) => d.routes.length === 0)).toEqual([]);
    expect(report.counts.routes).toEqual({ bred: 914, coop: 19, evolved: 35, summoned: 5, purchased: 20 });
    // Rainbow, Surface and the gem, legendary, mythic and other Elements are displayed but no Route uses them.
    expect(snapshot.elements).toHaveLength(27);
  });
});
