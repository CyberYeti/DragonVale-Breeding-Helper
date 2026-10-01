# How to get dragon data out of the wiki

Research for [#3](https://github.com/CyberYeti/DragonVale-Breeding-Helper/issues/3), part of map #1. Checked 2026-10-01 against the live wiki (MediaWiki 1.43.9). About 25 API requests in total, one per second, with a descriptive User-Agent.

## Answer

The scraper doesn't need to parse dragon pages at all. Dragon pages on the DragonVale wiki contain only a bare `{{Infobox/Dragon}}` call. That template calls the Lua module `Module:Dragonbox`, which reads the wiki's own JSON data pages in the `Data:` namespace (namespace 112). Those JSON pages are the wiki's source of truth for the data shown in every infobox and in its breeding sandbox, and the API serves them raw.

Recommended approach: one `action=query&prop=revisions` request per run, fetching a few `Data:*.json` pages and saving the raw JSON plus each page's revision ID and timestamp. Then transform locally into the app's snapshot. No HTML scraping, no per-dragon requests, no crawling.

```
GET https://dragonvale.fandom.com/api.php
  ?action=query&prop=revisions&rvprop=content|timestamp|ids&rvslots=main
  &titles=Data:Dragons.json|Data:BreedingHints.json|Data:Game.json|Data:DragonForms.json|Data:Limited.json
  &format=json&formatversion=2
```

Total payload is about 1.4 MB (`Data:Dragons.json` alone is 1,099,738 bytes). Fetch images separately, and only if we decide to use them (see Images).

## Evidence

### The API is open and usable

- `api.php` answers anonymous `action=query`, `action=parse` and `prop=revisions` requests. `meta=siteinfo` reports `generator: MediaWiki 1.43.9` and `rightsinfo: {"url": "https://www.fandom.com/licensing", "text": "CC-BY-SA"}`.
- Statistics: 3,227 articles, 15 active users, 4 admins.
- No rate-limit headers came back (`Cache-Control: private, no-store`, no `X-RateLimit-*` or `Retry-After`). Fandom's [Help:Bots](https://community.fandom.com/wiki/Help:Bots) only sets a limit for edits ("more than one edit per second … slow it down"). It says nothing about reads. Running once per release with a single batched request is far below any reasonable limit.
- `www.fandom.com/licensing` and `/terms-of-use` returned HTTP 402/403 to non-browser fetches (bot protection), so the licence terms below come from the Community Central help page and the wiki's own copyright page, both fetched through the API.

### Dragon pages hold no data

`Plant Dragon` wikitext (rev 2025-03-14) is `{{Infobox/Dragon}}` followed by prose, a gallery and notes. Most of the old hand-written breeding text is commented out. [`Template:Infobox/Dragon`](https://dragonvale.fandom.com/wiki/Template:Infobox/Dragon) is just `{{#invoke:Dragonbox|load|name={{PAGENAME}}…}}`. [`Module:Dragonbox`](https://dragonvale.fandom.com/wiki/Module:Dragonbox) starts with:

```lua
local dragonData = mw.loadJsonData('Data:Dragons.json')
local breedingHintsData = mw.loadJsonData('Data:BreedingHints.json').breedingHints
local dragonFormsData = mw.loadJsonData('Data:DragonForms.json')
...
```

So scraping rendered infoboxes would only get back what is already in these JSON files, with HTML added.

### The data pages

All in namespace 112 (`list=allpages&apnamespace=112`):

| Page | Size | Last edit | Use for us |
|---|---|---|---|
| `Data:Dragons.json` | 1.1 MB | 2026-10-01 | **Core.** One record per Dragon (983). |
| `Data:BreedingHints.json` | 130 KB | 2026-10-01 | **Core.** Breeding requirements per Dragon (964 entries). |
| `Data:Game.json` | 2.5 KB | 2026-05-29 | Element list grouped by kind (primary, epic, gem, legendary, mythic, rift), rarity order. |
| `Data:Limited.json` | 10 KB | 2026-10-01 | What is available *right now*, with countdown dates, plus event-shop dragons with `"Breedable": false`. Changes week to week. |
| `Data:DragonForms.json` | 3.9 KB | 2026-08-08 | Cosmetic forms (Day/Night, Hiding, seasons). Not breeding-relevant. |
| `Data:BreedingOdds.json` | 178 KB | 2026-10-01 | Odds. Out of scope for v1. |
| `Data:Events.json` | 1 KB | 2024-08-29 | Stale placeholder ("New 1", "New 2"). Ignore. |
| Others | | | Decorations, islands, quests, earning rates, release schedule. Not needed. |

Editors update these the same day a dragon releases. Recent changes show edits on 2026-10-01, and the newest dragon is `"ReleaseDate": "October 1, 2026 #983"`.

`Module:BreedingSandbox` is the wiki's own breeding calculator, written in Lua over the same JSON. It is the best available spec for what each hint field means. The rules quoted below come from it.

### Listing every Dragon

Use the `dragons` array in `Data:Dragons.json`: 983 records, unique `Name`, plus an `Order` field (release order). Don't use categories. `Category:Dragons` has 1,032 pages and 20 subcategories, so it includes multiform and other non-species pages.

Page title is `Name + " Dragon"` for most dragons (`Module:Dragon` `d.pageName`). The exceptions are multiform dragons (Snowflake 1–5 → `Snowflake Dragon` via `Alias`) and dragons with powers (Legendary and Mythic, e.g. `Kairos`), whose page title is the bare name. Link with `https://dragonvale.fandom.com/wiki/<pageName>`.

## Fields

### `Data:Dragons.json` → `dragons[]`

How many of the 983 records have each field:

| Field | Count | Notes |
|---|---|---|
| `Name` | 983 | Unique key. No " Dragon" suffix. |
| `Rarity` | 983 | Primary 10, Hybrid 80, Rare 472, Epic 364, Gemstone 29, Galaxy 23, Legendary 3, Mythic 2. |
| `Elements` | 983 | e.g. `["Fire","Earth"]`. Includes epic elements (Rainbow, Sun, Moon, Treasure, Olympus, …) and `Rift`. |
| `ReleaseDate` | 983 | String such as `"September 14, 2011 #8"` (date + release number). |
| `Order` | 983 | Integer release order. |
| `LevelRequirement` | 983 | Park level needed. |
| `Description` | 983 | In-game blurb (HTML fragments such as `<br />`). |
| `Pedestal` | 983 | Not needed. |
| `BreedingTime` | 978 | String: `"5 S"`, `"10 H"`, `"48 H"`, `"Instant"`. |
| `Traits` | 942 | **Rift form indicator**, see below. |
| `IsLimited` | 673 | `true` or absent. Absent means permanently available. |
| `BuyPrice`/`BuyCurrency` | 950 | Market price (DragonCash, Gems, Etherium). |
| `BreedingElements` | 405 | Elements the Dragon *counts as* when used as a parent, where that differs from `Elements`. For example Rainbow has `Elements: ["Rainbow"]` but `BreedingElements` lists all 10 primaries. |
| `Tags` | 195 | `Common` (90, first-grid hybrids), `Golden` (81, second-grid), `RiftPrimary` (10), `GhostlyCommon`, `GhostlyPrimary`. |
| `Evolutions` / `Devolution` | 26 / 35 | Evolution links. A Dragon with `Devolution` is evolved and **cannot be bred** (sandbox rule `evolved_dragons_cant_be_bred_rule`). |
| `Ghostly`, `Elder`, `Alias`, `Goal`, `Sell*`, `HatchExperience` | various | Not needed for v1 except `Alias` (for page names). |

### `Data:BreedingHints.json` → `breedingHints{Name: hint}`

964 of 983 Dragons have a hint. The 19 without one are the 9 basic primaries (Air has one, see below) and the 10 `X Rift` primaries. Their routes are implicit: a basic dragon comes from parents carrying only its element, and an `X Rift` primary comes from Rift breeding.

| Key | Count | Meaning (from `Module:BreedingSandbox`) |
|---|---|---|
| `RequiredElements` | 585 | The parents' combined element pool must contain all of these. This is the "bred from Element nodes" edge in our model. |
| `RequiredDragons` | 495 | Specific parent Dragons. With 2 names, both parents must match. With 1 name, one parent must be that Dragon. Usually combined with `RequiredElements`, e.g. Love = Flower + any Lightning. |
| `Any` | 21 | Any two parents (e.g. Motley). |
| `MinimumRequiredElements` | 12 | At least N distinct elements across the parents (e.g. Rainbow: 4). |
| `RequiredElementsForBothParents` | 16 | Each parent must carry this element (Snowflake, Monolith, Galaxy). |
| `RequiredTraits` / `RequiredDragonTraits` | 13 / 4 | Rift breeding with a parent carrying a given trait (e.g. Blightwing: a Dark trait; Zaffer: Blue Fire with Air trait + Plasma with Metal trait). |
| `RiftAlignment` | 4 | Rift must be aligned to an element. |
| `RequiredTime` / `RequiredWeather` | 10 / 2 | Day or Night, or weather, at breeding time (Sun, Moon, Tranquil). |
| `RequiredCave` / `RequiredCloneCave` | 3 / 2 | Rift or Cooperative cave (Galaxy dragons). |
| `IsEvolution` + `RequiredDecorations` | 35 | Obtained by evolving with a decoration, not by breeding. |
| `RequiredArtifacts` | 5 | Legendary and Mythic, obtained with relics or artifacts. Not breedable. |
| `Prerequisites` | 1 | e.g. Rigel requires owning a Galaxy Dragon. |
| `BuyPrice`/`BuyPriceType` | 954 | Price of the in-game hint. Ignore. |

### How the Rift form maps onto the data

The wiki has no "Rift form" field. The concept in `CONTEXT.md` corresponds to three different shapes in the data:

1. **Traited Dragons**: `Traits: {"Available": "All"}` (905 Dragons). Breeding in the Rift cave gives the Dragon a trait ([Traits](https://dragonvale.fandom.com/wiki/Traits): "given to certain dragons through rift breeding"). A traited specimen is effectively the Dragon's Rift form. Separate images exist (`LavaDragonAdultFireTrait.png`).
2. **Rift primaries**: `Plant Rift`, `Fire Rift`, … (10, `Tags: ["RiftPrimary"]`, `Elements: ["Plant","Rift"]`, `Traits: {"Default": "Plant"}`). These are separate species records. The normal primaries have no `Traits` field, so for primaries the Rift form is a *different record*.
3. **Rift-only species**: Blightwing, Zaffer, Kampos, Abraxas, … (27 more with `Rift` in `Elements` and `Traits: {"Default": X}`). They have no normal form at all.

`Traits` is absent for 41 Dragons. These have no Rift form: the 10 primaries (whose Rift form is the separate `X Rift` record), the 3 Legendary and 2 Mythic Dragons, and 26 Ghostly Dragons.

## Samples

From `Data:Dragons.json` (with `Description` and `Goal` omitted) and the matching `Data:BreedingHints.json` entry, as fetched on 2026-10-01.

**Basic: Plant.** No hint. Its route (any parents carrying only Plant) is implicit. No `Traits`, so the Rift form is the separate `Plant Rift` record.
```json
{"Name":"Plant","Rarity":"Primary","BreedingTime":"5 S","ReleaseDate":"September 14, 2011 #1","Order":1,
 "BuyPrice":100,"BuyCurrency":"DragonCash","LevelRequirement":1,"Elements":["Plant"],
 "Evolutions":[{"Name":"Ghostly Plant","Cost":100,"CostType":"Gems"}],"Elder":true}
hint: null
```

**Basic with a fixed recipe: Air.** Unlike the other primaries, Air has a hint with specific parents.
```json
{"Name":"Air","Rarity":"Primary","BreedingTime":"2 H","Elements":["Air"],"LevelRequirement":16, ...}
hint: {"RequiredDragons":["Water","Fire"]}
```

**Hybrid: Lava**
```json
{"Name":"Lava","Rarity":"Hybrid","BreedingTime":"10 H","ReleaseDate":"September 14, 2011 #8","Order":8,
 "BuyPrice":25,"BuyCurrency":"Gems","LevelRequirement":4,"Elements":["Fire","Earth"],
 "Traits":{"Available":"All"},"Tags":["Common"]}
hint: {"RequiredElements":["Earth","Fire"]}
```

**Specific parent and limited: Love**
```json
{"Name":"Love","Rarity":"Rare","BreedingTime":"5 H","ReleaseDate":"February 2, 2012 #38","Order":38,
 "LevelRequirement":12,"Elements":["Lightning","Plant","Fire"],"IsLimited":true,
 "Evolutions":[{"Name":"Wrath","Cost":100,"CostType":"Gems"}],"Traits":{"Available":"All"}}
hint: {"RequiredDragons":["Flower"],"RequiredElements":["Lightning"]}
Data:Limited.json: "Love": {"countdown": "October 7, 2026"}
```

**Rift primary: Plant Rift**
```json
{"Name":"Plant Rift","Rarity":"Rare","BreedingTime":"Instant","ReleaseDate":"July 6, 2017 #366",
 "LevelRequirement":28,"Elements":["Plant","Rift"],"Traits":{"Default":"Plant"},"Tags":["RiftPrimary"]}
hint: null
```

**Rift-only, specific parents with traits: Zaffer**
```json
{"Name":"Zaffer","Rarity":"Rare","BreedingTime":"Instant","Elements":["Cold","Lightning","Rift"],
 "Traits":{"Default":"Metal"},"LevelRequirement":28}
hint: {"RequiredDragonTraits":["Air","Metal"],"RequiredDragons":["Blue Fire","Plasma"],"RequiredElements":["Rift"]}
```

**Epic with an element-count rule: Rainbow**
```json
{"Name":"Rainbow","Rarity":"Epic","Elements":["Rainbow"],
 "BreedingElements":["Earth","Lightning","Plant","Air","Water","Cold","Fire","Metal","Light","Dark"],
 "Traits":{"Available":"All"}}
hint: {"MinimumRequiredElements":4}
```

## Gaps and quirks

- **"Limited" has no history.** `IsLimited: true` (673 Dragons) only says that availability comes and goes. The windows themselves aren't recorded. `Data:Limited.json` lists only what is available *now*. This is enough for the planned availability filter (limited or permanent). It is not enough for "when can I next breed X".
- **Event-shop dragons.** Dragons sold for event currency appear in `Data:Limited.json → events → dragons` with `"Breedable": false`, but only while the event runs. Outside an event, the data doesn't say a limited Dragon is unbreedable. Feeds the open map question "Dragons with no breeding route".
- **Basic routes are implicit.** The basic primaries (except Air) and the Rift primaries have no hint. The transformer needs a rule for these.
- **Edge-case conditions don't fit a simple graph:** time of day, weather, cave type, rift alignment, required traits, minimum-element counts, "both parents carry X". About 60 Dragons in total. Normal hybrids (`RequiredElements` only) and specific-parent dragons (`RequiredDragons` + `RequiredElements`) cover the large majority.
- **Not obtainable by breeding:** `IsEvolution` (35), `Devolution` (35, evolved forms), `RequiredArtifacts` (5).
- **The wiki tracks its own missing data.** [`Data:Missing Dragon Info Dashboard`](https://dragonvale.fandom.com/wiki/Data:Missing_Dragon_Info_Dashboard) lists the gaps. On 2026-10-01 these were mostly missing `BuyPrice` and pedestal prices (≈57 Dragons), with almost everything missing for the newest Dragon (Dotty). Missing breeding-hint entries: 0 (the 5 listed are only missing hint *prices*).
- **Free-form strings** for `ReleaseDate` and `BreedingTime` need parsing.
- **Structure can change without notice.** It's a wiki: field names are a convention, not an API contract. The transformer should fail loudly on unknown hint keys.

## Existing community dataset

[drouu/dragonvale-sandbox](https://github.com/drouu/dragonvale-sandbox) (Unlicense, last commit 2026-09-25 "updated dragons.js 2026-Sep-25") powers the [dvbox.bin.sh](https://dvbox.bin.sh/) calculator. Its `dragons.json` (253 KB, 977 entries) has `name, type, elements, reqs, rifty, available, clonable, latent, breed_note, sell, time`. For example Zaffer: `reqs: [["Blue Fire","Plasma"]]`, `breed_note: "Blue Fire with Air trait + Plasma with Metal trait"`, `rifty: true`.

The format is compact and close to what we need, and it includes a ready-made `rifty` flag. But it has 6 fewer dragons than the wiki on the same week, and the edge cases are free text (`breed_note`). Its `available` field is time-stamped by hand (it shows Love as `"no"` even though Love is in the market this week). It's maintained by one person, and its provenance relative to the wiki's data is unclear. Good as a **cross-check** for the transformer. Don't use it as the primary source.

## Licence and attribution

- **Text and data: CC BY-SA 3.0.** The wiki footer and `siteinfo.rightsinfo` both say CC-BY-SA. Per [Help:Licensing](https://community.fandom.com/wiki/Help:Licensing) and [DragonVale Wiki:Copyrights](https://dragonvale.fandom.com/wiki/DragonVale_Wiki:Copyrights), anyone reusing it must:
  1. identify the licence and link to it (https://creativecommons.org/licenses/by-sa/3.0/);
  2. attribute it. "A link to or URL of the original article" is enough. For a data snapshot, a link to the wiki and to the `Data:*.json` pages used, ideally with revision IDs, is a reasonable form of this;
  3. share alike. The **snapshot JSON derived from the wiki must itself be CC BY-SA**. This does not force a licence on the app's code, which is a separate work that reads the data. Do keep the data file clearly separate and labelled.
- The app should show a footer such as "Dragon data from the [DragonVale Wiki](https://dragonvale.fandom.com) (Fandom), CC BY-SA 3.0", and the snapshot should carry `source`, `license` and `revisions` metadata. Even for a personal tool, this costs nothing and keeps public hosting open.
- **Bulk-access etiquette:** Fandom publishes no read rate limit that we could find. Help:Bots asks bots to stay under 1 edit/second. One batched request per manual scrape, with a descriptive `User-Agent`, is well within that.

## Images

[Help:Licensing](https://community.fandom.com/wiki/Help:Licensing): "uploading images or video files does not necessarily mean they are released under the CC-BY-SA. While text contributions automatically fall under the CC-BY-SA, image and video files do not." Dragon images are game art owned by the game's publisher. They are uploaded under fair use, and file pages such as `File:LavaDragonAdult.png` carry no licence text.

- For a **personal, local** tool, hotlinking or caching them is low-risk.
- For **public hosting**, we can't assume a licence. Options: hotlink from `static.wikia.nocookie.net` (keeps the files off our servers, but depends on Fandom's CDN), go text-only, or ask the publisher.
- Naming is predictable (`Module:Dragon` `d.imageWithName`): `<Name without spaces>Dragon<Stage>.png` with stage Egg, Baby, Juvenile or Adult (e.g. `LavaDragonAdult.png`, `PlantRiftDragonAdult.png`), plus a `<Element>Trait` suffix for traited forms (`LavaDragonAdultFireTrait.png`). Resolve URLs in batches of 50 with `prop=imageinfo&iiprop=url`. Don't guess CDN paths: they contain a hash directory and a cache-buster.

## Sources

- API: `https://dragonvale.fandom.com/api.php`: `meta=siteinfo`; `prop=revisions` on `Plant Dragon`, `Template:Infobox/Dragon`, `Module:Dragonbox`, `Module:Dragon`, `Module:BreedingSandbox`, `Traits`, `Data:*.json`; `list=allpages` (ns 828, 112); `list=recentchanges` (ns 112); `prop=categoryinfo`; `prop=imageinfo`; `action=parse` on `Data:Missing Dragon Info Dashboard`.
- https://community.fandom.com/wiki/Help:Licensing (rev 2025-07-02) and https://community.fandom.com/wiki/Help:Bots (rev 2026-09-09), via API.
- https://dragonvale.fandom.com/wiki/DragonVale_Wiki:Copyrights
- https://github.com/drouu/dragonvale-sandbox (via `gh api`).
