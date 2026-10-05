// The Focus view tree (spec §9, Focus view rules 1–9).

import type { BredRoute, CoopRoute, Dragon, EvolvedRoute, Route, RouteKind } from '../../snapshot';
import { breedingFor, caveCanMake, caveForm, formFor, routeStatus, type Cave } from '../breeding';
import { isOwned, type Form } from '../collection';
import type { Breeding, World } from '../world';
import { generations } from './generation';
import { badge, conditionBadges, reason } from './labels';
import type {
  Badge,
  DragonNode,
  GraphEdge,
  GraphEdgeKind,
  GraphModel,
  GraphNode,
  GraphState,
  NodeId,
  Target,
  TargetReason,
} from './types';

const CAVES: readonly Cave[] = ['normal', 'rift', 'coop'];

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableDragonNode = Mutable<DragonNode> & { badges: Badge[] };

/**
 * The Focus view of `target` in `cave`: every Route of the Target, and below
 * each one exactly what it needs, expanding missing named parents (and an
 * Evolved Route's base) through their own Routes until a branch reaches a
 * Dragon owned in the right form, a dead end, or a Dragon already in the view.
 *
 * Pairs, suggestions and the Basic dragon are never in the model; the click
 * panel works them out. Throws when the snapshot has no such Dragon.
 */
export function focusTree(world: World, target: Target, cave: Cave): GraphModel {
  return focusIn(world, target, cave, null);
}

/**
 * `focusTree`, with `members` the tab's Dragon nodes when the tree is pulled
 * out of a tab graph (so the rest are marked `outside`). Throws as `focusTree`.
 */
export function focusIn(world: World, target: Target, cave: Cave, members: ReadonlySet<NodeId> | null): GraphModel {
  const dragon = world.dragons.get(target.dragon);
  if (!dragon) throw new Error(`focusTree: no Dragon named ${target.dragon}`);
  const form = formFor(dragon, target.form);

  const build = new Builder(world, cave, new Set([dragonId(dragon.name, form)]), members);
  const node = build.dragon(dragon, form, isOwned(world.collection, dragon, form));
  build.expand(node, dragon);

  const reasons = targetReasons(world, dragon, form, cave, node.owned);
  return {
    nodes: build.nodes(),
    edges: build.edges(),
    target: { node: node.id, dragon: dragon.name, form, owned: node.owned, breedableNow: reasons.length === 0, reasons },
  };
}

export const dragonId = (name: string, form: Form): NodeId => `dragon:${name}:${form}`;

/**
 * Builds a model by the Focus view rules. `roots` are drawn as Targets: always
 * expanded, dimmed when not Available, badged when owned. The Focus view has
 * one; a tab graph has every Dragon of the tab. With `members` set, every
 * other Dragon node is `outside`.
 */
export class Builder {
  private readonly nodeMap = new Map<NodeId, GraphNode | MutableDragonNode>();
  private readonly edgeMap = new Map<string, GraphEdge>();
  private readonly generation: ReadonlyMap<string, number>;

  constructor(
    private readonly world: World,
    private readonly cave: Cave,
    private readonly roots: ReadonlySet<NodeId>,
    private readonly members: ReadonlySet<NodeId> | null = null,
  ) {
    this.generation = generations(world);
  }

  nodes(): GraphNode[] {
    return [...this.nodeMap.values()];
  }

  edges(): GraphEdge[] {
    return [...this.edgeMap.values()];
  }

  /** The Dragon's node, added if it isn't in the view yet. */
  dragon(dragon: Dragon, form: Form, owned: boolean): MutableDragonNode {
    const id = dragonId(dragon.name, form);
    const existing = this.nodeMap.get(id);
    if (existing) return existing as MutableDragonNode;
    const isTarget = this.roots.has(id);

    const unavailable = !this.world.available.has(dragon.name);
    let state: GraphState = 'normal';
    if (isTarget && unavailable) state = 'dimmed';
    else if (!isTarget && unavailable && !owned) state = 'locked';

    const node: MutableDragonNode = {
      id,
      kind: 'dragon',
      dragon: dragon.name,
      form,
      owned,
      expanded: false,
      generation: this.generation.get(dragon.name) ?? 1,
      outside: this.members !== null && !this.members.has(id),
      state,
      badges: isTarget && owned ? [badge({ kind: 'owned' })] : [],
    };
    this.nodeMap.set(id, node);
    return node;
  }

  /**
   * Draws the Dragon's Routes below its node, once. A node that's owned (and
   * isn't a root) or that can't be a parent stays a leaf.
   */
  expand(node: MutableDragonNode, dragon: Dragon): void {
    if (node.expanded) return;
    const isTarget = this.roots.has(node.id);
    if (!isTarget && node.owned) return;
    if (!isTarget && !dragon.canBeParent) {
      if (!node.badges.some((b) => b.kind === 'cannot-be-parent')) node.badges.push(badge({ kind: 'cannot-be-parent' }));
      return;
    }
    node.expanded = true;

    let breedable = false;
    dragon.routes.forEach((route, index) => {
      switch (route.kind) {
        case 'purchased':
          node.badges.push(badge({ kind: 'purchased' }));
          return;
        case 'summoned':
          node.badges.push(badge({ kind: 'summoned', artifacts: route.artifacts }));
          return;
        case 'bred':
          breedable = true;
          this.bredRoute(node, dragon, route, index);
          return;
        case 'coop':
          breedable = true;
          this.coopRoute(node, dragon, route, index);
          return;
        case 'evolved':
          breedable = true;
          this.evolvedRoute(node, dragon, route, index);
          return;
      }
    });
    if (!breedable) node.badges.push(badge({ kind: 'dead-end' }));
  }

  private bredRoute(owner: MutableDragonNode, dragon: Dragon, route: BredRoute, index: number): void {
    const breeding = breedingFor(route, owner.form);
    const parentSet = this.world.parents[breeding];
    const req = route.requirement;
    const status = routeStatus(this.world, dragon, route, owner.form);
    const purchaseOnly = this.world.purchaseOnly.has(dragon.name);

    const parents = (req.parents ?? []).flatMap((name) => {
      const parent = this.world.dragons.get(name);
      return parent ? [parent] : [];
    });
    const unavailable = parents
      .filter((p) => !parentSet.names.has(p.name) && !this.world.available.has(p.name))
      .map((p) => p.name);

    const state: GraphState = purchaseOnly
      ? 'locked'
      : unavailable.length > 0
        ? 'dimmed'
        : status.met
          ? 'met'
          : 'normal';
    const badges: Badge[] = [];
    if (purchaseOnly) badges.push(badge({ kind: 'purchase-only' }));
    if (unavailable.length > 0) badges.push(badge({ kind: 'not-available', dragons: unavailable }));
    if (status.reason.kind === 'opposites' || status.reason.kind === 'no-valid-pair') {
      badges.push(badge({ kind: 'no-valid-pair' }));
    }
    badges.push(...conditionBadges(route.conditions), ...this.caveBadges(dragon, owner.form, route));

    const pill = this.routeNode(owner, dragon, route, index, status.met, state, badges);

    const both = req.elementOnBothParents;
    const elements = [...new Set([...(req.elements ?? []), ...(both === undefined ? [] : [both])])];
    for (const element of elements) {
      const id = this.elementNode(element, breeding);
      this.edge('requirement', id, pill, state, element === both ? [badge({ kind: 'both-parents' })] : []);
    }
    if (req.minDistinctElements !== undefined) {
      const id = this.ruleNode(pill, 'minDistinctElements', `Any ${req.minDistinctElements}+ elements`);
      this.edge('requirement', id, pill, state);
    }
    if (req.anyPair) {
      const id = this.ruleNode(pill, 'anyPair', 'Any pair');
      this.edge('requirement', id, pill, state);
    }
    for (const parent of parents) {
      const form = formFor(parent, breeding);
      const node = this.dragon(parent, form, parentSet.names.has(parent.name));
      this.edge('requirement', node.id, pill, state);
      // Rule 5: a Purchase only Route shows its parents but doesn't expand them.
      if (!purchaseOnly) this.expand(node, parent);
    }
  }

  private coopRoute(owner: MutableDragonNode, dragon: Dragon, route: CoopRoute, index: number): void {
    const status = routeStatus(this.world, dragon, route, owner.form);
    const state: GraphState = status.met ? 'met' : 'normal';
    const badges = [...conditionBadges(route.conditions), ...this.caveBadges(dragon, owner.form, route)];
    const pill = this.routeNode(owner, dragon, route, index, status.met, state, badges);

    // Rule 9: the friend's node is never checked against the Collection or expanded.
    const friend = `friend:${route.friendsDragon}`;
    if (!this.nodeMap.has(friend)) {
      this.nodeMap.set(friend, {
        id: friend,
        kind: 'friend',
        dragon: route.friendsDragon,
        label: `${route.friendsDragon} (friend's)`,
        state: 'normal',
        badges: [],
      });
    }
    this.edge('coop-only', friend, pill, state, [badge({ kind: 'any-dragon' })]);
  }

  private evolvedRoute(owner: MutableDragonNode, dragon: Dragon, route: EvolvedRoute, index: number): void {
    const status = routeStatus(this.world, dragon, route, owner.form);
    const base = this.world.dragons.get(route.from);
    const baseForm = base ? formFor(base, owner.form) : owner.form;
    const baseOwned = base ? isOwned(this.world.collection, base, baseForm) : false;
    const unavailable = base && !baseOwned && !this.world.available.has(base.name);

    const state: GraphState = unavailable ? 'dimmed' : status.met ? 'met' : 'normal';
    const badges = unavailable ? [badge({ kind: 'not-available', dragons: [route.from] })] : [];
    const pill = this.routeNode(owner, dragon, route, index, status.met, state, badges);
    if (!base) return;

    // Rule 4: the evolves-from edge leads to the base Dragon, which expands as normal.
    const node = this.dragon(base, baseForm, baseOwned);
    this.edge('evolves-from', node.id, pill, state, [badge({ kind: 'decoration', decorations: route.decorations })]);
    this.expand(node, base);
  }

  private routeNode(
    owner: MutableDragonNode,
    dragon: Dragon,
    route: BredRoute | CoopRoute | EvolvedRoute,
    index: number,
    met: boolean,
    state: GraphState,
    badges: Badge[],
  ): NodeId {
    const id = `route:${owner.id}:${index}`;
    this.nodeMap.set(id, {
      id,
      kind: 'route',
      owner: owner.id,
      dragon: dragon.name,
      form: owner.form,
      routeIndex: index,
      routeKind: route.kind,
      met,
      state,
      badges: [],
    });
    this.edgeMap.set(`${id}>${owner.id}`, {
      id: `${id}>${owner.id}`,
      kind: 'route',
      source: id,
      target: owner.id,
      route: id,
      state,
      badges,
    });
    return id;
  }

  private elementNode(element: string, breeding: Breeding): NodeId {
    const id = `element:${element}:${breeding}`;
    if (!this.nodeMap.has(id)) {
      this.nodeMap.set(id, {
        id,
        kind: 'element',
        element,
        breeding,
        covered: coveredElements(this.world, breeding).has(element),
        state: 'normal',
        badges: [],
      });
    }
    return id;
  }

  private ruleNode(pill: NodeId, rule: 'minDistinctElements' | 'anyPair', label: string): NodeId {
    const id = `rule:${pill}:${rule}`;
    this.nodeMap.set(id, { id, kind: 'rule', rule, label, state: 'normal', badges: [] });
    return id;
  }

  /** An edge into a Route pill. A requirement named twice is drawn once. */
  private edge(kind: GraphEdgeKind, source: NodeId, pill: NodeId, state: GraphState, badges: Badge[] = []): void {
    const id = `${source}>${pill}`;
    if (this.edgeMap.has(id)) return;
    this.edgeMap.set(id, { id, kind, source, target: pill, route: pill, state, badges });
  }

  /** "Rift cave only" and the like, when the chosen cave doesn't use this Route for this Dragon and form. */
  private caveBadges(dragon: Dragon, form: Form, route: BredRoute | CoopRoute): Badge[] {
    const caves = CAVES.filter((c) => caveForm(dragon, c) === form && caveCanMake(dragon, c) && caveUses(route, c));
    return caves.includes(this.cave) ? [] : [badge({ kind: 'other-cave', caves })];
  }
}

/** Whether `cave` uses a Route of this kind (spec §6, What each Breeding cave makes). */
const caveUses = (route: Route, cave: Cave): boolean =>
  route.kind === 'bred' ? cave === 'rift' || route.rift !== 'only' : route.kind === 'coop' && cave === 'coop';

const coveredCache = new WeakMap<World, Partial<Record<Breeding, ReadonlySet<string>>>>();

/** The Elements some parent that counts for `breeding` carries. Cached per World. */
function coveredElements(world: World, breeding: Breeding): ReadonlySet<string> {
  let perWorld = coveredCache.get(world);
  if (!perWorld) coveredCache.set(world, (perWorld = {}));
  return (perWorld[breeding] ??= new Set(world.parents[breeding].dragons.flatMap((d) => d.breedingElements)));
}

/** Rule 7: why the Target can't be bred now in `cave`, all that apply. */
function targetReasons(world: World, dragon: Dragon, form: Form, cave: Cave, owned: boolean): TargetReason[] {
  const reasons: TargetReason[] = [];
  if (owned) reasons.push(reason({ kind: 'owned' }));

  const makes = caveForm(dragon, cave) === form && caveCanMake(dragon, cave);
  if (!CAVES.some((c) => caveCanMake(dragon, c))) {
    const sources = [...new Set<RouteKind>(dragon.routes.map((r) => r.kind))];
    reasons.push(reason({ kind: 'no-breeding', sources }));
  } else if (!makes) {
    reasons.push(reason({ kind: 'cave', cave }));
  }
  if (!world.available.has(dragon.name)) reasons.push(reason({ kind: 'not-available' }));
  if (world.purchaseOnly.has(dragon.name)) reasons.push(reason({ kind: 'purchase-only' }));
  if (makes) {
    const met = dragon.routes.some((r) => caveUses(r, cave) && routeStatus(world, dragon, r, form).met);
    if (!met) reasons.push(reason({ kind: 'not-met' }));
  }
  return reasons;
}
