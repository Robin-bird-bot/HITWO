"""Writes sound.md (the full list) from sounds.py."""
import json, sounds
from collections import OrderedDict
man = json.load(open('out/manifest.json'))['sounds']
LABEL = {'made': 'Made', 'placeholder': 'Placeholder', 'need': '**Needs a recording**', 'code': 'In code'}
areas = OrderedDict()
for e in sounds.S:
    areas.setdefault(e['area'], []).append(e)
n = {k: sum(1 for e in sounds.S if e['status'] == k) for k in LABEL}
files = sum(len(v['files']) for v in man.values())
out = []
out.append(f"""# Sound

Every sound the game needs: where it plays, what it sounds like, and whether it's made. **{len(sounds.S)} sounds** ({files} files, counting variations): **{n['made']} made**, **{n['placeholder']} placeholders** (made, but a real recording would be better), **{n['need']} that need a recording**, and **{n['code']} already in the game's code** (the packing machines). Listen to all of them on the sound board.

## How the sound works
- **Two families, like the art.** The trail side (menus, cards, the map) sounds organic: wood clicks, marimba, kalimba, paper, cloth. The TrailMate side (items, the packing machine, minigames) uses soft device bleeps.
- **Five volume groups:** Interface, Sound effects, Minigames, Ambience and Music. Settings gets a slider for Master, Music, Ambience and Sound effects (Interface and Minigames follow Sound effects).
- **Variations:** sounds that repeat a lot (footsteps, card deals, clicks) have 2 to 4 versions, picked at random, never the same one twice in a row, with a tiny random pitch change.
- **Ambience** is a loop per biome and time of day, plus layers for weather, rivers and fire, plus one-shots (birds, a woodpecker, an owl) scattered now and then.
- **Footsteps** follow the trail line (dirt, gravel, paved, steep, mud), snow while it snows, and the hiker's kind (boots, paws, plush).

## What I still need from Wyatt
Pixabay or Freesound (CC0) is perfect. I'll trim, level and convert them.
- **Animals (night events):** a fox scream, coyote yips, a hyena laugh, raccoon chitters (one set covers Raccoons and the Raccoon Gang).
- **Generic voices:** a man and a woman (a happy cheer, an "oof", a yawn), a dog (a happy bark, a whimper, a yawn) and a cat (a happy meow or trill, a hiss or yowl, a yawn). The plush voices are made (squeaky toys).
- **Optional nature one-shots:** an owl hooting, a single frog croak, a wolf howl, a few clear birdcalls, a small stream. These would replace the made placeholders.

Already in: the bear growl, leopard, eagle, chant, beer, laugh and hiccup, and nine nature recordings (all six biome beds, rain, wind and thunder). Credits are in rec/CREDITS.md.

## The list
""")
for a, es in areas.items():
    out.append(f"### {a}\n\n| Sound | When it plays | What it sounds like | Status |\n| --- | --- | --- | --- |")
    for e in es:
        v = f" ({e['variants']} versions)" if e['variants'] > 1 else ''
        lp = ' (loop)' if e['loop'] else ''
        sound = e['sound'] + (f" {e['note']}" if e.get('note') else '')
        out.append(f"| `{e['id']}`{v}{lp} | {e['when'].replace('|', '/')} | {sound.replace('|', '/')} | {LABEL[e['status']]} |")
    out.append('')
open('sound.md', 'w').write('\n'.join(out))
print(len('\n'.join(out)), 'chars')
