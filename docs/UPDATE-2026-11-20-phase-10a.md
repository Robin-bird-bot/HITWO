# Update: November 20, 2026 (Phase 10a: every trait, with test hikers)

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `02-traits-and-conditions.md` → `docs/design/02-traits-and-conditions.md`. It **replaces** the old copy and is the source of truth for traits.
- `07-characters.md` → `docs/design/07-characters.md` (new). It holds the classes, the Plush family, every character and the new traits that came from them. Add it to the "Where things are" table in `CLAUDE.md`.
- `TraitBadges.dc.html` → `docs/mockups/TraitBadges.dc.html`.
- Then delete the leftover `update-2026-11-20-phase-10a/` folder.

**Phase 10 is now split in two.** Update `BUILD_PLAN.md` to match:
- **Phase 10a (now):** the trait system: every trait, slots, XP, level-ups, families (including the new Plush family), Duos, the trait badges, and the new trait warnings. It's tested with placeholder hikers that have no art.
- **Phase 10b (later, with Wyatt):**
  - the real roster from `07-characters.md`: characters, variants and starting bags;
  - trait art and character art;
  - the **hiker selection screen** and the **level-up screen**, designed together.

  **Don't build the real characters yet.** Every character will start unlocked; locking comes in a later phase.

Numbers in [brackets] are first guesses. Put them in `balance.ts` with `TODO(wyatt)`.

---

## 1. Ask Wyatt before you start
Both questions are short; build everything else in the meantime.
1. **When the level-up screen appears:**
   - right away, as soon as XP crosses the line;
   - or at the next camp step, so play isn't interrupted mid-phase.

   Suggest the camp step, and ask.
2. **XP numbers:** the XP for each source and the XP needed per level. Use what the design doc says. Where it gives no number, use a first guess in `balance.ts` and list them for him.

Every trait tier is now confirmed. The doc no longer has "proposed" tiers.

## 2. Traits
- **Every trait in `02-traits-and-conditions.md`:**
  - **All the tables:** Trail, Utility, Morale, family, special and unique traits.
  - **Every trait in `07-characters.md` marked New:** Wanderer, Forgetful, Snores, Alpha Dog, Lanky, Good Boy, Spoiled, Fluff Armor, Mentor, Storyteller, Hype Dog, Shifty, Night Shifty, Lucky Charm, Cuddle Buddy, Rule Changer, Strong Walker, Just Around the Next Corner, Tank Butt, Linguist, Coach, Comedian, Easy Mode, Garbage Gut, the Boss & Gracie Tag Team, and the new Morale traits.
  - **Family names:** Leash Puller is the Dog name for Puller, and Human Food is the Dog name for Glutton (like Copydog for Copier).
  - Characters come in 10b, but their traits must work now so they can be tested.
- **Changed since your last copy:**
  - the Morale trait Empath is now **Caring**;
  - the old Utility trait Tank Butt is now **Closer** (Sherman's new Tank Butt is a different, unique trait);
  - Niche Hunter is now **Nosework**;
  - Team Player is now **Soccer Mom**;
  - Backtracker is now a regular Tier I Trail trait, and Teacher is a new Tier I Utility trait.
  - **Trespasser** is now **usable**: once per biome, the hiker turns it on, and no challenges trigger for them that day. If they're moved with the group, they aren't part of the challenge.
  - **Alchemist:** as a free action, turn 2 of the same resource into 1 resource of the same node.
  - **Thrifty:** 1 random item at each shop is free.
- **Trait data** (in `src/content/traits.ts`):
  - id, name, type (Trail, Utility or Morale), tier, kind (normal, family, special or unique, plus who owns it), classes, `active`, `uses`, and the effect;
  - `active`: needs the player to choose to use it;
  - `uses`: how many, and how often they come back (per phase, day, biome or section);
  - **the effect runs through the shared effect engine and hooks**, never through name checks.
- **Traits with a setting:** [Node] Finder, Hound, Thumbs and Pockets, Location [X/Y], Action [X/Y], Traveler [X], Conservationist [X] and Allergies [X]. Each one stores its setting on the hiker.
- **Traits that change each day:** Quirky, Zany, Nosework and Moody re-roll each morning, and their hover window shows what they are today.
- **Classes:**
  - Tag every Trail and Utility trait with its classes, from the "Existing traits by class" table in `07-characters.md` (Tank, Hardy, Scavenger, Crafter, Scout, Support, Jack, Entertainer, Moneymaker).
  - Strong and Backtracker are **general**: open to every class.
  - Morale traits have no class and are open to every hiker, except Misophonia, Rain Lover, Moody and Show Girl, which stay special.

## 3. Trait badges (follow `TraitBadges.dc.html`)
- **Shape:** always-on traits are a **diamond**, and usable traits are a **circle**. Every Morale trait is always on.
- **Color:**
  - the **ring** is the trait type's color (Trail yellow, Utility green, Morale purple);
  - the **middle** is a darker shade of the same color;
  - the **icon is always white**.
  - Exact colors are in the mockup's script:
    - Trail: ring `#F2B950`, middle `#8A6320`;
    - Utility: ring `#9CC3A8`, middle `#4C7759`;
    - Morale: ring `#CDA6EE`, middle `#6B4C8F`;
    - used up: ring `#6F6A60`, middle `#3A3833`.
- **Icons:** Wyatt draws every trait icon in **white on transparent**. Load them from `public/assets/traits/<trait-id>.png`, and use a placeholder icon until they arrive. Keep the icon tintable in code (a CSS mask or filter) in case a color is wanted later, but show white by default.
- **Usable trait states:**
  - **Ready:** a slow soft glow pulse, with the uses left as dots in a small tab under the circle.
  - **Used up:** turns grey and dims, and its hover window says when it comes back.
  - **Only usable during something:** for example Gambler during a scavenge. The tab names when ("SCAVENGE"), and there's no glow.
  - Under reduced motion there's no pulse.
- **Hiker panel:** keep it simple.
  - Each hiker shows their traits as **a row of badges, icons only** (replacing today's named chips).
  - **Hovering a badge** (long-press on a phone) opens a small window with:
    - the trait's name and type;
    - what it does;
    - its **status right now**, when it has one (for example "Alone right now: loses 1 Morale tomorrow morning"), as a colored line.
  - **Simple UI mode:** icons only.
  - **Informative UI mode:** the same row, with each trait's name in small text under its icon.
  - Empty slots show as a faint outline in the slot's color.
  - Tapping a usable trait opens the Abilities panel.
- **Abilities panel:** only usable traits, each as a row with a **USE** button. A trait that's only usable during something shows that instead of a button, and a used-up trait shows when it's back.
- **Usable traits from the new characters:** Good Boy, Coach, Hype Dog, Rule Changer, Night Shifty, Trespasser, and Boss & Gracie's daily give and fetch.

## 4. Trait warnings (new)
Show players when an always-on trait is about to help or hurt, above all for Morale.
- **What gets a forecast:**
  - **Start-of-day Morale traits:** work out what each one would do at the next start of day **if everyone stays where they are now** (Extrinsic, Intrinsic, Foody, Location, Fair-Weather, Dressed, Alpha, Extrovert, Close Company, Center of Attention and so on). Update it whenever something changes.
  - **Morale traits that react to actions** (Bossy, Action, Traveler, Conservationist, Simple Pleasures, Slow and Steady, Misophonia, Wanderlust and so on): work out the change for the action being hovered or dragged, before it's done.
  - **Non-Morale traits with a condition:** show whether they're **working right now** or not. For example:
    - Focused and Collaborative (alone or not);
    - Lovingly Made (8+ Morale);
    - Closer (last to act);
    - Pirate (alone);
    - Nosework (today's node);
    - Fluff Armor and Shrug Off (unused, or already used).
- **The setting:** "Trait warnings" in the ☰ menu, with three options. Default: **Simple**.
  - **Off:** no forecasts.
  - **Simple:** visual only, on the badge itself.
    - A Morale trait about to give Morale gets a **green middle** (`#3F8A57`) and a small **+1** bubble at its corner.
    - One about to take Morale gets a **red middle** (`#B4472F`) and a **−1** bubble.
    - The number shows the amount, so it doesn't rely on color alone.
    - A non-Morale trait that isn't working right now is **dimmed**; when it's working, it's at full color.
  - **Informative:** everything in Simple, plus:
    - **On the portrait:** a hiker about to lose Morale from traits gets a red **"! −N"** tag on their portrait and profile tab, where N is the total about to be lost.
    - **A check before acting:** when an action would make a hiker lose Morale from a trait, ask first. This covers the hiker taking the action, and anyone the action leaves behind (for example, moving away and leaving an Extrinsic hiker alone).
    - The check is a small window: "Move Cody? Ellie will be left alone, so she loses 1 Morale tomorrow morning (Extrinsic)." It has **Move anyway** and **Cancel**, and a "Don't ask again this run" box.
    - Before ending the day, a single check lists everyone about to lose Morale overnight.
- **Build the forecast once** in the engine (a "dry run" of the trait hooks on a copy of the state), so the badges, the portrait tags and the checks all use the same numbers. Never write a separate copy of each trait's rule for the UI.

## 5. Slots, XP and level-ups
Follow the "Trait rules" in `02-traits-and-conditions.md`:
- **Slot types:** T, U, M, T/U, T/M, U/M and W. A hiker has 2–6 slots, and can't have the same trait twice. Special and unique traits take a slot too.
- **XP and levels:** from the design doc.
- **Level-up offers:**
  - **Level N (1–3)** offers 3 Tier N traits. Trail and Utility options come from the hiker's **classes**, Jack traits and general traits, but [1] of the 3 can come from any class.
  - Options only come from the types the hiker's slots can hold, and Morale traits come up less often.
  - **From level 4,** one more option per level, all Tier III, up to 6.
  - **A new slot** is sometimes an option instead of a trait, and never past 6. T and U slots are the most common, the mixed slots rarer, and W the rarest.
  - **Family versions:** a hiker is only offered the version that matches their family.
  - Special and unique traits are only offered to the characters they belong to.
  - Taking a trait with no fitting open slot replaces the trait in a fitting slot (the player picks which).
- **Level-up screen: a bare-bones placeholder only,** in the style of the existing pop-ups. The real screen gets designed in 10b, together with the hiker selection screen.
- **Trinkets marked `TODO(phase 10)`:** build them now (the three Photos, Instruction Manual, Diploma, Postcard and Textbook).

## 6. Families and Duos
- **Built-in family traits** (no slot):
  - **Human:** none.
  - **Dog:** +1 scavenge card, but crafts lower Quality.
  - **Cat:** moving costs no Appetite, but −1 item slot.
- **Family traits:** the family Trail, Utility and Morale traits, and the family items, as in the doc.
- **Plush (new family, see `07-characters.md`):**
  - **Stuffing:** one bar instead of Energy and Appetite, maximum [12]. Every Energy or Appetite cost or gain goes to Stuffing, and food and sleep fill it. At [7] or less they can't move the group and can only sleep at night. At [3] or less they can only sleep. At 0 they take an injury.
  - **Carried:** they can't move alone. Being moved with the group costs nothing and doesn't use their action.
  - Traits that check for Dogs don't count them.
  - Show Stuffing as one bar in the hiker panel, in place of the Energy and Appetite rows.
- **Duo (Boss & Gracie):** one hiker card for two characters. The **Tag Team** trait switches each day: one side on odd days, the other on even days. The hover window shows whose day it is.

## 7. Test hikers (no art)
- **What they are:** dev-only placeholder hikers, picked from the debug panel or a dev party picker.
- **What they look like:** a colored circle with initials and no portrait. They must not appear in the real roster.
- **Each one exercises a group of traits.** Every set below is a starting setup; the debug panel can change any of it.

| Test hiker | Family | Slots | Starting traits |
| --- | --- | --- | --- |
| Test Tank | Human | T, T, T/U, M | Leader, Puller, Trespasser, Bossy |
| Test Hardy | Human | T, T, T/U, M | Stoic, Hardy, Second Wind, Thrill-Seeker (Morale) |
| Test Scavenger | Dog | U, U, U, M | Forager, Copydog, River Finder, Foody |
| Test Crafter | Human | U, U, U, M | Handy, Focused, Artisan Cook, Zen |
| Test Scout | Human | T, T, T, M | Scout, Fast, Prepared, Wanderlust |
| Test Support | Human | T, U, U, M | Supportive, Therapist, Wise, Extrinsic |
| Test Moneymaker | Human | U, U, U, M | Charismatic, Frugal, MBA, Fair-Weather |
| Test Cat | Cat | T, U, M | Leader, Mouser, Aloof |
| Test Plush | Plush | T, T, M | Shifty, Night Shifty, Intrinsic |
| Test Duo | Dog (Duo) | T, U, Tag Team, M | Herder, Fetch, Boss & Gracie Tag Team, Loyal |
| Test Wild | Human | W, W, W, W, W, W | (empty: fill from the debug panel) |

## 8. Debug panel
- Add or remove any trait on any hiker, including its setting (node, X/Y).
- Add a slot of any type, and set level and XP.
- Trigger a level-up right away, with a chosen tier.
- Refill a trait's uses, and set the day as odd or even (for Tag Team).
- Force what a daily trait becomes today (Quirky, Zany, Nosework, Moody).
- Switch Trait warnings between Off, Simple and Informative.

## 9. Tests
- **Every trait:** at least one test of its effect.
- **Uses:** they come back on the right schedule (phase, day, biome, section).
- **Level-up offers:**
  - they respect slot types, classes, the any-class option, the family version, and special and unique owners;
  - Morale traits are rarer;
  - no slot is offered past 6.
- **Plush:** Stuffing takes both kinds of cost and gain, the limits at 7, 3 and 0, and Carried.
- **Tag Team:** it switches on odd and even days.
- **Forecasts:**
  - an Extrinsic hiker alone forecasts −1;
  - an action that leaves a hiker alone triggers the Informative check;
  - a forecast matches what actually happens at the next start of day.
- **Badges:**
  - usable traits are flagged `active`, and always-on ones aren't;
  - a used-up trait shows as used, and comes back when its uses reset.
