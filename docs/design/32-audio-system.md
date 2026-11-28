# Phase 12: sound

Wyatt (November 27 and 28): Phase 12 is the UI and sound together. This doc is the sound half: an audio engine, **342 sounds** (412 files: 309 made, 11 placeholders, 17 that need recordings, 5 already in the code), the wiring for every sound in the game, the ambience, and the music player (the music itself comes next, from Suno; its prompts are in `34-music.md`). The UI half is `35-ui-overhaul.md`.

- **What every sound is and when it plays:** `33-sound-list.md`. Its "When it plays" column is the spec for wiring. (The same list is the Sound tab of the design doc.)
- **The music plan:** `34-music.md`.
- **Listen to every sound:** Wyatt's sound board, https://claude.ai/artifact/RyKcF15ft8Yyi49ZudQVLH
- **The files:** `audio/sfx/` (an `.ogg` and an `.mp3` of each) and `audio/manifest.json`.
- **How they were made:** `tools/audio/` (Python; optional, not part of the build). `render.py` remakes every file from `sounds.py`. The recordings it trims are in `tools/audio/rec/`, with `CREDITS.md`.

Numbers in [brackets] are first guesses: put them in `balance.ts` (an `audio` block) with `TODO(wyatt)`. Ideas marked *(Claude's idea)* are mine.

**Changed since the sound-only draft (November 27):** the hiker motifs are gone (Wyatt); 32 sounds were added for the new UI (section 6, "The new UI"); the music is now made in Suno as whole songs with matching versions instead of stems (section 5).

---

## 1. Files
- **Copy** `audio/sfx/*` to `public/assets/audio/sfx/` and `audio/manifest.json` to `public/assets/audio/manifest.json`.
- **Copy** `tools/audio/` to `tools/audio/` (with a one-line README: "Python 3, numpy, scipy, ffmpeg; `python3 render.py` remakes the sounds").
- **The manifest:** `{ version, formats, base, sounds: { "<id>": { files, bus, status, loop?, volume? } } }`.
  - `files` are base names: add `.ogg` or `.mp3`.
  - Several files mean versions of one sound.
  - Ids with `status: "need"` have no files yet. Playing them does nothing; when Wyatt sends the recordings, they just get files.
  - `status: "code"` is the packing machines' synth, which stays in code.
- **Formats:** use `.ogg`. Fall back to `.mp3` when `new Audio().canPlayType('audio/ogg; codecs="vorbis"')` is empty (older Safari).
- **Levels are already set in the files:** quiet sounds are mastered quiet, stingers louder. Play them at 1.0 unless the manifest says `volume`.

## 2. The engine (`src/audio/`)
- **One `AudioContext`,** created on the first click or key (browsers need a gesture) and resumed if suspended. Suspend it while the tab is hidden; resume when it's back.
- **Buses** (gain nodes into a master gain):

| Bus | What's on it |
| --- | --- |
| `ui` | menus, windows, hiker select, the new frames, wheel, book and transitions |
| `sfx` | everything in the game world (cards, items, map, actions, the station) |
| `minigame` | the shared minigame sounds and each game's own |
| `ambience` | the biome loops, layers and one-shots |
| `music` | music |

- **The packing machines' synth** (`src/ui/packing/synth.ts`) uses this context and connects to the `sfx` bus instead of `destination`.
- **Loading:**
  - decode files into `AudioBuffer`s and cache them;
  - at the title screen, preload the small, common sounds (every id starting `ui.`, `select.`, `card.`, `res.`, `item.`, `stat.`, `cond.`, `map.`, `foot.`, `act.`, `day.`, `chal.`, `mg.`, `book.`, `craft.`, `scav.`, `trans.`, `load.`, `title.`; about 2 MB);
  - when the trail starts or the biome changes, preload that biome's ambience (on the loading screen, `35`, section 9);
  - when a challenge opens, preload that game's own sounds;
  - load the station's when the party arrives at one.
- **The API:**
  - `sfx(id, { volume?, pan?, rate?, delay? })` plays a one-shot and returns a handle with `stop()`;
  - `loop(id, { fadeIn? })` returns a handle with `fadeOut(seconds)`;
  - an id with no files does nothing (log it once in dev builds).
- **Versions:** pick one at random, never the same one twice in a row.
- **Jitter:** a random pitch change of ±[3%] on sounds with versions and on footsteps; ±[1 dB] of volume. No jitter on sounds that set their own `rate` (the XP ticks and the bench clacks climb in pitch on purpose).
- **Limits:**
  - at most [3] of the same id at once ([2] for footsteps, [4] for ticks and brushing), stopping the oldest;
  - at most [24] sounds at once in all;
  - the same id can't start twice within [30 ms]. Several cards flipping together are spread out by the animations anyway.

## 3. Settings
- **In the ☰ menu's settings,** a Sound section:
  - sliders for Master [0.8], Music [0.6], Ambience [0.7] and Sound effects [0.8] (the effects slider sets `ui`, `sfx` and `minigame`);
  - a Mute switch.
- **Saved** per device with `deviceSetting`, like the other settings (and the four new look settings in `35`, section 1).
- **Dragging the Sound effects slider** plays `ui.slider` at the new level.
- **The packing screen's sound button** becomes the same Mute switch.

## 4. Ambience
- **The bed:** `amb.<biome>.<day|night>` loops all the time on the map (Meadow, Rainforest, Alpine). It crossfades over [6 s] when night falls and when morning comes.
- **Layers** (each fades in and out over [3 s]):
  - **weather:** `amb.rain`, `amb.wind`, `amb.snow`, or `amb.heat` (by day only);
  - **river:** `amb.river`, while the selected hiker is on a tile with a River node;
  - **fire:** `amb.fire`, at night when someone sits by the fire, on a campsite tile, and under the night camp recap (`35`, section 7).
- **One-shots,** played now and then at random, panned ±[0.8], volume [0.4–1.0]:

| When | Every | Picks from |
| --- | --- | --- |
| Day, Meadow | [6–14 s] | `amb.bird`, `amb.twig` |
| Day, Rainforest | [5–12 s] | `amb.bird`, `amb.woodpecker`, `amb.frog`, `amb.twig` |
| Day, Alpine | [12–25 s] | `amb.bird`, `amb.twig` |
| Night, any | [10–25 s] | `amb.owl`, `amb.twig` (and `amb.frog` in the Rainforest) |
| Night, Alpine | about once every [4 min] | `amb.wolfFar` |
| Rain | [40–120 s] | `weather.thunder` |

- **Other places:**
  - the title screen plays `amb.title`;
  - the Ranger Station replaces the bed with `amb.station`;
  - minigames duck the ambience to [30%];
  - windows over the map leave it alone;
  - loading screens keep whatever was playing, faded to [50%].

## 5. Music (the player now, the songs next)
Build the player now so songs can drop in as Wyatt makes them (`34-music.md`). Until there are files, it plays nothing.

The songs come from Suno as **whole songs**, not stems. A biome's Day, Night, Rain and Snow are separate **versions** of one song, made with Suno's Cover so they share the tune, tempo and chords; I trim them to the same loop length so they line up.
- **States:** title, select, packing, loading, trail, station, wonder, briefing, minigame, night event, summit, over.
- **Versions in sync:** a piece has `bpm`, `beatsPerBar`, `bars` and named versions (`day`, `night`, `rain`, `snow` for the biomes; `trailmate` and `cabinet` for packing). All of a piece's versions start together and loop on the same length; the player only changes their volumes.
- **Changes:**
  - inside a piece (day ↔ night ↔ rain or snow), crossfade the versions ([8 s] at dusk and dawn, [4 s] for weather);
  - between pieces, crossfade over [2 s], starting the new one on the next bar line.
- **Wind and heat** *(Claude's idea)*: no versions. Wind sweeps a soft low-pass filter on the music bus ([1200–4000 Hz], over [6 s]); heat adds a slow pitch wobble ([±8 cents], [0.2 Hz]).
- **Minigame hurry** *(Claude's idea)*: in the last [10 s] of a clock, the music's playback rate rises to [1.06].
- **Ducking:** [−3 dB] while a window is open over the map, [−6 dB] under stingers (`levelUp`, `mg.passed`, `mg.failed`, `map.checkpoint`, `day.morning`, `day.night`, `hike.start`, `wonder.open`).
- **A music manifest** at `public/assets/audio/music/manifest.json`: `{ pieces: { "<id>": { bpm, beatsPerBar, bars, versions: { "<version>": "<file>" } } } }`. The piece ids:

| Id | Song in `34` | Versions |
| --- | --- | --- |
| `meadow`, `rainforest`, `alpine` | 1–2, 11–14, 18–20, 30 | `day`, `night`, `rain` (+ `snow` for `alpine`) |
| `quickDraw`, `thinkingCap`, `runForIt` | 3–5 | one |
| `title` | 6 Trailhead | one |
| `station` | 7 | one |
| `select` | 8 Pick Your Party | one |
| `packing` | 9 and 28 Squirrel Wheel Rag | `trailmate`, `cabinet` (by the packing look) |
| `briefing`, `summit`, `over`, `bigTrouble`, `wonder` | 10, 15, 16, 17, 24 | one |
| `nightNuisance`, `nightDanger`, `nightEerie` | 21–23 Uninvited | one |
| `lightsOut`, `shellGame`, `shanty` | 25–27 (one game each) | one |
| `loading` | 29 Pack Your Bags | one |

Which minigame plays which piece is in `34`'s "Where it plays". A game with no piece of its own uses its group's (Shell Game falls back to `quickDraw`, and so on).

## 6. Wiring
`33-sound-list.md` says where every sound plays. Notes on the ones with rules:
- **Footsteps,** while a hiker's token moves along a line:
  - one step every [300 ms] for people, [200 ms] for dogs and cats, [340 ms] for plush;
  - the surface comes from the line: normal → `foot.dirt`, rough → `foot.gravel`, paved → `foot.paved`, steep → `foot.steep`, muddy → `foot.mud`;
  - while it snows, people use `foot.snow`;
  - dogs use `foot.paw`, or `foot.pawHard` on paved and rough lines; cats use `foot.paw` at [60%]; plush hikers use `foot.plush` everywhere;
  - pan by the token's place on screen, from −[0.6] at the left edge to +[0.6] at the right.
- **Resources:** `res.<category>` for each resource gained (the five categories in `resources.ts`). At most [3] per action, [70 ms] apart.
- **Caps:** `res.caps` when caps arrive, `res.capsSpend` when they're spent, `station.buy` and `station.sell` at the counter.
- **Stats:**
  - `stat.energyUp`, `stat.appetiteUp`, `stat.moraleUp` and `stat.down` when an action changes a stat (once per action, not per point);
  - `stat.low` when a hiker drops into Fatigued, Hungry, low Morale or low Stuffing (`thresholds.ts`), not every time after.
- **No hiker motifs** (Wyatt). Picking a hiker plays `map.select` (on the map) or `select.add` (on hiker select): a plain wooden pick-up click.
- **The new UI** (`35-ui-overhaul.md`; all in the "Phase 12 UI" table of `33`):

| Id | Where |
| --- | --- |
| `ui.frameOpen`, `ui.frameClose` | A party frame opens or closes (`35`, section 3). |
| `ui.wheelOpen`, `ui.wheelClose` | The action wheel pops open or shuts (section 4). |
| `ui.star`, `ui.unstar` | Starring a recipe or resource (section 6). |
| `book.page` | A recipe book tab, and opening the book from Looking for. |
| `craft.slot` | A resource lands in a bench slot. Play at rate `1 + 0.06 × slot index`, so each clack is a step higher. |
| `craft.ghost` | A ghost slot appears (a missing resource). |
| `craft.clear` | Clear, or taking everything off the bench. |
| `craft.ready` | The bench is full and Craft starts to pulse. |
| `scav.brush.<node>` | While brushing a cover (section 5), one every [110 ms] of movement, by the card's node. |
| `scav.uncover` | A cover blows away. |
| `card.reveal.<rarity>` | A card flips: `card.flip`, then, [90 ms] apart, one chime per rarity step up to its own (Uncommon plays `uncommon`; Rare plays `uncommon` then `rare`; and so on up to `mythic`). Common plays only the flip. |
| `card.wanted` | A flipped card that a starred recipe needs (its NEEDED ribbon). |
| `xp.gain` | Each XP ticking into the party bar at night (section 7). Rate `1 + 0.35 × fill`, so it rises as the bar fills. |
| `levelUp` | PARTY LEVEL N! stamps on. |
| `trans.irisIn`, `trans.irisOut` | The spotlight closing and opening (section 10). |
| `trans.door` | The station doors swing open. |
| `load.jump` | The loading-screen runner jumps (section 9). |
| `title.logo` | The logo lands on the title screen (section 8). |

- **The minigame hooks** (`src/ui/minigames/sound.ts`) map to files:
  - `place` → `mg.place`, `ready` → `mg.ready`, `bearUp` → `mg.bearUp`, `pop` → `mg.pop`, `hit` → `mg.hit`, `miss` → `mg.miss`;
  - `tick` → `mg.tick`, version 1 to 5 for 5 to 1 seconds left;
  - `note` → `mg.note1` to `mg.note6`: add the note's index to the hook (`playSound('note', 3)`).
  - The pop-up's demo stays silent (`muteSounds`).
  - Replace the hook's "Phase 16" comments: this is it.
- **The shared minigame flow:** `chal.start` on Play, then `mg.count` three times and `mg.go`; `mg.turn` on each hiker's turn; `mg.tick` in the last 5 seconds of any clock; `mg.timeUp`; `mg.hikerPassed` or `mg.hikerFailed`; on the end screen `mg.passed` or `mg.failed`, then `mg.stamp` as the stamp lands; `mg.punish` when the punishment applies.
- **Each game's own sounds:** the Minigame signatures table. Loops (`fly.buzz`, `bear.snore`, `dodge.bees`, `dodge.ants`, `train.crossing`, `trails.offTrail`, `ghost.heartbeat`) play with `loop()` while their thing is on screen.
- **Night events:** `night.nuisance`, `night.danger` or `night.eerie` when the event opens (the groups are in the list); then, [0.6 s] later, the creature's own sound if it has a file. `night.good` or `night.bad` at the end.
- **The challenge card:** `map.challengeLand` when the hiker arrives, then `card.challenge` as the card slides in.
- **Packing:** the machines keep their code sounds (now on the `sfx` bus); `res.bundleBurst` when the bundles burst; `hike.start` as the map appears.
- **The infoboard:** `infoboard.clink` where `InfoboardWindow.tsx` says "The clink waits for the game's audio".
- **The end:** `hike.summit` or `hike.over`, and `hike.tally` for each point counted.

## 7. The debug panel
A Sound tab:
- every id with a play button (and its versions), filtered by search;
- how many sounds are playing, and the ambience state (bed, layers) and music state (piece, version);
- a switch to log every `sfx()` call.

## 8. Tests
- **Files:** every id in the manifest with files has both an `.ogg` and an `.mp3`; every id the code plays is in the manifest; no `motif.` ids are played.
- **Versions:** the picker never repeats the last version.
- **Limits:** the per-id and total limits stop the oldest sound.
- **Footsteps:** each line kind, the snow rule and each family pick the right id.
- **Reveal chimes:** each rarity plays the right chimes in order (Common none, Mythic five).
- **Ambience:** the bed and layers for each biome, time of day and weather; the river layer follows the selected hiker's tile.
- **Hooks:** every `MinigameSound` maps to an id; the demo stays silent.
- **Music:** with a fake piece, versions start together, a crossfade only changes volumes, and a piece change waits for the bar line.

## 9. Things to flag to Wyatt
- **Hover sounds** are on buttons only (cards and tiles would get noisy).
- **17 sounds need recordings** (animals and voices); 11 are placeholders that a recording would improve. The list is on the sound board and in the Sound tab.
- **Wind and heat change the music** with a filter and a wobble instead of their own versions, and **minigame music speeds up** at the end of a clock: both are my ideas.
- **The family voices** (an optional idea) would need a new hook on big moments; skip them until there are recordings.
