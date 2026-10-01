# How DragonVale breeding rules actually work

Research for [#2](https://github.com/CyberYeti/DragonVale-Breeding-Helper/issues/2), part of map [#1](https://github.com/CyberYeti/DragonVale-Breeding-Helper/issues/1). Fetched 2026-10-01.

## Sources and how far to trust them

There is no official rules document. The game shows each dragon's requirements as an in-game "breeding hint". The DragonVale Fandom wiki copies those hints into structured JSON data pages, and its Breeding Sandbox calculator runs on that data.

| Source | What it is | Used for |
|---|---|---|
| [Data:BreedingHints.json](https://dragonvale.fandom.com/wiki/Data:BreedingHints.json) | One hint object per dragon (964 hints) | Every requirement kind and its count |
| [Data:Dragons.json](https://dragonvale.fandom.com/wiki/Data:Dragons.json) | 983 dragons: elements, latent `BreedingElements`, rarity, `IsLimited`, `Traits`, `LevelRequirement`, `Devolution` | Element membership, rift forms, limited flags |
| [Data:Limited.json](https://dragonvale.fandom.com/wiki/Data:Limited.json) | Limited dragons available now, plus event shop lists with `Breedable: false` | Availability windows |
| [Data:Game.json](https://dragonvale.fandom.com/wiki/Data:Game.json) | Element lists (10 primary, 18 epic, 2 gem, 3 legendary, 1 mythic, 1 rift), weather list | Element vocabulary |
| [Module:BreedingSandbox](https://dragonvale.fandom.com/wiki/Module:BreedingSandbox) | The wiki calculator's Lua rule engine | How each hint field is applied |
| [Breeding](https://dragonvale.fandom.com/wiki/Breeding), [Breeding Rules](https://dragonvale.fandom.com/wiki/Breeding_Rules) | Prose rules pages | Named rules, quoted below |
| [Rift Breeding](https://dragonvale.fandom.com/wiki/Rift_Breeding), [Traits](https://dragonvale.fandom.com/wiki/Traits), [Rift Dimension](https://dragonvale.fandom.com/wiki/Rift_Dimension), [Rift Element Dragons](https://dragonvale.fandom.com/wiki/Rift_Element_Dragons) | Rift prose pages | Rift rules |
| [Epic Dragons Latent Elements](https://dragonvale.fandom.com/wiki/Epic_Dragons_Latent_Elements), [Elements](https://dragonvale.fandom.com/wiki/Elements), [Limited](https://dragonvale.fandom.com/wiki/Limited) | Prose pages | Hidden elements, opposites, limited |

All counts below come from the JSON data pages as fetched. They change whenever a new dragon is released.

Fandom's normal HTML pages return HTTP 402 or a Cloudflare challenge to scripts. `https://dragonvale.fandom.com/api.php?action=parse&page=<Title>&prop=wikitext&format=json` and `action=query&prop=revisions&rvprop=content&rvslots=main&titles=Data:Dragons.json` both work without a browser. This matters for the data-source ticket.

## The core mechanism: the breeding pool

From [Breeding Rules](https://dragonvale.fandom.com/wiki/Breeding_Rules):

> breeding works by combining the elements of two dragons ... which forms the "breeding pool" of elements. Each dragon has base elements seen in the game as well as latent breeding elements which are not displayed in game.

> **Breeding Pool Rule.** Normally, dragons can only be a result of a breeding pair if their elements are contained within the breeding pool. For example, breeding Plant + Fire cannot result in any dragons which do not have the plant and fire elements (except if bypassed by a breeding hint).

The sandbox builds the pool as `union(parentA.BreedingElements or Elements, parentB.BreedingElements or Elements)`, and adds `Rift` if either parent is a Rift-element dragon (`create_parents` in Module:BreedingSandbox).

What this means for the questions in the ticket:

- **Does owning any dragon with an Element let you use it?** Yes, any dragon whose *breeding* elements include it. But the pool always comes from exactly **two** parents. A requirement of {Air, Fire, Plant} (Seasonal) needs two dragons that cover all three between them. Owning one Air, one Fire and one Plant dragon is not enough unless two of them cover the set.
- **Displayed elements and breeding elements differ.** 405 of 983 dragons have a `BreedingElements` list. Sun Dragon shows the Sun element but adds Cold + Lightning to the pool. Rainbow, Leap Year, Dream and about 25 others add all ten primary elements. Gold/Silver/Bronze Olympus need Earth + Lightning + Air to be bred but only add Earth + Lightning ([Epic Dragons Latent Elements](https://dragonvale.fandom.com/wiki/Epic_Dragons_Latent_Elements)). When epic parents are used, the sandbox also adds their displayed epic elements to the pool, which is how requirements like "Sun" or "Galaxy" are met.
- **Opposites exist.** Plant/Metal, Fire/Cold, Earth/Air, Lightning/Water and Light/Dark. Primaries of opposite elements cannot breed together ([Breeding § Opposite Dragons](https://dragonvale.fandom.com/wiki/Breeding#Opposite_Dragons)). See requirement 2.
- **Order of parents never matters** ([Breeding](https://dragonvale.fandom.com/wiki/Breeding)).
- **Parent Rule.** "either parent in a breeding pair can be a breeding result" ([Breeding Rules](https://dragonvale.fandom.com/wiki/Breeding_Rules)). Cloning (two of the same dragon) in a normal cave can give that dragon. Gemstone and Crystalline dragons are the exception.

## Every kind of breeding requirement

The shape of each hint in Data:BreedingHints.json, ignoring the hint's unlock price:

| Hint shape | Count |
|---|---|
| `RequiredElements` only | 378 |
| `RequiredDragons` only | 301 |
| `RequiredDragons` + `RequiredElements` | 161 |
| `IsEvolution` + `RequiredDecorations` | 35 |
| `Any` + `RequiredDragons` (Galaxy) | 19 |
| `RequiredElements` + `RequiredElementsForBothParents` | 15 |
| `RequiredElements` + `RequiredTraits` | 13 |
| `MinimumRequiredElements` (± elements) | 12 |
| `RequiredArtifacts` | 5 |
| ... + `RequiredTime` | 10 |
| `RequiredElements` + `RiftAlignment` | 4 |
| `RequiredDragonTraits` + `RequiredDragons` + `RequiredElements` | 4 |
| `Any` only | 2 |
| ... + `RequiredWeather` | 2 |
| ... + `RequiredCave` / `RequiredCloneCave` / `Prerequisites` | 3 |
| No hint (primaries and rift primaries, which are bought or given) | 19 |

"Representable?" in each section below means: can the requirement be drawn as edges from **Element** nodes and **Dragon** nodes into the result **Dragon**, read as "breed from these"?

### 1. Element set in the pool

`RequiredElements`: 585 hints, 378 with nothing else. The pool must contain every listed element. 110 hints list 1 element, 281 list 2, 138 list 3, 55 list 4, and one lists 5 (Quintessence: Metal, Plant, Fire, Earth, Water).

- Poison, Flower: Plant + Fire. Tree, Moss: Plant + Earth.
- Seasonal: Air + Fire + Plant. Sun: Cold + Lightning (daytime). Gold: Fire + Metal. Apocalypse: Cold + Lightning + Metal + Plant.
- Epic elements can be required: Tranquil needs Sun, Solis needs Galaxy, Snowflake N needs Snowflake.

**Representable: yes, with caveats.** One Element node per required element works. Three things are needed to get it right:
1. Dragon-to-Element membership has to use breeding (latent) elements, not displayed ones.
2. The edges mean AND over a pool that two parents fill. "You own something in each Element" does not prove a valid pair exists. The Focus view's cut-off logic needs a pair check, not a per-element check.
3. For non-epic results the result's own elements must also be in the pool unless the hint overrides it (`contains_elements_rule`). So in practice the hint's elements are the full requirement.

### 2. Opposite dragons

There are 25 of these: Blue Fire, Frostfire, Fever, Flickerflame, Sandstorm, Dodo, Whirlwind, Khamsin, Plasma, Current, Surge, Malachite, Ironwood, Thorn, Razortail, Iron Blossom, Dartwing, Spore, Mirage, Shadow, Silverline, Ghast, Antumbra, Lacuna and Nox. The hint lists both opposite elements (Ironwood: Plant + Metal; Blue Fire: Fire + Cold). The real rule is stricter ([Breeding Rules § Opposites Rule](https://dragonvale.fandom.com/wiki/Breeding_Rules)):

> Opposites require the Primary dragon of their primary element and a hybrid containing their secondary element and at least one other (non-primary) element (e.g. Plant + Chrome can make Ironwood ...)

Plant Dragon + Metal Dragon is not allowed, since opposite primaries cannot breed.

**Representable: partly.** Plant + Metal Element nodes are correct as a summary, but a naive search would suggest Plant Dragon + Metal Dragon, which the game rejects. The model needs an "opposite" flag on these dragons, or the pairing check has to know the opposite pairs.

### 3. One named parent plus elements

`RequiredDragons` with 1 dragon and `RequiredElements`: about 160 hints.

- Clover: Moss + Plant. Love: Flower + Lightning. Bearded: Mountain + Metal.
- Nature: Reminiscence + Cold + Air. Celtic: Storm + Plant. Tranquil: Serenity + Sun (+ Blossoms weather).

**Representable: yes.** One Dragon node plus Element nodes. The other parent only has to supply the remaining elements.

### 4. Exact parent pair

`RequiredDragons` with 2 dragons: 314 hints, 301 with nothing else. Only that one combination works ("If both parents are required, then only that one breeding combination will work", Breeding Rules).

- Mesmer: Scorn + Masque. Ikatako: Tidal + Ooze. Nightmare: Howl + Abyss. Gourd: Pepper + Root.
- Gemstones: Emerald = Crystal + Lichen, Diamond = Ice + Mine.
- Chrysalis family is closed: Chrysalis = Swallowtail + Duskwing, Swallowtail = Chrysalis + Marbletail.
- Primary: Air = Water + Fire (Air can also be bought).
- Dawn and Dusk both use Moon + Sun. Only the time of day decides which one you get.

**Representable: yes.** Two Dragon nodes. The edge does need to mean "this exact pair" and not "either of these". Dawn and Dusk show that two targets can share one pair and differ only by a condition.

### 5. Minimum number of distinct elements

`MinimumRequiredElements`: 12 hints, all ≥ 4. Rainbow, Double/Triple Rainbow, Leap Year (and Double/Triple/Quadruple), Aurora, Surprise, Party and Enfis. Dream also needs Light + Dark.

**Representable: no, not with fixed Element nodes.** Any four elements will do. This needs a rule node such as "≥4 elements" or a field on the dragon.

### 6. Both parents must carry an element

`RequiredElementsForBothParents`: 16 hints. Snowflake 1–7 (both parents Snowflake), Monolith 1–7 (both Monolith), Dazzling (both Ornamental), and Rigel (both Galaxy, in the Rift).

**Representable: partly.** An Element node can be drawn, but the edge has to say "×2: both parents". A pool test alone would accept one Snowflake parent.

### 7. Time of day

`RequiredTime`: 10 hints.
- Day: Sun, Dawn, Midday, Lightmatter.
- Night: Moon, Dusk, Nosferatu, Midnight, Misfortune, Darkmatter.

The park clock follows the device clock unless a Twilight Tower overrides it.

**Representable: not as a node.** It is a condition on the edge (a badge).

### 8. Weather

`RequiredWeather`: 2 hints. Tranquil needs Blossoms and Moriante needs Fireflies. Without a Weather Station the weather is "None", so these cannot be bred at all (Breeding Rules § Weather Rule). Aubergine needs rain to *evolve*, not to be bred.

**Representable: not as a node.** It is an edge condition.

### 9. Breeding cave

- **Cooperative cave:** most Galaxy dragons (23 total) are bred there, with one parent being a *friend's* dragon. 19 have the hint `Any: true` + `RequiredDragons: [itself]`, e.g. Nebula, meaning any epic or galaxy dragon paired with a friend's Nebula. Solis and Lunis can be bred in any cave but cloned only in Cooperative. Rigel is Rift-only and also needs a Galaxy dragon already owned (`Prerequisites`).
- **Rift cave:** every Rift-element dragon (`dragons_require_cave_rule`).
- **Epic Breeding Island** is never required. It only improves odds ([Breeding § Notes](https://dragonvale.fandom.com/wiki/Breeding)).

**Representable: Galaxy only partly.** The required parent is a friend's dragon, not one in the player's **Collection**, so the Focus view cannot cut off at "owned". The cave itself is an edge or dragon attribute.

### 10. Rift element, traits and alignment

These apply only in **Rift breeding**:
- `RequiredElements` contains `Rift`: 25 hints, e.g. Plumewing, Kampos, Antumbra. The pool gets `Rift` when a parent is a Rift-element dragon.
- `RequiredTraits`: 13 hints. At least one parent must have a given trait. Kampos needs a Water trait. Plumewing needs Air. Blightwing needs Dark.
- `RequiredDragonTraits`: 4 hints. The named parent must have a specific trait. Zaffer = Blue Fire with Air trait + Plasma with Metal trait. Viridian = Dodo (Fire) + Malachite (Light). Lacuna = Mirage (Water) + Shadow (Air). Pearlescent = Prism (Light) + Starwing (Dark).
- `RiftAlignment`: 4 hints. The park's rift alignment must be set: Antumbra needs Earth, Frostfluff Cold, Sandscale Light, Abraxas Lightning.

**Representable:** `Rift` works as an Element node. Traits do not. The **Collection** stores one rift flag per Dragon, not which trait that specimen has. Kampos, Zaffer and the others cannot be checked against the Collection as designed. Alignment is an edge condition.

### 11. Evolution (not bred)

`IsEvolution` + `RequiredDecorations`: 35 dragons. Each has a `Devolution` base dragon in Data:Dragons.json.

- Ghostly Fire evolves from Fire with "Effigy of the Flame".
- Corrupticorn evolves from Chromacorn with "Flame of Corruption Set".
- Wrath evolves from Love. Porcelain evolves from Bone. Vidalia and Karroot evolve from Seed.

"Evolved dragons cannot be bred, only evolved from a base dragon." Breeding more of an evolved dragon "requires a matched pair as parents" (Breeding Rules).

**Representable: as a single Dragon to Dragon edge if edges have a type** ("evolves from"). The decoration requirement does not fit Element or Dragon nodes.

### 12. Summoned with artifacts (not bred)

`RequiredArtifacts`: 5 dragons. Legendary: Kairos, Gaia, Ts'aishen. Mythic: Bahamut, Tiamat. They cannot breed or be bred.

**Representable: no.** They have no parents. Show them as unobtainable by breeding.

### 13. Any pair

`Any: true` with nothing else: Motley and Dargon. Any pair can give them while they are available.

**Representable:** an edge from every dragon would be noise. Better to give them an "any pair" label.

### 14. Availability windows (limited and event)

- `IsLimited: true` on **673 of 983** dragons. Only those listed in Data:Limited.json can be bred today. On the fetch date that was 9 dragons, plus event lists.
- Availability Rule: "Expired dragons cannot be bred (except if following the Parent Rule)". You can only re-breed an expired dragon if you already own one, or during a "Bring 'Em Back" event.
- Some event dragons are shop-only. In the current Om of Noms event, Haystack and Sungazer are `Breedable: false` and cost 12,250 Spice.
- 308 hints name a limited dragon as a required parent. Their availability is a chain: a Target can be blocked by an expired parent.

**Representable:** this is a property of the Dragon (`IsLimited` + current window), not a node. It changes over time, so it should come from data and not be hard-coded.

### 15. Dragons that cannot be parents

- Gemstone and Crystalline (29 with Gemstone rarity) "cannot breed with any other dragons ... except during special events such as the Shimmering Solstice". They can still be *bred* from exact pairs (requirement 4).
- Legendary and Mythic can neither breed nor be bred.
- Breeding needs both parents at dragon level 4 or higher ([Breeding § How to Breed](https://dragonvale.fandom.com/wiki/Breeding)). The Collection has no levels, so this is out of scope.

**Representable:** a "cannot be a parent" flag on the Dragon, so it never appears as a parent in the Focus view.

### 16. Park level

`LevelRequirement` on every dragon (park level 1 to 31+). Primaries unlock for DragonCash at fixed levels: Plant 1, Fire 1, Earth 4, Cold 9, Lightning 12, Water 14, Air 16, Metal 18, Light 21, Dark 25. The Rift Dimension needs park level 28.

**Representable:** an attribute. It is probably not needed, since the Collection does not track the player's level.

### Not requirements, but they affect results

Base odds, parent level, owning the result already (Enfis: 4% unowned, 1% owned), cave upgrades and Epic Breeding Island all change the *chance* of a result, not whether it is possible ([Breeding](https://dragonvale.fandom.com/wiki/Breeding)).

## Rift breeding and Rift form

The wiki never says "Rift form". It says **traits**. A dragon bred in the Rift Breeding Cave can get one of ten traits, one per primary element. The trait it gets depends on the rift alignment ([Traits](https://dragonvale.fandom.com/wiki/Traits)).

- **Which dragons have a Rift form:** "all dragons except the primary dragons, the legendary dragons, and the mythic dragons now have traits. Since then, every new dragon released into the game (except for the ghostly dragons) has been simultaneously given traits" (Traits, Notes). In the data, 942 of 983 have `Traits`. The 41 without are the 10 primaries, 5 legendary/mythic and 26 Ghostly dragons.
- **Primaries have no Rift form.** The rift equivalents are separate species: Plant Rift, Fire Rift, ... Metal Rift (10 dragons, tag `RiftPrimary`). They have no breeding hint. They are bought with etherium or came from events, e.g. [Light Rift Dragon](https://dragonvale.fandom.com/wiki/Light_Rift_Dragon).
- **Rift-only species:** 37 dragons have the `Rift` element, e.g. Plumewing, Kampos, Antumbra, Chromacorn, Rigel. They have no normal form and can only be bred in the Rift cave.
- **Both parents in Rift form: confirmed in practice.** "Only dragons classified as Rift Element Dragons or ones which have a trait can travel between the Rift Dimension and the park" ([Rift Dimension](https://dragonvale.fandom.com/wiki/Rift_Dimension)). Rift breeding happens there, so both parents are always rift-form or rift-only dragons. Rift breeding otherwise "follows the same rules as regular breeding with a few exceptions" (Breeding Rules). The exceptions: instant breeding, an etherium cost, `Rift` in the pool, and requirements on traits and alignment.
- **Normal breeding with rift-form parents: probably not allowed.** [Rift Breeding](https://dragonvale.fandom.com/wiki/Rift_Breeding) says "Regular breeding caves cannot be used to breed rift dragons or any dragon with traits." The most natural reading is that a rift-form specimen cannot be a parent in a normal cave. That contradicts CONTEXT.md's "Normal breeding: parents may be in either form". The sentence could also mean "produce", so this needs checking in-game.

## Unbreedable dragons: summary

| Kind | How the wiki marks it | Count / examples |
|---|---|---|
| Primaries | No hint; bought with DragonCash | 10 (Air also has a Water + Fire hint) |
| Rift primaries | No hint, tag `RiftPrimary` | 10 (Fire Rift, ...) |
| Legendary / Mythic | `RequiredArtifacts` | 5 (Kairos, Gaia, Ts'aishen, Bahamut, Tiamat) |
| Evolved | `IsEvolution`, `Devolution`, `RequiredDecorations` | 35 (Ghostly Fire, Corrupticorn, Wrath) |
| Event-shop only | `Breedable: false` in Data:Limited.json events | per event (Haystack, Sungazer) |
| Expired limited | `IsLimited: true` and not in Data:Limited.json | most of the 673 limited; breedable only via Parent Rule or Bring 'Em Back |

## Verdict: can Element nodes + Dragon nodes represent it?

| Requirement | Element + Dragon nodes alone | Needs in addition |
|---|---|---|
| 1. Element set | Yes | Latent-element membership; a two-parent pair check |
| 2. Opposites | Misleading | Opposite flag or pairing rule |
| 3. Named parent + elements | Yes | none |
| 4. Exact pair | Yes | "Exact pair" edge meaning |
| 5. Minimum element count | No | Rule node or field |
| 6. Both parents carry element | Partly | "×2" edge flag |
| 7. Time of day | No | Edge condition |
| 8. Weather | No | Edge condition |
| 9. Cave (Galaxy cooperative) | Partly | Friend-owned parent; cave attribute |
| 10. Rift element / traits / alignment | Rift: yes; traits: no | Per-specimen trait data; alignment condition |
| 11. Evolution | With typed edge | Edge type; decorations |
| 12. Artifacts | No | "Not breedable" marker |
| 13. Any pair | Technically | "Any pair" label |
| 14. Limited / event windows | No | Availability attribute from data |
| 15. Cannot be a parent | No | "Cannot be a parent" flag |
| 16. Park level | No | Attribute (likely out of scope) |

Overall: Element and Dragon nodes cover the large majority of hints. Shapes 1, 3 and 4 account for 840 of 964 hints. The rest needs **conditions on edges** (time, weather, cave, alignment, "both parents", "exact pair", "evolves from") and **flags on Dragons** (limited/available, cannot be a parent, opposite, not breedable). Trait-level requirements (17 rift hints) cannot be expressed with the Collection as currently defined.
