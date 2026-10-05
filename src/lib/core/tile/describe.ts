// describeTile: what one Dragon tile shows in a cave (spec §8 Dragon tile).

import type { Dragon } from '../../snapshot';
import { breedableNow, caveCanMake, caveForm, type Cave } from '../breeding';
import { formsOf, isOwned, ticks, type Collection, type Form } from '../collection';
import type { World } from '../world';
import type { Banner, Display, OwnedForms, Tick, TileView } from './types';

/** The tile for `dragon` in `cave` under the Display settings. */
export function describeTile(world: World, dragon: Dragon, cave: Cave, display: Display): TileView {
  const owned = ownedPerSetting(world.collection, dragon, cave, display.ownedForms);
  const opensAs = caveForm(dragon, cave) ?? formsOf(dragon)[0]!;
  return {
    dragon,
    owned,
    colour: owned || display.allInColour,
    sheen: breedableNow(world, cave).has(dragon.name),
    banner: banner(world, dragon, cave),
    ticks: tileTicks(world.collection, dragon),
    opensAs,
    ownedBanner: isOwned(world.collection, dragon, opensAs),
  };
}

/**
 * Whether `dragon` counts as owned under Owned forms in `cave`: Either counts
 * either form (the Rift form in the Rift cave), Normal the normal form, Rift
 * the Rift form. A single-form Dragon always counts its one form, so an
 * owned Fire stays owned in the Rift cave and an owned Rift dragon under
 * Normal (the menu hides those Dragons; graphs still draw them).
 */
export function ownedPerSetting(collection: Collection, dragon: Dragon, cave: Cave, ownedForms: OwnedForms): boolean {
  const forms = formsOf(dragon);
  if (forms.length === 1) return isOwned(collection, dragon);
  const counted: Form | undefined =
    ownedForms === 'either' ? (cave === 'rift' ? 'rift' : undefined) : ownedForms;
  return isOwned(collection, dragon, counted);
}

/** The first banner that applies, in spec §8's order. */
function banner(world: World, dragon: Dragon, cave: Cave): Banner | null {
  const kinds = new Set(dragon.routes.map((route) => route.kind));
  if (!kinds.has('bred') && !kinds.has('coop')) {
    if (kinds.has('summoned')) return { kind: 'summoning-only' };
    if (kinds.has('evolved')) return { kind: 'evolution-only' };
    return { kind: 'shop-only' };
  }
  if (dragon.isLimited && !world.available.has(dragon.name)) return { kind: 'not-available' };
  if (!caveCanMake(dragon, cave)) return { kind: 'not-breedable-in-cave', cave };
  if (world.purchaseOnly.has(dragon.name)) return { kind: 'purchase-only' };
  return null;
}

function tileTicks(collection: Collection, dragon: Dragon): Tick[] {
  const all = ticks(collection, dragon);
  return all.map(({ form, owned }) => ({ label: all.length === 1 ? 'owned' : form, form, owned }));
}
