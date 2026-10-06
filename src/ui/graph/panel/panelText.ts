// Wording shared by the click panel's popover and side sheet. The headline
// and reason come from core/panel as they are; this only names things.

import type { Listed, PairGroup, PanelData } from '../../../lib/core/panel';
import { routeKindName } from '../../../lib/core/breeding';
import { formsOf, type Form } from '../../../lib/core/collection';
import type { Dragon, Route } from '../../../lib/snapshot';

export function routeKindText(route: Route): string {
  return routeKindName(route.kind);
}

/** " (Rift form)" for a Dragon with both forms listed in its Rift form. */
export function formSuffix(listed: Pick<Listed, 'dragon' | 'form'>): string {
  return riftForm(listed.dragon, listed.form);
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

const riftForm = (dragon: Dragon, form: Form) => (form === 'rift' && formsOf(dragon).length > 1 ? ' (Rift form)' : '');

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
