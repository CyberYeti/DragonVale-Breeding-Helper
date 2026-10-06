// describeTile: what one Dragon tile shows in a cave (spec §8 Dragon tile).

import type { Dragon } from '../../snapshot';
import { breedableNow, caveCanMake, caveForm, noBreeding, ownedPerSetting, type Cave } from '../breeding';
import { formsOf, isOwned, ticks, type Collection } from '../collection';
import type { World } from '../world';
import type { Banner, Display, Tick, TileView } from './types';

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

/** The first banner that applies, in spec §8's order. */
function banner(world: World, dragon: Dragon, cave: Cave): Banner | null {
  const only = noBreeding(dragon);
  if (only) return { kind: only };
  if (dragon.isLimited && !world.available.has(dragon.name)) return { kind: 'not-available' };
  if (!caveCanMake(dragon, cave)) return { kind: 'not-breedable-in-cave', cave };
  if (world.purchaseOnly.has(dragon.name)) return { kind: 'purchase-only' };
  return null;
}

function tileTicks(collection: Collection, dragon: Dragon): Tick[] {
  const all = ticks(collection, dragon);
  return all.map(({ form, owned }) => ({ label: all.length === 1 ? 'owned' : form, form, owned }));
}
