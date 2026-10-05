# Licence: CC BY-SA 3.0

Everything in this folder (`public/data/`) is data from the [DragonVale Wiki](https://dragonvale.fandom.com) on Fandom, licensed under [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/). That covers:

- `raw/`: the wiki's `Data:` pages exactly as fetched (`Data:Dragons.json`, `Data:BreedingHints.json`, `Data:Game.json`, `Data:Dragonarium.json`, `Data:Limited.json`). `raw/pages.json` records the fetch time and each page's revision ID; view one at `https://dragonvale.fandom.com/wiki/<title>?oldid=<revision>`.
- `snapshot.json`, once built: a derived work of those pages, shared under the same licence.

The licence covers the data only. The app's code, outside this folder, is a separate work and is not covered by it. Dragon art belongs to Deca Games and is not covered either.

`fixtures/real-records.json` at the repo root is cut from `raw/` and is under the same licence.
