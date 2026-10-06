// Wording shared by the click panel's popover and side sheet. The headline
// and reason come from core/panel as they are; this only names things.

import type { Listed, PairGroup, PanelData } from '../../../lib/core/panel';
import type { Form } from '../../../lib/core/collection';
import type { Dragon, Route } from '../../../lib/snapshot';

const ROUTE_KIND: Record<Route['kind'], string> = {
  bred: 'Bred',
  coop: 'Co-op bred',
  evolved: 'Evolved',
  summoned: 'Summoned',
  purchased: 'Purchased',
};

export function routeKindText(route: Route): string {
  return ROUTE_KIND[route.kind];
}

/** " (Rift form)" for a Dragon with both forms listed in its Rift form. */
export function formSuffix(listed: Pick<Listed, 'form' | 'ticks'>): string {
  return listed.form === 'rift' && listed.ticks.length > 1 ? ' (Rift form)' : '';
}

/** The panel's title line. */
export function panelTitle(data: PanelData): string {
  switch (data.kind) {
    case 'route': {
      const index = data.dragon.routes.indexOf(data.route);
      return `${routeKindText(data.route)} Route ${index + 1} → ${data.dragon.name}${riftForm(data.dragon, data.form)}`;
    }
    case 'element':
      return `${data.element} element${data.breeding === 'rift' ? ' (Rift breeding)' : ''}`;
    case 'dragon':
      return `${data.dragon.name}${riftForm(data.dragon, data.form)}`;
  }
}

const riftForm = (dragon: Dragon, form: Form) => (form === 'rift' && dragon.traits.kind === 'all' ? ' (Rift form)' : '');

/** Every pair, simplest group first: the popover's top pairs. */
export function flatPairs(groups: readonly PairGroup[], limit: number): [Listed, Listed][] {
  const out: [Listed, Listed][] = [];
  for (const g of groups) {
    for (const w of g.with) {
      if (out.length >= limit) return out;
      out.push([g.parent, w]);
    }
  }
  return out;
}

export function pairCount(groups: readonly PairGroup[]): number {
  return groups.reduce((n, g) => n + g.with.length, 0);
}

/** Search over Dragon names: case-insensitive, blank matches everything. */
export function matcher(query: string): (listed: Listed) => boolean {
  const q = query.trim().toLowerCase();
  return q === '' ? () => true : (l) => l.dragon.name.toLowerCase().includes(q);
}
