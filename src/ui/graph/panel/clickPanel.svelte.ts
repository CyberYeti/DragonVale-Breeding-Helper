// The click panel's state for one graph view (spec §9 Click panel): which
// node is selected, whether its Details sheet is open, and the PanelData
// core/panel works out for it. The view that draws the graph owns one of
// these and provides it, so the node components (popover via NodeToolbar)
// and the view's side sheet read the same selection.
//
// A view uses it like this:
//   const panel = new ClickPanel(store, () => model, (dragon, form) => …make it the Target…);
//   provideClickPanel(panel);
//   <ClickPanelFrame {panel}> <GraphView selected={panel.selected} onnodeclick={(n) => panel.toggle(n)}
//                                        onpaneclick={() => panel.selected ? panel.close() : nav.back()} …/> </ClickPanelFrame>

import { getContext, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import type { Form } from '../../../lib/core/collection';
import type { GraphModel, GraphNode, NodeId } from '../../../lib/core/graph';
import { panelFor, type Clicked, type PanelData } from '../../../lib/core/panel';
import type { AppStore } from '../../store.svelte';

/**
 * Phone width (spec §8 Phone layout; keep 700px in step with MenuShell): the
 * popover docks at the bottom and the side sheet becomes a bottom sheet.
 */
export const phoneWidth = new MediaQuery('max-width: 700px');

/** A panel for a model with no Target (a plain tab graph) still needs one; nothing is excluded then. */
const NO_TARGET = { dragon: '', form: 'normal' } as const;

export class ClickPanel {
  /** The node whose panel is open, or null. Pass it to GraphView as `selected`. */
  selected: NodeId | null = $state(null);
  /** The Details side sheet (bottom sheet on a phone) is open instead of the popover. */
  details = $state(false);
  /**
   * Set when a Dragon picked in a panel selected a node: the node's component
   * pans it into view. `n` changes on every pick so picking the same node again
   * still pans.
   */
  reveal: { readonly id: NodeId; readonly n: number } | null = $state.raw(null);

  readonly #store: AppStore;
  readonly #model: () => GraphModel | null;
  readonly #retarget: (dragon: string, form: Form) => void;

  /**
   * @param model the model on screen (null while it can't be built).
   * @param retarget makes a Dragon the Target: called for a Dragon picked in a
   *   panel that has no node in the model, and by the Dragon popover's
   *   "Make Target".
   */
  constructor(store: AppStore, model: () => GraphModel | null, retarget: (dragon: string, form: Form) => void) {
    this.#store = store;
    this.#model = model;
    this.#retarget = retarget;
  }

  /** The selected node, if it's still in the model. */
  readonly node: GraphNode | null = $derived.by(() => {
    const id = this.selected;
    if (id === null) return null;
    return this.#model()?.nodes.find((n) => n.id === id) ?? null;
  });

  /** What core/panel says about the selected node; recomputed when the Collection or cave changes. */
  readonly data: PanelData | null = $derived.by(() => {
    const model = this.#model();
    const node = this.node;
    if (!model || !node) return null;
    const clicked = clickedFor(model, node);
    if (!clicked) return null;
    const target = model.target ? { dragon: model.target.dragon, form: model.target.form } : NO_TARGET;
    try {
      return panelFor(this.#store.world, this.#store.cave, target, clicked);
    } catch {
      return null;
    }
  });

  /** Whether the model has a Target (Dragon panels then offer "Make Target" for the others). */
  get targetNode(): NodeId | null {
    return this.#model()?.target?.node ?? null;
  }

  /** A node tap: opens its panel, or closes it when it's already open. */
  toggle(node: GraphNode): void {
    if (this.selected === node.id) this.close();
    else this.selected = node.id;
  }

  /** Opens `id`'s panel, keeping the Details sheet open if it is. */
  select(id: NodeId): void {
    this.selected = id;
  }

  /** Closes the popover and the sheet. */
  close(): void {
    this.selected = null;
    this.details = false;
  }

  openDetails(): void {
    this.details = true;
  }

  /** Back from the sheet to the popover. */
  closeDetails(): void {
    this.details = false;
  }

  /**
   * A Dragon named in a panel was tapped: select its node if the tree has
   * one (the same form first), otherwise make it the Target.
   */
  pickDragon(dragon: string, form: Form): void {
    const nodes = (this.#model()?.nodes ?? []).filter((n) => n.kind === 'dragon' && n.dragon === dragon);
    const node = nodes.find((n) => n.kind === 'dragon' && n.form === form) ?? nodes[0];
    if (node) {
      this.selected = node.id;
      this.reveal = { id: node.id, n: (this.reveal?.n ?? 0) + 1 };
    } else {
      this.close();
      this.#retarget(dragon, form);
    }
  }

  /** A Route listed in a Dragon panel was tapped: select its pill if drawn. */
  pickRoute(dragon: string, form: Form, index: number): void {
    const node = this.#model()?.nodes.find(
      (n) => n.kind === 'route' && n.dragon === dragon && n.form === form && n.routeIndex === index,
    );
    if (node) {
      this.selected = node.id;
      this.reveal = { id: node.id, n: (this.reveal?.n ?? 0) + 1 };
    }
  }

  /** Makes a Dragon the Target (the Dragon popover's button). */
  retarget(dragon: string, form: Form): void {
    this.close();
    this.#retarget(dragon, form);
  }
}

/**
 * The core/panel Clicked for a node. A rule node or a friend's node opens the
 * panel of the Route it feeds; a node that feeds nothing has no panel.
 */
function clickedFor(model: GraphModel, node: GraphNode): Clicked | null {
  switch (node.kind) {
    case 'route':
      return { kind: 'route', dragon: node.dragon, form: node.form, route: node.routeIndex };
    case 'element':
      return { kind: 'element', element: node.element, breeding: node.breeding };
    case 'dragon':
      return { kind: 'dragon', dragon: node.dragon, form: node.form };
    case 'rule':
    case 'friend': {
      const edge = model.edges.find((e) => e.source === node.id);
      const route = edge && model.nodes.find((n) => n.id === edge.route);
      return route?.kind === 'route' ? clickedFor(model, route) : null;
    }
  }
}

// ---- Context ----------------------------------------------------------------

const KEY = Symbol('click-panel');

/** Makes `panel` the one the graph's node components below read. */
export function provideClickPanel(panel: ClickPanel): void {
  setContext(KEY, panel);
}

/** The click panel of the graph view above, or null when the view has none. */
export function useClickPanel(): ClickPanel | null {
  return getContext<ClickPanel | undefined>(KEY) ?? null;
}
