# Update: November 24, 2026 (Dodge: four new animals and a shared attack library)

**Builds on `UPDATE-2026-11-24-dodge`.** Wyatt has played Dodge and loves it, especially how the attacks get more complicated at higher tiers. Keep everything already built: the party sprite and switching, lives, controls, Bees, and Bear with a Sword's sweep.

This update:
1. turns the attacks into a **shared attack library**, so animals are just a box, a head and a list of attacks;
2. adds four animals: **Bear**, **Bobcat**, **Squirrel Army** and **Wild Predator Stampede**;
3. gives **Bear with a Sword** bear claws, sword jabs and poke-ups on top of its sweep;
4. adds testing tools: an **Attack** picker, **Show hitboxes**, and **Include Claude's ideas**.

Some attacks are marked *(Claude's idea)*. They're suggestions on top of Wyatt's list, and Wyatt will keep or cut them after playing, so make them easy to remove.

The revised `12-minigames-dodge.md` replaces the old one. The note at its top lists what changed. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`, by attack and tier.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `12-minigames-dodge.md` → `docs/design/12-minigames-dodge.md`, replacing the old one.
- `mockups/*` → `docs/mockups/minigames/dodge/`, next to the first three.
- `art/dodge/*` → the existing `dodge/` asset folder (new files only; keep the old ones).
- Then delete the leftover `update-2026-11-24-dodge-animals/` folder.

---

## 1. Attack library (design section 6)
- **Refactor:** each attack is a piece with an id, a name, the tier it starts on, its numbers per tier, its warning, and its hit shapes. Bees' patterns and the sword sweep become attacks in the library.
- **An animal** is a box size, a head sprite and a list of attack ids. Picking: random, never the same attack twice in a row, only what's unlocked at the tier.
- **Shared rules:**
  - every attack warns first: [0.6 s] by default, never under [0.35 s];
  - harder tiers make attacks faster or add more of them, but never shorten warnings below that minimum.
- **New hit shapes:** segments with a thickness, ellipses, and ring bands with a gap.

## 2. New attacks (design section 6)
- **Wyatt's list:**
  - **Claws:** a row of 3 or 4, straight or a curved swipe, doubled on Tier III;
  - **Bite:** jaws snap where you are;
  - **Sword jab;**
  - **Poke-up slide;**
  - **Pounce:** a shadow marks where it lands, with a feint on Tier III;
  - **Rolling acorns:** they bounce, crack, and break on the 3rd wall;
  - **Acorn bombs,** with a blast radius;
  - **Shrapnel** on Tier III.
- ***Claude's ideas*:**
  - Roar rings with a gap;
  - Bear hug: the walls squeeze in;
  - Honey drips, which leave puddles that slow you;
  - X slash;
  - Thrown sword;
  - Zigzag dash;
  - Landing swipe;
  - Pinecone rain;
  - Wall scurry;
  - Herd rush.
- **Honey puddles** slow the sprite but never count as a hit. Bear hug and the shrinking box always push the sprite back inside.

## 3. Animals (design sections 7 to 11)
- **Bear** `[140 × 110]`: Claws and Bite, plus Roar, Bear hug and Honey drips.
- **Bear with a Sword** `[180 × 80]`: Sweep, Claws, Jab and Poke-up slide, plus X slash and Thrown sword.
- **Bobcat** `[150 × 110]`: Pounce and fast Claws (×1.25), plus Zigzag dash and Landing swipe.
- **Squirrel Army** `[130 × 120]`: Rolling acorns and Acorn bombs, plus Pinecone rain and Wall scurry.
- **Wild Predator Stampede:**
  - every attack from every animal, plus Herd rush;
  - the head and the box switch to whichever animal is attacking;
  - on Tier III two attacks can overlap;
  - [10 s] longer by default.

Which variants each tier unlocks is listed per animal in the design. The mockups are `4-bear.png` to `9-stampede.png`, and the sprites are the new files in `art/dodge/`.

## 4. Testing tab (design section 12)
- **Animal:** add Bear, Bobcat, Squirrel Army and Wild Predator Stampede.
- **Attack:** All, or one attack the chosen animal uses. It plays only that attack, at the chosen tier.
- **Include Claude's ideas:** On or Off.
- **Show hitboxes:** draws every hit shape as an outline, for tuning.

## 5. Tests
See design section 13, which adds tests for the attack picker, tiers, Claude's ideas, acorn cracking, shrapnel, honey, the box squeezing, and the Stampede.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- how to try one attack at a time and turn Claude's ideas on and off.
