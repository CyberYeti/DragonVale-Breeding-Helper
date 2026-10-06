// What a GraphCanvas tells the node components drawn inside it: whether the
// large-graph rules are on and whether the view is zoomed far out. Node
// components read it through useCanvasView() instead of node data, so
// crossing the zoom threshold doesn't rebuild every node.

import { getContext, setContext } from 'svelte';

/** Below this zoom, tiles in a large graph are drawn lite (spec §9 Performance rules). */
export const FAR_ZOOM = 0.32;

export class CanvasView {
  /** Zoomed out past FAR_ZOOM. Only set in a large graph. */
  far = $state(false);
  readonly #large: () => boolean;

  constructor(large: () => boolean) {
    this.#large = large;
  }

  /** The large-graph rules are on: lite tiles for faded and far-zoomed nodes. */
  get large(): boolean {
    return this.#large();
  }
}

const KEY = Symbol('canvas-view');

export function provideCanvasView(view: CanvasView): void {
  setContext(KEY, view);
}

/** The enclosing GraphCanvas's view. Outside one (never in the app), a small-graph view. */
export function useCanvasView(): CanvasView {
  return getContext<CanvasView | undefined>(KEY) ?? new CanvasView(() => false);
}
