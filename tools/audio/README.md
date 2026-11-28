# Sound tools

The game's sound effects are made in code. Python 3 with numpy and scipy, plus ffmpeg (with libvorbis and libmp3lame).

- `synth.py`: the toolkit (oscillators, noise, filters, wood, marimba, kalimba, bells, footsteps, reverb).
- `sounds.py`: every sound in the game: where it plays, what it is, and its recipe.
- `python3 render.py`: remakes every file into `out/` (wav, ogg, mp3) and writes `out/manifest.json`. `python3 render.py card. foot.` remakes only those ids.
- `python3 make_sound_md.py`: writes the sound list (`sound.md`) from `sounds.py`.
- `python3 build_board.py`: builds the sound board page (`board/`).
- `rec/CREDITS.md`: the recordings some sounds are cut from (Pixabay). The recordings themselves aren't in the repo (about 24 MB); the sounds made from them are already in `public/assets/audio/`. `render.py` needs them only for those ids, so without them remake just the ids you changed (`python3 render.py ui. card.`).

Copy the files in `out/ogg` and `out/mp3` to `public/assets/audio/sfx/`, and `out/manifest.json` to `public/assets/audio/`, after a change.
