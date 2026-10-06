import { describe, expect, it } from 'vitest';
import type { Cave, OwnedForms } from '../breeding';
import {
  coop,
  dragon,
  evolved,
  limited,
  primaries,
  primary,
  purchased,
  riftDragon,
  summoned,
  world,
  type Owned,
  type WorldSpec,
} from '../testing/fixtures';
import type { World } from '../world';
import { describeTile, type Display, type TileView } from './index';

const EITHER: Display = { ownedForms: 'either', allInColour: false };
const CAVES: Cave[] = ['normal', 'rift', 'coop'];

const lava = () => dragon({ name: 'Lava', elements: ['Fire', 'Earth'] });
const plumewing = () => riftDragon({ name: 'Plumewing', elements: ['Air', 'Light'], trait: 'Air' });
const fireRift = () => riftDragon({ name: 'Fire Rift', elements: ['Fire'], trait: 'Fire', routes: [purchased()] });
const kairos = () => dragon({ name: 'Kairos', rarity: 'Legendary', traits: 'none', routes: [summoned(['Hourglass'])] });
const ghostlyFire = () => dragon({ name: 'Ghostly Fire', traits: 'none', routes: [evolved('Fire', ['Spooky Lamp'])] });
const nebula = () =>
  dragon({ name: 'Nebula', rarity: 'Galaxy', elements: ['Galaxy'], breedingElements: ['Air', 'Galaxy'], routes: [coop('Nebula')] });
const haystack = () => limited({ name: 'Haystack', elements: ['Plant', 'Earth'] });
const love = () => limited({ name: 'Love', elements: ['Plant', 'Light'] });

const cast = () => [...primaries(), lava(), plumewing(), fireRift(), kairos(), ghostlyFire(), nebula(), haystack(), love()];

function build(spec: Omit<WorldSpec, 'dragons'> = {}): World {
  return world({ dragons: cast(), ...spec });
}

function tile(w: World, name: string, cave: Cave = 'normal', display: Display = EITHER): TileView {
  return describeTile(w, w.dragons.get(name)!, cave, display);
}

const bannerOf = (w: World, name: string, cave: Cave = 'normal') => tile(w, name, cave).banner;

describe('banner', () => {
  const w = build({
    owned: ['Fire', 'Earth', 'Plant', 'Air', 'Light'],
    overlay: { events: [{ shop: [{ dragon: 'Haystack', breedable: false }] }] },
  });

  it('Summoning only, Evolution only and Shop only when no cave can breed it, in every cave', () => {
    for (const cave of CAVES) {
      expect(bannerOf(w, 'Kairos', cave)).toEqual({ kind: 'summoning-only' });
      expect(bannerOf(w, 'Ghostly Fire', cave)).toEqual({ kind: 'evolution-only' });
      expect(bannerOf(w, 'Fire Rift', cave)).toEqual({ kind: 'shop-only' });
    }
  });

  it('Not available for a limited Dragon that is not Available', () => {
    expect(bannerOf(w, 'Love')).toEqual({ kind: 'not-available' });
  });

  it('Not breedable in <cave> cave when the chosen cave can never make it', () => {
    expect(bannerOf(w, 'Plumewing', 'normal')).toEqual({ kind: 'not-breedable-in-cave', cave: 'normal' });
    expect(bannerOf(w, 'Plumewing', 'coop')).toEqual({ kind: 'not-breedable-in-cave', cave: 'coop' });
    expect(bannerOf(w, 'Plumewing', 'rift')).toBeNull();
    expect(bannerOf(w, 'Fire', 'rift')).toEqual({ kind: 'not-breedable-in-cave', cave: 'rift' });
    expect(bannerOf(w, 'Fire', 'normal')).toBeNull();
    expect(bannerOf(w, 'Nebula', 'normal')).toEqual({ kind: 'not-breedable-in-cave', cave: 'normal' });
    expect(bannerOf(w, 'Nebula', 'rift')).toEqual({ kind: 'not-breedable-in-cave', cave: 'rift' });
    expect(bannerOf(w, 'Nebula', 'coop')).toBeNull();
  });

  it('Purchase only for an Event shop entry with Breedable: false', () => {
    expect(bannerOf(w, 'Haystack', 'normal')).toEqual({ kind: 'purchase-only' });
    expect(bannerOf(w, 'Haystack', 'coop')).toEqual({ kind: 'purchase-only' });
  });

  it('no banner for an ordinary Dragon the cave makes', () => {
    for (const cave of CAVES) expect(bannerOf(w, 'Lava', cave)).toBeNull();
  });

  describe('precedence: the first that applies wins', () => {
    it('Summoning / Evolution / Shop only beats Not available', () => {
      const w2 = world({
        dragons: [
          ...primaries(),
          limited({ name: 'Old Shop', routes: [purchased()] }),
          limited({ name: 'Old Summon', traits: 'none', routes: [summoned()] }),
        ],
      });
      expect(bannerOf(w2, 'Old Shop')).toEqual({ kind: 'shop-only' });
      expect(bannerOf(w2, 'Old Summon')).toEqual({ kind: 'summoning-only' });
    });

    it('Summoning only beats Evolution only beats Shop only on mixed non-bred Routes', () => {
      const w2 = world({
        dragons: [
          ...primaries(),
          dragon({ name: 'Mixed', traits: 'none', routes: [purchased(), evolved('Fire'), summoned()] }),
          dragon({ name: 'Bought Or Evolved', traits: 'none', routes: [purchased(), evolved('Fire')] }),
        ],
      });
      expect(bannerOf(w2, 'Mixed')).toEqual({ kind: 'summoning-only' });
      expect(bannerOf(w2, 'Bought Or Evolved')).toEqual({ kind: 'evolution-only' });
    });

    it('Not available beats Not breedable in <cave> cave', () => {
      const w2 = world({
        dragons: [...primaries(), riftDragon({ name: 'Old Rift', elements: ['Fire'], trait: 'Fire', isLimited: true })],
      });
      expect(bannerOf(w2, 'Old Rift', 'normal')).toEqual({ kind: 'not-available' });
    });

    it('Not breedable in <cave> cave beats Purchase only', () => {
      expect(bannerOf(w, 'Haystack', 'rift')).toEqual({ kind: 'purchase-only' }); // the Rift cave makes its Rift form
      const w2 = world({
        dragons: [...primaries(), limited({ name: 'Debut', traits: 'none', elements: ['Plant'] })],
        overlay: { events: [{ shop: [{ dragon: 'Debut', breedable: false }] }] },
      });
      expect(bannerOf(w2, 'Debut', 'rift')).toEqual({ kind: 'not-breedable-in-cave', cave: 'rift' });
      expect(bannerOf(w2, 'Debut', 'normal')).toEqual({ kind: 'purchase-only' });
    });
  });

  it('a limited Dragon in the Limited rotation is Available: no banner', () => {
    const w2 = build({ overlay: { rotation: ['Love'] } });
    expect(bannerOf(w2, 'Love')).toBeNull();
  });
});

describe('grey or colour per Owned forms', () => {
  const display = (ownedForms: OwnedForms, allInColour = false): Display => ({ ownedForms, allInColour });

  /** `owned` for Lava (both forms), Fire (no Rift form) and Plumewing (Rift dragon) per cave and setting. */
  function ownedTable(owned: Owned, name: string) {
    const w = build({ owned });
    const rows: Record<string, Record<OwnedForms, boolean>> = {};
    for (const cave of CAVES) {
      rows[cave] = {
        either: tile(w, name, cave, display('either')).owned,
        normal: tile(w, name, cave, display('normal')).owned,
        rift: tile(w, name, cave, display('rift')).owned,
      };
    }
    return rows;
  }

  it('Lava owned in normal form only: Either counts it outside the Rift cave', () => {
    expect(ownedTable({ Lava: 'normal' }, 'Lava')).toEqual({
      normal: { either: true, normal: true, rift: false },
      rift: { either: false, normal: true, rift: false },
      coop: { either: true, normal: true, rift: false },
    });
  });

  it('Lava owned in Rift form only: Either counts it in every cave', () => {
    expect(ownedTable({ Lava: 'rift' }, 'Lava')).toEqual({
      normal: { either: true, normal: false, rift: true },
      rift: { either: true, normal: false, rift: true },
      coop: { either: true, normal: false, rift: true },
    });
  });

  it('Lava owned in both forms counts everywhere; not owned counts nowhere', () => {
    const all = { either: true, normal: true, rift: true };
    const none = { either: false, normal: false, rift: false };
    expect(ownedTable({ Lava: 'both' }, 'Lava')).toEqual({ normal: all, rift: all, coop: all });
    expect(ownedTable([], 'Lava')).toEqual({ normal: none, rift: none, coop: none });
  });

  it('a single-form Dragon counts its one form under every setting and cave', () => {
    const all = { either: true, normal: true, rift: true };
    expect(ownedTable(['Fire'], 'Fire')).toEqual({ normal: all, rift: all, coop: all });
    expect(ownedTable(['Plumewing'], 'Plumewing')).toEqual({ normal: all, rift: all, coop: all });
  });

  it('colour = owned, unless Show all Dragons in colour is on', () => {
    const w = build({ owned: { Lava: 'normal' } });
    expect(tile(w, 'Lava', 'normal').colour).toBe(true);
    expect(tile(w, 'Lava', 'rift').colour).toBe(false);
    expect(tile(w, 'Lava', 'rift', display('either', true))).toMatchObject({ owned: false, colour: true });
    expect(tile(w, 'Fire', 'normal').colour).toBe(false);
  });
});

describe('sheen', () => {
  it('is Breedable now in the chosen cave', () => {
    const w = build({ owned: ['Fire', 'Earth'] });
    expect(tile(w, 'Lava', 'normal').sheen).toBe(true);
    expect(tile(w, 'Lava', 'rift').sheen).toBe(false); // no Rift breeding parents
    expect(tile(w, 'Fire', 'normal').sheen).toBe(false); // owned
    expect(tile(w, 'Kairos', 'normal').sheen).toBe(false);

    const rift = build({ owned: { Lava: 'rift', Fire: true, Earth: true } });
    expect(tile(rift, 'Lava', 'rift').sheen).toBe(false); // owned in Rift form
    expect(tile(rift, 'Lava', 'normal').sheen).toBe(true);
  });
});

describe('ticks', () => {
  const w = build({ owned: { Lava: 'rift', Fire: true, Plumewing: true } });

  it('a Dragon with a Rift form shows Normal + Rift form ticks', () => {
    expect(tile(w, 'Lava').ticks).toEqual([
      { label: 'normal', form: 'normal', owned: false },
      { label: 'rift', form: 'rift', owned: true },
    ]);
  });

  it('a Dragon with no Rift form shows one Owned tick that writes the normal flag', () => {
    expect(tile(w, 'Fire').ticks).toEqual([{ label: 'owned', form: 'normal', owned: true }]);
    expect(tile(w, 'Kairos').ticks).toEqual([{ label: 'owned', form: 'normal', owned: false }]);
  });

  it('a Rift dragon shows one Owned tick that writes the rift flag', () => {
    expect(tile(w, 'Plumewing').ticks).toEqual([{ label: 'owned', form: 'rift', owned: true }]);
    expect(tile(w, 'Fire Rift').ticks).toEqual([{ label: 'owned', form: 'rift', owned: false }]);
  });

  it('ticks do not depend on the cave or Owned forms', () => {
    for (const cave of CAVES) {
      for (const ownedForms of ['either', 'normal', 'rift'] as const) {
        expect(tile(w, 'Lava', cave, { ownedForms, allInColour: false }).ticks).toEqual(tile(w, 'Lava').ticks);
      }
    }
  });
});

describe('the form a tile opens as', () => {
  const w = build();

  it('normal in the Normal and Co-op caves, Rift form in the Rift cave', () => {
    expect(tile(w, 'Lava', 'normal').opensAs).toBe('normal');
    expect(tile(w, 'Lava', 'coop').opensAs).toBe('normal');
    expect(tile(w, 'Lava', 'rift').opensAs).toBe('rift');
  });

  it('a Rift dragon always opens as itself', () => {
    for (const cave of CAVES) expect(tile(w, 'Plumewing', cave).opensAs).toBe('rift');
  });

  it('a Dragon with no Rift form opens in its normal form', () => {
    for (const cave of CAVES) {
      expect(tile(w, 'Fire', cave).opensAs).toBe('normal');
      expect(tile(w, 'Kairos', cave).opensAs).toBe('normal');
    }
  });
});

describe('Owned banner flag', () => {
  it('is set when the Dragon is owned in the form it opens as', () => {
    const w = build({ owned: { Lava: 'normal', Fire: true, Plumewing: true } });
    expect(tile(w, 'Lava', 'normal').ownedBanner).toBe(true);
    expect(tile(w, 'Lava', 'coop').ownedBanner).toBe(true);
    expect(tile(w, 'Lava', 'rift').ownedBanner).toBe(false);
    expect(tile(w, 'Fire', 'rift').ownedBanner).toBe(true);
    expect(tile(w, 'Plumewing', 'normal').ownedBanner).toBe(true);
    expect(tile(w, 'Earth', 'normal').ownedBanner).toBe(false);
  });

  it('does not depend on Owned forms', () => {
    const w = build({ owned: { Lava: 'normal' } });
    expect(tile(w, 'Lava', 'normal', { ownedForms: 'rift', allInColour: false })).toMatchObject({
      owned: false,
      ownedBanner: true,
    });
  });
});

it('carries the Dragon for name, rarity border and art', () => {
  const w = world({ dragons: [primary('Plant', { image: 'images/PlantDragonAdult.png' })] });
  expect(tile(w, 'Plant').dragon).toBe(w.dragons.get('Plant'));
});
