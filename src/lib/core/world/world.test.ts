import { describe, expect, it } from 'vitest';
import {
  NOW,
  TODAY,
  TOMORROW,
  YESTERDAY,
  collection,
  dragon,
  limited,
  overlay,
  primaries,
  primary,
  realCast,
  riftDragon,
  snapshot,
  world,
} from '../testing/fixtures';
import { buildWorld } from './index';

const lava = () => dragon({ name: 'Lava', elements: ['Fire', 'Earth'] });
const love = () => limited({ name: 'Love', elements: ['Light', 'Plant'] });
const kampos = () => riftDragon({ name: 'Kampos', elements: ['Rift'], trait: 'Fire' });
const gem = () => dragon({ name: 'Ruby', rarity: 'Gemstone', elements: ['Gemstone'], canBeParent: false });

const names = (dragons: readonly { name: string }[]) => dragons.map((d) => d.name);

describe('Available', () => {
  it('holds every Dragon that is not limited, with or without an overlay', () => {
    const w = world({ dragons: [...primaries(), lava(), love()] });
    expect(w.available.has('Lava')).toBe(true);
    expect(w.available.has('Fire')).toBe(true);
    expect(w.available.has('Love')).toBe(false);
  });

  it('holds a limited Dragon in the Limited rotation', () => {
    const w = world({ dragons: [love()], overlay: { rotation: [{ dragon: 'Love', ends: TOMORROW }] } });
    expect(w.available.has('Love')).toBe(true);
  });

  it('holds a limited Dragon in a running Event shop, Purchase only or not', () => {
    const w = world({
      dragons: [love(), limited({ name: 'Haystack' })],
      overlay: { events: [{ ends: TOMORROW, shop: ['Love', { dragon: 'Haystack', breedable: false }] }] },
    });
    expect(w.available.has('Love')).toBe(true);
    expect(w.available.has('Haystack')).toBe(true);
  });

  it('keeps a Dragon through its last day and drops it after', () => {
    const dragons = [love()];
    const spec = { rotation: [{ dragon: 'Love', ends: TODAY }] };
    expect(world({ dragons, overlay: spec }).available.has('Love')).toBe(true);
    const nextDay = new Date(2026, 9, 6, 0, 0, 1);
    expect(world({ dragons, overlay: spec, now: nextDay }).available.has('Love')).toBe(false);
  });

  it('drops a shop entry after its own countdown, and the whole shop after the Event ends', () => {
    const w = world({
      dragons: [love(), limited({ name: 'Trick' })],
      overlay: {
        events: [
          { ends: TOMORROW, shop: [{ dragon: 'Love', ends: YESTERDAY }] },
          { ends: YESTERDAY, shop: [{ dragon: 'Trick', ends: TOMORROW }] },
        ],
      },
    });
    expect(w.available.has('Love')).toBe(false);
    expect(w.available.has('Trick')).toBe(false);
  });

  it('treats no end date as running', () => {
    const w = world({ dragons: [love()], overlay: { rotation: ['Love'] } });
    expect(w.available.has('Love')).toBe(true);
  });
});

describe('Purchase only', () => {
  it('marks a running shop entry with Breedable: false', () => {
    const w = world({
      dragons: [limited({ name: 'Haystack' }), love()],
      overlay: { events: [{ shop: [{ dragon: 'Haystack', breedable: false }, 'Love'] }] },
    });
    expect([...w.purchaseOnly]).toEqual(['Haystack']);
  });

  it('ends with the shop entry', () => {
    const w = world({
      dragons: [limited({ name: 'Haystack' })],
      overlay: { events: [{ ends: YESTERDAY, shop: [{ dragon: 'Haystack', breedable: false }] }] },
    });
    expect(w.purchaseOnly.size).toBe(0);
  });
});

describe('parent sets', () => {
  const cast = () => [...primaries(), lava(), kampos(), gem(), love()];

  it('Normal breeding counts owned Dragons in either form, Rift dragons included', () => {
    const w = world({ dragons: cast(), owned: { Fire: true, Lava: 'rift', Kampos: true, Love: true } });
    expect(names(w.parents.normal.dragons)).toEqual(['Fire', 'Lava', 'Kampos', 'Love']);
    expect(w.parents.normal.names).toEqual(new Set(['Fire', 'Lava', 'Kampos', 'Love']));
  });

  it('Rift breeding counts only owned Rift forms and Rift dragons', () => {
    const w = world({
      dragons: [...cast(), dragon({ name: 'Blue Fire', elements: ['Fire', 'Cold'] })],
      owned: { Fire: true, Lava: 'rift', 'Blue Fire': 'normal', Kampos: true },
    });
    expect(names(w.parents.rift.dragons)).toEqual(['Lava', 'Kampos']);
  });

  it('never counts a Dragon that cannot be a parent', () => {
    const w = world({ dragons: cast(), owned: ['Ruby', 'Fire'] });
    expect(w.parents.normal.names.has('Ruby')).toBe(false);
    expect(w.parents.rift.names.has('Ruby')).toBe(false);
    expect(w.parents.normal.names.has('Fire')).toBe(true);
  });

  it('never counts an orphan', () => {
    const w = world({ dragons: cast(), owned: ['Lava'], orphans: ['Old Name'] });
    expect(w.collection.orphans).toHaveProperty('Old Name');
    expect(names(w.parents.normal.dragons)).toEqual(['Lava']);
    expect(names(w.parents.rift.dragons)).toEqual(['Lava']);
  });

  it('is empty for an empty Collection', () => {
    const w = world({ dragons: cast() });
    expect(w.parents.normal.dragons).toEqual([]);
    expect(w.parents.rift.dragons).toEqual([]);
  });
});

describe('lookups', () => {
  it('finds Dragons by name', () => {
    const w = world({ dragons: realCast() });
    expect(w.dragons.get('Seasonal')?.breedingElements).toEqual(['Air', 'Fire', 'Plant', 'Seasonal']);
    expect(w.dragons.get('Nope')).toBeUndefined();
  });

  it('lists carriers fewest breeding Elements first, ties to the lowest order', () => {
    const w = world({ dragons: realCast() });
    expect(names(w.carriers.get('Plant') ?? [])).toEqual(['Plant', 'Ironwood', 'Seasonal', 'Nebula', 'Rainbow']);
    expect(names(w.carriers.get('Sun') ?? [])).toEqual(['Sun']);
    expect(names(w.carriers.get('Cold') ?? [])).toEqual([
      'Cold', 'Blue Fire', 'Sun', 'Zaffer', 'Nebula', 'Rainbow',
    ]);
    expect(w.carriers.has('Moon')).toBe(false);
  });

  it('breaks a carrier tie by order', () => {
    const a = dragon({ name: 'A', elements: ['Fire', 'Earth'], order: 9 });
    const b = dragon({ name: 'B', elements: ['Fire', 'Earth'], order: 3 });
    expect(names(world({ dragons: [a, b] }).carriers.get('Fire') ?? [])).toEqual(['B', 'A']);
  });
});

describe('buildWorld', () => {
  it('keeps its inputs and is frozen', () => {
    const snap = snapshot([primary('Fire')]);
    const coll = collection(snap, ['Fire']);
    const over = overlay();
    const w = buildWorld(snap, coll, over, NOW);
    expect(w.snapshot).toBe(snap);
    expect(w.collection).toBe(coll);
    expect(w.overlay).toBe(over);
    expect(w.now).toBe(NOW);
    expect(Object.isFrozen(w)).toBe(true);
  });
});

describe('fixtures', () => {
  it('rejects an owned name the snapshot lacks', () => {
    expect(() => world({ owned: ['Lava'] })).toThrow(/Lava/);
  });

  it('owns every form for a bare name, and one form when asked', () => {
    const w = world({ dragons: [lava(), kampos()], owned: { Lava: 'normal', Kampos: 'rift' } });
    expect(w.collection.entries).toEqual({
      Lava: { normal: true, rift: false },
      Kampos: { normal: false, rift: true },
    });
  });
});
