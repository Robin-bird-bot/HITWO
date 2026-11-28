"""Every sound in Hike in the Woods: where it plays, what it is, and (when it can be
made in code) the recipe. `render.py` turns this into files, the sound board and
the tables in the docs.

status:
  made         made here, ready to use
  placeholder  made here so the game isn't silent, but a real recording would be better
  need         Wyatt provides it (a recording); no file yet
  code         already in the game, made in code (the packing machines)
level: how loud it's mastered: soft (hover, ticks), normal, loud (stingers), bed (loops)
"""
import numpy as np
from synth import *  # noqa

S = []  # the catalog

import os
from fractions import Fraction
from scipy.io import wavfile
from scipy.signal import resample_poly
REC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rec')
PIX = 'From Pixabay ({}), Pixabay Content License.'


def rec(name, a=0.0, b=None, speed=1.0, fin=0.004, fout=0.05, wet=0.0, t60=1.2, lowpass=None):
    """A clip of one of Wyatt's recordings: trimmed, sped up or slowed (which also changes the pitch), faded."""
    path = os.path.join(REC, name + '.wav')
    if os.path.exists(path):
        sr, x = wavfile.read(path)
        x = x.astype(float) / 32768
    else:  # an mp3 clip: decode with ffmpeg
        import subprocess
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', os.path.join(REC, name + '.mp3'), '-f', 's16le', '-ac', '2', '-ar', '44100', '-'],
                             capture_output=True, check=True).stdout
        sr, x = 44100, np.frombuffer(raw, np.int16).reshape(-1, 2).astype(float) / 32768
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = x[int(a * sr): int(b * sr) if b else None]
    if speed != 1.0:
        fr = Fraction(1 / speed).limit_denominator(64)
        x = resample_poly(x, fr.numerator, fr.denominator, axis=0)
    x = fade(x, fin, fout)
    if lowpass:
        x = lp(x, lowpass)
    if wet:
        x = verb(x, t60, wet)
    return x


def snd(id, area, when, sound, status='made', level='normal', variants=1, loop=0, bus='sfx', fn=None, note=None):
    S.append(dict(id=id, area=area, when=when, sound=sound, status=status, level=level, variants=variants,
                  loop=loop, bus=bus, fn=fn, note=note))


def V(v, *opts):
    return opts[v % len(opts)]


# ═════════════════════════════════════════════════════════════════ MENUS ═══
A = 'Menus and windows'
snd('ui.hover', A, 'The pointer moves onto a button (buttons only, not cards or tiles).',
    'A tiny, soft wooden tick.', level='soft', variants=2, bus='ui',
    fn=lambda v: wood(V(v, 2400, 2600), 0.06, 0.4) * 0.6)
snd('ui.click', A, 'Any button or menu item is pressed.',
    'A short wooden click, like a pencil tapped on a desk.', variants=3, bus='ui',
    fn=lambda v: mix(wood(V(v, 1300, 1380, 1250), 0.12), burst(0.01, 3000, 9000, 0.002) * 0.4))
snd('ui.confirm', A, 'OK, Done, Take, Buy: a choice is made.',
    'Two marimba notes going up (C, then G).', bus='ui',
    fn=lambda v: tones(lambda m: marimba(m, 0.7), [72, 79], 0.08))
snd('ui.cancel', A, 'Cancel, Back, closing a choice without picking.',
    'Two soft marimba notes going down.', bus='ui',
    fn=lambda v: tones(lambda m: marimba(m, 0.6, 0.5) * 0.8, [74, 67], 0.08))
snd('ui.error', A, "Something can't be done (not enough caps, can't move there).",
    'A muffled low double "bonk", a little out of tune.', bus='ui',
    fn=lambda v: mix(wood(330, 0.15, 0.4), (wood(311, 0.15, 0.4), 0.11)))
snd('ui.windowOpen', A, 'A window opens (scavenge, crafting, the station counter, traits, the infoboard).',
    'A poster unrolling: a quick paper swish up and a soft thump.', bus='ui',
    fn=lambda v: mix(whoosh(0.28, 500, 3500, 1.0) * 0.8, (thump(90, 0.15, 0.04) * 0.5, 0.2), (grains(0.2, 120, 2500, 8000, amp=(0.1, 0.4)), 0.02)))
snd('ui.windowClose', A, 'A window closes.',
    'The same paper swish going down, ending in a light tap.', bus='ui',
    fn=lambda v: mix(whoosh(0.22, 3000, 600, 1.0, peak=0.4) * 0.7, (wood(700, 0.08, 0.5) * 0.4, 0.18)))
snd('ui.tab', A, 'Switching tabs in a window.',
    'A quick paper flick.', level='soft', bus='ui', variants=2,
    fn=lambda v: mix(burst(0.05, 2500, 9000, 0.012), (wood(V(v, 1800, 1950), 0.05, 0.3) * 0.3, 0.005)))
snd('ui.toggleOn', A, 'A setting is switched on.',
    'A switch clicking up: two quick clicks, the second higher.', bus='ui',
    fn=lambda v: mix(wood(1500, 0.06, 0.7), (wood(2100, 0.06, 0.7), 0.045)))
snd('ui.toggleOff', A, 'A setting is switched off.',
    'The same clicks going down.', bus='ui',
    fn=lambda v: mix(wood(2100, 0.06, 0.7), (wood(1500, 0.06, 0.7), 0.045)))
snd('ui.slider', A, 'Dragging a slider (it also plays at the new volume, so you hear the level).',
    'A small tick per step.', level='soft', bus='ui',
    fn=lambda v: chip(84, 0.03, 0.5, vol=0.6))
snd('ui.toast', A, 'A note pops up (a trait worked, "Family Cookbook: no Energy").',
    'One kalimba note and its fifth, light.', bus='ui',
    fn=lambda v: mix(kalimba(79, 0.9), (kalimba(86, 0.7) * 0.5, 0.06)))
snd('ui.dragPick', A, 'Picking up something to drag (a resource, an item, a hiker on the map).',
    'A soft lift: a tiny rising swish and a tick.', level='soft', bus='ui',
    fn=lambda v: mix(whoosh(0.1, 900, 2500, 1.2) * 0.6, wood(1700, 0.05, 0.5) * 0.4))
snd('ui.dragDrop', A, 'Dropping it somewhere it can go.',
    'A soft place: a small thud and a tick.', bus='ui',
    fn=lambda v: mix(thump(120, 0.1, 0.03) * 0.6, wood(1100, 0.08, 0.6) * 0.6))
snd('ui.dragNo', A, "Dropping it somewhere it can't go (it slides back).",
    'A soft, short buzz.', bus='ui',
    fn=lambda v: chip(50, 0.14, 0.5, vol=0.5, soft=1500))
snd('ui.endPhase', A, 'The End Phase button.',
    'A deeper wooden knock with a little chime on top.', bus='ui',
    fn=lambda v: mix(wood(520, 0.2), (kalimba(76, 0.8) * 0.4, 0.03)))
snd('ui.settings', A, 'The settings or pause menu opens.',
    'A drawer sliding open (soft wood scrape and click).', bus='ui',
    fn=lambda v: mix(bp(pink(0.25), 300, 1800) * swell(0.25, 0.5) * 0.5, (wood(900, 0.08) * 0.5, 0.24)))

# ═══════════════════════════════════════════════════════ TITLE AND SELECT ═══
A = 'Title and hiker select'
snd('title.start', A, 'New hike or Continue on the title screen.',
    'A bright marimba run up, C-E-G-C, with a glockenspiel on the top note.', level='loud', bus='ui',
    fn=lambda v: mix(tones(lambda m: marimba(m, 0.8), [60, 64, 67, 72], 0.07), (glock(84, 1.4) * 0.35, 0.21)))
snd('select.add', A, 'A hiker joins the party on hiker select.',
    'A card snap and two bright kalimba notes going up.', bus='ui',
    fn=lambda v: mix(burst(0.03, 2000, 9000, 0.006) * 0.6, (kalimba(76, 0.8), 0.02), (kalimba(83, 0.8) * 0.8, 0.1)))
snd('select.remove', A, 'A hiker leaves the party.',
    'A card slid back into the deck: a swish down.', bus='ui',
    fn=lambda v: whoosh(0.2, 2500, 700, 1.0, peak=0.35) * 0.7)
snd('select.flip', A, "Flipping a hiker card to see the back.",
    'A card flip: a snap and a short swish.', bus='ui',
    fn=lambda v: mix(burst(0.025, 2500, 9000, 0.004), (whoosh(0.12, 1500, 4000, 1.0) * 0.5, 0.01)))
snd('select.sort', A, 'Sorting the hiker cards (the ribbons).',
    'A short shuffle of cards.', bus='ui',
    fn=lambda v: grains(0.35, 70, 2000, 8000, (0.003, 0.01), env=swell(0.35, 0.3)) * 0.8)
snd('select.go', A, "Let's go: the party is picked, on to packing.",
    'Boots stomping twice and a rising whistle-like glock.', level='loud', bus='ui',
    fn=lambda v: mix(thump(80, 0.18, 0.05), (thump(80, 0.18, 0.05), 0.16), (tones(lambda m: glock(m, 1.0) * 0.5, [79, 84, 91], 0.08), 0.3)))

# ═════════════════════════════════════════════════════════════════ CARDS ═══
A = 'Cards'
snd('card.deal', A, 'Each card dealt (scavenge, crafting, challenge, level-up choices).',
    'A quick card swish that lands with a tiny tap.', variants=4,
    fn=lambda v: mix(whoosh(0.13, V(v, 1800, 2000, 1700, 2200), 5000, 0.9, peak=0.7) * 0.8, (burst(0.015, 3000, 8000, 0.003) * 0.5, 0.11)))
snd('card.flip', A, 'A card turns face up.',
    'A crisp snap.', variants=3,
    fn=lambda v: mix(burst(0.02, 2200, 9000, 0.003), (burst(0.06, 1200, 5000, 0.02) * 0.4, 0.005), (wood(V(v, 1900, 2100, 2300), 0.04, 0.4) * 0.3, 0.0)))
snd('card.hover', A, 'The pointer moves onto a face-down card (it lifts a little).',
    'A very soft paper brush.', level='soft',
    fn=lambda v: burst(0.06, 3000, 9000, 0.02) * 0.4)
snd('card.take', A, 'A card is taken (a resource or item goes to the bag).',
    'A swish up and a round pop.', variants=2,
    fn=lambda v: mix(whoosh(0.12, 1200, 4500, 1.0, peak=0.5) * 0.7, (osc(glide(V(v, 500, 560), 900, 0.08), 0.08) * expdec(0.08, 0.03), 0.08)))
snd('card.discard', A, 'Cards that weren\'t taken slide away.',
    'A swish going down.', level='soft',
    fn=lambda v: whoosh(0.2, 3500, 900, 1.0, peak=0.3) * 0.6)
snd('card.shuffle', A, 'A deck is shuffled (a reroll, a new deal).',
    'A riffle: a run of tiny card clicks that speeds up.',
    fn=lambda v: mix(clicks(0.55, 70, 2500, 6000, 4, env=np.linspace(0.4, 1, 50)) * 0.5, grains(0.55, 30, 2000, 7000) * 0.3))
snd('card.rare', A, 'A rare card shows (a glow on a face-down card, a Tier II+ item).',
    'A glassy shimmer that rises.', level='loud',
    fn=lambda v: verb(tones(lambda m: glass(hz(m), 1.2, 0.5) * 0.3, [84, 88, 91, 96], 0.06), 1.2, 0.3))
snd('card.challenge', A, 'A challenge card slides in from the top, flips and zooms in.',
    'A longer slide, a thump as it lands, then a flip snap.', level='loud',
    fn=lambda v: mix(whoosh(0.35, 400, 2500, 1.0, peak=0.8) * 0.8, (thump(70, 0.2, 0.06) * 0.7, 0.33), (burst(0.025, 2200, 9000, 0.004) * 0.8, 0.55), (whoosh(0.15, 1500, 4000) * 0.4, 0.56)))

# ════════════════════════════════════════════════════════ PHASE 12 UI ═══
A = 'Phase 12 UI'
snd('ui.frameOpen', A, 'A hiker frame opens to show traits, conditions and gear.',
    'A paper tag unfolding: a soft flap and a wooden tick.', level='soft', bus='ui',
    fn=lambda v: mix(whoosh(0.16, 700, 2600, 1.0, peak=0.4) * 0.6, (wood(1350, 0.06, 0.6) * 0.5, 0.12)))
snd('ui.frameClose', A, 'A hiker frame folds back up.',
    'The same flap, shorter, ending a step lower.', level='soft', bus='ui',
    fn=lambda v: mix(whoosh(0.12, 2400, 800, 1.0, peak=0.5) * 0.5, (wood(1050, 0.06, 0.6) * 0.5, 0.09)))
snd('ui.wheelOpen', A, 'The action wheel pops open above the selected hiker.',
    'A soft puff, then seven tiny wooden pops going up, one per button.', bus='ui',
    fn=lambda v: mix(whoosh(0.14, 500, 2200, 1.2, peak=0.3) * 0.5,
                     *[(wood(hz(_m), 0.05, 0.8) * 0.45, 0.05 + _k * 0.028) for _k, _m in enumerate([79, 81, 83, 84, 86, 88, 91])]))
snd('ui.wheelClose', A, 'The action wheel closes.',
    'The pops going back down, quicker and softer.', level='soft', bus='ui',
    fn=lambda v: mix(*[(wood(hz(_m), 0.04, 0.6) * 0.35, _k * 0.018) for _k, _m in enumerate([91, 86, 83, 79])]))
snd('ui.star', A, 'A recipe or a resource is starred as a favorite.',
    'A bright kalimba ding-ding, going up.', bus='ui',
    fn=lambda v: verb(mix(kalimba(88, 0.5) * 0.5, (kalimba(95, 0.7) * 0.5, 0.07)), 0.8, 0.15))
snd('ui.unstar', A, 'A favorite is unstarred.',
    'One soft, lower kalimba note.', level='soft', bus='ui',
    fn=lambda v: kalimba(83, 0.4) * 0.5)
snd('book.page', A, 'The recipe book turns to another tab.',
    'A page turning: a soft paper sweep with a little crackle.', level='soft', bus='ui', variants=2,
    fn=lambda v: mix(whoosh(0.22, V(v, 900, 1100), 4200, 1.1, peak=0.45) * 0.7, (grains(0.18, 90, 3000, 9000, amp=(0.1, 0.35)), 0.03)))
snd('craft.slot', A, 'A resource lands in a workbench slot (the game raises the pitch a step for each slot).',
    'A short wooden clack with a soft thud under it.', bus='ui', variants=2,
    fn=lambda v: mix(wood(V(v, 1150, 1230), 0.07, 0.9), (thump(140, 0.08, 0.025) * 0.35, 0.0)))
snd('craft.ghost', A, 'A slot the recipe needs but the hiker is missing.',
    'A hollow, muted knock.', level='soft', bus='ui',
    fn=lambda v: lp(mix(wood(420, 0.1, 0.4), thump(110, 0.1, 0.03) * 0.5), 1800))
snd('craft.clear', A, 'The workbench is cleared (Clear, or picking another recipe).',
    'A quick wooden rattle sliding down.', level='soft', bus='ui',
    fn=lambda v: mix(*[(wood(1500 - _k * 140, 0.04, 0.5) * 0.35, _k * 0.022) for _k in range(6)]))
snd('craft.ready', A, 'Every slot is filled: the recipe can be crafted.',
    'Two small glockenspiel notes, a fifth apart.', bus='ui',
    fn=lambda v: mix(glock(91, 0.5) * 0.35, (glock(98, 0.7) * 0.35, 0.08)))
snd('scav.brush.forest', A, 'Brushing leaves off a scavenge card (the brush reveal) on a Forest card; repeats while dragging.',
    'A dry leaf rustle.', level='soft', variants=3,
    fn=lambda v: grains(0.22, V(v, 260, 300, 230), 2000, 8000, env=swell(0.22, 0.35), amp=(0.2, 0.8)) * 0.9)
snd('scav.brush.river', A, 'Brushing water and pebbles off a River card.',
    'A small water swish with a pebble click.', level='soft', variants=3,
    fn=lambda v: mix(bp(pink(0.25), 500, 2600) * swell(0.25, 0.4) * 0.9, (clicks(0.06, 40, 1800, 3200, amp=(0.3, 0.6)) * 0.4, V(v, 0.06, 0.12, 0.16))))
snd('scav.brush.wildlife', A, 'Brushing tall grass aside on a Wildlife card.',
    'A grassy swish.', level='soft', variants=3,
    fn=lambda v: mix(whoosh(0.2, V(v, 1500, 1800, 1300), 6000, 1.3, peak=0.5) * 0.6, grains(0.2, 140, 3000, 9000, amp=(0.1, 0.4)) * 0.5))
snd('scav.brush.mountain', A, 'Brushing gravel off a Mountain card.',
    'A gravelly scrape.', level='soft', variants=3,
    fn=lambda v: clicks(0.24, V(v, 180, 220, 160), 700, 3500, q=4, env=swell(0.24, 0.3), amp=(0.2, 0.9)))
snd('scav.uncover', A, 'A covered card is fully brushed clear and pops up.',
    'A puff, then a little rising sparkle.', bus='sfx',
    fn=lambda v: mix(whoosh(0.18, 600, 3000, 1.0, peak=0.3) * 0.6, *[(glock(_m, 0.4) * 0.22, 0.08 + _k * 0.05) for _k, _m in enumerate([88, 92, 95])]))
snd('trans.irisIn', A, 'The spotlight transition closes in on a point (a click, a tile, a button).',
    'A soft, falling whoosh that tightens, ending in a small low thump as it goes dark.',
    fn=lambda v: mix(whoosh(0.62, 2600, 420, 1.1, peak=0.75) * 0.8, (thump(70, 0.16, 0.05) * 0.5, 0.6)))
snd('trans.irisOut', A, 'The spotlight transition opens on the new scene.',
    'A rising, airy whoosh with a light shimmer at the top.',
    fn=lambda v: mix(whoosh(0.7, 380, 3200, 1.1, peak=0.35) * 0.8, *[(glock(_m, 0.5) * 0.12, 0.42 + _k * 0.05) for _k, _m in enumerate([86, 91])]))
snd('trans.door', A, 'The Ranger Station doors swing open after the party checks in.',
    'A wooden latch clack, a long creak of two heavy doors, and a little shop bell.', level='loud',
    fn=lambda v: mix(wood(900, 0.08, 0.9), (creak(0.9, env=swell(0.9, 0.3)) * 0.55, 0.1), (bell(hz(88), 1.2, tau=0.5) * 0.25, 0.55), (bell(hz(93), 1.0, tau=0.4) * 0.18, 0.62)))
snd('load.jump', A, 'The little hiker jumps on the loading screen (runner and jumper).',
    'A soft TrailMate boop sliding up.', level='soft',
    fn=lambda v: chip(72, 0.12, 0.25, slide=84, vol=0.7))
snd('title.logo', A, 'The title logo drops in on the title screen.',
    'A heavy wooden thunk and a puff of leaves.', level='loud',
    fn=lambda v: mix(thump(60, 0.3, 0.09), (wood(420, 0.14, 0.8) * 0.6, 0.0), (grains(0.45, 180, 2000, 8000, env=swell(0.45, 0.2), amp=(0.2, 0.7)) * 0.7, 0.03)))
_REV = {'uncommon': [84, 88], 'rare': [84, 88, 91], 'veryRare': [84, 88, 91, 96], 'legendary': [79, 84, 88, 91, 96], 'mythic': [79, 84, 88, 91, 96, 100]}
for _r, _ns in _REV.items():
    snd(f'card.reveal.{_r}', A, f'A card flips face up and is {_r.replace("R", " r")} (slot-machine style: one more chime per rarity step). Common cards just snap.',
        f'{len(_ns)} quick bell chimes going up' + (', over a low bell boom.' if len(_ns) >= 5 else '.'), level='loud' if len(_ns) >= 4 else 'normal',
        fn=lambda v, _ns=_ns: verb(mix(tones(lambda m: glock(m, 0.9) * 0.3, _ns, 0.055),
                                       *([(bell(hz(55), 2.0, tau=0.7) * 0.35, 0.0)] if len(_ns) >= 5 else [])), 1.1, 0.25))
snd('card.wanted', A, 'A revealed card is a resource a starred recipe still needs.',
    'Two quick bright pings, like a metal detector finding something.', bus='sfx',
    fn=lambda v: mix(osc(hz(96), 0.07, 'tri') * expdec(0.07, 0.03) * 0.35, (osc(hz(96), 0.09, 'tri') * expdec(0.09, 0.04) * 0.35, 0.1)))

# ═════════════════════════════════════════════════════ RESOURCES AND CAPS ═══
A = 'Resources and caps'
snd('res.food', A, 'Getting a Food resource (berries, mushrooms, fish).',
    'A soft round pluck.', variants=2,
    fn=lambda v: mix(osc(glide(V(v, 420, 470), 700, 0.09), 0.12) * expdec(0.12, 0.04), lp(white(0.02), 2000) * expdec(0.02, 0.004) * 0.3))
snd('res.building', A, 'Getting a Building resource (sticks, stone, logs).',
    'Two quick wood knocks.', variants=2,
    fn=lambda v: mix(wood(V(v, 600, 650), 0.12), (wood(V(v, 720, 780), 0.12) * 0.8, 0.07)))
snd('res.fiber', A, 'Getting a Fiber resource (grass, bark, wool).',
    'A soft rustle.', variants=2,
    fn=lambda v: grains(0.18, 160, 1500, 6000, env=swell(0.18, 0.3)) * 0.8)
snd('res.fire', A, 'Getting a Fire resource (tinder, pinecones, sap).',
    'A match flick: a scratch and a little whoosh.',
    fn=lambda v: mix(burst(0.05, 2000, 8000, 0.015), (whoosh(0.25, 300, 1200, 1.4, 'brown') * 0.6, 0.03)))
snd('res.trinket', A, 'Getting a Trinket resource (shells, feathers, shiny things).',
    'A small glass ting.', variants=2,
    fn=lambda v: glass(V(v, 2350, 2640), 0.5, 0.2))
snd('res.caps', A, 'Getting acorn caps (the money).',
    'Little wooden clicks, like caps dropping into a pouch.', variants=2,
    fn=lambda v: mix(*[(wood(_r, 0.05, 0.8) * 0.7, i * 0.045) for i, _r in enumerate(V(v, [2100, 2400, 2250], [2300, 2000]))]))
snd('res.capsSpend', A, 'Spending caps (buying, the infoboard).',
    'The pouch shaken: a clatter of caps.',
    fn=lambda v: clicks(0.3, 45, 1800, 3200, 8) * 0.6)
snd('res.lose', A, 'Losing resources (a punishment, a night event).',
    'A soft puff going down.',
    fn=lambda v: mix(whoosh(0.25, 1500, 400, 1.2, peak=0.2) * 0.6, osc(glide(500, 250, 0.2), 0.2) * expdec(0.2, 0.07) * 0.4))
snd('res.bundleBurst', A, 'Packing: the bundles burst into resources when the hike starts.',
    'A cluster of pops.', level='loud',
    fn=lambda v: mix(*[(osc(glide(_f, _f * 1.6, 0.07), 0.07) * expdec(0.07, 0.025) * 0.6, _t) for _f, _t in zip([400, 520, 470, 610, 560, 700], [0, .05, .09, .14, .17, .22])]))

# ═════════════════════════════════════════════════════════════════ ITEMS ═══
A = 'Items'
snd('item.new', A, 'An item card goes into a bag.',
    'The TrailMate wakes: two quick soft bleeps going up.',
    fn=lambda v: chips([79, 86], 0.05, 0.06))
snd('item.equip', A, 'Putting on clothes.',
    'A cloth rustle and a light zip.', variants=2,
    fn=lambda v: mix(lp(pink(0.3), 2500) * swell(0.3, 0.35) * 0.6, (zipper(0.18, 300, 450) * 0.4, V(v, 0.12, 0.15))))
snd('item.unequip', A, 'Taking clothes off.',
    'A shorter cloth rustle.',
    fn=lambda v: lp(pink(0.22), 2200) * swell(0.22, 0.5) * 0.6)
snd('item.use', A, 'Using a tool (a Shovel, the Binoculars, a Swiss Army Knife).',
    'A small metal clink.', variants=2,
    fn=lambda v: bell(V(v, 1800, 2050), 0.4, 2.3, 2.0, 0.05, 0.08))
snd('item.ledDown', A, "A use is spent: one LED on the card goes dark.",
    'A TrailMate blip going down, with a flicker.', level='soft',
    fn=lambda v: mix(chip(84, 0.03, vol=0.7), (chip(84, 0.03, vol=0.4), 0.06), (chip(79, 0.06, vol=0.5), 0.12)))
snd('item.break', A, 'An item is used up or breaks.',
    'A crunch and a snap.',
    fn=lambda v: mix(grains(0.2, 260, 800, 5000, env=np.linspace(1, 0.2, 20)), (burst(0.04, 800, 6000, 0.01), 0), (thump(110, 0.12, 0.03) * 0.5, 0)))
snd('item.eat', A, 'Eating a bite of food.',
    'A crunchy bite.', variants=3,
    fn=lambda v: mix(grains(0.16, 300, 900, 4000, (0.002, 0.008), env=np.linspace(1, 0.2, 10)), (thump(150, 0.08, 0.02) * 0.4, 0)))
snd('item.drink', A, 'Taking a sip of a drink.',
    'A little gulp: two bubbly blips.', variants=2,
    fn=lambda v: mix(osc(glide(V(v, 260, 300), 520, 0.07), 0.07) * expdec(0.07, 0.03, 0.005), (osc(glide(320, 650, 0.06), 0.06) * expdec(0.06, 0.025, 0.005) * 0.7, 0.13)))
snd('item.drop', A, 'Dropping an item on the ground.',
    'A thud on dirt.',
    fn=lambda v: mix(thump(85, 0.15, 0.04), grains(0.08, 200, 800, 3000) * 0.4))
snd('item.give', A, 'Giving an item or resource to another hiker.',
    'A quick hand-off swish.',
    fn=lambda v: whoosh(0.16, 800, 2600, 1.0, peak=0.6) * 0.7)
snd('present.wrap', A, 'Wrapping a present (holiday hikers).',
    'Paper crinkling.',
    fn=lambda v: grains(0.6, 120, 2500, 9000, (0.002, 0.02), env=swell(0.6, 0.3)) * 0.8)
snd('present.open', A, 'Opening a present.',
    'Paper ripping, then a little sparkle.', level='loud',
    fn=lambda v: mix(shape(white(0.35), glide(1500, 5000, 0.35), 1.5) * swell(0.35, 0.2), grains(0.35, 300, 2000, 9000) * 0.5, (tones(lambda m: glock(m, 0.8) * 0.4, [84, 88, 91], 0.06), 0.33)))

# ═════════════════════════════════════════════════ STATS AND CONDITIONS ═══
A = 'Stats, conditions and XP'
snd('stat.energyUp', A, 'Energy goes up (sleep, a drink).',
    'Two light, rising chimes.',
    fn=lambda v: tones(lambda m: glock(m, 0.7) * 0.5, [79, 86], 0.07))
snd('stat.appetiteUp', A, 'Appetite goes up (food).',
    'Two warm, low marimba notes.',
    fn=lambda v: tones(lambda m: marimba(m, 0.6), [60, 67], 0.08))
snd('stat.moraleUp', A, 'Morale goes up.',
    'A quick sparkly kalimba run up.',
    fn=lambda v: tones(lambda m: kalimba(m, 0.7) * 0.7, [72, 76, 79, 84], 0.05))
snd('stat.down', A, 'Any stat goes down (paying a cost).',
    'A soft blip going down.', level='soft',
    fn=lambda v: osc(glide(700, 380, 0.12), 0.12) * expdec(0.12, 0.05) * 0.7)
snd('stat.low', A, 'A stat drops below its warning line (Tired, Hungry, Sad).',
    'Two low, soft heartbeat thumps.',
    fn=lambda v: mix(thump(55, 0.2, 0.06), (thump(50, 0.2, 0.06) * 0.8, 0.22)))
snd('cond.good', A, 'Getting a good condition (Lucky, Energized, Refreshed).',
    'A short sparkle.',
    fn=lambda v: verb(tones(lambda m: glass(hz(m), 0.5, 0.15) * 0.4, [88, 91, 96], 0.04), 0.8, 0.2))
snd('cond.bad', A, 'Getting a bad condition (Unlucky, Bleeding, Crippled, Buzzed).',
    'A muffled, slightly sour low chord.',
    fn=lambda v: lp(chord_pad([50, 51, 57], 0.6, 'tri', 900, 0.01, 0.4), 1200) * 1.5)
snd('cond.cured', A, 'A bad condition goes away.',
    'A gentle chime, like something let go.',
    fn=lambda v: tones(lambda m: kalimba(m, 0.9) * 0.7, [74, 79], 0.1))
snd('injury', A, 'A hiker is hurt (an injury).',
    'A dull thud and a low "dum".', level='loud',
    fn=lambda v: mix(thump(60, 0.3, 0.08), (burst(0.06, 200, 2000, 0.02) * 0.5, 0), (lp(osc(hz(38), 0.5, 'tri'), 400) * expdec(0.5, 0.15) * 0.6, 0.02)))
snd('healed', A, 'An injury heals.',
    'A warm, soft major chord.',
    fn=lambda v: verb(tones(lambda m: marimba(m, 1.0) * 0.5, [60, 64, 67, 72], 0.03), 0.9, 0.2))
snd('passedOut', A, 'A hiker passes out.',
    'A slow whoosh going down and a body falling on grass.', level='loud',
    fn=lambda v: mix(whoosh(0.6, 1800, 250, 1.2, peak=0.3) * 0.7, (thump(65, 0.3, 0.08), 0.55), (lp(pink(0.3), 1500) * expdec(0.3, 0.08) * 0.4, 0.56)))
snd('xp.gain', A, 'XP is added (it counts up).',
    'Tiny TrailMate bleeps, one per point.', level='soft',
    fn=lambda v: chip(91, 0.025, 0.5, vol=0.6))
snd('levelUp', A, 'The party levels up.',
    'A short jingle: marimba and glockenspiel climbing to a bright chord, with a soft cymbal swell.', level='loud',
    fn=lambda v: verb(mix(tones(lambda m: marimba(m, 0.9), [60, 64, 67, 72, 76], 0.08),
                          (tones(lambda m: glock(m, 1.6) * 0.35, [79, 84, 88], 0.02), 0.42),
                          (hp(white(0.6), 5000) * swell(0.6, 0.85) * 0.25, 0)), 1.2, 0.2))
snd('trait.learn', A, 'Learning a step on a skill trail.',
    'A rubber stamp and a chime.',
    fn=lambda v: mix(thump(100, 0.12, 0.03), burst(0.03, 1500, 6000, 0.008) * 0.6, (kalimba(81, 0.9) * 0.6, 0.06)))
snd('trait.levelStep', A, 'Raising a leveled step (Game Sight, free crafting): level 2, 3, 4.',
    'A chime that climbs one note higher each level.', variants=3,
    fn=lambda v: tones(lambda m: kalimba(m, 0.8) * 0.7, [76 + 2 * v, 81 + 2 * v], 0.07))
snd('trait.proc', A, 'A trait works ("Family Cookbook: no Energy").',
    'A tiny sparkle.', level='soft',
    fn=lambda v: tones(lambda m: glass(hz(m), 0.35, 0.1) * 0.4, [91, 96], 0.04))

# ═════════════════════════════════════════════════════════ MAP AND MOVING ═══
A = 'Map and moving'


def step_boot(v, crunch=(1500, 5000), rate=250, low=380, d=0.09, soft=1.0, wet=False):
    heel = lp(white(0.03), low) * expdec(0.03, 0.008) * 1.2
    toe = lp(white(0.03), low * 1.4) * expdec(0.03, 0.006) * 0.6
    c = grains(d, rate, *crunch, (0.001, 0.006), env=np.linspace(1, 0.1, 12)) * 0.6 * soft
    y = mix(heel, (toe, R().uniform(0.035, 0.06)), c)
    return y


snd('foot.dirt', A, 'Each step on a normal trail line (people).',
    'A boot on packed dirt: a soft heel-toe with a little grit.', variants=4, level='soft',
    fn=lambda v: step_boot(v))
snd('foot.gravel', A, 'Each step on a rough line.',
    'A boot on gravel: a crunchier, longer step.', variants=4, level='soft',
    fn=lambda v: step_boot(v, (1200, 6500), 700, 350, 0.16, 1.4))
snd('foot.paved', A, 'Each step on a paved line.',
    'A boot on stone: a harder click and less grit.', variants=4, level='soft',
    fn=lambda v: mix(burst(0.012, 2500, 8000, 0.002) * 0.6, lp(white(0.02), 900) * expdec(0.02, 0.004), (burst(0.01, 2000, 7000, 0.002) * 0.35, 0.05)))
snd('foot.steep', A, 'Each step on a steep line.',
    'A heavier step that scrapes a little as the boot slips.', variants=3, level='soft',
    fn=lambda v: mix(step_boot(v, (1200, 5000), 300, 300, 0.1), (bp(pink(0.18), 800, 4000) * swell(0.18, 0.3) * 0.35, 0.05)))
snd('foot.mud', A, 'Each step on a muddy line.',
    'A squelch: a wet suck as the boot pulls out.', variants=3, level='soft',
    fn=lambda v: mix(shape(pink(0.2), glide(1400, 300, 0.2), 0.8) * swell(0.2, 0.2) * 1.3, (osc(glide(180, 420, 0.04), 0.05) * expdec(0.05, 0.015) * 0.5, 0.15)))
snd('foot.snow', A, 'Each step while it snows (replaces the line\'s step).',
    'A soft snow crunch with a tiny squeak.', variants=4, level='soft',
    fn=lambda v: mix(grains(0.14, 900, 1500, 5000, (0.0008, 0.003), env=swell(0.14, 0.3)) * 0.8, lp(white(0.04), 500) * expdec(0.04, 0.01) * 0.6))
snd('foot.paw', A, 'Each step for the dogs and cats (soft ground).',
    'A light, quick paw pat.', variants=3, level='soft',
    fn=lambda v: mix(lp(white(0.02), 700) * expdec(0.02, 0.005) * 0.8, grains(0.04, 150, 2000, 5000) * 0.3))
snd('foot.pawHard', A, 'Dog steps on paved lines and rock.',
    'A paw pat with tiny claw clicks.', variants=3, level='soft',
    fn=lambda v: mix(lp(white(0.02), 700) * expdec(0.02, 0.005) * 0.6, (clicks(0.04, 60, 3500, 6000, 10) * 0.3, 0.005)))
snd('foot.plush', A, 'Each step for plush hikers.',
    'A soft, squishy "fwump".', variants=3, level='soft',
    fn=lambda v: mix(lp(pink(0.08), 450) * swell(0.08, 0.3) * 1.2, (lp(pink(0.05), 1500) * swell(0.05) * 0.2, 0.02)))
snd('map.select', A, 'Picking a hiker on the map (clicking their icon).',
    'Picking up a wooden game piece.', bus='ui',
    fn=lambda v: wood(1600, 0.08, 0.6) * 0.7)
snd('map.arrive', A, 'A hiker reaches a tile and stops.',
    'A game piece set down on a board.',
    fn=lambda v: mix(wood(800, 0.1, 0.6) * 0.6, thump(140, 0.08, 0.02) * 0.4))
snd('map.reveal', A, 'New tiles are revealed (the fog lifts).',
    'An airy whoosh with a faint shimmer.',
    fn=lambda v: mix(whoosh(0.8, 400, 4000, 1.6, peak=0.4) * 0.5, (verb(tones(lambda m: glass(hz(m), 0.5, 0.2) * 0.15, [91, 95, 98], 0.08), 1.0, 0.3), 0.2)))
snd('map.challengeLand', A, 'A hiker steps onto a challenge tile (just before the card slides in).',
    'A low drum hit and a short rising string-like swell.', level='loud',
    fn=lambda v: mix(thump(55, 0.4, 0.12), (lp(chord_pad([50, 57, 62], 0.5, 'saw', 2000, 0.25, 0.08), 3000) * 0.8, 0.0)))
snd('map.checkpoint', A, 'The party reaches a checkpoint (a new section begins).',
    'A ranger\'s handbell, ding-ding, and a warm chord.', level='loud',
    fn=lambda v: verb(mix(bell(1320, 1.4, 1.41, 3, 0.2, 0.5), (bell(1320, 1.4, 1.41, 3, 0.2, 0.5) * 0.8, 0.28), (tones(lambda m: marimba(m, 1.2) * 0.4, [60, 64, 67], 0.02), 0.55)), 1.2, 0.2))
snd('map.pan', A, 'The map pans by itself (to a found tile, to the next section).',
    'A soft, long air whoosh.', level='soft',
    fn=lambda v: whoosh(0.7, 300, 1500, 1.4, peak=0.5) * 0.5)
snd('map.pin', A, 'A pin drops on the map (the infoboard\'s WHERE IS IT?).',
    'A thumbtack pressed into cork.',
    fn=lambda v: mix(bell(3100, 0.15, 2.7, 1.5, 0.02, 0.03) * 0.5, (thump(200, 0.06, 0.015) * 0.6, 0.01)))

# ═══════════════════════════════════════════════════ SPACES ON THE MAP ═══
A = 'Spaces on the map'
snd('space.trailSign', A, 'Landing on a Trail Sign.',
    'Knock-knock on a wooden post.',
    fn=lambda v: mix(wood(520, 0.15), (wood(540, 0.15), 0.14)))
snd('space.geoCache', A, 'Landing on a Geocache.',
    'A metal detector: TrailMate beeps that speed up, then a found chime.',
    fn=lambda v: mix(chips([84, None, None, 84, None, 84, 84, 84], 0.07, 0.05, duty=0.5), (tones(lambda m: glock(m, 0.7) * 0.5, [88, 91], 0.06), 0.6)))
snd('space.campsite', A, 'Landing on a Campsite.',
    'A fire catching, and a warm guitar-like chord.',
    fn=lambda v: mix(whoosh(0.5, 200, 900, 1.6, 'brown') * 0.8, (clicks(0.6, 12, 1200, 3500, 6) * 0.4, 0.2), (tones(lambda m: kalimba(m, 1.2) * 0.4, [55, 59, 62, 67], 0.04), 0.35)))
snd('space.overlook', A, 'Landing on an Overlook.',
    'A gust of wind and a wide, airy chord that swells.', level='loud',
    fn=lambda v: mix(whoosh(1.8, 300, 1200, 1.8, peak=0.4) * 0.6, verb(chord_pad([62, 69, 74, 78, 81], 2.4, 'tri', 3000, 0.8, 1.2), 2.0, 0.4) * 0.7))
snd('space.narrowPath', A, 'Landing on a Narrow Path.',
    'Careful steps and a few pebbles falling away.',
    fn=lambda v: mix(step_boot(v), (step_boot(v), 0.35), (clicks(0.5, 14, 1500, 4000, 8) * 0.4, 0.3)))
snd('space.mystery', A, 'Landing on a Mystery space.',
    'A mysterious glassy shimmer (whole-tone notes).',
    fn=lambda v: verb(tones(lambda m: glass(hz(m), 0.8, 0.3) * 0.3, [84, 86, 88, 90, 92], 0.07), 1.4, 0.35))
snd('space.choice', A, 'Landing on a Choice space (pick one of two).',
    'A marimba question: up, then hanging.',
    fn=lambda v: tones(lambda m: marimba(m, 0.7), [67, 72, 71], 0.1))
snd('space.opportunity', A, 'Landing on an opportunity (when they come back).',
    'A bright "oh!": two quick glockenspiel notes.',
    fn=lambda v: tones(lambda m: glock(m, 0.9) * 0.6, [81, 88], 0.07))

# ═══════════════════════════════════════════════════════════════ ACTIONS ═══
A = 'Actions'
snd('act.scavenge.forest', A, 'Scavenging on a Forest node (as the cards are dealt).',
    'Rummaging in bushes: leaves rustling and a twig snapping.',
    fn=lambda v: mix(grains(0.7, 180, 1500, 7000, env=swell(0.7, 0.3)) * 0.8, (burst(0.02, 1500, 6000, 0.004), 0.45)))
snd('act.scavenge.river', A, 'Scavenging on a River node.',
    'Hands in a stream: a splash and pebbles.',
    fn=lambda v: mix(shape(pink(0.5), glide(3000, 900, 0.5), 1.2) * swell(0.5, 0.15) * 0.8, (clicks(0.4, 18, 1500, 3500, 10) * 0.4, 0.15)))
snd('act.scavenge.wildlife', A, 'Scavenging on a Wildlife node.',
    'Rustling in tall grass with a little critter squeak.',
    fn=lambda v: mix(grains(0.6, 160, 1200, 6000, env=swell(0.6, 0.4)) * 0.8, (osc(glide(4200, 5200, 0.05), 0.05) * expdec(0.05, 0.02) * 0.2, 0.4)))
snd('act.scavenge.mountain', A, 'Scavenging on a Mountain node.',
    'Turning over rocks: a stony scrape and a clack.',
    fn=lambda v: mix(bp(brown(0.4), 200, 1500) * swell(0.4, 0.4) * 0.8, (modal(900, [1, 2.1, 3.7], [0.03, 0.015, 0.008], d=0.1, click=0.6) * 0.6, 0.35)))
snd('act.tend', A, 'Tending a node (raising Abundance).',
    'Patting soil and a soft rustle.',
    fn=lambda v: mix(*[(lp(white(0.05), 500) * expdec(0.05, 0.012) * 0.8, t) for t in (0, 0.22, 0.42)], grains(0.6, 60, 1500, 5000) * 0.3))
snd('act.craft.tool', A, 'Crafting a tool.',
    'Three hammer taps on wood and metal.',
    fn=lambda v: mix(*[(modal(_f, [1, 2.3, 3.9, 5.6], [0.08, 0.04, 0.02, 0.01], d=0.2, click=0.7), _t) for _f, _t in ((700, 0), (720, 0.2), (690, 0.38))]))
snd('act.craft.clothes', A, 'Crafting clothes.',
    'Sewing: three quick needle pulls.',
    fn=lambda v: mix(*[(whoosh(0.12, 1800, 5000, 0.8, 'white', 0.7) * 0.6, t) for t in (0, 0.18, 0.36)]))
snd('act.craft.food', A, 'Crafting food.',
    'Chopping on a board, then a sizzle.',
    fn=lambda v: mix(*[(modal(420, [1, 2.4], [0.04, 0.02], d=0.1, click=0.8) * 0.8, t) for t in (0, 0.16, 0.32)], (mix(hp(white(0.9), 3000) * swell(0.9, 0.2) * 0.25, clicks(0.9, 30, 3000, 7000, 3) * 0.15), 0.45)))
snd('act.craft.shelter', A, 'Crafting a shelter.',
    'Tent stakes hammered in and fabric pulled tight.',
    fn=lambda v: mix(*[(mix(bell(1500, 0.2, 2.6, 2, 0.02, 0.05) * 0.5, thump(120, 0.1, 0.02) * 0.5), t) for t in (0, 0.22)], (lp(pink(0.35), 3000) * swell(0.35, 0.7) * 0.5, 0.45)))
snd('act.craft.trinket', A, 'Crafting a trinket.',
    'Tinkering: small clicks and a tiny chime.',
    fn=lambda v: mix(clicks(0.45, 20, 2500, 5000, 12) * 0.6, (glass(2800, 0.4, 0.15) * 0.4, 0.45)))
snd('act.craftDone', A, 'The crafted item is picked and made.',
    'A little success jingle, half marimba, half TrailMate.', level='loud',
    fn=lambda v: mix(tones(lambda m: marimba(m, 0.7), [67, 72, 76], 0.07), (chips([84, 91], 0.06, 0.08, vol=0.6), 0.22)))
snd('act.sleep', A, 'Sleep is picked for the night.',
    'A sleeping bag zip, then three slow lullaby notes.',
    fn=lambda v: mix(zipper(0.7, 220, 300, (1200, 5000)) * 0.6, (tones(lambda m: kalimba(m, 1.2) * 0.5, [67, 64, 60], 0.3), 0.75)))
snd('act.keepWatch', A, 'Keep Watch is picked.',
    'A lantern clicking on and a low hum.',
    fn=lambda v: mix(burst(0.015, 2000, 7000, 0.003), (lp(osc(110, 0.8, 'saw'), 500) * swell(0.8, 0.2) * 0.15, 0.02)))
snd('act.sitByFire', A, 'Sit by the Fire is picked.',
    'A log dropped on a fire and a burst of crackle.',
    fn=lambda v: mix(thump(90, 0.2, 0.05) * 0.6, (whoosh(0.5, 150, 700, 1.5, 'brown') * 0.7, 0.05), (clicks(1.0, 25, 1500, 4500, 5) * 0.4, 0.1)))
snd('act.shelterUp', A, 'Setting up a shelter.',
    'A long tent zip and two stake taps.',
    fn=lambda v: mix(zipper(0.6), (bell(1500, 0.2, 2.6, 2, 0.02, 0.05) * 0.4, 0.7), (bell(1550, 0.2, 2.6, 2, 0.02, 0.05) * 0.4, 0.9)))
snd('act.shelterDown', A, 'Packing up a shelter.',
    'A zip and fabric being rolled up.',
    fn=lambda v: mix(zipper(0.45, 520, 380), (lp(pink(0.5), 2500) * swell(0.5, 0.5) * 0.6, 0.4)))
snd('act.teach', A, 'Teaching a blueprint to another hiker.',
    'A page turning and a chime.',
    fn=lambda v: mix(whoosh(0.25, 1200, 4500, 1.0, 'white', 0.6) * 0.6, grains(0.25, 80, 3000, 8000) * 0.3, (kalimba(79, 0.8) * 0.6, 0.22)))
snd('act.returnToNature', A, 'Returning a resource to nature.',
    'A leafy rustle and a soft, low chime.',
    fn=lambda v: mix(grains(0.4, 120, 1500, 6000, env=swell(0.4)) * 0.6, (kalimba(67, 1.0) * 0.5, 0.15)))
snd('act.carry', A, 'Picking up a hiker to carry them.',
    'A cloth rustle and an effort thump.',
    fn=lambda v: mix(lp(pink(0.3), 2000) * swell(0.3) * 0.6, (thump(90, 0.15, 0.04) * 0.6, 0.2)))
snd('act.abandon', A, 'A hiker leaves the party.',
    'Two slow, sad marimba notes.',
    fn=lambda v: tones(lambda m: marimba(m, 1.0, 0.4), [64, 57], 0.35))

# ══════════════════════════════════════════════════════════ DAY AND NIGHT ═══
A = 'Day and night'
snd('day.morning', A, 'Morning begins (with the new day banner).',
    'A sunrise: a soft rising swell, a glockenspiel twinkle and a bird.', level='loud',
    fn=lambda v: verb(mix(chord_pad([60, 67, 72, 76], 2.2, 'tri', 2500, 1.2, 0.8) * 0.6, (tones(lambda m: glock(m, 1.2) * 0.3, [84, 88, 91, 96], 0.12), 1.0)), 1.6, 0.3))
snd('day.afternoon', A, 'Afternoon begins.',
    'Two light, warm notes.',
    fn=lambda v: tones(lambda m: kalimba(m, 1.0) * 0.6, [72, 79], 0.12))
snd('day.night', A, 'Night falls.',
    'A low, soft chime and a swell of crickets.', level='loud',
    fn=lambda v: verb(mix(chord_pad([48, 55, 62, 64], 2.4, 'tri', 1200, 0.8, 1.0) * 0.6, (tones(lambda m: kalimba(m, 1.6) * 0.35, [64, 60, 55], 0.25), 0.2)), 1.8, 0.35))

# ═════════════════════════════════════════════════════════════════ WEATHER ═══
A = 'Weather'
snd('weather.rain', A, 'The weather turns to rain (with the weather change screen).',
    'Rain starting: patters growing into a shower.', level='loud',
    fn=lambda v: mix(hp(lp(pink(3.0), 7000), 500) * swell(3.0, 0.7, 1.2) * 0.5, clicks(3.0, 60, 2500, 6000, 8, env=np.linspace(0.2, 1, 30)) * 0.25))
snd('weather.thunder', A, 'Now and then while it rains (random, rare).',
    'Thunder: a close crack and rumble, and two farther rolls.', level='loud', variants=3, note=PIX.format('soundreality'),
    fn=lambda v: rec('soundreality-thunder-375727', *V(v, (5.4, 11.6), (24.8, 33.0), (33.8, 41.5)), fin=0.25, fout=1.8))
snd('weather.snow', A, 'The weather turns to snow.',
    'A hush: soft wind and a few glassy, high notes.', level='loud',
    fn=lambda v: mix(whoosh(2.5, 300, 900, 1.5, peak=0.4) * 0.6, (verb(tones(lambda m: glass(hz(m), 1.0, 0.4) * 0.25, [96, 91, 88, 84], 0.25), 1.8, 0.4), 0.3)))
snd('weather.wind', A, 'The weather turns windy.',
    'A big gust that whistles through trees.', level='loud',
    fn=lambda v: whoosh(2.2, 250, 1400, 1.0, peak=0.45) * 0.9 + osc(glide(900, 1300, 2.2), 2.2) * swell(2.2, 0.5) * 0.04)
snd('weather.heatwave', A, 'A heatwave begins.',
    'Cicadas buzzing up in a long swell.', level='loud',
    fn=lambda v: bp(white(2.5) * (1 + np.sin(2 * np.pi * 180 * T(2.5))), 4000, 7500) * swell(2.5, 0.5) * 0.8)
snd('weather.clear', A, 'The weather clears up.',
    'Birdsong coming back: two bright chirps.',
    fn=lambda v: mix(osc(glide(3800, 4600, 0.1), 0.1) * expdec(0.1, 0.05), (osc(glide(4200, 3400, 0.15), 0.15) * expdec(0.15, 0.06), 0.18)) * 0.6)

# ═════════════════════════════════════════════════════════ RANGER STATION ═══
A = 'Ranger Station'
snd('station.enter', A, 'Entering the Ranger Station.',
    'A shop door bell jingling and the door creaking shut.', level='loud',
    fn=lambda v: mix(*[(bell(_f, 0.9, 1.41, 3, 0.1, 0.25) * 0.4, _t) for _f, _t in ((2800, 0), (3150, 0.07), (2950, 0.15), (3300, 0.24))], (creak(0.5, (60, 140), (500, 1100, 2100)) * 0.3, 0.3)))
snd('station.leave', A, 'Leaving the station.',
    'The door bell, shorter.',
    fn=lambda v: mix(*[(bell(_f, 0.7, 1.41, 3, 0.1, 0.2) * 0.4, _t) for _f, _t in ((3000, 0), (3200, 0.08))]))
snd('station.buy', A, 'Buying something.',
    'A cash register: "ka-ching".', level='loud',
    fn=lambda v: mix(clicks(0.15, 40, 1500, 3500, 8) * 0.5, (thump(140, 0.1, 0.03) * 0.5, 0.15), (bell(2640, 1.0, 1.41, 3.5, 0.08, 0.35) * 0.6, 0.18), (bell(3520, 1.0, 1.41, 3.5, 0.08, 0.35) * 0.4, 0.2)))
snd('station.sell', A, 'Selling something.',
    'Caps poured onto the counter.',
    fn=lambda v: clicks(0.5, 50, 1800, 3500, 8, env=swell(0.5, 0.2)) * 0.6)
snd('station.trade', A, 'Trading an item.',
    'A paper slid across the counter and stamped.',
    fn=lambda v: mix(whoosh(0.3, 800, 2500, 1.0, 'white') * 0.5, (mix(thump(100, 0.12, 0.03), burst(0.03, 1500, 6000, 0.008) * 0.6), 0.32)))
snd('station.ask', A, "Asking the ranger what's ahead (the radio).",
    'Radio static and a beep.',
    fn=lambda v: mix(bp(white(0.5), 700, 3500) * swell(0.5, 0.2) * 0.4, clicks(0.5, 30, 1000, 3000, 4) * 0.2, (osc(1000, 0.18, 'sine') * adsr(0.18, 0.005, 0.02, 0.8, 0.02) * 0.4, 0.5)))
snd('station.rest', A, 'Rest and Go.',
    'A chair creak and a content sigh of a chord.',
    fn=lambda v: mix(creak(0.4, (50, 100)) * 0.4, (tones(lambda m: marimba(m, 1.0) * 0.5, [65, 69, 72], 0.1), 0.35)))
snd('station.workbench', A, 'Using the Workbench.',
    'A wood plane stroke and a tap.',
    fn=lambda v: mix(shape(pink(0.4), glide(800, 2500, 0.4), 1.0) * swell(0.4, 0.6) * 0.7, (wood(600, 0.12) * 0.6, 0.42)))

# ═════════════════════════════════════════ WONDERS, TRAITS AND THE INFOBOARD ═══
A = 'Wonders, skill trails and the infoboard'
snd('wonder.open', A, 'A Wonder\'s window opens.',
    'An awe chord swelling, like light breaking through.', level='loud',
    fn=lambda v: verb(chord_pad([57, 64, 69, 73, 76], 2.5, 'tri', 3500, 1.0, 1.2) * 0.8, 2.2, 0.4))
snd('wonder.done', A, 'A Wonder is accomplished.',
    'A short fanfare on glockenspiel and marimba.', level='loud',
    fn=lambda v: verb(mix(tones(lambda m: marimba(m, 0.9), [67, 72, 76, 79], 0.09), (tones(lambda m: glock(m, 1.8) * 0.3, [84, 88, 91, 96], 0.02), 0.4)), 1.4, 0.25))
snd('trails.open', A, 'The skill trails window opens.',
    'A trail map unfolding.',
    fn=lambda v: mix(grains(0.5, 150, 1500, 8000, env=swell(0.5, 0.4)) * 0.6, whoosh(0.5, 500, 2500, 1.2) * 0.5))
snd('infoboard.open', A, 'The Trail Infoboard opens.',
    'A knock on a wooden board and paper fluttering.',
    fn=lambda v: mix(wood(420, 0.15), (grains(0.4, 120, 2500, 8000, env=swell(0.4)) * 0.5, 0.05)))
snd('infoboard.clink', A, 'The infoboard\'s acorn flies and the caps are paid ("the clink").',
    'A single bright cap clink.',
    fn=lambda v: mix(wood(2600, 0.06, 1), (bell(2900, 0.4, 2.7, 2, 0.03, 0.12) * 0.4, 0.005)))
snd('infoboard.shake', A, 'Not enough caps: the box shakes.',
    'A few rattly clicks.',
    fn=lambda v: clicks(0.3, 40, 1500, 3000, 8) * 0.6)

# ═══════════════════════════════════════════════════ CHALLENGES (SHARED) ═══
A = 'Challenges and minigames (shared)'
snd('chal.prepareSlot', A, 'Putting a resource or item into a Prepare slot.',
    'A solid "clunk" into a slot.',
    fn=lambda v: mix(wood(500, 0.12), thump(120, 0.1, 0.025) * 0.6))
snd('chal.prepareRemove', A, 'Taking it back out.',
    'A lighter "clunk" going up.', level='soft',
    fn=lambda v: wood(850, 0.1) * 0.7)
snd('chal.start', A, 'Play: the party GPS powers on for the minigame.',
    'The TrailMate starting up: a rising sweep and two bleeps.', level='loud',
    fn=lambda v: mix(osc(glide(200, 1600, 0.35), 0.35, 'tri') * swell(0.35, 0.8) * 0.4, (chips([84, 91], 0.07, 0.08), 0.33)))
snd('mg.count', A, 'Each number of the 3-2-1 countdown.',
    'A TrailMate beep.',
    fn=lambda v: chip(81, 0.12, 0.5))
snd('mg.go', A, 'GO!',
    'A higher, longer beep.', level='loud',
    fn=lambda v: chip(93, 0.35, 0.5))
snd('mg.turn', A, "The next hiker's turn.",
    'A quick two-tone swap blip.',
    fn=lambda v: chips([79, 86], 0.05, 0.05, duty=0.125))
snd('mg.point', A, 'Something right (a dodge, a catch, a match, a locked bearing).',
    'A bright bleep up.', variants=3,
    fn=lambda v: chip(84 + 2 * v, 0.08, 0.25, slide=91 + 2 * v))
snd('mg.wrong', A, 'Something wrong (a wrong key, a miss).',
    'A low double bleep.',
    fn=lambda v: chips([52, 52], 0.08, 0.06, soft=2000))
snd('mg.heartLost', A, 'A heart (or a try) is lost.',
    'A crunchy TrailMate hit going down.', level='loud',
    fn=lambda v: mix(chip(72, 0.2, 0.5, slide=48, soft=3000), hp(white(0.08), 1500) * expdec(0.08, 0.02) * 0.4))
snd('mg.heartGained', A, 'A heart is gained (Bandages).',
    'A warm bleep arpeggio up.',
    fn=lambda v: chips([72, 76, 79, 84], 0.05, 0.06, duty=0.5))
snd('mg.tick', A, 'The last 5 seconds on a clock (one per second, getting higher).',
    'A clock tick from the device.', level='soft', variants=5,
    fn=lambda v: chip(86 + v, 0.04, 0.5, vol=0.8))
snd('mg.timeUp', A, 'Time runs out.',
    'A low buzzer.', level='loud',
    fn=lambda v: lp(osc(hz(45), 0.6, 'square') + osc(hz(45.3), 0.6, 'square'), 1500) * adsr(0.6, 0.01, 0.1, 0.8, 0.1) * 0.5)
snd('mg.hikerPassed', A, 'One hiker passes their part.',
    'Three quick notes up.',
    fn=lambda v: chips([79, 84, 88], 0.06, 0.08))
snd('mg.hikerFailed', A, 'One hiker fails their part.',
    'Three notes down.',
    fn=lambda v: chips([72, 67, 60], 0.09, 0.1, soft=2500))
snd('mg.passed', A, 'Challenge Passed (the end screen).',
    'A TrailMate fanfare, 2 seconds.', level='loud',
    fn=lambda v: mix(chips([72, 76, 79, 84, None, 79, 84], 0.09, 0.09, duty=0.5), (chip(88, 0.6, 0.5), 0.63), (chips([48, None, 55, None, 60], 0.09, 0.09, wave='tri', soft=2000), 0)))
snd('mg.failed', A, 'Challenge Failed (the end screen).',
    'A slow, sad TrailMate tune going down, 2 seconds.', level='loud',
    fn=lambda v: mix(chips([67, 66, 65, None, 64], 0.2, 0.18, duty=0.5, soft=2500), (chip(60, 0.7, 0.5, soft=2000), 0.82)))
snd('mg.stamp', A, 'The PASSED or FAILED stamp hits.',
    'A heavy rubber stamp thunk.', level='loud',
    fn=lambda v: mix(thump(70, 0.25, 0.06), burst(0.05, 800, 5000, 0.012) * 0.6))
snd('mg.punish', A, 'A punishment is applied after a fail.',
    'A soft thud and a blip down.',
    fn=lambda v: mix(thump(80, 0.15, 0.04) * 0.7, (osc(glide(600, 300, 0.2), 0.2) * expdec(0.2, 0.07) * 0.4, 0.05)))
snd('mg.place', A, 'Hook `place`: placing a piece, a block, a pot shard.',
    'A small solid click.',
    fn=lambda v: mix(wood(1200, 0.07, 0.8), chip(76, 0.03, vol=0.3)))
snd('mg.ready', A, 'Hook `ready`: something is ready (a bear about to wake, a turn about to start).',
    'Two soft bleeps.',
    fn=lambda v: chips([76, 76], 0.12, 0.05))
snd('mg.pop', A, 'Hook `pop`: something pops up (a raccoon, a firefly, a sign).',
    'A quick bubbly pop.', variants=3,
    fn=lambda v: osc(glide(V(v, 400, 460, 520), 1100, 0.07), 0.08) * expdec(0.08, 0.03, 0.002))
snd('mg.hit', A, 'Hook `hit`: hitting the target (a whack, a swat).',
    'A punchy bonk.', variants=2,
    fn=lambda v: mix(modal(V(v, 300, 340), [1, 2.4], [0.06, 0.02], d=0.15, click=1.0), thump(110, 0.1, 0.03) * 0.5))
snd('mg.miss', A, 'Hook `miss`: missing (a whoosh through air).',
    'A small swish.',
    fn=lambda v: whoosh(0.15, 1200, 3500, 1.0, peak=0.5) * 0.6)
snd('mg.bearUp', A, 'Hook `bearUp`: the Sleeping Bear sits up.',
    'A low grumble rising: the bear growl, slowed a little and faded in.', note=PIX.format('universfield'),
    fn=lambda v: rec('universfield-bear-growl-191995', 0.03, 1.2, speed=0.85, fin=0.3, fout=0.15) * 0.7)
BIRD = [76, 79, 81, 84, 86, 88]
for i, m in enumerate(BIRD):
    snd(f'mg.note{i + 1}', A, f'Hook `note`: Birdsong note {i + 1} (one per color).',
        f'A whistled bird note, its own pitch ({m} in MIDI), with a little slide.',
        fn=(lambda mm: (lambda v: lp(osc(glide(hz(mm + 12) * 0.92, hz(mm + 12), 0.08), 0.3, vib=0.01, vib_rate=30) * adsr(0.3, 0.01, 0.1, 0.7, 0.1), 9000) * 0.8))(m))

# ════════════════════════════════════════════════════ MINIGAME SIGNATURES ═══
A = 'Minigame signatures'
G = lambda game, id, when, sound, fn, status='made', level='normal', variants=1: snd(
    id, A, f'**{game}:** {when}', sound, status=status, level=level, variants=variants, bus='minigame', fn=fn)


def buzz(d, f, jit=0.08, band=(250, 3000)):
    fr = f * (1 + jit * np.interp(np.linspace(0, 1, N(d)), np.linspace(0, 1, 12), R().standard_normal(12)))
    return bp(osc(fr, d, 'saw') * (1 + 0.3 * np.sin(2 * np.pi * 28 * T(d))), *band)


G('Incoming Bike!', 'bike.bell', 'a bike appears up the trail.', 'A bicycle bell: ring-ring.',
  lambda v: mix(bell(3300, 0.6, 1.5, 2.5, 0.05, 0.2) * 0.5, (bell(3300, 0.6, 1.5, 2.5, 0.05, 0.2) * 0.5, 0.12)))
G('Incoming Bike!', 'bike.whoosh', 'a bike flies past.', 'Tires and air rushing by.', variants=2,
  fn=lambda v: whoosh(0.45, 2500, 700, 1.2, peak=0.5) + bp(white(0.45), 200, 700) * swell(0.45, 0.5) * 0.3)
G('Incoming Bike!', 'bike.hop', 'the hiker hops aside.', 'A springy little hop.',
  lambda v: osc(glide(300, 700, 0.12), 0.14) * expdec(0.14, 0.06) * 0.7)
G('Incoming Bike!', 'bike.clip', 'a bike clips the hiker.', 'A clatter: bike rattle and a bump.',
  lambda v: mix(thump(90, 0.2, 0.05), clicks(0.3, 50, 1500, 5000, 8) * 0.4, (bell(2800, 0.3, 1.5, 2, 0.03, 0.08) * 0.3, 0.02)))
G('Wrong Turn', 'compass.ratchet', 'the needle turns (a tick every few degrees).', 'A fine ratchet tick.', level='soft',
  fn=lambda v: wood(3200, 0.03, 1) * 0.5)
G('Wrong Turn', 'compass.hold', 'the needle is in the notch and the lock bar fills.', 'A soft rising tone.',
  lambda v: chip(72, 0.6, 0.5, slide=84, vol=0.5))
G('Wrong Turn', 'compass.lock', 'a bearing locks.', 'A firm click and a chime.',
  lambda v: mix(wood(1400, 0.08, 1), (glass(2640, 0.6, 0.25) * 0.5, 0.02)))
G('Fallen Branch', 'saw.stroke', 'each saw stroke (A pushes, D pulls).', 'A raspy saw stroke; push and pull sound a little different.', variants=2,
  fn=lambda v: bp(white(0.22) * (1 + np.sin(2 * np.pi * V(v, 140, 110) * T(0.22))), V(v, 1800, 1400), V(v, 6000, 5000)) * swell(0.22, 0.4) * 0.8)
G('Fallen Branch', 'saw.bind', 'the saw binds (too fast).', 'A dull clunk and a metal twang.',
  lambda v: mix(thump(100, 0.15, 0.04), bell(700, 0.5, 2.3, 3, 0.05, 0.15) * 0.4))
G('Fallen Branch', 'saw.knot', 'the cut reaches a knot.', 'A woody creak.',
  lambda v: creak(0.5, (35, 80)) * 0.6)
G('Fallen Branch', 'saw.through', 'the branch is cut through and falls.', 'A crack and a heavy thud.', level='loud',
  fn=lambda v: mix(burst(0.06, 800, 6000, 0.015), creak(0.4, (60, 160)) * 0.4, (thump(55, 0.4, 0.1), 0.35), (grains(0.4, 100, 1000, 5000) * 0.4, 0.37)))
G('Snagged Pack', 'rope.drag', 'dragging a rope from cell to cell (a tick per cell).', 'A soft rope rub.', level='soft',
  fn=lambda v: bp(pink(0.06), 500, 2500) * swell(0.06) * 0.7)
G('Snagged Pack', 'rope.join', 'a rope reaches its socket.', 'A snug click.',
  lambda v: mix(wood(1000, 0.06, 1), (chip(84, 0.05, vol=0.4), 0.01)))
G('Whackoon', 'whackoon.bonk', 'the mallet hits a raccoon (Wyatt\'s hammer).', 'A cartoon wooden BONK with a squeak.',
  lambda v: mix(modal(280, [1, 2.5, 4.1], [0.1, 0.04, 0.02], d=0.25, click=1), (osc(glide(1800, 2600, 0.08), 0.08) * expdec(0.08, 0.04) * 0.3, 0.04)))
G('Whackoon', 'raccoon.chitter', 'a raccoon pops up.', 'A raccoon chitter (a real recording would be better).', status='placeholder',
  fn=lambda v: bp(osc(glide(1200, 1700, 0.35), 0.35, 'saw') * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 18 * T(0.35)))), 900, 4000) * swell(0.35, 0.3) * 0.5)
G('Fly Swatter', 'fly.buzz', 'flies buzzing (a loop while they fly).', 'A fly buzz that wanders in pitch.', level='soft',
  fn=lambda v: buzz(1.5, 210, 0.12, (300, 4000)) * swell(1.5, 0.5, 0.3, 0.3) * 0.5)
G('Fly Swatter', 'fly.splat', 'a fly is swatted.', 'A wet splat.',
  lambda v: mix(thump(130, 0.1, 0.02) * 0.6, lp(white(0.08), 2500) * expdec(0.08, 0.02)))
G('Firefly Catch', 'firefly.catch', 'a firefly is caught.', 'A twinkle and a jar clink.', variants=2,
  fn=lambda v: mix(tones(lambda m: glock(m, 0.6) * 0.4, V(v, [91, 96], [93, 98]), 0.05), (glass(2200, 0.35, 0.12) * 0.4, 0.1)))
G('Size Up', 'sizeup.stretch', 'growing or shrinking a step.', 'A springy "boing" up or down.', variants=2,
  fn=lambda v: osc(glide(V(v, 300, 600), V(v, 600, 300), 0.18), 0.2, vib=0.03, vib_rate=18) * expdec(0.2, 0.08) * 0.6)
G('Safari', 'safari.shutter', 'taking a photo.', 'A camera shutter and film wind.',
  lambda v: mix(burst(0.012, 2000, 8000, 0.002), (burst(0.012, 1500, 6000, 0.002) * 0.8, 0.06), (bp(white(0.25), 1500, 4000) * (1 + np.sign(np.sin(2 * np.pi * 40 * T(0.25)))) * 0.1, 0.12)))
G('Safari', 'safari.bigfoot', 'the rare Bigfoot appears.', 'A big distant roar: the bear growl, slowed way down, with a lot of echo.', level='loud',
  fn=lambda v: rec('universfield-bear-growl-191995', 0.03, 1.25, speed=0.68, fout=0.2, wet=0.4, t60=2.2, lowpass=3500))
G('Raccoon Shuffle', 'shuffle.slide', 'the cups slide around.', 'Wooden cups scraping on a table.', variants=2,
  fn=lambda v: bp(pink(0.25), 300, 1600) * swell(0.25, 0.5) * (1 + 0.5 * np.sin(2 * np.pi * 30 * T(0.25))) * 0.7)
G('Raccoon Shuffle', 'shuffle.lift', 'a cup is lifted.', 'A light wood clack.',
  lambda v: wood(950, 0.1) * 0.8)
G('Train!', 'train.horn', 'a train is coming (with the headlight flash).', 'A three-note train horn.', level='loud',
  fn=lambda v: lp(sum(osc(hz(m) * (1 + 0.003 * k), 1.2, 'saw') for k, m in enumerate([63, 66, 70, 73])), 1700, 4) * adsr(1.2, 0.06, 0.1, 0.9, 0.2) * 0.35)
G('Train!', 'train.pass', 'a train rumbles past.', 'A rumble with wheels clacking over rail joints.', level='loud',
  fn=lambda v: mix(lp(brown(2.0), 300) * swell(2.0, 0.5) * 0.9, *[(modal(1100, [1, 2.7], [0.02, 0.01], d=0.06, click=0.8) * 0.5 * swell(2.0, 0.5)[min(N(2.0) - 1, N(t))], t) for t in np.arange(0.1, 1.9, 0.27).tolist() + np.arange(0.18, 1.9, 0.27).tolist()]))
G('Train!', 'train.crossing', 'the crossing bell (a loop while a train is near).', 'Ding-ding of a railroad crossing.',
  lambda v: mix(bell(1800, 0.5, 1.41, 3, 0.05, 0.15) * 0.5, (bell(1800, 0.5, 1.41, 3, 0.05, 0.15) * 0.5, 0.5)))
G('Crossing', 'crossing.car', 'a car whooshes by.', 'A car passing: engine hum and air.', variants=2,
  fn=lambda v: mix(whoosh(0.8, 1800, 600, 1.4, peak=0.5) * 0.6, lp(osc(glide(110, 80, 0.8), 0.8, 'saw'), 500) * swell(0.8, 0.5) * 0.3))
G('Crossing', 'crossing.horn', 'a car honks at a slow hiker.', 'A short car horn.',
  lambda v: lp(osc(420, 0.35, 'square') + osc(505, 0.35, 'square'), 2500) * adsr(0.35, 0.01, 0.05, 0.9, 0.05) * 0.3)
G('Crossing', 'crossing.hop', 'each hop forward.', 'A small hop.', level='soft',
  fn=lambda v: osc(glide(400, 650, 0.07), 0.08) * expdec(0.08, 0.035) * 0.6)
G('Crossing', 'crossing.splash', 'falling in the river.', 'A splash.',
  lambda v: mix(shape(white(0.5), glide(4000, 700, 0.5), 1.4) * expdec(0.5, 0.15), (clicks(0.4, 30, 800, 2500, 10) * 0.3, 0.1)))
G('Rafting', 'raft.paddle', 'each paddle stroke.', 'A paddle dipping into water.', variants=2,
  fn=lambda v: shape(pink(0.3), glide(2500, 800, 0.3), 1.0) * swell(0.3, 0.3) * 0.8)
G('Rafting', 'raft.bump', 'the raft hits a rock.', 'A rubbery thud and a splash.',
  lambda v: mix(thump(70, 0.2, 0.05), (shape(white(0.3), glide(3000, 800, 0.3), 1.2) * expdec(0.3, 0.08) * 0.5, 0.02)))
G('Sleeping Bear', 'bear.snore', 'the bear sleeps (a loop).', 'Slow, rumbly snoring.', level='soft',
  fn=lambda v: mix(lp(pink(1.4) * (1 + 0.7 * np.sin(2 * np.pi * 32 * T(1.4))), 450) * swell(1.4, 0.6) * 0.9, (lp(pink(1.0), 900) * swell(1.0, 0.3) * 0.3, 1.5)))
G('Sleeping Bear', 'bear.tiptoe', 'a careful step near the bear.', 'A tiny, careful step.', level='soft', variants=2,
  fn=lambda v: lp(white(0.03), 900) * expdec(0.03, 0.006) * 0.5)
G('Sleeping Bear', 'bear.roar', 'the bear wakes up.', 'A bear growl.', level='loud',
  fn=lambda v: rec('universfield-bear-growl-191995', 0.03, 1.25, fout=0.12, wet=0.12))
G('Spooky Ghost!', 'ghost.wail', 'a ghost floats by.', 'A wavering, theremin-like wail with an echo.',
  lambda v: echo(osc(np.interp(np.linspace(0, 1, N(1.4)), [0, .3, .6, 1], [520, 880, 700, 440]), 1.4, vib=0.03, vib_rate=6) * swell(1.4, 0.3) * 0.4, 0.22, 0.4, 3, 2500))
G('Spooky Ghost!', 'ghost.flashlight', 'the flashlight clicks on or off.', 'A plastic switch click.',
  lambda v: mix(burst(0.01, 2000, 8000, 0.002), (burst(0.008, 1500, 5000, 0.002) * 0.5, 0.02)))
G('Spooky Ghost!', 'ghost.heartbeat', 'sanity is low (a loop that speeds up).', 'A heartbeat.', level='soft',
  fn=lambda v: mix(thump(50, 0.18, 0.05), (thump(46, 0.18, 0.05) * 0.7, 0.2)))
G('Spooky Ghost!', 'ghost.mitten', "a hiker's mitten is found.", 'A soft, relieved chime.',
  lambda v: tones(lambda m: glass(hz(m), 0.6, 0.25) * 0.4, [84, 88], 0.08))
G('Cracked Pots', 'pots.shard', 'a shard is picked up or set down.', 'A ceramic clink.', variants=3,
  fn=lambda v: modal(V(v, 1900, 2200, 2500), [1, 2.32, 4.25, 6.63], [0.08, 0.04, 0.02, 0.01], d=0.25, click=0.6) * 0.7)
G('Cracked Pots', 'pots.whole', 'a pot is whole again.', 'A ringing "ting" of a full pot.',
  lambda v: verb(modal(880, [1, 2.32, 4.25], [0.6, 0.25, 0.1], d=1.2, click=0.3) * 0.6, 0.8, 0.2))
G('Thin Ice', 'ice.crack', 'the ice cracks under a step.', 'A sharp, zinging ice crack.', variants=2,
  fn=lambda v: mix(burst(0.02, 2000, 9000, 0.004), osc(glide(5000, 900, 0.06), 0.06) * expdec(0.06, 0.02) * 0.5, clicks(0.15, 50, 2500, 7000, 6) * 0.4))
G('Thin Ice', 'ice.fall', 'a hiker falls through.', 'Ice breaking and a cold splash.', level='loud',
  fn=lambda v: mix(grains(0.2, 400, 2000, 8000), (shape(white(0.6), glide(4000, 600, 0.6), 1.4) * expdec(0.6, 0.2), 0.1)))
G('Minefield', 'minefield.squish', 'stepping in dog waste.', 'A wet squish (and an "ew" if Wyatt records one).',
  lambda v: mix(shape(pink(0.25), glide(1200, 250, 0.25), 0.7) * swell(0.25, 0.25) * 1.3, (clicks(0.15, 30, 600, 1500, 5) * 0.3, 0.05)))
G('Minefield', 'minefield.sniff', 'the dog sniffs a square.', 'Two quick sniffs.',
  lambda v: mix(bp(white(0.08), 2000, 6000) * swell(0.08) * 0.6, (bp(white(0.08), 2000, 6000) * swell(0.08) * 0.6, 0.13)))
G('Trail Blocks', 'blocks.land', 'a block lands.', 'A wooden block clack.', variants=2,
  fn=lambda v: wood(V(v, 700, 780), 0.14) * 0.9)
G('Trail Blocks', 'blocks.clear', 'a line clears.', 'A sweep and a chime.',
  lambda v: mix(whoosh(0.3, 800, 4000, 1.0) * 0.5, (tones(lambda m: glock(m, 0.8) * 0.4, [84, 91], 0.06), 0.2)))
G('Sketchy Bridge', 'bridge.creak', 'the bridge creaks (louder as it weakens).', 'Old wood and rope creaking.', variants=2,
  fn=lambda v: creak(0.8, (30, 90)) * 0.7)
G('Sketchy Bridge', 'bridge.break', 'the bridge breaks.', 'Planks snapping and falling.', level='loud',
  fn=lambda v: mix(burst(0.05, 800, 6000, 0.012), creak(0.3, (80, 200)) * 0.5, (grains(0.8, 60, 600, 3000, (0.01, 0.04)) * 0.6, 0.1), (thump(60, 0.3, 0.08) * 0.5, 0.7)))
G('Falling Rocks', 'rocks.fall', 'a rock falls toward its shadow.', 'A falling whistle.', variants=2,
  fn=lambda v: osc(glide(V(v, 1500, 1700), 500, 0.7), 0.7) * swell(0.7, 0.8) * 0.3)
G('Falling Rocks', 'rocks.impact', 'a rock lands.', 'A heavy thud and gravel.', variants=2,
  fn=lambda v: mix(thump(60, 0.3, 0.07), grains(0.4, 200, 800, 5000, env=np.linspace(1, 0, 10)) * 0.5))
G('Falling Rocks', 'rocks.rumble', 'a rockslide or avalanche warning.', 'A deep rumble.', level='loud',
  fn=lambda v: lp(brown(2.0), 160) * swell(2.0, 0.6) * 1.0)
G('Rock Climb', 'climb.grab', 'a hand grabs a hold.', 'A hand slap on rock.', variants=2,
  fn=lambda v: mix(burst(0.03, 600, 4000, 0.006), lp(white(0.04), 800) * expdec(0.04, 0.01) * 0.6))
G('Rock Climb', 'climb.power', 'the power meter goes up and down.', 'A soft tone that rises and falls with it.', level='soft',
  fn=lambda v: chip(72, 0.8, 0.5, slide=96, vol=0.4))
G('Rock Climb', 'climb.fall', 'a climber falls.', 'A whoosh down and a bump.',
  lambda v: mix(whoosh(0.5, 2500, 400, 1.2, peak=0.3) * 0.7, (thump(70, 0.2, 0.05) * 0.6, 0.45)))
G('Dodge', 'dodge.bees', 'bees (a loop while they swarm).', 'A swarm buzz.', level='soft',
  fn=lambda v: sum(buzz(1.5, f, 0.05, (200, 3000)) for f in (230, 247, 262)) * swell(1.5, 0.5, 0.2, 0.2) * 0.25)
G('Dodge', 'dodge.swordSwing', 'a sword swings or flies.', 'A sharp blade whoosh.', variants=2,
  fn=lambda v: whoosh(0.22, 1500, 5000, 0.7, 'white', 0.6) * 0.8)
G('Dodge', 'dodge.swordPoke', 'Sword Volley: a numbered sword pokes in.', 'A metal "shing".',
  lambda v: bell(2400, 0.6, 3.1, 4, 0.08, 0.2) * 0.4)
G('Dodge', 'dodge.shot', 'Bear with a Gun fires (cartoony).', 'A cartoon pop-bang with a short echo.', level='loud',
  fn=lambda v: verb(mix(hp(white(0.1), 600) * expdec(0.1, 0.02), thump(60, 0.2, 0.05)), 0.8, 0.25))
G('Dodge', 'dodge.aim', 'an aim line locks on.', 'A rising lock-on beep.',
  lambda v: chips([84, 88, 91, 96], 0.05, 0.04, duty=0.5))
G('Dodge', 'dodge.ricochet', 'Ricochet bounces.', 'A cartoon "pew-yeww".',
  lambda v: osc(glide(3200, 1200, 0.25), 0.25, vib=0.05, vib_rate=30) * expdec(0.25, 0.1) * 0.4)
G('Dodge', 'dodge.trap', 'a bear trap snaps.', 'A metal snap and clank.',
  lambda v: mix(bell(900, 0.4, 2.76, 4, 0.04, 0.1) * 0.5, burst(0.02, 1500, 8000, 0.004)))
G('Dodge', 'dodge.ants', 'ants march (a loop).', 'Tiny skittering clicks.', level='soft',
  fn=lambda v: clicks(1.2, 120, 3000, 7000, 8) * 0.25)
G('Dodge', 'dodge.antPop', 'a fire ant explodes.', 'A small pop and fizz.',
  lambda v: mix(burst(0.04, 400, 4000, 0.01), (hp(white(0.3), 3000) * expdec(0.3, 0.08) * 0.3, 0.02)))
G('Dodge', 'dodge.arrow', 'an arrow flies.', 'A thin arrow whistle and a thunk.',
  lambda v: mix(whoosh(0.2, 2500, 4500, 0.5, 'white', 0.8) * 0.6, (wood(500, 0.1) * 0.6, 0.2)))
G('Dodge', 'dodge.hurt', 'the party icon is hit.', 'A bump and a down blip.',
  lambda v: mix(thump(90, 0.15, 0.04), chip(72, 0.15, slide=60, vol=0.4)))
G('Dodge', 'dodge.eagle', 'an Eagle swoops.', 'An eagle screech.', level='loud',
  fn=lambda v: rec('u_jfkxueyart-eagle-281163', 0.03, 1.8, fout=0.2, wet=0.15))
G('Dodge', 'dodge.snowLeopard', 'the Snow Leopard pounces.', 'A big-cat snarl (the first roar of the leopard recording).', level='loud',
  fn=lambda v: rec('dffdv-leopard-attack-193175', 0.03, 1.45, fout=0.25))
G('Dodge', 'dodge.snowgirl', 'the Abominable Snowgirl roars.', 'A smaller, higher roar: the bear growl sped up, with an icy echo. *(Claude\'s pick)*', level='loud',
  fn=lambda v: rec('universfield-bear-growl-191995', 0.03, 1.25, speed=1.25, fout=0.12, wet=0.3, t60=1.6))
G('Dodge', 'dodge.bearRoar', 'Bear with a Sword or Gun arrives.', 'The bear growl, a little bigger.', level='loud',
  fn=lambda v: rec('universfield-bear-growl-191995', 0.03, 1.25, speed=0.92, fout=0.12, wet=0.15))
G('Dodge', 'dodge.monster', 'the Woods Monster attacks.', 'A deep, weird growl.', status='placeholder',
  fn=lambda v: lp(osc(glide(70, 50, 1.2), 1.2, 'saw', vib=0.06, vib_rate=7) + 0.6 * osc(glide(105, 74, 1.2), 1.2, 'saw'), 900) * swell(1.2, 0.3) * (1 + 0.4 * np.sin(2 * np.pi * 17 * T(1.2))) * 0.5)
G('Squirrel Theft', 'squirrel.scurry', 'a squirrel scurries.', 'Tiny claws pattering on bark.',
  lambda v: clicks(0.45, 45, 2500, 5000, 10, env=swell(0.45)) * 0.5)
G('Squirrel Theft', 'squirrel.chitter', 'a squirrel steals something.', 'A squirrel chitter (a real recording would be better).', status='placeholder',
  fn=lambda v: bp(osc(glide(3500, 4500, 0.4), 0.4) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * T(0.4)))), 2500, 7000) * swell(0.4, 0.2) * 0.4)
G('Pack It Up', 'pack.drop', 'an item drops into the pack grid.', 'A soft canvas thunk.', variants=2,
  fn=lambda v: mix(thump(V(v, 140, 160), 0.1, 0.025), lp(pink(0.08), 1500) * expdec(0.08, 0.02) * 0.4))
G('Pack It Up', 'pack.rotate', 'rotating an item.', 'A quick click-turn.', level='soft',
  fn=lambda v: mix(wood(1500, 0.05, 0.8), (wood(1700, 0.05, 0.8) * 0.6, 0.04)))
G('Camp Cleanup', 'cleanup.pick', 'trash is picked up.', 'A plastic crinkle.', variants=2,
  fn=lambda v: grains(0.2, 300, 3000, 8000, (0.001, 0.006), env=swell(0.2, 0.3)) * 0.7)
G('Camp Cleanup', 'cleanup.crash', 'the line crashes and drops bags.', 'A bump and bags tumbling.',
  lambda v: mix(thump(80, 0.2, 0.05), (grains(0.5, 200, 1500, 7000, env=np.linspace(1, 0, 10)) * 0.6, 0.05)))
G('Fake Trail Signs', 'signs.stamp', 'a sign is judged REAL or FAKE.', 'A wooden stamp.', variants=2,
  fn=lambda v: mix(thump(V(v, 110, 90), 0.12, 0.03), wood(V(v, 700, 500), 0.12) * 0.6))
G('Trails', 'trails.offTrail', 'the hiker leaves the trail (a loop while off it).', 'Brushing through undergrowth.', level='soft',
  fn=lambda v: grains(1.0, 200, 1500, 6000, env=swell(1.0, 0.5, 0.3, 0.3)) * 0.6)
G('Trails', 'trails.gust', 'Ridgeline: a wind gust.', 'A strong gust.',
  lambda v: whoosh(1.2, 300, 1500, 1.0, peak=0.5) * 0.9)
G('Trails', 'trails.scree', 'Ridgeline: scree slides.', 'Gravel sliding away.',
  lambda v: grains(1.0, 300, 600, 4000, env=swell(1.0, 0.2)) * 0.7)
G('Crossroads', 'crossroads.arrow', 'each arrow of the row shows.', 'A soft blip, higher for each arrow.', variants=4,
  fn=lambda v: chip(76 + 2 * v, 0.07, 0.5, vol=0.7))
G('Traildle', 'traildle.key', 'typing a letter.', 'A typewriter-ish key tick.', level='soft', variants=2,
  fn=lambda v: mix(wood(V(v, 1900, 2050), 0.05, 1), burst(0.01, 3000, 9000, 0.002) * 0.4))
G('Memory Puzzle', 'memory.match', 'two cards match.', 'A bright two-note chime.',
  lambda v: tones(lambda m: glock(m, 0.7) * 0.5, [84, 91], 0.07))
G('Picture Puzzle', 'puzzle.snap', 'a piece snaps into place.', 'A satisfying cardboard snap.',
  lambda v: mix(burst(0.015, 1200, 6000, 0.003), wood(900, 0.08) * 0.5))
G('Birdsong', 'birdsong.phrase', 'the bird sings the phrase to repeat (uses notes 1-6).', 'Uses the six `mg.note` sounds.',
  status='made', fn=lambda v: tones(lambda m: lp(osc(glide(hz(m + 12) * 0.92, hz(m + 12), 0.08), 0.25, vib=0.01, vib_rate=30) * adsr(0.25, 0.01, 0.1, 0.7, 0.1), 9000) * 0.7, [76, 81, 79, 86], 0.3))

# ═══════════════════════════════════════════════════════════ NIGHT EVENTS ═══
A = 'Night events'
snd('night.nuisance', A, 'A nuisance night event begins (Raccoons, Opossums, Foxes, Bats, Drunk Hiker).',
    'A sneaky pizzicato-like sting: four plucks tiptoeing down.', level='loud',
    fn=lambda v: tones(lambda m: marimba(m, 0.4, 0.3) * 0.8, [69, 67, 64, 61], 0.14))
snd('night.danger', A, 'A dangerous night event begins (Wolves, Coyotes, Hyenas, Bears, Leopards, Bobcats, Robbers).',
    'A tense low sting: a deep hit and a dark swell.', level='loud',
    fn=lambda v: mix(thump(45, 0.6, 0.18), lp(chord_pad([38, 45, 46], 1.6, 'saw', 900, 0.4, 0.8), 1200) * 0.8))
snd('night.eerie', A, 'An eerie night event begins (Cultists, the Monster).',
    'A weird, wavering low drone and glassy notes.', level='loud',
    fn=lambda v: verb(mix(lp(chord_pad([41, 47, 53], 2.4, 'saw', 700, 0.6, 1.0), 900) * 0.7, (tones(lambda m: glass(hz(m), 0.9, 0.35) * 0.2, [90, 89, 85], 0.35), 0.4)), 2.0, 0.4))
snd('night.good', A, 'The night event ends well.',
    'A relieved, warm two-note chime.',
    fn=lambda v: tones(lambda m: kalimba(m, 1.0) * 0.6, [64, 71], 0.12))
snd('night.bad', A, 'The night event ends badly (something lost or hurt).',
    'A soft, low "oh no" of two notes falling.',
    fn=lambda v: tones(lambda m: marimba(m, 0.9, 0.4) * 0.8, [55, 49], 0.25))
snd('night.bats', A, 'Bats.', 'Quick, very high squeaks and wing flutters.',
    fn=lambda v: mix(*[(osc(glide(9000, 7000, 0.03), 0.03) * expdec(0.03, 0.01) * 0.3, t) for t in (0, 0.12, 0.17, 0.4, 0.46)], lp(white(0.6) * (1 + np.sign(np.sin(2 * np.pi * 14 * T(0.6)))), 1200) * swell(0.6) * 0.3))
snd('night.robbers', A, 'Robbers.', 'Sneaking footsteps and a bag being rummaged.',
    fn=lambda v: mix(step_boot(0), (step_boot(1), 0.45), (grains(0.6, 150, 1500, 6000, env=swell(0.6)) * 0.5, 0.9)))
snd('night.opossums', A, 'Opossums.', 'A hiss.', status='placeholder',
    fn=lambda v: bp(white(0.7), 2500, 8000) * swell(0.7, 0.2) * 0.5)
snd('night.wolves', A, 'Wolves.', 'A wolf howl (a real recording would be much better).', status='placeholder', level='loud',
    fn=lambda v: verb(lp(osc(np.interp(np.linspace(0, 1, N(2.6)), [0, .15, .6, 1], [380, 640, 600, 420]), 2.6, 'tri', vib=0.012, vib_rate=5) + 0.2 * osc(np.interp(np.linspace(0, 1, N(2.6)), [0, .15, .6, 1], [760, 1280, 1200, 840]), 2.6), 2000) * swell(2.6, 0.25, 1, 1.5) * 0.5, 2.5, 0.45))
snd('night.monster', A, 'The Monster.', 'Uses the Woods Monster growl from Dodge.', status='placeholder', fn=None,
    note='Same file as dodge.monster.')
snd('night.bears', A, 'Bears.', 'The bear growl, slower, out in the dark.', level='loud', note=PIX.format('universfield'),
    fn=lambda v: rec('universfield-bear-growl-191995', 0.03, 1.25, speed=0.88, fout=0.15, wet=0.35, t60=1.8))
snd('night.leopards', A, 'Leopards.', 'The whole leopard recording: a snarling attack.', level='loud', note=PIX.format('dffdv'),
    fn=lambda v: rec('dffdv-leopard-attack-193175', 0.03, 3.6, fout=0.3, wet=0.25, t60=1.5))
snd('night.bobcats', A, 'Bobcats.', 'The leopard snarls sped up into a smaller, higher cat.', level='loud', note=PIX.format('dffdv'),
    fn=lambda v: rec('dffdv-leopard-attack-193175', 0.03, 2.3, speed=1.3, fout=0.2, wet=0.25, t60=1.5))
snd('night.cultists', A, 'Cultists.', 'Low occult chanting, faded in and out (12 seconds of the recording).', note=PIX.format('alex_jauk'),
    fn=lambda v: rec('alex_jauk-occult-chant-ambience-192416', 30.0, 42.0, fin=1.0, fout=2.5))
snd('night.drunkHiker', A, 'The Drunk Hiker.', 'A can cracking open, a laugh, then a hiccup.', level='loud', note='From Pixabay (saboteurcomics, universfield, freesound_community), Pixabay Content License.',
    fn=lambda v: mix(rec('saboteurcomics-beer-opening-407833', 0.0, 1.2, fout=0.05), (rec('universfield-male-laughter-121577', 0.35, 3.15, fin=0.05, fout=0.15), 1.4), (rec('freesound_community-male-hiccup-67892', 5.98, 6.4, fout=0.06), 4.45)))
for name, what in [('raccoons', 'Raccoon chitters and trash rattling'), ('foxes', 'A fox scream'),
                   ('coyotes', 'Coyote yips'), ('hyenas', 'Hyena laughs'), ('raccoonGang', 'Lots of raccoon chitters')]:
    snd(f'night.{name}', A, name[0].upper() + name[1:].replace('Hiker', ' Hiker').replace('Gang', ' Gang') + '.', what + '.', status='need', fn=None)

# ══════════════════════════════════════════════════════════ HIKER VOICES ═══
A = 'Hiker voices'
VOICE_WHEN = {'cheer': 'a level up, a passed challenge, a Wonder', 'oof': 'an injury, a failed part, passing out', 'yawn': 'Sleep'}
for kind, sounds_ in [('man', [('cheer', 'A happy "Yes!" or "Woo!"'), ('oof', 'An "oof" or a hurt grunt'), ('yawn', 'A big yawn')]),
                      ('woman', [('cheer', 'A happy "Yay!" or "Woo!"'), ('oof', 'An "oof" or a hurt grunt'), ('yawn', 'A big yawn')]),
                      ('dog', [('cheer', 'A happy bark or two'), ('oof', 'A whimper'), ('yawn', 'A dog yawn or a big sigh')]),
                      ('cat', [('cheer', 'A happy meow'), ('oof', 'A hiss or yowl'), ('yawn', 'A purr')])]:
    for what, desc in sounds_:
        snd(f'voice.{kind}.{what}', A, f'Any {kind} hiker: {VOICE_WHEN[what]}.', desc + '. A generic stock sound.', status='need', fn=None)
snd('voice.plush.cheer', A, 'Any plush hiker: a level up, a passed challenge, a Wonder.', 'Two happy squeaks of a squeaky toy, going up.',
    fn=lambda v: mix(lp(osc(glide(1300, 1900, 0.12), 0.14, 'tri', vib=0.04, vib_rate=40), 5000) * swell(0.14, 0.3) * 0.6, (lp(osc(glide(1500, 2300, 0.14), 0.16, 'tri', vib=0.04, vib_rate=40), 5000) * swell(0.16, 0.3) * 0.6, 0.2)))
snd('voice.plush.oof', A, 'Any plush hiker: an injury, a failed part, passing out.', 'A long, deflating squeak going down.',
    fn=lambda v: lp(osc(glide(1800, 700, 0.5), 0.5, 'tri', vib=0.05, vib_rate=35), 4500) * swell(0.5, 0.15) * 0.6)
snd('voice.plush.yawn', A, 'Any plush hiker: Sleep.', 'A slow, soft squeak like air leaving a cushion.',
    fn=lambda v: mix(lp(osc(glide(900, 600, 0.6), 0.6, 'tri', vib=0.02, vib_rate=8), 3000) * swell(0.6, 0.4) * 0.4, lp(pink(0.7), 1200) * swell(0.7, 0.5) * 0.3))

# ═════════════════════════════════════════════════════════════════ AMBIENCE ═══
A = 'Ambience'
L = 24.0  # seconds per loop


def bird(kind, at=0.0, pitch=1.0):
    if kind == 0:  # chickadee "fee-bee"
        y = mix(osc(glide(4100 * pitch, 4000 * pitch, 0.25), 0.25) * swell(0.25, 0.2), (osc(glide(3500 * pitch, 3400 * pitch, 0.3), 0.3) * swell(0.3, 0.15), 0.3))
    elif kind == 1:  # trill
        y = mix(*[(osc(glide(5200 * pitch, 3800 * pitch, 0.04), 0.04) * swell(0.04, 0.1), i * 0.055) for i in range(12)])
    elif kind == 2:  # robin-ish phrase
        ps = [3000, 3400, 2800, 3600, 3100]
        y = mix(*[(osc(glide(p * pitch, p * 1.12 * pitch, 0.09), 0.1) * swell(0.1, 0.3), i * 0.13) for i, p in enumerate(ps)])
    else:  # a single rising chirp
        y = osc(glide(2500 * pitch, 5000 * pitch, 0.07), 0.08) * swell(0.08, 0.2)
    return y * 0.25


def scatter(dur, gen, rate, pan=0.9, vol=(0.3, 1.0), wet=0.3, t60=1.4):
    out = np.zeros((N(dur), 2))
    t = R().uniform(0, 1 / rate)
    while t < dur - 3:
        s = stereo(gen() * R().uniform(*vol), R().uniform(-pan, pan))
        out = place(out, s, t)
        t += R().exponential(1 / rate)
    out = out[:N(dur)]
    return verb(out, t60, wet)[:N(dur)]


def crickets(dur, n=5, base=4300):
    out = np.zeros((N(dur), 2))
    for k in range(n):
        f = base * R().uniform(0.85, 1.2)
        rate = R().uniform(1.2, 2.5)
        pan = R().uniform(-0.9, 0.9)
        vol = R().uniform(0.15, 0.4)
        chirp = osc(f, 0.11) * (np.sin(2 * np.pi * 30 * T(0.11)) > 0.2) * swell(0.11, 0.3)
        t = R().uniform(0, 1)
        while t < dur:
            out = place(out, stereo(chirp * vol, pan), t)
            t += 1 / rate * R().uniform(0.9, 1.1)
    return out[:N(dur)]


def frogs(dur, rate=0.7):
    def croak():
        d = R().uniform(0.25, 0.45)
        f0 = R().uniform(300, 600)
        imp = (np.sin(2 * np.pi * R().uniform(22, 35) * T(d)) > 0.9).astype(float)
        return (reso(imp, f0, 6) + 0.5 * reso(imp, f0 * 2.1, 8)) * swell(d, 0.4) * 0.4
    return scatter(dur, croak, rate, 0.8, (0.3, 0.9), 0.2, 1.0)


def breeze(dur, lo=300, hi=1400, vol=0.5, color='pink'):
    src = {'white': white, 'pink': pink, 'brown': brown}[color](dur)
    c = np.interp(np.linspace(0, 1, 40), np.linspace(0, 1, 9), R().uniform(lo, hi, 9))
    y = shape(src, c, 1.6) * (0.6 + 0.4 * np.interp(np.linspace(0, 1, N(dur)), np.linspace(0, 1, 8), R().uniform(0.2, 1, 8)))
    return stereo(y * vol, 0) * np.array([1, 0.92]) + stereo(np.roll(y, N(0.3)) * vol * 0.4, 0) * np.array([0.3, 1])


def stream(dur, vol=0.6):
    base = sum(reso(pink(dur), f, 3) * 0.3 for f in (500, 900, 1600, 2600))
    bub = np.zeros(N(dur) + N(0.1))
    for _ in range(int(dur * 25)):
        at = R().uniform(0, dur)
        f = R().uniform(400, 1500)
        d = R().uniform(0.01, 0.03)
        bub = place(bub, osc(glide(f, f * 1.8, d), d) * expdec(d, d / 3, 0.001) * R().uniform(0.1, 0.4), at)
    y = base / (np.max(np.abs(base)) + 1e-9) * 0.6 + bub[:N(dur)] * 0.5
    return np.stack([y, np.roll(y, N(0.13))], 1) * vol


def fire(dur, vol=0.6):
    roar = lp(brown(dur), 400) * 0.4
    pops = clicks(dur, 9, 1200, 4500, 4, (0.2, 1)) * 0.5 + clicks(dur, 1.0, 600, 2000, 3, (0.6, 1)) * 0.7
    y = roar + pops[:N(dur)]
    return stereo(y * vol, 0)


def rain(dur, vol=0.6):
    y = hp(lp(pink(dur), 7000), 400) * 0.5
    drops = clicks(dur, 120, 2500, 7000, 8, (0.1, 0.5))[:N(dur)]
    return np.stack([y + drops * 0.4, np.roll(y, N(0.2)) + np.roll(drops, N(0.07)) * 0.4], 1) * vol


def amb(id, when, sound, gen, status='placeholder', note=None, loop=L):
    snd(id, A, when, sound, status=status, level='bed', loop=loop, bus='ambience', fn=gen, note=note)


def bed(name, a, length, lowpass=None, vol=1.0):
    """A loop cut from one of Wyatt's nature recordings (the last 1 s crossfades into the start)."""
    return lambda v: rec(name, a, a + length + 1.0, fin=0, fout=0, lowpass=lowpass) * vol


amb('amb.meadow.day', 'The Meadow by day (loops under everything).',
    'A sunny forest edge full of songbirds.', bed('dany_photo-forestbirds-319791', 5.0, 40), status='made', loop=40, note=PIX.format('dany_photo'))
amb('amb.meadow.night', 'The Meadow at night.',
    'A steady chorus of crickets.', bed('capaholiczsfx-forest-night-403609', 5.0, 40), status='made', loop=40, note=PIX.format('capaholiczsfx'))
amb('amb.rainforest.day', 'The Temperate Rainforest by day.',
    'A rich, busy forest: many birds, rustling leaves.', bed('soundreality-nature-forest-537925', 2.0, 40), status='made', loop=40, note=PIX.format('soundreality'))
amb('amb.rainforest.night', 'The Temperate Rainforest at night.',
    'Frogs and crickets pulsing together.', bed('eryliaa-night-forest-frogs-crickets-451153', 2.0, 40), status='made', loop=40, note=PIX.format('eryliaa'))
amb('amb.alpine.day', 'The Alpine biome by day.',
    'A steady mountain wind (the one-shot birds still come now and then).', bed('soundreality-wind-blowing-457954', 2.0, 38), status='made', loop=38, note=PIX.format('soundreality'))
amb('amb.alpine.night', 'The Alpine biome at night.',
    'A cold, hollow blizzard wind, softened.', bed('dragon-studio-blizzard-wind-463217', 0.5, 16, lowpass=2500), status='made', loop=16, note=PIX.format('dragon-studio'))
amb('amb.river', 'Layered on top when the selected hiker is on a tile with a River node.',
    'A babbling stream.', lambda v: stream(L + 1, 0.6), status='made')
amb('amb.fire', 'Layered on at night when someone sits by the fire, at campsites, and in the station.',
    'A crackling campfire.', lambda v: fire(L + 1), status='made')
amb('amb.rain', 'Layered on while it rains (any biome).',
    'Steady rain in a forest.', bed('soundsforyou-rain-in-forest-111405', 2.0, 40), status='made', loop=40, note=PIX.format('soundsforyou'))
amb('amb.wind', 'Layered on while it\'s windy.',
    'Strong winter gusts.', bed('dragon-studio-winter-wind-402331', 1.5, 16), status='made', loop=16, note=PIX.format('dragon-studio'))
amb('amb.snow', 'Layered on while it snows.',
    'A hush: very soft, muffled wind.', lambda v: breeze(L + 1, 180, 450, 0.35, 'brown'), status='made')
amb('amb.heat', 'Layered on during a heatwave (by day).',
    'Cicadas buzzing in slow waves.',
    lambda v: stereo(bp(white(L + 1) * (1 + np.sin(2 * np.pi * 180 * T(L + 1))), 4200, 7200) * (0.4 + 0.6 * np.sin(np.linspace(0, 6 * np.pi, N(L + 1))) ** 2) * 0.25, 0.2), status='made')
amb('amb.station', 'Inside the Ranger Station.',
    'A quiet room: the fireplace, a ticking clock, an old radio murmuring very low.',
    lambda v: fire(L + 1, 0.35) + stereo(fit(mix(*[(wood(2000 if i % 2 else 1700, 0.05, 0.6) * 0.15, i * 0.5) for i in range(int(L * 2) + 2)]), L + 1), 0.5) + stereo(bp(pink(L + 1), 400, 2500) * 0.03, -0.4))
amb('amb.title', 'The title screen (under the menu music).',
    'Evening forest: a few crickets and a soft breeze.',
    lambda v: crickets(L + 1, 3) * 0.6 + breeze(L + 1, 250, 800, 0.2), status='made')

A = 'Ambience one-shots'
snd('amb.bird', A, 'Random birds by day (the ambience scheduler plays these now and then, panned).',
    'Songbird calls: a "fee-bee", a trill, a robin phrase, a chirp.', variants=4, bus='ambience', status='placeholder',
    fn=lambda v: verb(bird(v), 1.2, 0.3))
snd('amb.woodpecker', A, 'Random, in the Forest and Rainforest by day.',
    'A woodpecker drumming.', bus='ambience',
    fn=lambda v: verb(mix(*[(wood(1050, 0.05, 1) * (1 - i / 22), i * 0.055) for i in range(18)]), 1.2, 0.3) * 0.6)
snd('amb.owl', A, 'Random at night.',
    'An owl: "hoo, hoo-hoooo".', bus='ambience', status='placeholder',
    fn=lambda v: verb(mix(*[(lp(osc(glide(400, 370, _d), _d) * swell(_d, 0.2) + 0.1 * lp(white(_d), 800) * swell(_d), 1200) * 0.4, _t) for _t, _d in ((0, 0.35), (0.6, 0.25), (0.9, 0.6))]), 1.6, 0.35))
snd('amb.twig', A, 'Random, all biomes by day and night.',
    'A twig snapping somewhere nearby.', bus='ambience',
    fn=lambda v: verb(burst(0.025, 1500, 6000, 0.005), 1.0, 0.3) * 0.5)
snd('amb.frog', A, 'Random near River nodes and in the Rainforest.',
    'A single frog croak.', bus='ambience', status='placeholder',
    fn=lambda v: reso((np.sin(2 * np.pi * 28 * T(0.35)) > 0.9).astype(float), 450, 6) * swell(0.35, 0.4) * 0.4)
snd('amb.wolfFar', A, 'Very rarely, Alpine nights.',
    'A wolf howling far away.', bus='ambience', status='placeholder', fn=None, note='Uses night.wolves, quieter and with more reverb.')

# ═══════════════════════════════════════════════════════════ RUN START/END ═══
A = 'Start and end of a hike'
snd('hike.start', A, 'The hike starts (after packing, as the map appears).',
    'A trail whistle and boots setting off.', level='loud',
    fn=lambda v: mix(lp(osc(glide(1900, 2300, 0.4), 0.6, vib=0.02, vib_rate=25) * adsr(0.6, 0.03, 0.1, 0.8, 0.15), 6000) * 0.4, (step_boot(0), 0.65), (step_boot(1), 0.95), (step_boot(2), 1.25)))
snd('hike.summit', A, 'The party reaches the summit (the hike is won).',
    'A big, happy fanfare: marimba, glockenspiel and a cymbal swell, 4 seconds.', level='loud',
    fn=lambda v: verb(mix(tones(lambda m: marimba(m, 0.8), [60, 64, 67, 72, 67, 72, 76], 0.11), (tones(lambda m: glock(m, 2.4) * 0.35, [72, 76, 79, 84, 88], 0.03), 0.8), (hp(white(1.0), 5000) * swell(1.0, 0.85) * 0.25, 0), (chord_pad([48, 55, 60, 64], 2.6, 'tri', 2500, 0.3, 1.2) * 0.5, 0.75)), 1.8, 0.3))
snd('hike.over', A, 'The hike is over: everyone passed out or left.',
    'A gentle, sad phrase going down, 3 seconds.', level='loud',
    fn=lambda v: verb(tones(lambda m: marimba(m, 1.4, 0.4) * 0.8, [67, 64, 62, 60, 55], 0.4), 2.0, 0.35))
snd('hike.tally', A, 'Counting up the final numbers on the end screen.',
    'Quick ticks, one per point.', level='soft',
    fn=lambda v: wood(2200, 0.04, 0.8) * 0.6)

# ════════════════════════════════════════════════════════════ PACKING ════
A = 'Packing machines'
for k, what in [('tick, stop, ratchet', 'reels'), ('clink, pop, clack', 'taking and bonuses'), ('chime, win, fanfare, drum', 'rows and jackpots'),
                ('whoosh, sad', 'Second Wind and misses'), ('crtOn, zap, modem, boot, sweep', 'TrailMate only')]:
    snd(f'packing.{what.split()[0].lower()}', A, f'Packing: {what}.', f'Already made in code for both looks: {k}.', status='code', fn=None)

# Where Wyatt's recordings came from (shown as notes on the board and in the list).
SOURCES = {'bear.roar': 'universfield', 'dodge.bearRoar': 'universfield', 'safari.bigfoot': 'universfield', 'dodge.snowgirl': 'universfield',
           'dodge.eagle': 'u_jfkxueyart', 'dodge.snowLeopard': 'dffdv'}
for _e in S:
    if _e['id'] in SOURCES:
        _e['note'] = PIX.format(SOURCES[_e['id']])
