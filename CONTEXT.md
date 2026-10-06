# DragonVale Breeding Helper

A personal tool for exploring DragonVale breeding: which dragons come from which, and what the player still needs to reach a dragon they want.

## Language

**Dragon**:
A species of dragon in DragonVale (e.g. Fire Dragon), not an individual specimen.
_Avoid_: specimen, instance

**Element**:
One of the game's breeding elements (Plant, Fire, Earth, …). Shown in the graph as its own node, so a hybrid reads as "bred from Plant + Fire" without listing every parent pair. A **Dragon**'s Elements are its breeding elements, which can differ from the elements it displays (Sun displays Sun but breeds as Cold + Lightning).

**Rift form**:
The rift variant of a **Dragon** that also has a normal form. Every Dragon with traits has one; primaries, legendary, mythic and Ghostly Dragons do not. Ownership of the normal form and the rift form is tracked separately.

**Trait**:
One of ten markers (one per primary element) that a **Rift form** or **Rift dragon** specimen carries. A **Rift form** gets its trait from the park's rift alignment when it is bred; a **Rift dragon** always has the same one. The **Collection** does not record traits.

**Rift dragon**:
A **Dragon** whose Elements include Rift, such as Kampos or Fire Rift. It can only be bred in the Rift Dimension, has no normal form and always has the same **Trait**. Fire Rift is a separate Dragon, not the **Rift form** of Fire.
_Avoid_: Rift form (for these)

**Rift breeding**:
Breeding that produces **Rift form** dragons and **Rift dragons**. Both parents must be in **Rift form** or be **Rift dragons**. Some routes also require a parent with a given **Trait**, or a given rift alignment for the park.

**Normal breeding**:
Breeding that produces normal-form dragons. Parents may be in either form, and **Rift dragons** can be parents too; a Rift-form dragon or Rift dragon just has to be moved out of the Rift Dimension first.

**Route**:
One way to obtain a **Dragon**, with a kind (Bred, Evolved, Summoned, Purchased, Co-op bred) and what it requires. A Dragon has one or more Routes; Air has a Bred route (Water + Fire) and a Purchased one.
_Avoid_: hint, recipe

**Source**:
How a **Dragon** is obtained: the kinds of its **Routes**. Bred, Evolved (from a base Dragon with a decoration), Summoned (with artifacts), Purchased, or Co-op bred (with a friend's dragon in the Cooperative cave). A Dragon may have more than one.

**Purchase only**:
The state of a breeding route that exists but is disabled, usually while a newly debuted Dragon can only be bought.

**Limited rotation**:
The game's own list of limited **Dragons** that can be bred right now outside any **Event**, each with an end date.
_Avoid_: current event (events are a broader thing)

**Event**:
A time-limited game event with its own shop of **Dragons**, bought with the event's currency. Its Dragons can also be bred while it runs, except the newly debuted ones, which are **Purchase only**.
_Avoid_: Limited rotation (for these)

**Available**:
A limited **Dragon** that can be obtained right now: it is in the **Limited rotation** or in a running **Event**'s shop. An Event Dragon stops being Available when the Event ends, or earlier if it has its own end date. A Dragon that is not limited is always Available.
_Avoid_: in rotation (for event Dragons)

**Dragonarium page**:
One of the game's curated groups of **Dragons** (Fire, Spooky, Rift, …), tagged Elemental, Epic or Special. A Dragon sits on one or more pages, and a page is not every Dragon displaying that Element.
_Avoid_: collection, category

**Owned forms**:
A display setting for which owned forms count: Either (the default), Normal, or Rift. It decides which **Dragons** are shown (Normal hides **Rift dragons**; Rift shows only Dragons with a **Rift form** and Rift dragons) and which count as owned. In the Rift **Breeding cave**, Either counts the Rift form.
_Avoid_: Form mode

**Breeding cave**:
The cave the player is breeding in, which decides what the app treats as breedable and which form a **Dragon** opens as. Normal uses **Normal breeding** and cannot make **Rift dragons** or Galaxy Dragons (except Solis, Lunis and Rigel). Rift uses **Rift breeding** and makes **Rift forms** and Rift dragons. Co-op makes everything Normal can, plus Galaxy Dragons through their Co-op bred **Route**, with a friend lending the Dragon it needs.

**Collection**:
The set of **Dragons** the player owns, recorded per species with a flag for normal form and one for **Rift form** (a single "owned" flag for Dragons with only one form, including **Rift dragons**). No counts, levels or **Traits**.
_Avoid_: inventory, park; the wiki's "Collection" means a **Dragonarium page**

**Target**:
The **Dragon**, in a given form (normal or **Rift form**), that the player has selected because they want to obtain it. A **Rift dragon** is always targeted as itself.

**Valid pair**:
Two parents that together satisfy a Bred **Route**: their combined breeding elements hold everything required, and any named parents, element counts or both-parent elements are met. Opposite primaries (Plant Dragon + Metal Dragon) and **Dragons** that cannot be parents never form one. Two of the same Dragon can. A basic primary other than Air has Valid pairs only with itself as a parent, next to itself or an opposite hybrid (Fire Dragon + Blue Fire Dragon), so it is never bred before one is owned.

**Breedable now**:
A **Dragon**, in the form the chosen **Breeding cave** makes, not yet in the **Collection** in that form, that the cave can make from the Collection: a Bred **Route** met by a **Valid pair** (or, in the Co-op cave only, a Co-op bred Route, since a friend lends the other parent). It must not be **Purchase only**, must be **Available** if it is limited, and must need no limited parent that is not **Available**. Evolved Routes never count.

**Focus view**:
A **Target** and whatever is needed to reach it, drawn as a tree with the Target on top and cut off at **Dragons** already in the **Collection**.
