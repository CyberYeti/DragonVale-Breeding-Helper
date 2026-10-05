// core/breeding: the breeding rules every view shares (spec §6).
export type * from './types';
export { basicDragon, breedableNow, caveCanMake, caveForm, routeStatus, validPairs } from './rules';
export { wouldBeValidPair } from './pairs';
