import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLimited, type Overlay } from './index';

// Dates are built in local time, so the tests hold in any time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

const page = (value: unknown) => JSON.stringify(value);

const shopNames = (overlay: Overlay, event = 0) => overlay.events[event]?.shop.map((e) => e.dragon);

describe('the committed raw Data:Limited.json (fetched 2026-10-01)', () => {
  const raw = readFileSync(join(import.meta.dirname, '../../../../fixtures/limited.json'), 'utf8');
  const parsed = JSON.parse(raw);
  const pageNames = [
    ...Object.keys(parsed.dragons),
    ...Object.values(parsed.events).flatMap((e) => Object.keys((e as { dragons: object }).dragons)),
  ];
  // Every Dragon on the page is in the snapshot; the junk keys aren't.
  const names = pageNames.filter((n) => n !== 'islands' && n !== 'islandThemes');

  it('reads the Limited rotation with end dates', () => {
    const overlay = parseLimited(raw, names, at(2026, 10, 5));
    expect(overlay.rotation).toEqual([
      { dragon: 'Love', ends: '2026-10-07' },
      { dragon: 'Trick', ends: '2026-10-07' },
      { dragon: 'Pharaoh', ends: '2026-10-07' },
      { dragon: 'Opal', ends: '2026-11-01' },
      { dragon: 'Autumn', ends: '2026-12-21' },
      { dragon: 'Bismuth', ends: '2026-10-15' },
      { dragon: 'Amber', ends: '2026-11-15' },
      { dragon: 'Stygian', ends: '2026-10-23' },
      { dragon: 'Librian', ends: '2026-10-23' },
    ]);
  });

  it('reads the Event and its shop, skipping islands and islandThemes', () => {
    const overlay = parseLimited(raw, names, at(2026, 10, 5));
    expect(overlay.events).toHaveLength(1);
    const [event] = overlay.events;
    expect(event).toMatchObject({ name: 'Om of Noms: Country Roads II', ends: '2026-10-07', currency: 'Spice' });
    expect(event?.shop).toHaveLength(123);
    expect(shopNames(overlay)).not.toContain('islands');
    expect(shopNames(overlay)).not.toContain('islandThemes');
    expect(event?.shop.slice(0, 4)).toEqual([
      { dragon: 'Haystack', cost: 12250, breedable: false, ends: '2026-10-07' },
      { dragon: 'Sungazer', cost: 12250, breedable: false, ends: '2026-10-07' },
      { dragon: 'Dotty', cost: 12500, breedable: true, ends: '2026-10-07' },
      { dragon: 'Jasmine', cost: 12000, breedable: true, ends: '2026-10-07' },
    ]);
    expect(event?.shop.filter((e) => !e.breedable).map((e) => e.dragon)).toEqual(['Haystack', 'Sungazer']);
    expect(overlay.notRecognised).toEqual([]);
  });

  it('lists names missing from the snapshot as not recognised', () => {
    const overlay = parseLimited(raw, names.filter((n) => n !== 'Dotty' && n !== 'Opal'), at(2026, 10, 5));
    expect(overlay.notRecognised).toEqual(['Opal', 'Dotty']);
    expect(overlay.rotation.map((e) => e.dragon)).not.toContain('Opal');
    expect(shopNames(overlay)).not.toContain('Dotty');
  });

  it('drops what has ended once the page goes stale', () => {
    const overlay = parseLimited(raw, names, at(2026, 10, 8));
    expect(overlay.rotation.map((e) => e.dragon)).toEqual([
      'Opal', 'Autumn', 'Bismuth', 'Amber', 'Stygian', 'Librian',
    ]);
    expect(overlay.events).toEqual([]);
  });
});

describe('hand-built pages', () => {
  const names = ['Love', 'Haystack', 'Dotty', 'Jasmine', 'Rose'];
  const event = (dragons: object, extra: object = { countdown: 'October 20, 2026' }) =>
    page({ events: { Fair: { ...extra, dragons } } });

  it('skips shop entries that are not objects or have no Cost', () => {
    const overlay = parseLimited(
      event({
        Jasmine: { Currency: 'Spice', Cost: 12000 },
        islands: {},
        islandThemes: {},
        Rose: 'Rose',
        Love: ['Cost', 1],
        Dotty: null,
        Haystack: { Currency: 'Spice', Breedable: false },
      }),
      names,
      at(2026, 10, 5),
    );
    expect(shopNames(overlay)).toEqual(['Jasmine']);
    expect(overlay.notRecognised).toEqual([]);
  });

  it('skips rotation entries that are not objects', () => {
    const overlay = parseLimited(
      page({ dragons: { Love: { countdown: 'October 7, 2026' }, Rose: 3, Dotty: null } }),
      names,
      at(2026, 10, 5),
    );
    expect(overlay.rotation).toEqual([{ dragon: 'Love', ends: '2026-10-07' }]);
  });

  it('matches names exactly and lists the rest once each', () => {
    const overlay = parseLimited(
      page({
        dragons: { love: {}, 'Love Dragon': {}, Love: {}, Mystery: {} },
        events: {
          A: { dragons: { Mystery: { Cost: 1 }, Jasmine: { Cost: 1 } } },
          B: { dragons: { 'Rose ': { Cost: 1 } } },
        },
      }),
      names,
      at(2026, 10, 5),
    );
    expect(overlay.rotation).toEqual([{ dragon: 'Love', ends: null }]);
    expect(shopNames(overlay, 0)).toEqual(['Jasmine']);
    expect(shopNames(overlay, 1)).toEqual([]);
    expect(overlay.notRecognised).toEqual(['love', 'Love Dragon', 'Mystery', 'Rose ']);
  });

  it("lets a Dragon's own countdown override its Event's", () => {
    const overlay = parseLimited(
      event({
        Dotty: { countdown: 'October 7, 2026', Currency: 'Spice', Cost: 12500 },
        Jasmine: { Currency: 'Spice', Cost: 12000 },
      }),
      names,
      at(2026, 10, 5),
    );
    expect(overlay.events[0]?.ends).toBe('2026-10-20');
    expect(overlay.events[0]?.shop).toEqual([
      { dragon: 'Dotty', cost: 12500, breedable: true, ends: '2026-10-07' },
      { dragon: 'Jasmine', cost: 12000, breedable: true, ends: '2026-10-20' },
    ]);

    // After Dotty's own end date the Event still runs, without Dotty.
    const later = parseLimited(
      event({ Dotty: { countdown: 'October 7, 2026', Cost: 12500 }, Jasmine: { Cost: 12000 } }),
      names,
      at(2026, 10, 8),
    );
    expect(shopNames(later)).toEqual(['Jasmine']);
  });

  it('drops a whole Event once it has ended, own countdowns included', () => {
    const overlay = parseLimited(
      event({ Dotty: { countdown: 'October 30, 2026', Cost: 1 } }, { countdown: 'October 7, 2026' }),
      names,
      at(2026, 10, 8),
    );
    expect(overlay.events).toEqual([]);
  });

  it('keeps an entry until the end of its last day, local time', () => {
    const raw = page({ dragons: { Love: { countdown: 'October 7, 2026' } } });
    expect(parseLimited(raw, names, at(2026, 10, 7, 0, 0)).rotation).toHaveLength(1);
    expect(parseLimited(raw, names, new Date(2026, 9, 7, 23, 59, 59, 999)).rotation).toHaveLength(1);
    expect(parseLimited(raw, names, at(2026, 10, 8, 0, 0)).rotation).toEqual([]);
  });

  it('treats an unparseable countdown as available with no end date', () => {
    const now = at(2030, 1, 1);
    for (const countdown of ['soon', '', 'February 30, 2026', 'Smarch 3, 2026', 7, null]) {
      const overlay = parseLimited(page({ dragons: { Love: { countdown } } }), names, now);
      expect(overlay.rotation, String(countdown)).toEqual([{ dragon: 'Love', ends: null }]);
    }

    const badEvent = parseLimited(event({ Rose: { Cost: 1 } }, { countdown: 'when the leaves fall' }), names, now);
    expect(badEvent.events).toEqual([{ name: 'Fair', ends: null, currency: null, shop: [
      { dragon: 'Rose', cost: 1, breedable: true, ends: null },
    ] }]);

    // A bad own countdown leaves the Event's end in charge.
    const badOwn = parseLimited(event({ Rose: { countdown: '??', Cost: 1 } }), names, at(2026, 10, 5));
    expect(badOwn.events[0]?.shop[0]?.ends).toBe('2026-10-20');
  });

  it('reads other common date spellings', () => {
    const ends = (countdown: string) =>
      parseLimited(page({ dragons: { Love: { countdown } } }), names, at(2026, 1, 1)).rotation[0]?.ends;
    expect(ends('October 7, 2026')).toBe('2026-10-07');
    expect(ends('  oct 7 2026 ')).toBe('2026-10-07');
    expect(ends('Sept. 21st, 2026')).toBe('2026-09-21');
    expect(ends('2026-10-07')).toBe('2026-10-07');
  });

  it('takes the currency from the Event, else from its shop', () => {
    const fromShop = parseLimited(event({ Rose: { Cost: 1 }, Jasmine: { Currency: 'Spice', Cost: 2 } }), names, at(2026, 10, 5));
    expect(fromShop.events[0]?.currency).toBe('Spice');
    const fromEvent = parseLimited(
      event({ Rose: { Currency: 'Spice', Cost: 1 } }, { countdown: 'October 20, 2026', Currency: 'Gems' }),
      names,
      at(2026, 10, 5),
    );
    expect(fromEvent.events[0]?.currency).toBe('Gems');
  });

  it('keeps an entry whose Cost is not a number, with no price', () => {
    const overlay = parseLimited(event({ Rose: { Cost: '1,250' }, Jasmine: { Cost: 'free' } }), names, at(2026, 10, 5));
    expect(overlay.events[0]?.shop.map((e) => e.cost)).toEqual([1250, null]);
  });

  it('gives an empty overlay for invalid JSON or a page of the wrong shape', () => {
    const empty = { rotation: [], events: [], notRecognised: [] };
    for (const raw of ['', '{"dragons": {', 'not json', 'null', '[]', '42', '"text"']) {
      expect(parseLimited(raw, names, at(2026, 10, 5)), raw).toEqual(empty);
    }
    expect(parseLimited(page({ dragons: [], events: 'x' }), names, at(2026, 10, 5))).toEqual(empty);
    expect(parseLimited(page({ events: { A: 1, B: { dragons: [] } } }), names, at(2026, 10, 5)).events).toEqual([
      { name: 'B', ends: null, currency: null, shop: [] },
    ]);
  });
});
