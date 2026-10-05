// Which owned form counts under the Owned forms display setting, per cave.
// Shared by core/tile (colour) and core/menu (Show filter, owned/total), so
// both read ownership the same way. Display only: breeding never uses it.

import type { Dragon } from '../../snapshot';
import { formsOf, isOwned, type Collection, type Form } from '../collection';
import type { Cave, OwnedForms } from './types';

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
  const counted: Form | undefined = ownedForms === 'either' ? (cave === 'rift' ? 'rift' : undefined) : ownedForms;
  return isOwned(collection, dragon, counted);
}
