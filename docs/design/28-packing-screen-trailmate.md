# The packing screen, TrailMate look (a GPS-themed skin)

Wyatt (November 26): "Make one that's device/GPS themed like the challenges device. It would be in the shape of a slot machine, but it would look like hiking tech similar to the challenge device. Each slot could be a screen with the green tint, and the slot art could be a bit more GPS themed, but also have bright colors to discern the type and/or rarity. Also make the animations and sounds even more exciting for this one, and a bit more technical."

**The rules are exactly those of `27-packing-screen.md`.** Only the look, the effects and the sounds change (`27`, section 9). **This is the default look** (Wyatt); the cabinet is the other choice in the settings.

**The reference is the prototype:** `mockups/packing-trailmate/prototype.html`, with screenshots `00` to `20`.

Numbers in [brackets] are first guesses. Ideas marked *(Claude's idea)* are mine.

---

## 1. The device
**A TrailMate, shaped like a slot machine.** It's the same handheld as the challenge pop-up's device (`20-challenge-popup.md`).

- **The shell:** the TrailMate's yellow (`#F6CB3A` → `#E2A91E`), with rounded corners, screws in the corners, and dark rubber grips on the left side.
- **The antenna stub** sits on top, with an LED: green and slow while ready, red and fast while scanning.
- **The face** is the dark `#1C201E`. Every screen on it is a green LCD (`LCD_GREENS`), with:
  - the challenge device's scanlines and sheen;
  - a faint map grid behind the symbols.
- **The background** (Wyatt: "a dark subtle version of the animated background from the character selection screen … to keep some continuity between the screens"):
  - the same shader as hiker select (`src/shaders/hiker-select-bg.frag`, `backgroundGl.ts`);
  - darker colors: deep `#060B08`, moss `#112019`, mist `#2C4237`, and a dimmer gold seam `#9A7A34`;
  - everything × [0.8] (a new `uDim` uniform, the only change to the shader: `col *= uDim;`);
  - a soft vignette on top;
  - it still bends toward the pointer and drifts when the pointer is away;
  - reduced motion: one still frame;
  - share the code with hiker select (a "dark" preset), not a copy. The prototype's `startBg()` shows the settings.
- **The words:**
  - "respins" are **scans**, and each one uses a **battery cell**;
  - an empty reel is **offline**;
  - Second Wind is **REBOOT!**;
  - the jackpot is **CACHE JACKPOT!**

### 1.1 The status screen (top)
- **The radar:** sweep line, rings and satellite blips. The sweep spins fast while scanning.
- **The status line,** typed out in big pixel text, one character at a time with a tick:
  - while booting: "TRAILMATE OS 2.6", then "SUPPLY SCAN";
  - while scanning: "SCANNING...", "LOCKING 87%", "LOCK 3/5";
  - after: "TAKE 5", "BONUS!", "!! JACKPOT !!", "FINN'S PICK", "ALL PACKED", "ROUTE LOADED".
- **A scrolling ticker:** "TRAILMATE SUPPLY SCAN · SATS 5/5 · 44.12°N 121.33°W · ELEV 4,210 FT · SUPPLY CACHES NEARBY…". After some events it briefly shows something else, such as "TRAIL MIX → FINN".
- **Signal bars and "SAT 5/5".**
- **The Squirrel Theft pixel squirrel** (`minigames/squirrel-theft/squirrel.png`, and `-happy` for big wins) pops up from the bottom-right on a win and hops.
- **In the resource step:** the current hiker's portrait sits in a ring of their color on this screen.

### 1.2 The reels: one screen each
- **Five little LCD screens** in a row; three in the resource step.
- **Symbols are GPS themed** (Wyatt):
  - **the item's art in LCD greens:** shrunk to about [42 px], turned into 4 greens with a dark outline, and drawn at 2× with crisp pixels. The recipe is `art/packing-trailmate/greenify.py` (it can run at build time or in a script);
  - **its type in bright corner brackets around it:** Tool `#FF9F1C`, Food `#8BE04E`, Clothes `#FFB37A`, Shelter `#4FC3F7`;
  - **a small badge** with the type icon (`item-cards/type-icons/`) in the same color.
- **Rarity:** a Tier II has **gold brackets that shimmer** (gold, pink, cyan), a glow, and a gold "II" chip (Wyatt: bright colors for rarity).
- **Bundles:**
  - the green pixel resource icons (`resources-green/`, at 4×), centered and evenly spaced as in `27`;
  - brackets and a size chip colored by size: ×1 `#4FC3F7`, ×2 `#8BE04E`, ×3 `#FF6BD6`, ×5 gold (it shimmers).
- **Neighbors:** the symbols above and below fade into darker green at the screen's edges.
- **Under each screen:** a label with a glowing LED in that color ("● TOOL", "● ×2 BUNDLE", "● OFFLINE").

### 1.3 Controls
- **SCAN:** the big round button in the middle, the TrailMate knob in orange. It pulses when a scan is ready and greys out with none left.
- **The antenna lever** on the right side: a black whip antenna with an orange ball tip and a coiled base. Pull it like the cabinet's lever.
- **Space** works too.
- **The battery** (left): "SCANS", with a count and a row of glowing green cells.
- **The picks screen** (right), an LCD: "TAKE 5 MORE", and under it "2 + 1 PER HIKER = 5 ITEMS".
- **The brand:** "TRAILMATE · SUPPLY SCANNER" in amber, above a speaker grille.

### 1.4 Around it
- **The drawers:** dark LCD panels with yellow borders and yellow tabs. A closed paytable's tab flashes green on a win.
- **The hiker cards:**
  - dark, with a stripe in the hiker's color;
  - bag slots are little dark screens that turn green with the item's pixel art;
  - bundle chips are colored by size.
- **The card preview** is the same real `ItemCard` as the cabinet's.

---

## 2. Animations (Wyatt: "even more exciting… and a bit more technical")
- **Booting up** (when the screen opens):
  - the status screen flashes on;
  - "TRAILMATE OS 2.6" types out, and the satellites lock one by one (bars and blips);
  - each reel screen turns on like an old CRT, a bright line that opens up, one after another with a blip;
  - then the first scan starts. About [2.5 s] in all; picking a new party skips most of it.
- **Scanning:**
  - the button presses in and the antenna swings;
  - a battery cell flashes white and drains, and a spark runs from the battery to the button;
  - a rising sweep sound plays, the radar spins fast, and the LED blinks red;
  - while the reels spin: motion blur, flickering TV static, a 1-pixel jitter, and red/cyan color fringes on the art.
- **Locking on** (each reel stopping, left to right):
  - a bracket reticle closes in from big and turned, and the screen flashes;
  - a beep that rises in pitch reel by reel (a chord);
  - "LOCK 3/5" on the status screen.
- **The tease** (two in a row so far):
  - the next screen gets a red border and a spinning red dashed "SIGNAL" ring;
  - ticks speed up like a Geiger counter, and the status line counts "LOCKING 12%… 99%";
  - that reel spins about [1.1 s] longer.
- **A win:**
  - the matching screens flash in negative and their borders strobe green;
  - a green radar ring spreads out from the reels, and the pixel squirrel pops up;
  - a chiptune riff plays;
  - **an LCD pop-up** comes in like a CRT over the reels: big neon pixel text with red/cyan glitch slices that jitter, and a typed line under it ("> 3 IN A ROW · +1 SCAN") with a blinking cursor;
  - a gold spark bolt runs from the radar to the battery, and a new cell charges with a white flash.
- **Turning Tier II (or growing a bundle):** the screen glitches (shifts, skews, inverts), then a burst of square pixel sparks in gold, pink and cyan, and a high chiptune arpeggio.
- **The jackpot:**
  - four colored radar rings spread across the whole screen, one after another;
  - green "data rain" glyphs fall over everything;
  - a big burst of neon pixel confetti, and pixel acorns (`minigames/dodge/acorn-0.png`) rain down;
  - the device strobes and shakes, the antenna LED flashes red, and the happy squirrel hops;
  - a longer chiptune fanfare with a bass line and drums;
  - the gold "CACHE JACKPOT!" pop-up, then the five upgrades one after another.
- **Packing an item:**
  - the dragged item glows green;
  - on drop, a spark trail in the hiker's color runs to their card, and the item squashes into a flat beam and lands;
  - the slot "materializes" it (a stepped flicker), with modem chirps;
  - the reel's screen turns off like a CRT (it shrinks to a line, then a dot), and shows "OFFLINE → FINN" in the hiker's color.
- **REBOOT!:** the pop-up, then every screen turns back on, one by one.
- **Changing steps:** the screens go off, three come back, and "BUNDLE SCAN" types out. Each turn types "FINN'S PICK", and the hiker's portrait appears.
- **Starting the hike:**
  - "DOWNLOADING" types out;
  - a progress bar fills on each hiker's card, then the resources pop in;
  - "ROUTE LOADED", and the "HAPPY TRAILS!" pop-up with data rain.
- **Reduced motion:** no shake, jitter, strobe or glitch slices, and fewer particles.

## 3. Sounds (chiptune and gadget, made in code in the prototype)
Use these, or real sounds in the same spirit:
- **Boot:** a rising square-wave arpeggio over a bass swell.
- **Scanning:**
  - **scan:** a rising sine sweep;
  - **spinning:** fast high square ticks;
  - **lock:** square beeps rising up a chord, reel by reel;
  - **tease:** accelerating Geiger ticks.
- **The battery:**
  - **a scan used:** a zap (a noise burst and a falling saw);
  - **a scan gained:** a charge (rising blips).
- **Wins:**
  - **a win:** an 8-note chiptune riff with a triangle bass and noise snares;
  - **the jackpot:** a 16-note fanfare with bass, drums and sparkle blips;
  - **Tier II:** a high arpeggio.
- **Screens:**
  - **a screen off:** a falling "pew";
  - **a screen on:** a rising hum and static.
- **Packing:** modem chirps.
- **No scans left:** an error buzz.

## 4. Things to flag to Wyatt
- **Type colors:** I brightened the game's own colors (orange, lime, peach, sky blue) so they stand out on green.
- **Size colors:** ×1 cyan, ×2 lime, ×3 pink, ×5 gold.
- **Words:** "scans" for respins, "offline", "REBOOT!" and "CACHE JACKPOT!" are my wording for this look.
- **The pixel squirrel** from Squirrel Theft is the mascot here. The cabinet keeps its drawn squirrel.
- **The background's darkness:** colors and the [0.8] dimmer are my guesses. Easy to tune.
