# Update: November 23, 2026 (Phase 10.7: Hikers)

**Build this next**, after Phase 10.6 (Simplify). If 10.6 isn't finished, finish it first.

This update replaces trait slots and per-hiker level-ups with **Skill Trails**: every hiker has 3 trees, picks 1 starting trait, and grows with **party XP**. It also adds **morale types**, **toggle traits**, the new trinket rules, and **locks every hiker except Finn, Ellie, Wyatt, Mom, Gdog and Wink**.

The full design is in `09-hikers.md`. The trees, as data, are in `skill-trails-data.json`. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `09-hikers.md` → `docs/design/09-hikers.md`.
- `skill-trails-data.json` → `docs/design/skill-trails/`. It's the source for the hiker data, not a file the game loads: convert it to the repo's data format. Field names are only a suggestion.
- `mockups/*.jpg` → `docs/mockups/skill-trails/`.
- At the top of `docs/design/07-characters.md`, add: "Phase 10.7 replaced traits, classes and leveling for the first 6 hikers. See `09-hikers.md`, which wins where they disagree." Add the same line under the Hikers, Trinkets and Morale types sections of `08-overhaul-plan.md`.
- Then delete the leftover `update-2026-11-23-phase-10.7-hikers/` folder.

---

## 1. Plan changes (update `BUILD_PLAN.md` first, and commit)
- Mark Phase 10.6 done (and the map corners add-on, if it's in).
- **Phase 10.7: Hikers (now):** this update.
- **Phase 10.7b (later, design first):** trees for the locked hikers, in new shapes (long trails of 4 tiers, steps you can buy more than once, steps that give an item, per-step costs, duos). Outline only.
- Phase 10.8 (Challenges) stays next after that.

## 2. Lock every other hiker
Only **Finn, Ellie, Wyatt, Mom, Gdog and Wink** are playable.
- **Selection screen:** every other hiker shows as a locked card: the portrait blacked out (a black silhouette of the portrait, not a blank box), the name replaced by "Locked", and no classes, traits, stats or back of the card. Hover and click do nothing.
- They can't be picked any way: not by clicking, random team, saved or last-used teams, or the debug panel. A saved team with a locked hiker drops them.
- Keep their data as it is, with `locked: true`. Don't convert their traits. They get trees later.
- Sorting still works; locked cards go to the end of each group.

## 3. Classes
- **Rename Tank → Leader and Guardian → Watcher** everywhere: data, UI text, sort ribbons, icons' names, tests.
- **Add Smith (tools), Tailor (clothes) and Architect (shelters).** Crafter stays as the general crafting class.
- There are now 19 classes in 3 areas (Movement, Resources, Utility), with colors in `09-hikers.md`. Sorting by class groups them by area.
- A hiker's classes are now the classes of their 3 trees, in tree order.

## 4. Remove the old trait system (for the 6)
- **No trait slots** (M/T/U), no trait swapping, no per-hiker level-ups or level-up trait picks.
- The 6 hikers' old starting traits are replaced by their trees. Old traits that are now trees (Leash Puller, Copydog, Singer, Dog Mom, Short, Rule Changer, Rain Lover and the rest) keep their icons. Wanderlust (Mom's trait) is now **Experienced Traveler**; reuse its icon.
- Morale traits become **morale types** (section 9).
- Anything else that read trait slots or hiker levels (items, night events, UI) should read the new data or be switched off. List anything you switch off in your summary to Wyatt.
- **Saves:** bump the save version. If a run in progress is easy to migrate, do it: each of the 6 keeps the first tree's Tier 1, and party level comes from total XP. If not, show "This run is from an older version and can't continue" and let the player start a new run.

## 5. Party XP and points
- XP from every hiker goes into **one party bar**. What gives XP doesn't change.
- **Party level** uses today's per-hiker XP curve for now [TODO(wyatt): tune]. Each level gives [1] point.
- Show the party level and bar in the top bar (small), and "N points to spend" when there are any.
- **Spending:** only at night or at a ranger station. At other times the Skill Trails window still opens for planning, with Learn greyed out and the line "Learn at night or at a ranger station."
- **Costs and unlocks** (all in `balance.ts`): Tier 2 step [1] point, Tier 3 step [2], opening another tree's Tier 1 [2]. Tier 2 needs party level [2], Tier 3 needs [4]. A step needs the step below it in the same tree. Keep an optional `cost` on each step in the data that overrides the default (Wyatt wants per-step costs later).
- **Level-up moment:** a short toast "Party level 3! +1 point". At the start of the next night (or on reaching a station), if there are unspent points, Skill Trails opens full screen.
- Debug panel: "+100 party XP", "+1 point", "Learn everything for this hiker".

## 6. Trees: data and effects
- Build the 6 hikers' trees from `skill-trails-data.json`, with the effects in `09-hikers.md`. Read its "Rules that need care" section before building the effects.
- **Start of a run:** each picked hiker starts with the Tier 1 trait chosen on the selection screen (section 8). Traits that give something (recipes, tools) give it at the start, and their text reads "Start with …".
- **Kinds:** always on, usable (limited uses, reset per day or per section as listed), toggle, and gives something.
- **Upgrades** replace the trait they upgrade; the hiker keeps one badge for it, with a II or III tag.
- **Toggles** (Leash Puller is the only one for now): a free switch on the hiker frame. Click the square badge to switch it, any time it's that hiker's turn and they're not in the middle of an action. Filled = on, outlined = off. It starts **on**.
- New traits without an icon yet get a placeholder: the badge shape in the class color with the class glyph. Wyatt is painting icons. List the placeholders in your summary.
- Write a test for each step (54 in all). Focus on the stacking cases: two Move All cost cuts, Copydog alone (first and last), Prepper with and without others, Rule Changer III on an empty tile.

## 7. The Skill Trails window
Follow `mockups/skill-trails-window.jpg` (look A). The badge and line language is in `mockups/skill-trails-legend.jpg`.
- **Opens from:** a button on each hiker frame (and clicking a hiker's tree area on their card). Full screen at night after a level-up, with the same layout.
- **Header:** "SKILL TRAILS", the hiker's portrait and name, a row of the party's portraits to switch hikers, the party level bar and points to spend, and a close button.
- **The map:** a dark topographic background with soft class-colored glows. Three trails start from one trailhead at the bottom and wind gently upward, one per tree, with the tree's name above it in italic serif ("Leader Trail"). Each step is a badge on the trail with its name and "New trait" or "Upgrade" under it, on a small dark backing.
- **Badges:** diamond (always on, gives something), circle (usable), rounded square (toggle). An upgrade is a smaller badge of the same trait with a small arrow above and a II/III tag.
- **Trail states:**
  - **Learned:** solid, glowing line in the class color; bright badge.
  - **Can learn now:** dashes that move slowly up the trail, a gently pulsing badge, and a gold cost chip ("2 PTS").
  - **Not yet:** dark dashes, a dim badge, and "PARTY LV 4" under it.
- **Side panel** (narrow, about a fifth of the window): the selected trait's badge, name, trail name in its color, the effect text, and the Learn button with its cost. Toggles show "On: …" and "Off: …". Upgrades show the full text with what changed in yellow. Nothing else: no kind labels, no tags.
- Reduced motion: no moving dashes or pulses.
- Check it at desktop size and phone landscape, with every hiker and every state.

## 8. Selection screen
- **Each designed hiker's card** shows 3 class tabs (one per tree, in class colors). The card back shows the 3 trees, each with its 3 traits (names only, hover for text).
- **Picking a hiker** then asks for the starting trait: 3 small cards, one per tree's Tier 1, with the "Start with …" wording where it fits. The pick can be changed until the run starts.
- **New filter, "By starting trait":** each designed hiker appears 3 times, once per tree, with a single class banner in the old style. Picking one picks that hiker with that start. A hiker can only be in the team once, so their other 2 cards grey out. Locked hikers don't appear in this view.

## 9. Morale types
- Each hiker has one **morale type**, replacing morale traits and any old morale rules. The 6: Finn Extrovert, Ellie Foody, Wyatt Energetic, Mom Wanderlust, Gdog Ambivert, Wink Ambivert. Rules and thresholds are in `09-hikers.md`.
- **Checked at the end of every phase:** +1, −1 or nothing, within today's Morale limits.
- **Hiker frame:** the type's symbol on the name banner (placeholder symbols for now; hover shows the rule). The Morale bar shows the forecast: the next pip glows green (going up), the last pip empties to a red outline (going down), or a small "?" at the end of the bar (can't tell yet). See the right half of the legend mockup.
- Log line at the end of the phase: "Finn +1 Morale (Extrovert)."

## 10. Trinkets
- Trinkets **no longer give or swap traits.** Switch off (`enabled: false`) every trinket that does. A switched-off trinket already in a pack does nothing; its tooltip says "Retired".
- **New trinket rules:** a trinket sits in a pack (1 item slot) and works on its own, with nothing to equip. Each has **durability** that ticks down either every phase or each time it takes effect, set per trinket. At 0 it's thrown away.
- **Two first trinkets** (names are placeholders): [Field Notebook]: XP from scavenging is doubled; [5] durability, −1 each time it doubles XP. [Merit Badge]: +[3] XP each time its hiker passes a challenge; [8] durability, −1 per phase. Put them in the item pools like other Tier [2] items.

## 11. Not in this update
- Trees for the locked hikers, per-step costs, long trails, repeatable steps, duos.
- New trait icons and morale symbols (Wyatt is painting them).
- The 3×3 crafting deal and other Phase 12 UI.

## When you're done
Send Wyatt a short summary: what's built, any rule you had to interpret, anything you switched off, and the list of placeholder icons.
