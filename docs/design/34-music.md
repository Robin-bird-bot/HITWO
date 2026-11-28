# Music

Every place in the game that needs music, in priority order, with a Suno prompt for each song. Wyatt (November 27, second pass): **made in Suno first**, inspired by **Stardew Valley and Undertale**, especially Stardew's winter songs and the Secret Woods ("In the Deep Woods"). A **cozy, earthy forest** feel with **orchestral touches** here and there, and **even the meadows should sound like they belong in the forest**. Intense minigames and Dodge lean **Undertale**; the Ranger Station, the packing machine and hiker select lean **wacky, like Balatro**. This replaces "mostly chiptune": chip sounds stay only as color (in minigames, the TrailMate and the slots). Ideas marked *(Claude's idea)* are mine.

## The sound of the music
- **The trail (map, title, summit):** acoustic and woody. Fingerpicked guitar, wooden flute, harp, marimba, celesta and music box, felt piano, pizzicato strings, upright bass, a French horn or a string swell when a moment is big. Background first: sparse, no drum kit on the map.
- **Winter colors** for the Alpine, nights and the eerie bits: slow felt piano, glassy synth pads, celesta, glass harmonica. Lonely but warm.
- **Secret Woods colors** for the Rainforest and anywhere hidden or ancient: mysterious and hushed, a little magical, like stepping off the trail into an old grove.
- **Minigames:** quirky indie-RPG energy. Acoustic instruments mixed with chiptune leads and arpeggios, punchy drums. Calm games stay acoustic.
- **Wacky places** (Ranger Station, packing machine, hiker select): a woozy, detuned, psychedelic lounge or casino groove, still cozy.
- **One theme** *(Claude's idea)*: a short, hopeful five-note "trail call" (D, F#, A, B, A) on the title screen, at the summit, and softly when a hike is over. Suno won't always follow notes, so treat it as a wish, not a rule.

## How to use the prompts in Suno
- **Custom mode, Instrumental on.** Paste **Style** into Style of Music, **Lyrics** into Lyrics (section tags only, no words), and **Exclude** into Exclude (under Advanced Options).
- **Style** leads with the genre and feel, then 3 or 4 instruments, then tempo, key and mood. Suno weights the first words most, and too many instruments blur together, so each prompt names only the ones that matter.
- **No names.** Suno ignores or refuses artist and game names, so the prompts describe the sound ("cozy forest folk", "quirky indie RPG battle", "psychedelic lounge") instead of naming Stardew, Undertale or Balatro.
- **Sliders, as a starting point:** Weirdness about 25% for the map and calm music, 45% for minigames, 65% for the wacky places. Style Influence about 75% for all of them.
- **Matching versions** (Day, Night, Rain and Snow of one biome; the two packing looks): make the main version first. When one sounds right, use **Cover** on it with the other version's Style, so the tune, tempo and chords carry over. The game crossfades between them while they play, so they need to line up.
- **Make 4 to 6 takes** of each and keep the best; Suno varies a lot between takes.
- **Send me what you make.** I'll trim the intros and endings, cut seamless loops, level them, and line up the versions, so length and loudness don't need to be exact.

## How the game plays them
- **Day and night:** each biome's versions play in sync and crossfade over [8 s] at dusk and dawn. Rain (and snow in the Alpine) swaps in the same way.
- **Wind and heat need no music** *(Claude's idea)*: wind adds a soft, breathy filter sweep to whatever is playing, and heat a slow, hazy pitch wobble.
- **Minigames:** in the last [10 s] of a clock, the music speeds up [6%] *(Claude's idea)*.
- **Ducking:** the music dips under stingers and while a window is open over the map. Birdsong has no music.

## Priority list

| # | Song | Where it plays | Why this order |
| --- | --- | --- | --- |
| **First** | | | |
| 1 | Meadow, Day | The map, the first biome | Heard the most: every run starts here. |
| 2 | Meadow, Night | The map at night | Half of every day on the map. |
| 3 | Quick Draw | Quick reaction minigames | Every challenge is a minigame, and this covers the most games. |
| 4 | Thinking Cap | Calm minigames | The next-biggest group. |
| 5 | Run For It | Movement games and Dodge | The third group, and the most exciting. |
| 6 | Trailhead | Title screen | The first thing Mom hears. |
| 7 | The Ranger Station | Ranger Stations | Visited every section. |
| **Next** | | | |
| 8 | Pick Your Party | Hiker select | Once per run, right after the title. |
| 9 | Squirrel Wheel Rag (TrailMate) | Packing, the default look | Once per run, a few minutes. |
| 10 | Briefing | The challenge pop-up | Before every challenge, but only for a moment. |
| 11–12 | Rainforest, Day and Night | The second biome | Only once a run gets that far. |
| 13–14 | Alpine, Day and Night | The last biome | The same. |
| 15 | The Summit | Winning a hike | Rare, but the biggest moment. |
| 16 | Pack It In | A hike that's over | Rare, short. |
| 17 | Big Trouble | Dodge bosses | Higher tiers only. |
| **Later** | | | |
| 18–20 | Meadow, Rainforest and Alpine, Rain | Rainy days | The rain ambience covers it until then. |
| 21–23 | Uninvited: Nuisance, Danger, Eerie | Night events | Short and occasional. |
| 24 | Wonder | A Wonder's window | Occasional. |
| 25 | Lights Out | Spooky Ghost! | One game. |
| 26 | Shell Game | Raccoon Shuffle | One game (Quick Draw until then). |
| 27 | Lumberjack Shanty | Fallen Branch | One game (Quick Draw until then). |
| 28 | Squirrel Wheel Rag (cabinet) | Packing, the cabinet look | Not the default look. |
| 29 | Pack Your Bags | Loading screens | Optional. |
| 30 | Alpine, Snow | Snowy days | Snow isn't in the game yet. |

## The prompts
Every prompt uses **Instrumental on** and adds **vocals, singing** to Exclude, even where it isn't listed.

### 1. Meadow, Day (first)
**Style**
```
Cozy forest folk video game music, sunny and peaceful, fingerpicked acoustic guitar, wooden flute melody, soft pizzicato strings, warm upright bass, light shaker, 84 BPM, G major, pastoral morning in the woods, earthy and gentle, sparse background music, instrumental
```
**Exclude:** vocals, singing, drum kit, electric guitar, synth bass

**Lyrics**
```
[Intro: fingerpicked guitar alone]
[Theme: wooden flute melody, pizzicato strings answer]
[Second theme: celesta joins, strings swell softly]
[Theme: flute and guitar, very sparse]
[End]
```

### 2. Meadow, Night (first)
Make it as a **Cover of Meadow, Day**.

**Style**
```
Cozy night forest video game music, sleepy and safe, soft felt piano, music box, warm string pad, faint wooden flute, 84 BPM, G major, starry sky over the campfire, intimate and calm, background music, instrumental
```
**Exclude:** vocals, singing, drums, percussion

### 3. Quick Draw (first)
**Style**
```
Bouncy indie RPG minigame music, playful and quick, chiptune square lead trading with plucky acoustic guitar, slap bass, snappy drums and woodblock, 140 BPM, C major, cheeky and catchy, fun pressure, never stressful, instrumental
```
**Exclude:** vocals, singing, heavy metal, EDM drop

**Lyrics**
```
[Intro: drums and slap bass]
[Hook: chiptune lead, catchy two-bar riff]
[Verse: acoustic guitar answers the lead]
[Breakdown: bass and woodblock only]
[Hook]
[End]
```

### 4. Thinking Cap (first)
**Style**
```
Gentle puzzle video game music, curious and thoughtful, marimba and pizzicato strings, soft clarinet melody, light ticking woodblock, 92 BPM, F major, cozy and focused, a rainy afternoon in a cabin, background music, instrumental
```
**Exclude:** vocals, singing, drum kit, electric guitar

**Lyrics**
```
[Intro: marimba]
[Theme A: clarinet melody over marimba and pizzicato]
[Theme B: celesta and strings, a small lift]
[Theme A]
[End]
```

### 5. Run For It (first)
**Style**
```
Energetic indie RPG chase music, urgent but fun, driving chiptune arpeggios over fiddle and strummed acoustic guitar, punchy drums, pulsing synth bass, 160 BPM, E minor, heroic forest chase, adventurous, instrumental
```
**Exclude:** vocals, singing, dubstep, metal screams

**Lyrics**
```
[Intro: arpeggio and drums]
[Chase: fiddle melody, chiptune arpeggios]
[Build: strings rise, drum fill]
[Chase: full band]
[End]
```

### 6. Trailhead (first)
**Style**
```
Cozy forest adventure title theme, warm and hopeful, fingerpicked acoustic guitar, wooden flute, soft orchestral strings, French horn swell, celesta sparkles, 88 BPM, D major, nostalgic sunset at a trailhead, gentle and cinematic, video game main menu, instrumental
```
**Exclude:** vocals, singing, drum kit, electric guitar

**Lyrics**
```
[Intro: guitar and celesta]
[Theme: wooden flute plays a hopeful five-note motif, D F# A B A]
[Swell: strings and French horn carry the motif]
[Quiet: guitar alone]
[End]
```

### 7. The Ranger Station (first)
**Style**
```
Psychedelic lounge funk shop music, quirky and cozy, woozy detuned synth lead with tape wobble, warm Rhodes electric piano, rubbery bass, brushed drums, nylon guitar and kalimba, 98 BPM, A minor, groovy, strange but homey, a cabin with a fireplace, video game shop theme, instrumental
```
**Exclude:** vocals, singing, rap, EDM drop

**Lyrics**
```
[Intro: Rhodes chords and bass]
[Groove: woozy synth lead, kalimba fills]
[Bridge: nylon guitar solo, warmer major chords]
[Groove]
[End]
```

### 8. Pick Your Party (next)
**Style**
```
Quirky jazzy character select music, upbeat and whimsical, walking upright bass, brushed swing drums, vibraphone, wonky detuned synth lead, finger snaps, 120 BPM swing, B-flat major, choosing your crew, playful and a little weird, video game menu music, instrumental
```
**Exclude:** vocals, singing, scat, rap

**Lyrics**
```
[Intro: bass and snaps]
[Theme: vibraphone melody, wonky synth answers]
[Solo: detuned synth, swing drums]
[Theme]
[End]
```

### 9. Squirrel Wheel Rag, TrailMate (next)
**Style**
```
Woozy psychedelic casino groove, hypnotic and playful, detuned synth lead, honky-tonk piano, walking bass, swing drums, chiptune blips, 112 BPM swing, F major, slot machine fever with a wink, quirky video game music, instrumental
```
**Exclude:** vocals, singing, EDM drop

Keep the middle of the mix light, since the machine makes a lot of noise.

### 10. Briefing (next)
**Style**
```
Suspenseful video game prep music, curious and a little tense, pizzicato string ostinato, soft timpani heartbeat, low clarinet, ticking woodblock, 100 BPM, D minor, ready set go, short loop, instrumental
```
**Exclude:** vocals, singing, drum kit, big melody

### 11. Rainforest, Day (next)
**Style**
```
Mysterious hidden forest grove video game music, secret woods, damp and curious, harp arpeggios, soft wooden flute, marimba like dripping water, low string drone, 72 BPM in 6/8, E Dorian, ancient ferns and fog, calm wonder, background music, instrumental
```
**Exclude:** vocals, singing, drum kit, electric guitar

### 12. Rainforest, Night (next)
Make it as a **Cover of Rainforest, Day**.

**Style**
```
Deep night in a secret forest grove, still and magical, music box, soft glassy synth pad, low cello drone, faint harp, 72 BPM in 6/8, E Dorian, fireflies in tall trees, hushed, background music, instrumental
```
**Exclude:** vocals, singing, drums, percussion

### 13. Alpine, Day (next)
**Style**
```
Melancholic winter mountain video game music, lonely and beautiful, soft felt piano, glassy synth pad, celesta, distant French horn, 64 BPM, A minor lifting to C major, cold air and high peaks, slow and spacious, background music, instrumental
```
**Exclude:** vocals, singing, drums, percussion

**Lyrics**
```
[Intro: felt piano alone]
[Theme: piano melody, glassy pad]
[Lift: French horn, far away, C major]
[Theme: celesta and piano]
[End]
```

### 14. Alpine, Night (next)
Make it as a **Cover of Alpine, Day**.

**Style**
```
Frozen starlit night music, hushed and tender, music box, soft felt piano, airy string pad, glass harmonica, 64 BPM, A minor, cold but peaceful, background music, instrumental
```
**Exclude:** vocals, singing, drums, percussion

### 15. The Summit (next)
**Style**
```
Triumphant cozy orchestral finale, joyful and moving, full strings, French horn, wooden flute, acoustic guitar, timpani and cymbal swells, 96 BPM, D major, reaching the summit at sunrise, tears of joy, video game victory theme, instrumental
```
**Exclude:** vocals, singing, rock drums, electric guitar

**Lyrics**
```
[Intro: strings build]
[Theme: French horn plays the trail call, D F# A B A, big and proud]
[Memory: gentle flute and guitar]
[Finale: full orchestra]
[Outro: soft guitar, happy]
[End]
```

### 16. Pack It In (next)
**Style**
```
Bittersweet folk lullaby, gentle and kind, solo fingerpicked guitar, soft felt piano, cello, 66 BPM, D minor resolving to D major, walking home at dusk, try again tomorrow, short, instrumental
```
**Exclude:** vocals, singing, drums

About 45 seconds with a real ending; this one doesn't loop.

### 17. Big Trouble (next)
**Style**
```
Intense indie RPG boss battle music, dramatic with a wink, crunchy chiptune lead, driving rock drums, distorted synth bass, staccato strings, brass stabs, 172 BPM, C minor, a bear with a sword, epic and a little silly, instrumental
```
**Exclude:** vocals, singing, screaming

**Lyrics**
```
[Intro: four big brass hits]
[Battle: chiptune lead, staccato strings]
[Break: drums and bass only]
[Battle: full]
[End]
```

### 18–20. Rain: Meadow, Rainforest, Alpine (later)
Make each as a **Cover of that biome's Day song**.

**Style**
```
Rainy day version, cozy and a little sad, muted felt piano, soft strings, gentle tape warmth, the same melody played slower-feeling and sparser, heard from inside a tent, background music, instrumental
```
**Exclude:** vocals, singing, drums, percussion

### 21. Uninvited, Nuisance (later)
**Style**
```
Sneaky cartoon heist music, mischievous and silly, pizzicato strings, bassoon, tiptoe woodblock, muted trumpet wah-wah, 104 BPM, F minor, raccoons raiding the camp, instrumental
```
**Exclude:** vocals, singing, drum kit

### 22. Uninvited, Danger (later)
**Style**
```
Tense night forest music, low and creeping, cello ostinato, soft timpani rolls, low brass swells, heartbeat kick, 90 BPM, D minor, wolves in the dark, scary but survivable, instrumental
```
**Exclude:** vocals, singing, horror screams, jump scare

### 23. Uninvited, Eerie (later)
**Style**
```
Eerie campfire story music, strange and spooky but family friendly, glass harmonica, detuned music box, low drone, reversed swells, slow and beatless, cultists in the woods, instrumental
```
**Exclude:** vocals, singing, chanting words, drums

### 24. Wonder (later)
**Style**
```
Awe-filled discovery music, glowing and majestic, harp glissando, celesta, warm string pad, slow noble French horn melody, 60 BPM in 3/4, E major, sunlight breaking through clouds over a waterfall, instrumental
```
**Exclude:** vocals, singing, choir, drums

### 25. Lights Out (later)
**Style**
```
Spooky-cute haunted cabin waltz, playful and nervous, music box, theremin-like synth, pizzicato strings, soft heartbeat, 72 BPM in 3/4, B minor, friendly ghosts and a flashlight, instrumental
```
**Exclude:** vocals, singing, horror, screams

### 26. Shell Game (later)
**Style**
```
Shifty carnival waltz, playful and sly, calliope organ, oom-pah tuba, tambourine, chiptune blips, 138 BPM in 3/4, A minor, a raccoon running a street hustle, instrumental
```
**Exclude:** vocals, singing

### 27. Lumberjack Shanty (later)
**Style**
```
Stomping lumberjack work song, hearty and steady, fiddle, accordion, banjo, foot stomps and claps on every beat, 76 BPM in 2/4, D major, sawing a log in rhythm, instrumental
```
**Exclude:** vocals, singing, shouting

### 28. Squirrel Wheel Rag, cabinet (later)
Make it as a **Cover of Squirrel Wheel Rag, TrailMate**.

**Style**
```
Old-timey ragtime, cheeky and bouncy, honky-tonk upright piano, banjo, tuba, washboard, slide whistle, 112 BPM, F major, county fair slot machine, a little dusty, instrumental
```
**Exclude:** vocals, singing, synth

### 29. Pack Your Bags (later)
**Style**
```
Calm loading screen music, gentle fingerpicked acoustic guitar and celesta, soft and simple, 84 BPM, D major, a breath between scenes, short loop, instrumental
```
**Exclude:** vocals, singing, drums

### 30. Alpine, Snow (later)
Make it as a **Cover of Alpine, Day**.

**Style**
```
Snowy day version, hushed and glittering, sparkling celesta, sleigh-bell shimmer, airy strings, soft felt piano, the world gone quiet, background music, instrumental
```
**Exclude:** vocals, singing, drums

## Stingers
Short one-shots on top of the music. My placeholders are in the game and on the sound board; Suno isn't great at 2-second clips, so these can stay as they are.

| Stinger | Length | What it is now |
| --- | --- | --- |
| Level up | 3 s | Marimba and glockenspiel climbing to a bright chord. |
| Challenge passed | 2 s | A chip fanfare. |
| Challenge failed | 2 s | A chip phrase falling. |
| Checkpoint | 5 s | A handbell and a warm chord. |
| Sunrise | 4 s | A soft swell and glockenspiel twinkles. |
| Nightfall | 4 s | A low, warm chime. |
| Hike start | 3 s | A trail whistle and boots setting off. |
| Wonder found | 3 s | An awe chord swelling. |
