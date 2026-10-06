// Saved arrangements of the main graphs: the storage key, the stored form,
// merging the moves over the layout, and the store over a fake localStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Position } from '../../lib/core/layout';
import { addMoves, arrangementKey, parseMoves, serializeMoves, tabGraphName, withMoves } from './arrangement';
import { SavedArrangements } from './arrangement.svelte';

const at = (x: number, y: number): Position => ({ x, y });

describe('arrangementKey', () => {
  it('names the tab graph, the cave and the version', () => {
    expect(arrangementKey({ kind: 'page', page: 'Spooky' }, 'normal')).toBe('arrangement:v1:page:Spooky:normal');
    expect(arrangementKey({ kind: 'event' }, 'rift')).toBe('arrangement:v1:event:rift');
    expect(arrangementKey({ kind: 'breedable' }, 'coop')).toBe('arrangement:v1:breedable:coop');
    expect(tabGraphName({ kind: 'limited' })).toBe('limited');
  });

  it('differs per cave', () => {
    const tab = { kind: 'page', page: 'Rift' } as const;
    expect(arrangementKey(tab, 'normal')).not.toBe(arrangementKey(tab, 'rift'));
  });
});

describe('stored form', () => {
  it('round-trips, in whole px', () => {
    const moves = new Map([
      ['dragon:Fire:normal', at(10.4, -20.6)],
      ['element:Earth:normal', at(0, 300)],
    ]);
    const text = serializeMoves(moves);
    expect(JSON.parse(text)).toEqual({ 'dragon:Fire:normal': [10, -21], 'element:Earth:normal': [0, 300] });
    expect(parseMoves(JSON.parse(text))).toEqual(
      new Map([
        ['dragon:Fire:normal', at(10, -21)],
        ['element:Earth:normal', at(0, 300)],
      ]),
    );
  });

  it('drops malformed entries and ignores anything that is not an object of pairs', () => {
    expect(parseMoves(null).size).toBe(0);
    expect(parseMoves([1, 2]).size).toBe(0);
    expect(parseMoves('x').size).toBe(0);
    const moves = parseMoves({ a: [1, 2], b: [1], c: ['1', 2], d: [Infinity, 0], e: { x: 1, y: 2 }, f: [3, 4] });
    expect([...moves.keys()]).toEqual(['a', 'f']);
  });
});

describe('withMoves', () => {
  const base = new Map([
    ['a', at(0, 0)],
    ['b', at(100, 0)],
  ]);

  it('puts moved nodes where they were left, over the layout', () => {
    const out = withMoves(base, new Map([['b', at(5, 6)]]));
    expect(out.get('a')).toEqual(at(0, 0));
    expect(out.get('b')).toEqual(at(5, 6));
    expect(base.get('b')).toEqual(at(100, 0));
  });

  it('ignores nodes that are no longer in the graph', () => {
    const out = withMoves(base, new Map([['gone', at(1, 1)]]));
    expect(out).toBe(base);
    expect(out.has('gone')).toBe(false);
  });

  it('addMoves lets the later move win', () => {
    const out = addMoves(new Map([['a', at(1, 1)]]), new Map([['a', at(2, 2)], ['b', at(3, 3)]]));
    expect(out).toEqual(new Map([['a', at(2, 2)], ['b', at(3, 3)]]));
  });
});

describe('SavedArrangements', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const tab = { kind: 'event' } as const;

  it('saves moves under the prefixed key and reads them back in a new session', () => {
    const saved = new SavedArrangements();
    expect(saved.has(tab, 'normal')).toBe(false);
    saved.move(tab, 'normal', new Map([['a', at(1, 2)]]));
    saved.move(tab, 'normal', new Map([['b', at(3, 4)]]));
    expect(data.get('dvbh:arrangement:v1:event:normal')).toBe('{"a":[1,2],"b":[3,4]}');
    const later = new SavedArrangements();
    expect(later.moves(tab, 'normal')).toEqual(new Map([['a', at(1, 2)], ['b', at(3, 4)]]));
    expect(later.has(tab, 'rift')).toBe(false);
  });

  it('reset forgets the moves and counts the reset', () => {
    const saved = new SavedArrangements();
    saved.move(tab, 'normal', new Map([['a', at(1, 2)]]));
    saved.reset(tab, 'normal');
    expect(saved.has(tab, 'normal')).toBe(false);
    expect(saved.resets).toBe(1);
    expect(data.size).toBe(0);
  });

  it('ignores an older version and works without storage', () => {
    data.set('dvbh:arrangement:v0:event:normal', '{"a":[1,2]}');
    expect(new SavedArrangements().has(tab, 'normal')).toBe(false);
    vi.stubGlobal('localStorage', undefined);
    const saved = new SavedArrangements();
    saved.move(tab, 'normal', new Map([['a', at(1, 2)]]));
    expect(saved.moves(tab, 'normal').get('a')).toEqual(at(1, 2));
  });
});
