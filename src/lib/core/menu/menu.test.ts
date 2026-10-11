import { describe, expect, it } from 'vitest';
import type { DragonariumPage, Rarity } from '../../snapshot';
import type { Cave } from '../breeding';
import {
  NOW,
  TODAY,
  TOMORROW,
  YESTERDAY,
  dragon,
  limited,
  primaries,
  riftDragon,
  snapshot,
  world,
  type Owned,
  type OverlaySpec,
} from '../testing/fixtures';
import type { World } from '../world';
import {
  NO_FILTERS,
  applyView,
  daysLeft,
  graphRoots,
  shownNames,
  sidebarCounts,
  tabContents,
  tabKey,
  type Filters,
  type OwnedForms,
  type Section,
  type Tab,
} from './index';

// ---- Fixture ------------------------------------------------------------------

const page = (name: string, group: DragonariumPage['group'], dragons: string[]): DragonariumPage => ({
  name,
  group,
  dragons,
  icon: null,
});

/**
 * Primaries (one form), Lava / Flower (Hybrid, both forms), Sun (Epic), Kampos
 * (Rift dragon), Love (limited, in rotation), Haystack (limited, Purchase only
 * in an Event) and Motley (limited, not Available).
 */
function cast() {
  return [
    ...primaries(),
    dragon({ name: 'Lava', elements: ['Fire', 'Earth'] }),
    dragon({ name: 'Flower', elements: ['Plant', 'Fire'] }),
    dragon({ name: 'Sun', rarity: 'Epic', elements: ['Sun'], breedingElements: ['Cold', 'Lightning', 'Sun'] }),
    riftDragon({ name: 'Kampos', elements: ['Water', 'Air'], trait: 'Water' }),
    limited({ name: 'Love', rarity: 'Rare', elements: ['Plant', 'Light'] }),
    limited({ name: 'Haystack', elements: ['Plant', 'Earth'] }),
    limited({ name: 'Motley', elements: ['Plant', 'Air'] }),
  ];
}

const PAGES = [
  page('Fire', 'elemental', ['Lava', 'Fire', 'Flower']),
  page('Plant', 'elemental', ['Plant', 'Flower', 'Love', 'Haystack', 'Motley']),
  page('Sun', 'epic', ['Sun']),
  page('Rift', 'special', ['Kampos']),
];

const EVENT: OverlaySpec = {
  rotation: [{ dragon: 'Love', ends: TOMORROW }],
  events: [
    {
      name: 'Harvest',
      ends: TOMORROW,
      currency: 'Spice',
      shop: [{ dragon: 'Haystack', cost: 1500, breedable: false }, { dragon: 'Lava', cost: 200 }],
    },
  ],
  notRecognised: ['Pumpkin'],
};

function menuWorld(owned: Owned = [], overlay: OverlaySpec = EVENT, now = NOW): World {
  return world({ snapshot: snapshot(cast(), { pages: PAGES }), owned, overlay, now });
}

const names = (sections: readonly Section[]) => sections.map((s) => s.items.map((i) => i.dragon.name));
const flat = (sections: readonly Section[]) => names(sections).flat();

const filters = (
  f: Partial<Omit<Filters, 'rarities' | 'elements'>> & { rarities?: Rarity[]; elements?: string[] } = {},
): Filters => ({
  ...NO_FILTERS,
  ...f,
  rarities: new Set(f.rarities ?? []),
  elements: new Set(f.elements ?? []),
});

const either = { ownedForms: 'either' as OwnedForms };

/** applyView on `tab` with no search. */
function view(w: World, tab: Tab, f: Filters = NO_FILTERS, ownedForms: OwnedForms = 'either', cave: Cave = 'normal', query = '') {
  return applyView(tabContents(w, tab, cave).sections, query, f, { ownedForms }, w, cave);
}

const FIRE: Tab = { kind: 'page', page: 'Fire' };
const PLANT: Tab = { kind: 'page', page: 'Plant' };

// ---- tabContents ----------------------------------------------------------------

describe('tabKey', () => {
  it('names each tab, a page by its name', () => {
    expect(tabKey({ kind: 'page', page: 'Spooky' })).toBe('page:Spooky');
    expect(tabKey({ kind: 'all' })).toBe('all');
    expect(tabKey({ kind: 'breedable' })).toBe('breedable');
    expect(tabKey({ kind: 'limited' })).toBe('limited');
    expect(tabKey({ kind: 'event' })).toBe('event');
  });

  it('tells pages apart', () => {
    expect(tabKey({ kind: 'page', page: 'Fire' })).not.toBe(tabKey({ kind: 'page', page: 'Rift' }));
  });
});

describe('tabContents', () => {
  it('a Dragonarium page holds its Dragons in the game order', () => {
    const contents = tabContents(menuWorld(), FIRE, 'normal');
    expect(contents.sections).toHaveLength(1);
    expect(contents.sections[0]).toMatchObject({ kind: 'page', page: { name: 'Fire', group: 'elemental' } });
    expect(names(contents.sections)).toEqual([['Lava', 'Fire', 'Flower']]);
    expect(contents).toMatchObject({ noEvent: false, notRecognised: [] });
  });

  it('an unknown page has no sections', () => {
    expect(tabContents(menuWorld(), { kind: 'page', page: 'Nope' }, 'normal').sections).toEqual([]);
  });

  it('All holds every Dragon once, in release order, whatever the cave', () => {
    const dragons = cast();
    const shuffled = world({ snapshot: snapshot([...dragons].reverse(), { pages: PAGES }), overlay: EVENT, now: NOW });
    const byOrder = [...dragons].sort((a, b) => a.order - b.order).map((d) => d.name);
    for (const cave of ['normal', 'rift', 'coop'] as const) {
      const contents = tabContents(shuffled, { kind: 'all' }, cave);
      expect(contents.sections.map((s) => s.kind)).toEqual(['all']);
      expect(flat(contents.sections)).toEqual(byOrder);
      expect(contents).toMatchObject({ noEvent: false, notRecognised: [] });
    }
  });

  it('Breedable now lists what the chosen cave can breed now', () => {
    const w = menuWorld(['Fire', 'Earth', 'Plant', 'Water', 'Air']);
    const normal = flat(tabContents(w, { kind: 'breedable' }, 'normal').sections);
    expect(normal).toEqual(expect.arrayContaining(['Lava', 'Flower']));
    expect(normal).not.toContain('Kampos'); // a Rift dragon
    expect(normal).not.toContain('Haystack'); // Purchase only
    expect(normal).not.toContain('Motley'); // not Available
    expect(normal).not.toContain('Fire'); // owned
    // The Rift cave has no Rift breeding parents in this Collection.
    expect(flat(tabContents(w, { kind: 'breedable' }, 'rift').sections)).toEqual([]);
  });

  it('Limited rotation lists the overlay with end dates', () => {
    const contents = tabContents(menuWorld(), { kind: 'limited' }, 'normal');
    expect(contents.sections).toEqual([
      { kind: 'rotation', items: [{ dragon: expect.objectContaining({ name: 'Love' }), ends: TOMORROW }] },
    ]);
  });

  it('Event has one section per running event with name, end date, currency and costs', () => {
    const w = menuWorld([], {
      events: [
        EVENT.events![0]!,
        { name: 'Frost', ends: null, currency: null, shop: [{ dragon: 'Motley', cost: null, ends: TODAY }] },
      ],
      notRecognised: ['Pumpkin'],
    });
    const contents = tabContents(w, { kind: 'event' }, 'normal');
    expect(contents.noEvent).toBe(false);
    expect(contents.notRecognised).toEqual(['Pumpkin']);
    expect(contents.sections.map((s) => s.kind === 'event' && s.event)).toEqual([
      { name: 'Harvest', ends: TOMORROW, currency: 'Spice' },
      { name: 'Frost', ends: null, currency: null },
    ]);
    const [harvest, frost] = contents.sections;
    expect(harvest!.items.map((i) => [i.dragon.name, i.cost, i.ends])).toEqual([
      ['Haystack', 1500, TOMORROW],
      ['Lava', 200, TOMORROW],
    ]);
    expect(frost!.items.map((i) => [i.dragon.name, i.cost, i.ends])).toEqual([['Motley', null, TODAY]]);
  });

  it('Event with no running event is empty and marked "No event", keeping Not recognised', () => {
    const contents = tabContents(menuWorld([], { notRecognised: ['Pumpkin'] }), { kind: 'event' }, 'normal');
    expect(contents).toEqual({ sections: [], noEvent: true, notRecognised: ['Pumpkin'] });
  });

  it('expired entries are absent: ended events, shop entries and rotation entries', () => {
    const w = menuWorld([], {
      rotation: [
        { dragon: 'Love', ends: YESTERDAY },
        { dragon: 'Motley', ends: TODAY },
      ],
      events: [
        { name: 'Old', ends: YESTERDAY, shop: ['Haystack'] },
        { name: 'Now', ends: TOMORROW, shop: [{ dragon: 'Haystack', ends: YESTERDAY }, 'Lava'] },
      ],
    });
    expect(flat(tabContents(w, { kind: 'limited' }, 'normal').sections)).toEqual(['Motley']);
    const events = tabContents(w, { kind: 'event' }, 'normal');
    expect(events.sections.map((s) => s.kind === 'event' && s.event.name)).toEqual(['Now']);
    expect(flat(events.sections)).toEqual(['Lava']);
  });

  it('an overlay that ended before World time leaves the Event tab at "No event"', () => {
    const later = new Date(2026, 9, 7, 9);
    const contents = tabContents(menuWorld([], EVENT, later), { kind: 'event' }, 'normal');
    expect(contents.noEvent).toBe(true);
    expect(flat(tabContents(menuWorld([], EVENT, later), { kind: 'limited' }, 'normal').sections)).toEqual([]);
  });

  it('daysLeft counts whole local days, 0 on the last day', () => {
    expect(daysLeft(TODAY, NOW)).toBe(0);
    expect(daysLeft(TOMORROW, NOW)).toBe(1);
    expect(daysLeft('2026-11-04', NOW)).toBe(30);
    expect(daysLeft(null, NOW)).toBeNull();
  });
});

// ---- applyView: filters -----------------------------------------------------------

describe('applyView filters', () => {
  // Owns Plant, Air, Earth and Flower (normal form). Motley's pool is covered but it isn't Available.
  const owned: Owned = { Plant: true, Flower: 'normal', Air: true, Earth: true };

  it('no filters keeps the tab as it is', () => {
    const w = menuWorld(owned);
    expect(names(view(w, PLANT).sections)).toEqual([['Plant', 'Flower', 'Love', 'Haystack', 'Motley']]);
  });

  it('Breedable now alone', () => {
    const w = menuWorld(owned);
    // Love needs Light; Haystack is Purchase only; Motley isn't Available.
    expect(flat(view(w, PLANT, filters({ breedableNow: true })).sections)).toEqual([]);
    // Flower carries Fire, so Lava (with Earth) is Breedable now; Fire isn't, since it breeds only from a Fire.
    expect(flat(view(w, FIRE, filters({ breedableNow: true })).sections)).toEqual(['Lava']);
    const w2 = menuWorld({ ...owned, Fire: true });
    expect(flat(view(w2, FIRE, filters({ breedableNow: true })).sections)).toEqual(['Lava']);
  });

  it('Breedable now uses the chosen cave', () => {
    const w = menuWorld({ Fire: true, Earth: true, Lava: 'rift' });
    // Normal cave: Lava owned (normal form not, but Lava is breedable as Fire + Earth).
    expect(flat(view(w, FIRE, filters({ breedableNow: true }), 'either', 'normal').sections)).toEqual(['Lava']);
    // Rift cave: Lava's Rift form is owned; Flower needs Plant.
    expect(flat(view(w, FIRE, filters({ breedableNow: true }), 'either', 'rift').sections)).toEqual([]);
  });

  it('Available now hides Dragons that are not Available', () => {
    const w = menuWorld(owned);
    expect(flat(view(w, PLANT, filters({ availableNow: true })).sections)).toEqual(['Plant', 'Flower', 'Love', 'Haystack']);
  });

  it('Show Owned alone and Show Not owned alone', () => {
    const w = menuWorld(owned);
    expect(flat(view(w, PLANT, filters({ show: 'owned' })).sections)).toEqual(['Plant', 'Flower']);
    expect(flat(view(w, PLANT, filters({ show: 'not-owned' })).sections)).toEqual(['Love', 'Haystack', 'Motley']);
  });

  it('Rarity alone; none ticked means all', () => {
    const w = menuWorld(owned);
    expect(flat(view(w, PLANT, filters({ rarities: ['Rare'] })).sections)).toEqual(['Love']);
    expect(flat(view(w, PLANT, filters({ rarities: ['Primary', 'Rare'] })).sections)).toEqual(['Plant', 'Love']);
    expect(flat(view(w, PLANT, filters({ rarities: [] })).sections)).toHaveLength(5);
  });

  it('Element alone: a Dragon must display every ticked Element; none ticked means all', () => {
    const w = menuWorld(owned);
    expect(flat(view(w, FIRE, filters({ elements: ['Plant'] })).sections)).toEqual(['Flower']);
    expect(flat(view(w, PLANT, filters({ elements: ['Plant', 'Fire'] })).sections)).toEqual(['Flower']);
    expect(flat(view(w, FIRE, filters({ elements: ['Plant', 'Earth'] })).sections)).toEqual([]);
    expect(flat(view(w, PLANT, filters({ elements: [] })).sections)).toHaveLength(5);
  });

  it('Element Match exact: the Dragon displays the ticked Elements and no other', () => {
    const w = menuWorld(owned);
    expect(flat(view(w, PLANT, filters({ elements: ['Plant'], elementMatch: 'exact' })).sections)).toEqual(['Plant']);
    expect(flat(view(w, FIRE, filters({ elements: ['Fire', 'Plant'], elementMatch: 'exact' })).sections)).toEqual([
      'Flower',
    ]);
    expect(flat(view(w, PLANT, filters({ elementMatch: 'exact' })).sections)).toHaveLength(5);
  });

  it('filters combine', () => {
    const w = menuWorld(owned);
    expect(flat(view(w, PLANT, filters({ show: 'not-owned', rarities: ['Hybrid'] })).sections)).toEqual([
      'Haystack',
      'Motley',
    ]);
    const w2 = menuWorld({ Fire: true, Earth: true, Plant: true });
    expect(flat(view(w2, FIRE, filters({ breedableNow: true, show: 'not-owned', rarities: ['Hybrid'] })).sections)).toEqual([
      'Lava',
      'Flower',
    ]);
    expect(flat(view(w2, FIRE, filters({ breedableNow: true, show: 'owned' })).sections)).toEqual([]);
  });

  it('owned/total ignore the filters but follow the tab', () => {
    const w = menuWorld(owned);
    const v = view(w, PLANT, filters({ show: 'not-owned' }));
    expect(v).toMatchObject({ owned: 2, total: 5 });
  });

  it('Event sections keep their header when filtered empty', () => {
    const v = view(menuWorld(), { kind: 'event' }, filters({ show: 'owned' }));
    expect(v.sections).toHaveLength(1);
    expect(v.sections[0]).toMatchObject({ kind: 'event', event: { name: 'Harvest' }, items: [] });
  });

  it('shownNames lists each shown Dragon once, for Select all shown', () => {
    const w = menuWorld();
    const sections = applyView(
      [...tabContents(w, FIRE, 'normal').sections, ...tabContents(w, PLANT, 'normal').sections],
      '',
      filters({ rarities: ['Hybrid'] }),
      either,
      w,
      'normal',
    ).sections;
    expect(shownNames(sections)).toEqual(['Lava', 'Flower', 'Haystack', 'Motley']);
  });

  it('graphRoots: a tab graph is rooted at the shown Dragons, or the whole tab on Show all', () => {
    const w = menuWorld();
    const tab = [...tabContents(w, FIRE, 'normal').sections, ...tabContents(w, PLANT, 'normal').sections];
    const shown = applyView(tab, '', filters({ rarities: ['Hybrid'] }), either, w, 'normal').sections;

    const some = graphRoots(tab, shown, false);
    expect(some).toMatchObject({ names: ['Lava', 'Flower', 'Haystack', 'Motley'], narrowed: true });
    expect(some.tabCount).toBe(shownNames(tab).length);

    expect(graphRoots(tab, shown, true)).toMatchObject({ names: shownNames(tab), narrowed: true });
    expect(graphRoots(tab, tab, false)).toMatchObject({ names: shownNames(tab), narrowed: false });
  });
});

// ---- applyView: search --------------------------------------------------------------

describe('applyView search', () => {
  it('searches every Dragon, ignoring the current tab', () => {
    const w = menuWorld();
    const fromFire = view(w, FIRE, NO_FILTERS, 'either', 'normal', 'kampos');
    expect(fromFire.sections).toEqual([{ kind: 'search', query: 'kampos', items: [{ dragon: w.dragons.get('Kampos') }] }]);
    expect(view(w, { kind: 'event' }, NO_FILTERS, 'either', 'normal', 'KAMPOS').sections).toEqual(
      fromFire.sections.map((s) => ({ ...s, query: 'KAMPOS' })),
    );
    expect(fromFire).toMatchObject({ owned: 0, total: 1 });
  });

  it('matches names, wiki page titles and Elements, best name matches first', () => {
    const w = menuWorld();
    // "Plant" exactly, then Dragons displaying Plant in release order.
    expect(flat(view(w, FIRE, NO_FILTERS, 'either', 'normal', '  plant ').sections)).toEqual([
      'Plant',
      'Flower',
      'Love',
      'Haystack',
      'Motley',
    ]);
    expect(flat(view(w, FIRE, NO_FILTERS, 'either', 'normal', 'lava dragon').sections)).toEqual(['Lava']);
    expect(flat(view(w, FIRE, NO_FILTERS, 'either', 'normal', 'zzz').sections)).toEqual([]);
  });

  it('a blank query keeps the tab', () => {
    const w = menuWorld();
    expect(names(view(w, FIRE, NO_FILTERS, 'either', 'normal', '   ').sections)).toEqual([['Lava', 'Fire', 'Flower']]);
  });

  it('filters and Owned forms apply to search results', () => {
    const w = menuWorld({ Lava: true });
    expect(flat(view(w, PLANT, filters({ show: 'owned' }), 'either', 'normal', 'fire').sections)).toEqual(['Lava']);
    expect(flat(view(w, PLANT, NO_FILTERS, 'rift', 'normal', 'water').sections)).toEqual(['Kampos']);
    expect(flat(view(w, PLANT, NO_FILTERS, 'normal', 'normal', 'water').sections)).toEqual(['Water']);
  });
});

// ---- applyView: find on this page ---------------------------------------------------

describe('applyView find on this page', () => {
  const find = (w: World, tab: Tab, text: string, f: Filters = NO_FILTERS) =>
    applyView(tabContents(w, tab, 'normal').sections, '', f, either, w, 'normal', text);

  it('keeps the tab’s Dragons matching by name or Element, in the tab’s order', () => {
    const w = menuWorld();
    expect(find(w, FIRE, 'FLO').sections).toMatchObject([{ kind: 'page', page: { name: 'Fire' } }]);
    expect(flat(find(w, FIRE, ' flo ').sections)).toEqual(['Flower']);
    expect(flat(find(w, FIRE, 'plant').sections)).toEqual(['Flower']);
    expect(flat(find(w, FIRE, 'kampos').sections)).toEqual([]);
    expect(names(find(w, FIRE, '  ').sections)).toEqual([['Lava', 'Fire', 'Flower']]);
  });

  it('narrows like a filter: the counts stay the tab’s', () => {
    const w = menuWorld({ Lava: true });
    expect(find(w, FIRE, 'flower')).toMatchObject({ owned: 1, total: 3 });
  });

  it('works with the filters', () => {
    const w = menuWorld({ Lava: true });
    expect(flat(find(w, FIRE, 'fire', filters({ show: 'not-owned' })).sections)).toEqual(['Fire', 'Flower']);
  });
});

// ---- Owned forms ------------------------------------------------------------------

describe('Owned forms', () => {
  const ALL: Tab[] = [FIRE, PLANT, { kind: 'page', page: 'Sun' }, { kind: 'page', page: 'Rift' }];
  const shown = (w: World, ownedForms: OwnedForms) =>
    flat(applyView(ALL.flatMap((t) => tabContents(w, t, 'normal').sections), '', NO_FILTERS, { ownedForms }, w, 'normal').sections);

  it('Either shows every Dragon', () => {
    expect(new Set(shown(menuWorld(), 'either'))).toEqual(
      new Set(['Lava', 'Fire', 'Flower', 'Plant', 'Love', 'Haystack', 'Motley', 'Sun', 'Kampos']),
    );
  });

  it('Normal hides Rift dragons', () => {
    const s = shown(menuWorld(), 'normal');
    expect(s).not.toContain('Kampos');
    expect(s).toEqual(expect.arrayContaining(['Fire', 'Lava', 'Sun']));
  });

  it('Rift shows only Dragons with a Rift form and Rift dragons', () => {
    const s = shown(menuWorld(), 'rift');
    expect(s).toContain('Kampos');
    expect(s).toContain('Lava');
    expect(s).not.toContain('Fire');
    expect(s).not.toContain('Plant');
  });

  it('decides which form counts as owned, per cave', () => {
    const w = menuWorld({ Lava: 'rift', Flower: 'normal', Fire: true, Kampos: true });
    // Through the Show Owned filter, on a search for that one Dragon.
    const owned = (name: string, forms: OwnedForms, cave: Cave) =>
      flat(applyView([], name, filters({ show: 'owned' }), { ownedForms: forms }, w, cave).sections).includes(name);
    // Either: any form, except the Rift cave counts the Rift form.
    expect(owned('Lava', 'either', 'normal')).toBe(true);
    expect(owned('Flower', 'either', 'coop')).toBe(true);
    expect(owned('Lava', 'either', 'rift')).toBe(true);
    expect(owned('Flower', 'either', 'rift')).toBe(false);
    // A Dragon with no Rift form counts its one form in the Rift cave.
    expect(owned('Fire', 'either', 'rift')).toBe(true);
    expect(owned('Kampos', 'either', 'normal')).toBe(true);
    // Normal and Rift count that form whatever the cave.
    expect(owned('Lava', 'normal', 'normal')).toBe(false);
    expect(owned('Lava', 'rift', 'normal')).toBe(true);
    expect(owned('Flower', 'normal', 'rift')).toBe(true);
    expect(owned('Flower', 'rift', 'rift')).toBe(false);
    expect(owned('Kampos', 'rift', 'normal')).toBe(true);
  });
});

// ---- sidebarCounts --------------------------------------------------------------------

describe('sidebarCounts', () => {
  const w = menuWorld({ Lava: 'rift', Flower: 'normal', Fire: true, Kampos: true, Plant: true, Earth: true });

  it('counts every tab, page and group, each Dragon once per group', () => {
    const c = sidebarCounts(w, 'normal', either);
    expect(c.limited).toEqual({ owned: 0, total: 1 });
    expect(c.event).toEqual({ owned: 1, total: 2 }); // Haystack, Lava
    expect(c.groups.map((g) => g.group)).toEqual(['elemental', 'epic', 'special']);
    const [elemental, epic, special] = c.groups;
    expect(elemental!.pages.map((p) => [p.page.name, p.count])).toEqual([
      ['Fire', { owned: 3, total: 3 }],
      ['Plant', { owned: 2, total: 5 }],
    ]);
    // Flower sits on both pages but counts once.
    expect(elemental!.count).toEqual({ owned: 4, total: 7 });
    expect(epic!.count).toEqual({ owned: 0, total: 1 });
    expect(special!.count).toEqual({ owned: 1, total: 1 });
  });

  it('All counts every Dragon, and matches its page header', () => {
    expect(sidebarCounts(w, 'normal', either).all).toEqual({ owned: 6, total: cast().length });
    for (const ownedForms of ['either', 'normal', 'rift'] as const) {
      for (const cave of ['normal', 'rift', 'coop'] as const) {
        const v = view(w, { kind: 'all' }, NO_FILTERS, ownedForms, cave);
        expect({ owned: v.owned, total: v.total }).toEqual(sidebarCounts(w, cave, { ownedForms }).all);
      }
    }
    expect(sidebarCounts(w, 'normal', { ownedForms: 'normal' }).all.total).toBe(cast().length - 1); // Kampos hidden
  });

  it('filters and search apply on All', () => {
    const owned = view(w, { kind: 'all' }, filters({ show: 'owned' }));
    expect(flat(owned.sections).sort()).toEqual(['Earth', 'Fire', 'Flower', 'Kampos', 'Lava', 'Plant']);
    const epic = view(w, { kind: 'all' }, filters({ rarities: ['Epic'] }));
    expect(flat(epic.sections)).toEqual(['Sun']);
    const searched = view(w, { kind: 'all' }, NO_FILTERS, 'either', 'normal', 'lav');
    expect(searched.sections.map((s) => s.kind)).toEqual(['search']);
    expect(flat(searched.sections)).toEqual(['Lava']);
  });

  it('Breedable now matches the tab', () => {
    for (const cave of ['normal', 'rift', 'coop'] as const) {
      const total = new Set(flat(tabContents(w, { kind: 'breedable' }, cave).sections)).size;
      expect(sidebarCounts(w, cave, either).breedable.total).toBe(total);
    }
  });

  it('follows Owned forms', () => {
    const fire = (ownedForms: OwnedForms, cave: Cave = 'normal') =>
      sidebarCounts(w, cave, { ownedForms }).groups[0]!.pages[0]!.count;
    expect(fire('normal')).toEqual({ owned: 2, total: 3 }); // Lava owned only as Rift form
    expect(fire('rift')).toEqual({ owned: 1, total: 2 }); // Fire hidden; Flower not owned as Rift form
    const rift = (ownedForms: OwnedForms) => sidebarCounts(w, 'normal', { ownedForms }).groups[2]!.count;
    expect(rift('normal')).toEqual({ owned: 0, total: 0 }); // Kampos hidden
    expect(rift('rift')).toEqual({ owned: 1, total: 1 });
  });

  it('follows the cave under Either', () => {
    const fire = (cave: Cave) => sidebarCounts(w, cave, either).groups[0]!.pages[0]!.count;
    expect(fire('normal')).toEqual({ owned: 3, total: 3 });
    expect(fire('coop')).toEqual({ owned: 3, total: 3 });
    expect(fire('rift')).toEqual({ owned: 2, total: 3 }); // Flower owned only in normal form
  });

  it('page header counts match the sidebar', () => {
    for (const ownedForms of ['either', 'normal', 'rift'] as const) {
      for (const cave of ['normal', 'rift'] as const) {
        const v = view(w, PLANT, NO_FILTERS, ownedForms, cave);
        const side = sidebarCounts(w, cave, { ownedForms }).groups[0]!.pages[1]!.count;
        expect({ owned: v.owned, total: v.total }).toEqual(side);
      }
    }
  });
});
