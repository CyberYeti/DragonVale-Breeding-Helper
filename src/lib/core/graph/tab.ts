// The tab graph and the tree pulled out of it (spec §9, Kinds of graph).

import { caveForm, type Cave } from '../breeding';
import { formsOf, isOwned, type Form } from '../collection';
import type { Dragon } from '../../snapshot';
import type { World } from '../world';
import { Builder, dragonId, focusIn } from './focus';
import type { GraphEdge, GraphModel, GraphNode, NodeId, TabGraph, Target } from './types';

/**
 * The tab graph for `dragonNames` in `cave`: each named Dragon, in the form
 * its tile opens as in `cave`, with every one of its Routes drawn as a Focus
 * view draws a Target's; below them what those Routes need, by the Focus view rules
 * (missing named parents and Evolved bases expand until owned, a dead end or
 * already drawn). Element hubs are shared across the whole graph. Dragons
 * that aren't in `dragonNames` are marked `outside`; every Dragon node has
 * its `generation`.
 *
 * Pass the tab's Dragons before search and filters (core/menu's
 * `tabContents`, every section of it): graphs ignore Show, Rarity and
 * Breedable now. Names given twice are drawn once. Throws for a name the
 * snapshot doesn't have.
 */
export function tabGraph(world: World, dragonNames: Iterable<string>, cave: Cave): TabGraph {
  const dragons = [...new Set(dragonNames)].map((name) => {
    const dragon = world.dragons.get(name);
    if (!dragon) throw new Error(`tabGraph: no Dragon named ${name}`);
    return dragon;
  });
  const members = dragons.map((d) => dragonId(d.name, opensAs(d, cave)));
  const memberSet = new Set(members);

  const build = new Builder(world, cave, memberSet, memberSet);
  // Every member's node first, so one reached as a parent is still drawn as a member.
  const nodes = dragons.map((dragon) => {
    const form = opensAs(dragon, cave);
    return { dragon, node: build.dragon(dragon, form, isOwned(world.collection, dragon, form)) };
  });
  for (const { dragon, node } of nodes) build.expand(node, dragon);

  return { nodes: build.nodes(), edges: build.edges(), target: null, cave, members, world };
}

/** The form a Dragon's tile opens as in `cave` (spec §8, Dragon tile), as core/tile works it out. */
const opensAs = (dragon: Dragon, cave: Cave): Form => caveForm(dragon, cave) ?? formsOf(dragon)[0]!;

/**
 * Focusing `target` inside a tab graph: the Target's Focus view (in the tab
 * graph's cave) marked `lit`, over the rest of the tab graph marked `faded`.
 * The lit nodes and edges are exactly `focusTree`'s, with the same ids, so
 * Element hubs and Dragons already in the graph are shared. A lit node that
 * the tab graph doesn't have is added after the tab graph's nodes.
 * `target` is the Focus view's. Throws as `focusTree`.
 */
export function pullTree(graph: TabGraph, target: Target): GraphModel {
  const tree = focusIn(graph.world, target, graph.cave, new Set(graph.members));
  return {
    nodes: overlay(graph.nodes, tree.nodes),
    edges: overlay(graph.edges, tree.edges),
    target: tree.target,
  };
}

/** The base items faded, each one the tree has replaced by the tree's lit version, then the tree's new ones. */
function overlay<T extends GraphNode | GraphEdge>(base: readonly T[], tree: readonly T[]): T[] {
  const lit = new Map<NodeId, T>(tree.map((item) => [item.id, { ...item, pull: 'lit' }]));
  const out = base.map((item) => lit.get(item.id) ?? { ...item, pull: 'faded' as const });
  const seen = new Set(base.map((item) => item.id));
  for (const [id, item] of lit) if (!seen.has(id)) out.push(item);
  return out;
}
