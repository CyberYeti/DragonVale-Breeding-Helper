import { describe, expect, it } from 'vitest';
import { editDistance, NameMatcher } from './fuzzy';
import { parseLimited } from './index';

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions and neighbour swaps as one edit', () => {
    expect(editDistance('outride', 'outrider')).toBe(1);
    expect(editDistance('teozinite', 'teozinte')).toBe(1);
    expect(editDistance('flaem', 'flame')).toBe(1);
    expect(editDistance('fire', 'ice')).toBe(2);
    expect(editDistance('same', 'same')).toBe(0);
  });

  it('gives up past the limit', () => {
    expect(editDistance('abcdefgh', 'zzzzzzzz', 2)).toBeGreaterThan(2);
  });
});

describe('NameMatcher', () => {
  const dragons = ['Outrider', 'Teozinte', 'Fire', 'Flare', 'Flames', 'Flamer', 'Blue Fire', 'Opal'];
  const m = new NameMatcher(dragons);

  it('finds the one Dragon a typo clearly means (the real wiki typos)', () => {
    expect(m.typoOf('Outride')).toBe('Outrider');
    expect(m.typoOf('Teozinite')).toBe('Teozinte');
  });

  it('ignores case, spaces and punctuation', () => {
    expect(m.typoOf('blue-fire')).toBe('Blue Fire');
    expect(m.typoOf('BLUEFIRE')).toBe('Blue Fire');
  });

  it('leaves an exact name alone', () => {
    expect(m.typoOf('Outrider')).toBeNull();
  });

  it('does not match short names, where one edit changes the Dragon', () => {
    expect(m.typoOf('Fira')).toBeNull();
    expect(m.typoOf('Opel')).toBeNull();
  });

  it('does not match when two Dragons are equally close', () => {
    expect(m.typoOf('Flamed')).toBeNull(); // Flames and Flamer
  });

  it('does not match a name too far from every Dragon', () => {
    expect(m.typoOf('Outrageous')).toBeNull();
    expect(m.typoOf('Teozinitess')).toBeNull();
  });
});

describe('parseLimited with mistyped names', () => {
  const raw = JSON.stringify({
    dragons: { Outride: { countdown: '2026-12-01' }, Mystery: { countdown: '2026-12-01' } },
    events: { Fair: { countdown: '2026-12-01', Currency: 'Spice', dragons: { Teozinite: { Cost: 6000 } } } },
  });
  const overlay = parseLimited(raw, ['Outrider', 'Teozinte'], new Date(2026, 9, 7));

  it('counts a clear typo as its Dragon, in the rotation and in a shop, and reports it', () => {
    expect(overlay.rotation).toEqual([{ dragon: 'Outrider', ends: '2026-12-01' }]);
    expect(overlay.events[0]!.shop.map((s) => s.dragon)).toEqual(['Teozinte']);
    expect(overlay.corrected).toEqual([
      { listed: 'Outride', dragon: 'Outrider' },
      { listed: 'Teozinite', dragon: 'Teozinte' },
    ]);
  });

  it('still reports a name that matches nothing', () => {
    expect(overlay.notRecognised).toEqual(['Mystery']);
  });
});
