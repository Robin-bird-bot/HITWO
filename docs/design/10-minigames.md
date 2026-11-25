# Minigames (Phase 10.8): the party GPS, the challenge pop-up, and Bearrels

Wyatt's design for how challenge minigames look and play. The first game is **Bearrels**, built and played from the **Minigame testing** tab on the main menu. Numbers in [brackets] are first guesses: they go in `balance.ts` with `TODO(wyatt)`.

**Revised November 24.** What changed since the first version:
- **The GPS:** it's vertical again. It loops a preview of the game, then turns sideways and zooms in on Start.
- **Art styles:** three art styles you can switch between for testing.
- **Hikers:** plain color-coded silhouettes for now.
- **Controls:** drag-and-drop.

## The pieces

1. **The challenge pop-up:** a cream window with a red banner. It's where the player reads the challenge, prepares, and presses Start.
2. **The party GPS:** a yellow, vertical handheld that the whole party shares.
   - In the pop-up it plays a short looping preview of the game.
   - On Start it turns sideways and zooms in until it fills most of the window, and the game plays on its screen.
3. **The minigame:** drawn in one of three art styles (section 3). It runs inside the GPS screen and returns a result to the pop-up.

Build all three as reusable parts. Every later minigame plugs into the same pop-up and GPS.

## 1. The challenge pop-up

The layout is unchanged from the first version (see `mockups/4-vertical-gps-preview-then-turn.jpg`, top right). The GPS now sits in the middle of the pop-up, between the poster and the right column.

- **Red banner** (#C8423A, with a darker bottom edge #8E2A24):
  - left: "CHALLENGE · TIER II";
  - center: the challenge name in the pixel font, between two small diamond badges that show the game's icon;
  - right: "WHOLE PARTY".
- **Poster** on the left, 2:3, with a cream mat (#FBF4E2) and a dark keyline. Posters are art only, and the game sets the name in the banner.
- **The vertical GPS** in the middle, playing the preview (section 2).
- **Right column:**
  - **The game:** icon, game name, one short line on how it plays, and a chip such as "Harder in a group";
  - **Prepare:** up to 3 option cards. **Hidden in test mode**;
  - **If hit:** a red-outlined box with what failing costs;
  - **Start:** a big red button.
- After a game, the pop-up shows the result line ("1 safe, 2 hit") plus Continue. In test mode it shows **Back to testing** and **Play again**.

## 2. The party GPS

See `mockups/4-vertical-gps-preview-then-turn.jpg` and `mockups/1-playing-earthy-pixel.jpg`. Build the body in CSS and SVG; it needs no image files.

- **Body:** a vertical rounded rectangle with a yellow gradient (#F6CB3A to #E2A91E) and a dark inner face (#1C201E).
  - A black antenna nub on the top left, and small side buttons.
  - Under the screen: "TRAILMATE" in small yellow pixel letters, a round knob with a yellow cap, and a small button on each side of it.
- **Screen:** 3:4 portrait when upright. When the GPS turns sideways it becomes 4:3 landscape, which is the shape every minigame is drawn for. On top of the game sit:
  - faint scanlines (horizontal lines about 6% dark, every 3 px);
  - a soft inner shadow;
  - a faint glass sheen;
  - a warm glow around the bezel.
- **Preview (before Start):** the upright GPS loops a short demo of the game. For Bearrels:
  - a ghost finger drags a hiker to a barrel;
  - the bear pops up, the crosshair sweeps, and it fires (sometimes a hit, sometimes a miss);
  - the loop runs about every [6 s].

  The demo uses the 4:3 scene cropped to the middle so it fills the tall screen. It shows a "▶ PREVIEW" pill top left and "Watch, then press Start" along the bottom, and it can't be played.
- **Turn and zoom (on Start), over [700 ms]:**
  - the GPS turns 90° clockwise, so the antenna ends up on the right and the knob on the left;
  - at the same time it moves to the center of the window and scales up until the device fills most of it. The landscape screen is as large as fits, up to [92%] of the window width and [86%] of its height. On small screens the body may run past the edge of the window, but the screen never does;
  - the pop-up behind dims to about [35%] brightness;
  - when the turn finishes, the game starts.
- **On Continue:** it shrinks and turns back upright over [500 ms], and the pop-up comes back.
- **Phone in landscape:** the screen should end up almost the full height of the phone.
- **Reduced motion:** a crossfade between the upright and sideways views, with no spinning.
- The knob and buttons are decoration for now.

## 3. Art styles (three, switchable for testing)

Wyatt wants to compare these in the game before choosing one. Build Bearrels so it can draw the same scene in any of the three, and switch between them without restarting (see section 5).

| Style | Look | Files |
| --- | --- | --- |
| **Earthy pixel** (default) | Detailed pixel art: sunset sky with a haloed sun, a lake with reflections, layered pines, tall framing trees, olive grass, a furry bear, wooden barrels | `art/bearrels/pixel-earth/` |
| **Teal pixel** | Color-focused: one teal family (foggy layered mountains, pines, grass swaths). Only the hikers carry color | `art/bearrels/pixel-teal/` |
| **Silhouette** | The flat layered silhouettes from the first version | the SVG parts from the last update, plus `art/bearrels/layout.json` |

**Pixel styles:**
- Draw the scene at **280 × 210** using the sprites and the exact positions in that style's `layout.json`.
- Scale it up with nearest-neighbor (`image-rendering: pixelated`), at a whole-number scale where it fits, letterboxed if needed.
- Draw in this order:
  1. background;
  2. bear (hidden or up);
  3. log;
  4. hikers, so the barrel hides their lower half;
  5. barrel shadows;
  6. barrels;
  7. crosshair;
  8. muzzle flash;
  9. effects.
- `layout.json` lists the barrel positions and sizes for 3, 4, 5 and 6 barrels, the bear and log positions, the muzzle-flash point, and the rule for placing hikers behind a barrel.
- Files starting with `_reference-` show how a frame should look. Don't load them in the game.
- Effects are drawn in code over the pixel scene, at the same pixel scale where possible:
  - red flash, shake and hikers tipping over;
  - a few splinter pixels and a smoke puff (3 to 6 pixel-sized squares are enough).

**Silhouette style:**
- The same SVG parts as before, but shown at 4:3: use viewBox `0 -120 1280 960`.
- Add a sky strip above (#FCE6BE) and a ground strip below (#4A1428), as in `layout.json` → `extend_for_4x3`.
- The new `layout.json` replaces the old one. Its barrel width line was out of date.

**Hikers (all styles):**
- For now they're plain color-coded silhouettes. Detailed character art waits until the style is settled.
- Shapes: dogs have pointed ears; Mom has a sun hat; the others are a plain head and shoulders.
- One color per hiker everywhere, matching the ring on their token. The colors are in each `layout.json`.

**In-game UI (all styles):** DOM on top of the scene, scaled with the screen.
- **Pills:** dark translucent (rgba(42,10,24,.72)) with cream text in DM Sans bold.
- **Round pill:** top left.
- **Prompt:** top center. It turns red for bad news.
- **Shots:** top right.
- **Hiker tokens:** bottom left.
- **Ready:** bottom right.
- The UI must never cover a barrel.

## 4. Bearrels

Hide your hikers behind barrels. Each round the bear pops up and shoots. Anyone behind the barrel it hits is out.

### Settings (test tab)

| Setting | Range | Default |
| --- | --- | --- |
| Art style | Earthy pixel, Teal pixel, Silhouette | Earthy pixel |
| Barrels | 3 to 6 | 3 |
| Hikers | pick 1 to 4 of the playable hikers | Finn, Ellie, Mom |
| Rounds | 1 to 5 | 3 |
| Shots per round | 1 or 2 (never the same barrel twice in a round) | 1 |

### Rules (unchanged)

- Several hikers can hide behind the same barrel. A shot hits **everyone** behind that barrel.
- A hiker who is hit is **out for the rest of the game**.
- The bear picks its barrels at random, with every barrel equally likely, before the crosshair starts moving.
- The game ends after the last round, or as soon as every hiker is out.
- Real stakes (Injury, Luck) aren't applied yet.

### Flow of a round

See `mockups/1-playing-earthy-pixel.jpg` and `mockups/7-game-states-reference.jpg` (the states look the same in every style).

1. **Placing.** The bear is hidden: only its ears and eyes peek over the log. Prompt: "Drag a hiker to a barrel".
   - The hikers still in are shown as tokens: a portrait ringed in their color, and their name.
   - Place each hiker by **dragging** or by **tap, then tap** (see Controls).
   - **Ready** lights up once every hiker still in is placed. In later rounds hikers keep their barrels, so Ready is lit at once, and they can still be moved.
2. **The bear pops up.** Tokens lock. Prompt: "Here it comes…".
   - The bear slides up from behind the log over [450 ms] with a small bounce.
   - The crosshair sweeps across the barrels for about [1.4 s], slows down and settles on the chosen barrel.
3. **Fire.**
   - A [300 ms] hold, then the muzzle flash for about [120 ms], and the barrel shakes with a few splinters.
   - **If anyone is behind it:**
     - **red flash:** a full-screen #E5483A overlay at about 40% plus a thick red inner border, in over [60 ms] and out over [400 ms];
     - a short screen shake;
     - the hit hikers tip over and fade;
     - a red prompt such as "Ellie and Mom were hit!";
     - their tokens grey out with a red X.
   - **If the barrel is empty:** a puff and "Missed!".
   - With 2 shots, the second shot comes [600 ms] later on a different barrel.
4. **The bear ducks.** Hikers who were hit leave the scene, and the next round starts.
5. **Results.** A cream card shows "1 safe, 2 hit", with each hiker as Safe or Hit in round N. Buttons: **Continue** (the GPS turns back and the pop-up returns) and **Play again**.

### Controls

**Drag-and-drop (new).** This is the main way to play, with mouse or touch (pointer events).
- **Start a drag:** press on a hiker's token, or on a hiker already behind a barrel, and move more than [6 px].
- **While dragging:**
  - the portrait lifts (bigger, tilted a little, with a shadow) and follows the pointer;
  - the token's spot shows an empty ring;
  - the barrel under the pointer gets a dashed cream outline and a glow. Use a generous hit area: the barrel, the space just above it where hikers peek out, and a margin of about [12 px].
- **Release over a barrel:** the hiker hides behind it, sliding into place from the drop point over [250 ms].
- **Release anywhere else:** the portrait flies back to its token over [200 ms].
- No dragging while the bear is up.

**Tap, then tap (kept):**
- Tap a token to select that hiker. It lifts and glows in their color.
- Tap a barrel to send them there. The next unplaced hiker is then selected automatically.
- Tapping a hiker who is already placed selects them so they can move.

**Keyboard:**
- 1–4 selects a hiker;
- ← and → move a highlight across the barrels;
- Enter or Space places the hiker, or presses Ready.

**For every future minigame:** anything the player places or moves can be dragged, and tap-then-tap always works too.

### Reduced motion

No shake or spin. A softer red flash (about 20%, no border). The crosshair jumps straight to its barrel.

### Sound

Leave hooks only, with no sound files yet: place, ready, bear up, crosshair tick, pop, hit, miss.

## 5. The Minigame testing tab

See `mockups/8-testing-tab-reference.jpg`.

- **Art style:** a new setting with three buttons (Earthy pixel, Teal pixel, Silhouette), shown above the other settings.
- **Preview:** shows the chosen style.
- **Switching while playing (test mode only):**
  - a small "Style" button in a corner outside the GPS screen cycles through the three styles;
  - so does the **S** key;
  - the scene redraws in place without restarting the round.
- Remember the last settings on this device, including the style.
- **Test it** opens the Bear Country pop-up in test mode (with the GPS preview and no Prepare). The flow is: Start → the GPS turns and zooms → Bearrels → results → Continue → the GPS turns back → the pop-up shows the result with **Back to testing** and **Play again**.
- Test mode never touches the save, XP, stats or anything else in a run.
