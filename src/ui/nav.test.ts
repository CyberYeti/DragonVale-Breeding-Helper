// ui/nav's browser-history tie-in, against a fake history whose `popstate`
// arrives when the test says (as the browser's does, after the call).
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../lib/snapshot';
import { Nav, type HistoryPort } from './nav.svelte';

const snapshot = { pages: [{ name: 'Rift' }] } as unknown as Snapshot;

class FakeHistory implements HistoryPort {
  readonly events = new EventTarget();
  entries: unknown[] = [null];
  index = 0;
  #pending: number[] = [];

  get state(): unknown {
    return this.entries[this.index];
  }
  pushState(data: unknown): void {
    this.entries = [...this.entries.slice(0, this.index + 1), structuredClone(data)];
    this.index++;
  }
  replaceState(data: unknown): void {
    this.entries[this.index] = structuredClone(data);
  }
  go(delta: number): void {
    this.#pending.push(delta);
  }
  /** Delivers the asked-for steps, one `popstate` each, like the browser. */
  flush(): void {
    for (const delta of this.#pending.splice(0)) this.#move(delta);
  }
  /** The browser's own back button. */
  browserBack(): void {
    this.#move(-1);
  }
  browserForward(): void {
    this.#move(1);
  }
  #move(delta: number): void {
    const next = Math.max(0, Math.min(this.entries.length - 1, this.index + delta));
    if (next === this.index) return;
    this.index = next;
    this.events.dispatchEvent(Object.assign(new Event('popstate'), { state: this.state }));
  }
}

function connected() {
  const nav = new Nav(snapshot);
  const history = new FakeHistory();
  nav.connectHistory(history, history.events);
  return { nav, history };
}

describe('Nav history', () => {
  it('browser back from a Focus view returns to the tiles', () => {
    const { nav, history } = connected();
    nav.openFocus('Fire', 'normal');
    expect(history.entries).toHaveLength(2);
    history.browserBack();
    expect(nav.levels).toEqual([]);
  });

  it('tab graph → tree → back → back is the tiles, and a new tree replaces the old one', () => {
    const { nav, history } = connected();
    nav.openTabGraph();
    nav.pullTree('Fire', 'normal');
    nav.pullTree('Plant', 'normal');
    expect(history.entries).toHaveLength(3);
    nav.back();
    history.flush();
    expect(nav.level?.kind).toBe('tab-graph');
    history.browserBack();
    expect(nav.levels).toEqual([]);
  });

  it('a retargeted Focus view still goes straight back to the tiles', () => {
    const { nav, history } = connected();
    nav.openFocus('Fire', 'normal');
    nav.retarget('Plant', 'normal');
    expect(nav.level).toEqual({ kind: 'focus', target: 'Plant', form: 'normal' });
    nav.back();
    history.flush();
    expect(nav.levels).toEqual([]);
    expect(history.index).toBe(0);
  });

  it('a quick double back never steps out past the tiles', () => {
    const { nav, history } = connected();
    nav.openFocus('Fire', 'normal');
    nav.back();
    nav.back();
    history.flush();
    expect(history.index).toBe(0);
    expect(nav.levels).toEqual([]);
  });

  it('back returns to the previous tab, and forward brings a graph back', () => {
    const { nav, history } = connected();
    nav.goTo({ kind: 'page', page: 'Rift' });
    nav.openFocus('Fire', 'normal');
    history.browserBack();
    history.browserBack();
    expect(nav.tab).toEqual({ kind: 'breedable' });
    history.browserForward();
    history.browserForward();
    expect(nav.tab).toEqual({ kind: 'page', page: 'Rift' });
    expect(nav.level).toEqual({ kind: 'focus', target: 'Fire', form: 'normal' });
  });

  it('closeGraphs steps back over every level at once', () => {
    const { nav, history } = connected();
    nav.openTabGraph();
    nav.pullTree('Fire', 'normal');
    nav.closeGraphs();
    history.flush();
    expect(nav.levels).toEqual([]);
    expect(history.index).toBe(0);
  });

  it('without a history, back works on the levels alone', () => {
    const nav = new Nav(snapshot);
    nav.openTabGraph();
    nav.back();
    expect(nav.levels).toEqual([]);
  });
});
