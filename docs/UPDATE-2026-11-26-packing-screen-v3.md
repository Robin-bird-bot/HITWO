# Update, November 26 (late): the packing screen, v3 (replaces both earlier packing-screen zips)

Wyatt played the prototypes: "This is absolutely incredible." **This package replaces `update-2026-11-26-packing-screen` and `…-v2`.** If you already started from the first one, the changes are:
1. **The odds and paytable are hidden** in pull-out drawers (`27`, section 2).
2. **Bundles are just the resource icons,** centered and evenly spaced: no sack (`27`, section 4).
3. **Hovering an item shows its real item card** (`27`, section 3).
4. **A second look, TrailMate** (GPS-themed), with the same rules. **Both stay, with a setting to switch, and TrailMate is the default** (Wyatt; `27`, section 9, and `28`).
5. **TrailMate's background** is a dark, subtle version of hiker select's animated background, for continuity (`28`, section 1).

## What's in this update
| File | What it is |
| --- | --- |
| `27-packing-screen.md` | The spec: where it goes, the cabinet look, every rule, number and animation, data, tests, flags, and the two looks. |
| `28-packing-screen-trailmate.md` | The TrailMate look: the device, its screens and symbols, its animations and sounds. |
| `mockups/packing/prototype.html` | **The cabinet prototype** (Lucky Trail Outfitters). Open it in a browser; the top-right buttons force every bonus. |
| `mockups/packing/01-…png` to `20-…png` | Its screenshots, in order. `19` is the card preview, `20` the drawers. |
| `mockups/packing-trailmate/prototype.html` | **The TrailMate prototype (the default look).** Same rules, same test buttons. |
| `mockups/packing-trailmate/00-…png` to `20-…png` | Its screenshots, in the same order, plus `00`, the boot-up. |
| `art/packing-trailmate/greenify.py` | How TrailMate turns item art into LCD greens (a short Python script). |
| `art/packing/squirrel-wheel.svg` | The cabinet's squirrel in its wheel (named parts: `.legs-a`, `.legs-b`, `.legs-sit`, `.tongue`, `.sweat`, `.eye-shut`; rotate `#wheel`). |

**Where these files went** (Wyatt unzipped the folder into the repo root):
- the two specs: `docs/design/27-packing-screen.md` and `28-packing-screen-trailmate.md`;
- `mockups/packing/`: `docs/mockups/packing/`;
- `mockups/packing-trailmate/`: `docs/mockups/packing-trailmate/`;
- `art/packing/squirrel-wheel.svg`: `assets/packing/`;
- `art/packing-trailmate/greenify.py`: `assets/packing-trailmate/`.

The two earlier packing-screen zips were never unpacked into the repo, so there was nothing of theirs to remove.

## Suggested order
1. **The rules,** as plain functions with tests (`27`, sections 3, 4, 6 and 7).
2. **The TrailMate look** (the default), with the drawers, the card preview and the dark background.
3. **The cabinet look,** as the second skin, and the setting. A separate PR is fine.

The packing screen comes before the hike, so it doesn't depend on the challenges-on-the-map update.

## Rules for this update
- **Numbers in [brackets]** are first guesses: put them in `balance.ts` with `TODO(wyatt)`.
- **Ideas marked *(Claude's idea)*** are the design assistant's, not Wyatt's.
- **"Things to flag to Wyatt"** (in `27` and `28`): mention them in the PR.
