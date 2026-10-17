# How the wiki's Breeding Sandbox calculates result probabilities

Research for [#56](https://github.com/CyberYeti/DragonVale-Breeding-Helper/issues/56), part of map [#55](https://github.com/CyberYeti/DragonVale-Breeding-Helper/issues/55). Fetched 2026-10-17. Builds on `research/breeding-mechanics.md` (branch `research/breeding-mechanics`).

## Short answer

1. **The Sandbox shows a percentage per result, but it does not compute one.** It looks each number up in a data table, `Data:BreedingOdds.json`. The Lua has no weighting, rarity logic, normalisation or tie-break. Its rules only decide *which* dragons are results. Each result then gets its own fixed base-odds value.
2. **The app stores none of the odds inputs.** `Data:BreedingOdds.json` is not in `public/data/raw/`, and `Dragons.json` and `BreedingHints.json` carry no odds fields.
3. **The numbers are community-measured estimates**, not game-internal exact values. The wiki's own pages say real odds also move with parent level, number owned and cave. Coverage is incomplete: 157 of the 987 dragons in `Dragons.json` have no entry.

## Sources

| Source | Revision fetched | Role |
|---|---|---|
| [Module:BreedingSandbox](https://dragonvale.fandom.com/wiki/Module:BreedingSandbox) (Lua) | current | The calculator. Primary source for what it does |
| [Data:BreedingOdds.json](https://dragonvale.fandom.com/wiki/Data:BreedingOdds.json) | 2026-10-15, user Jojoboz123 | The only source of the percentages (834 entries) |
| [Module:Automation/Dragon/Src](https://dragonvale.fandom.com/wiki/Module:Automation/Dragon/Src) | current | `BreedingOddsTable` and `CloningOddsTable`: how the wiki itself reads the JSON |
| [Breeding Rules](https://dragonvale.fandom.com/wiki/Breeding_Rules) | 2025-05-10 | Prose "Breeding Odds" and "Dragon Levels" sections |
| [Breeding Sandbox](https://dragonvale.fandom.com/wiki/Breeding_Sandbox) | 2024-10-01 | Only a redirect to Breeding Rules, so there is no separate About page |
| [Breeding](https://dragonvale.fandom.com/wiki/Breeding) | 2026-02-28 | Prose on what changes odds; example rates |
| [Breeding Odds](https://dragonvale.fandom.com/wiki/Breeding_Odds), [Epic Breeding Island](https://dragonvale.fandom.com/wiki/Epic_Breeding_Island) | 2024-10-03, 2021-05-01 | Table page wrapper; island effect from "user tests" |

All fetched through `api.php?action=query&prop=revisions&rvprop=content&rvslots=main`.

## 1. How the Sandbox produces a percentage

### Which dragons are results (no probability involved)

`calc:breed` first checks parent compatibility (gem dragons, Legendary/Mythic, opposite primaries). It adds the parents themselves under `parents_always_result_rule` (the Parent Rule). Then it loops every dragon in `Dragons.json` and keeps it only if every iterated rule passes: `available_dragons_be_bred_rule`, `contains_elements_rule`, `specific_combination_rule`, `dragon_exceptions_rule`, `required_elements_for_parents`, `time_of_day_rule`, `weather_rule`, `evolved_dragons_cant_be_bred_rule`, `dragons_require_cave_rule` and `power_weilding_dragons_be_bred_rule`. A dragon also needs a hint that can produce display text. These match `research/breeding-mechanics.md`. Two details are new:

- `dragon_exceptions_rule` reads a `DragonExceptions` list from the hint (a parent that blocks this result). No hint in the 2026-10-15 `Data:BreedingHints.json` uses that field, so the rule is dormant.
- `any_dragon_parent_troll_rule` short-circuits all other rules for "pure Any" hints (Motley, Dargon), subject only to availability.

### What number each result gets (`get_result`)

The whole probability logic is `get_result(dragon, parents)` (Lua lines 572-603):

```
entry = BreedingOdds.breedingOdds[dragon.Name]
if entry has data:
    if dragon is parent A or parent B:           -- cloning
        key = Normal | Rift | Coop   (from cave; Runic counts as Normal)
        odds = (both parents are the same dragon) ? entry.clone.double[key]
                                                  : entry.clone.single[key]
    else:                                         -- normal breeding
        odds = last element of entry.breed
else: odds = nil  -> shown as "?? %"
```

Consequences:

- **Odds are per dragon and independent of the other results.** The Sandbox lists "N results" and shows each one's own base rate. The numbers are not normalised and need not sum to 100%. The wiki says so directly: "The number of resulting dragons from a breeding pair does not affect the chances of breeding a dragon. Chances are determined by breeding odds, not by number of results." (Breeding Rules, Breeding Odds).
- **Owned-count is ignored.** `entry.breed` is an array indexed by how many of that dragon the player owns (`BreedingOddsTable` has columns "0 Owned", "1 Owned" and "2+ Owned", padding short arrays with the last value). The Sandbox always takes the *last* element, the "many owned" value. Enfis is `[0.03, 0.01]`, so the Sandbox shows 1% for an unowned Enfis.
- **Cloning is detected by name**: the result is one of the two parents. One copy as a parent uses `clone.single`, two copies use `clone.double`, each keyed by cave type.
- **Cave only matters for cloning.** Normal-breed odds have no cave key, so the Epic Breeding Island effect is not modelled.
- **Parent level, Epic Breeding Island, time and weather do not change any number.** The environment's `Reduction` (0.2 upgraded cave, 0.25 Runic) only shortens breeding *time*.
- **No tie-breaks or rarity weights exist in code.** Rarity shows up only indirectly, through the stored values. Results sort by breeding time (default), name, or odds. The odds sort comparator has a typo (`not r.odds ~= nil`) and looks unreliable.
- Display is `tonumber(odds) * 100 .. "%"`, so values like 0.0333 show as 3.33% and floating-point artefacts are possible.

### Shape of Data:BreedingOdds.json

```
"Enfis": { "breed": [0.03, 0.01],
           "clone": { "single": {"Normal":..,"Rift":..,"Coop":..},
                      "double": {"Normal":..,"Rift":..,"Coop":..} } }
```

834 entries. `breed` has 1 value for 787 dragons, 2 for 45 and 3 for 2 (Motley and Dargon: `[0.04, 0.01, 0.005]`). The most common single values are 3% (172 dragons), 5% (133), 4% (98) and 2% (72). Seven entries rise with owned count instead of falling (Misfortune, Armament, Dash, Sparkles, Vanguard, Psyche, Bastion), which may be data entry errors. 738 entries have all three single-clone caves and 70 only `Coop`. 633 have all three double-clone caves, 192 only `Coop`.

## 2. Which inputs the app already has

The app stores `public/data/raw/{BreedingHints,Dragons,Game,Limited,Dragonarium,pages}.json`. It has no `BreedingOdds.json`.

| Input the Sandbox uses | In app data? |
|---|---|
| Result eligibility (elements, parents, cave, time, weather, availability, evolution) | Yes: `Dragons.json`, `BreedingHints.json`, `Limited.json` (see the mechanics research) |
| `breed[]` per owned count | **No.** Needs `Data:BreedingOdds.json` |
| `clone.single` / `clone.double` by cave | **No.** Same file |
| Number of copies the player owns | Not checked here. The Sandbox does not use it either |
| Parent level | No, and out of scope (the Collection has no levels) |
| Epic Breeding Island use | No data exists anywhere, only prose |

Dragons in `Dragons.json` with no odds entry: **157 of 987** (80 Hybrid, 28 Epic, 19 Galaxy, 16 Rare, 9 Primary, 3 Legendary, 2 Mythic). Four odds entries (Dracomancy I-IV) are not in `Dragons.json`. The wiki keeps an "Unknown" table (`UnknownBreedingOddsTable`) listing dragons that lack odds, so the gaps are known. Legendary, Mythic and evolved dragons are not bred and are expected to be absent. The Rare and Epic gaps are real holes. The Sandbox shows "?? %" for gaps.

Adding odds to the app means fetching one more data page (the same `api.php` route works) and joining on dragon name.

## 3. Exact, estimated or folklore?

**Estimated and community-sourced, moderate confidence.**

- There is no first-party source. The Breeding page says base rates "can be found on the DECA forum page". The JSON is hand-maintained by wiki editors, last edited 2026-10-15.
- Many values are round (3%, 5%) but others look like observed frequencies: 3.33%, 4.15%, 3.75%, 3.15%, 4.25%. Sample sizes are not published.
- The wiki says odds vary with parent level ("It has been confirmed that higher level dragons have better breeding odds") and Epic Breeding Island ("User tests support that odds of breeding certain dragons appear to be higher"). The Sandbox models neither, so its percentage is an approximation at an unspecified level and cave.
- The sources disagree on a flagship example. The Breeding page says Enfis is 4% unowned and 1% owned. The JSON says 3% and 1%.
- The Breeding page gives ranges, not exact values ("usually between 0.5% and 2.5%" for epic and gemstone, "2% and 4%" for event rares, 10% typical event clone with exceptions).
- No independent measurement was fetched. The DECA forum thread is not reachable through the wiki API and was not read. It, plus any player test logs, would be the next sources if more confidence is needed.

## Implications for the app

- A per-result percentage is cheap to show by copying the Sandbox method: look up `breed[last]` (or `breed[owned]` if counts are tracked) and label it as an approximate base rate.
- Do not normalise it or present it as "your chance of X out of Y results". The Sandbox does not, and the wiki says the number of results does not affect odds.
- Cloning (a parent is the target) is a separate lookup keyed by single/double and by cave. The Normal/Rift/Coop split maps directly onto the app's caves.
- The 157 gaps need a "no data" state, not 0%.
- Ranking by "easiest to get" would work only coarsely. Level, island and owned-count effects are likely larger than small differences between stored values.
