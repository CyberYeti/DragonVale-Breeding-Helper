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
A **Dragon** whose Elements include Rift, such as Kampos or Fire Rift. It exists only in the Rift Dimension, has no normal form and always has the same **Trait**. Fire Rift is a separate Dragon, not the **Rift form** of Fire.
_Avoid_: Rift form (for these)

**Rift breeding**:
Breeding that produces **Rift form** dragons and **Rift dragons**. Both parents must be in **Rift form** or be **Rift dragons**. Some routes also require a parent with a given **Trait**, or a given rift alignment for the park.

**Normal breeding**:
Breeding that produces normal-form dragons. Parents may be in either form; a **Rift form** dragon just has to be moved out of the Rift Dimension first.

**Route**:
One way to obtain a **Dragon**, with a kind (Bred, Evolved, Summoned, Purchased, Co-op bred) and what it requires. A Dragon has one or more Routes; Air has a Bred route (Water + Fire) and a Purchased one.
_Avoid_: hint, recipe

**Source**:
How a **Dragon** is obtained: the kinds of its **Routes**. Bred, Evolved (from a base Dragon with a decoration), Summoned (with artifacts), Purchased, or Co-op bred (with a friend's dragon in the Cooperative cave). A Dragon may have more than one.

**Purchase only**:
The state of a breeding route that exists but is disabled, usually while a newly debuted Dragon can only be bought.

**Limited rotation**:
The limited **Dragons** that can currently be bred, each with an end date.
_Avoid_: current event (events are a broader thing)

**Collection**:
The set of **Dragons** the player owns, recorded per species with a flag for normal form and one for **Rift form** (a single "owned" flag for Dragons with only one form, including **Rift dragons**). No counts, levels or **Traits**.
_Avoid_: inventory, park

**Target**:
The **Dragon** the player has selected because they want to obtain it.

**Focus view**:
The graph narrowed to a **Target** and whatever is needed to reach it, cut off at **Dragons** already in the **Collection**.
