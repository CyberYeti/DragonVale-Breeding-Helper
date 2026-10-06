// The text each badge and Target reason shows. Kept in one place so the
// wording matches across views.

import type { Conditions, RouteKind } from '../../snapshot';
import type { Cave } from '../breeding';
import type { Badge, ConditionKind, TargetReason } from './types';

const CAVE_NAMES: Record<Cave, string> = { normal: 'Normal', rift: 'Rift', coop: 'Co-op' };

/** "Normal cave", "Rift or Co-op cave". */
const caveText = (caves: readonly Cave[]): string => `${caves.map((c) => CAVE_NAMES[c]).join(' or ')} cave`;

type Unlabelled<T> = T extends unknown ? Omit<T, 'label'> : never;

export function badge(b: Unlabelled<Badge>): Badge {
  return { ...b, label: badgeLabel(b) } as Badge;
}

function badgeLabel(b: Unlabelled<Badge>): string {
  switch (b.kind) {
    case 'owned':
      return 'Owned';
    case 'purchased':
      return 'Purchased';
    case 'summoned':
      return b.artifacts.length > 0 ? `Summoned with ${b.artifacts.join(', ')}` : 'Summoned';
    case 'dead-end':
      return 'Dead end';
    case 'cannot-be-parent':
      return b.dragons.length === 1
        ? `Needs ${b.dragons[0]}, which can't be a parent`
        : `Needs ${b.dragons.join(' and ')}, which can't be parents`;
    case 'decoration':
      return b.decorations.length > 0 ? `Evolves with ${b.decorations.join(' or ')}` : 'Evolves';
    case 'any-dragon':
      return '+ any dragon';
    case 'both-parents':
      return 'On both parents';
    case 'purchase-only':
      return '🔒 Purchase only';
    case 'not-available':
      return 'Not available';
    case 'no-valid-pair':
      return 'No valid pair yet';
    case 'condition':
      return `${CONDITION_NAMES[b.condition]}: ${b.value}`;
    case 'other-cave':
      return b.caves.length > 0 ? `${caveText(b.caves)} only` : 'No cave makes this form';
  }
}

const CONDITION_NAMES: Record<ConditionKind, string> = {
  time: 'Time',
  weather: 'Weather',
  alignment: 'Rift alignment',
  parentTrait: 'Parent trait',
  namedParentTrait: 'Trait',
  cloneCave: 'Clone in',
  prerequisite: 'Needs',
};

/** One badge per condition, in a fixed order. */
export function conditionBadges(conditions: Conditions | undefined): Badge[] {
  if (!conditions) return [];
  const out: Badge[] = [];
  const add = (condition: ConditionKind, value: string | undefined) => {
    if (value !== undefined) out.push(badge({ kind: 'condition', condition, value }));
  };
  add('time', conditions.time);
  add('weather', conditions.weather);
  add('alignment', conditions.alignment);
  add('parentTrait', conditions.parentTrait);
  for (const { dragon, trait } of conditions.namedParentTraits ?? []) add('namedParentTrait', `${dragon} with ${trait}`);
  add('cloneCave', conditions.cloneCave);
  add('prerequisite', conditions.prerequisite);
  return out;
}

const SOURCE_WORDS: Partial<Record<RouteKind, string>> = {
  evolved: 'Evolution',
  summoned: 'Summoning',
  purchased: 'Shop',
};

export function reason(r: Unlabelled<TargetReason>): TargetReason {
  return { ...r, label: reasonLabel(r) } as TargetReason;
}

function reasonLabel(r: Unlabelled<TargetReason>): string {
  switch (r.kind) {
    case 'owned':
      return 'Owned';
    case 'no-breeding': {
      const words = r.sources.map((s) => SOURCE_WORDS[s] ?? s);
      return words.length > 0 ? `${words.join(' or ')} only` : 'No way to obtain it';
    }
    case 'cave':
      return `Not breedable in ${caveText([r.cave])}`;
    case 'not-available':
      return 'Not available';
    case 'purchase-only':
      return '🔒 Purchase only';
    case 'not-met':
      return 'No Route is met from your Collection yet';
  }
}
