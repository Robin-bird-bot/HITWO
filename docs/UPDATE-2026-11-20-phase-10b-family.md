# Update: November 20, 2026 (Phase 10b final touches: family sort, darker background, Melissa and Erin)

The last Phase 10b follow-up. Apply it after the 10b, 10b-icons and 10b-polish updates (or together with them). Where it disagrees with them, **this one wins**.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `07-characters.md` → `docs/design/07-characters.md` (replace). New in it: the families list for the Family sort.
- `assets/portraits/melissa.png`, `erin.png` and `portraits.json` → `public/assets/portraits/` (replace).
- `assets/shaders/hiker-select-bg.frag` → replace the copy from the polish update (only the colors and the edge darkening changed).
- `mockups/*` → `docs/mockups/`, replacing files with the same names.
- Then delete the leftover `update-2026-11-20-phase-10b-family/` folder.

## 1. Darker background on the hiker selection screen
Same shader, more subtle. New uniform values:

| Uniform | New value |
| --- | --- |
| `uDeep` | `#0C1411` |
| `uMoss` | `#1D3129` |
| `uMist` | `#476055` |
| `uGlow` | `#E9B44C` (the gold lines are dimmer in the shader itself) |

The no-WebGL fallback color is now `#0C1411`.

## 2. Melissa and Erin
Both portraits are re-centered on their faces: Melissa sat too far left, and Erin too far right. Replace the two PNGs and `portraits.json`.

## 3. New sort: FAMILY
The sort buttons are now **DEFAULT, FAMILY, CLASS, TRAITS, DIFFICULTY**.

- **Family** groups hikers by real-life family, each under its own ribbon (same ribbon style as the other sorts):

  | Ribbon | Color | Hikers, in this order |
  | --- | --- | --- |
  | ELMERS | `#B5543A` | Wyatt, Mom, Ellie, Finn, Cody, Duke, Scarlet, Hershal, Sinjon, Brutus |
  | BROOKS | `#3D7EA6` | Mom, Gdog, Grandpa Wink, Pepper, Melissa, Muffin, Coco |
  | SHERMAN | `#D08A2E` | Grandpa Sherman, Pearl, Kai, Catie, Mitchell, Nathan, Madeline |
  | LEICHTY | `#4E8F5A` | Erin, Jackson, Anni, Boss & Gracie |
  | OTHER | `#6B6F78` | Everyone else, by name |

- **Rules:**
  - Inside a group, use the order in the table.
  - **A hiker can be in more than one family.** Mom is in both Elmers and Brooks, so her card shows in both groups. Both copies act as the same hiker: either can be dragged, both dim when she's in the party, and so on.
  - **Variants** go with their base hiker's family, right after the base hiker:
    - Follower Finn, Agility Finn, Ellie the Devourer, Nosework Ellie and Wywee go to Elmers;
    - Graduate Mom goes to both Elmers and Brooks;
    - Planner Wink and Showgirl Gdog go to Brooks.
  - Ben, Mindy, Leah, Loki and Goldie go to Other.
- **Naming in code:** the game already uses "family" for Human, Dog, Cat and Plush. Call this one `household` in the data, with a `households` list per hiker. The button and ribbons still say **FAMILY**.

## 4. Tests
- The Family sort makes the 5 groups in the right order, and Mom appears in both Elmers and Brooks.
- Variants land in their base hiker's group.
