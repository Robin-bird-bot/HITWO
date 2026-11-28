# Update, November 28: Phase 12, the UI and sound

Phase 12 is the UI overhaul and the sound, together. **This replaces the November 27 sound-only update** (`phase-12a-sound`): its docs are here again, changed only where `32` says. Build on `main` (Phase 11 is merged).

## What's in this update
| File | What it is |
| --- | --- |
| `35-ui-overhaul.md` | **The UI spec:** four new settings, paper tags, party frames, the action wheel, using items from the pack, poster scavenging and the brush reveal, the workbench and recipe book (Paper and TrailMate looks), the night camp recap and party level-up, the title screen, loading screens and spotlight transitions. |
| `32-audio-system.md` | **The sound spec:** files, the engine and its buses, settings, ambience, the music player, the wiring rules (with the new UI sounds), the debug tab and tests. |
| `33-sound-list.md` | **Every sound** (342): when it plays, what it is, and whether it's made. Its "When it plays" column is where to hook each one up. |
| `34-music.md` | **The music plan:** 30 songs with Suno prompts, and how the game plays them. No music files yet; Wyatt is making them next. |
| `mockups/ui-overhaul/` | **The prototype** (`prototype/index.html`, serve the folder) and 27 screenshots. The table at the end of `35` says what each one is. |
| `art/ui-overhaul/` | The title logo (logo 4), the workbench top, the station doors, and Wyatt's stone square (reference for the Mountain brush cover only). |
| `audio/sfx/` | 410 sound files, each as `.ogg` and `.mp3`. |
| `audio/manifest.json` | Every sound id: its files, bus and status. |
| `tools/audio/` | The Python that made the sounds (optional; not part of the build). |

**Play first:** the prototype, https://claude.ai/artifact/7Qd1vr2PzS7YCtZaNLusvD, and the sound board, https://claude.ai/artifact/RyKcF15ft8Yyi49ZudQVLH.

## Wyatt's decisions
- **Settings, with these defaults:** the action wheel (side grid as a setting), deal and flip (brush as a setting), Paper crafting (TrailMate as a setting), and the Runner loading screen (Node wheel as a setting).
- **Title:** logo 4, his mint lettering grown over, for now. He'll rework it later.
- **No Eat and use action:** items are used by clicking them in the pack.
- **Auto-fill spends spare resources first.**
- **Several party frames can be open at once.**
- **No level-up star and no hiker motifs.**
- **Every night** shows the XP since the last night, the level-up when the bar fills, then a hiker picker into the skill trails.
- **The spotlight** is the main transition.
- **Music** will be made in Suno, inspired by Stardew Valley (its winter songs and the Secret Woods) and Undertale, with the Ranger Station, packing and hiker select wacky like Balatro.

## Suggested order (one PR each is fine)
1. **The audio engine, settings and debug tab** (`32`, sections 1 to 3 and 7), so everything can be heard.
2. **The sounds wired in** (`32`, section 6) and **ambience** (section 4).
3. **The four settings, the look and the party frames** (`35`, sections 1 to 3).
4. **The wheel and items from the pack** (`35`, section 4).
5. **Scavenging** (`35`, section 5).
6. **Crafting** (`35`, section 6).
7. **The night camp and level-ups** (`35`, section 7).
8. **The title, loading screens and transitions** (`35`, sections 8 to 10).
9. **The music player** (`32`, section 5), tested with a fake piece.

## Rules for this update
- **Numbers in [brackets]** are first guesses: put them in `balance.ts` (`audio` and `ui.overhaul` blocks) with `TODO(wyatt)`.
- **Ideas marked *(Claude's idea)*** are the design assistant's, not Wyatt's.
- **The prototype is for the look and the feel.** Its code is plain JavaScript with sample data; rebuild it in the game's React and engine, porting the drawing code (posters, brush covers, sprites) where `35` says so.
- **Sounds with no files** (`status: "need"`) stay silent until Wyatt's recordings arrive; wire them anyway.
- **"Not in this phase"** (`35`, section 11): leave those screens as they are, apart from their sounds.
- **"Things to flag to Wyatt"** (end of `32` and `35`): mention them in the PRs.
- **Copy the docs** into `docs/design/`, the mockups into `docs/mockups/ui-overhaul/`, the sounds into `public/assets/audio/`, and the art into `public/assets/` (a new `ui/` folder is fine; the stone square is reference only and goes with the mockups).
