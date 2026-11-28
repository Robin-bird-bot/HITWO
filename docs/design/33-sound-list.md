# Sound

Every sound the game needs: where it plays, what it sounds like, and whether it's made. **342 sounds** (412 files, counting variations): **309 made**, **11 placeholders** (made, but a real recording would be better), **17 that need a recording**, and **5 already in the game's code** (the packing machines). Listen to all of them on the sound board: https://claude.ai/artifact/RyKcF15ft8Yyi49ZudQVLH

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

### Menus and windows

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `ui.hover` (2 versions) | The pointer moves onto a button (buttons only, not cards or tiles). | A tiny, soft wooden tick. | Made |
| `ui.click` (3 versions) | Any button or menu item is pressed. | A short wooden click, like a pencil tapped on a desk. | Made |
| `ui.confirm` | OK, Done, Take, Buy: a choice is made. | Two marimba notes going up (C, then G). | Made |
| `ui.cancel` | Cancel, Back, closing a choice without picking. | Two soft marimba notes going down. | Made |
| `ui.error` | Something can't be done (not enough caps, can't move there). | A muffled low double "bonk", a little out of tune. | Made |
| `ui.windowOpen` | A window opens (scavenge, crafting, the station counter, traits, the infoboard). | A poster unrolling: a quick paper swish up and a soft thump. | Made |
| `ui.windowClose` | A window closes. | The same paper swish going down, ending in a light tap. | Made |
| `ui.tab` (2 versions) | Switching tabs in a window. | A quick paper flick. | Made |
| `ui.toggleOn` | A setting is switched on. | A switch clicking up: two quick clicks, the second higher. | Made |
| `ui.toggleOff` | A setting is switched off. | The same clicks going down. | Made |
| `ui.slider` | Dragging a slider (it also plays at the new volume, so you hear the level). | A small tick per step. | Made |
| `ui.toast` | A note pops up (a trait worked, "Family Cookbook: no Energy"). | One kalimba note and its fifth, light. | Made |
| `ui.dragPick` | Picking up something to drag (a resource, an item, a hiker on the map). | A soft lift: a tiny rising swish and a tick. | Made |
| `ui.dragDrop` | Dropping it somewhere it can go. | A soft place: a small thud and a tick. | Made |
| `ui.dragNo` | Dropping it somewhere it can't go (it slides back). | A soft, short buzz. | Made |
| `ui.endPhase` | The End Phase button. | A deeper wooden knock with a little chime on top. | Made |
| `ui.settings` | The settings or pause menu opens. | A drawer sliding open (soft wood scrape and click). | Made |

### Title and hiker select

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `title.start` | New hike or Continue on the title screen. | A bright marimba run up, C-E-G-C, with a glockenspiel on the top note. | Made |
| `select.add` | A hiker joins the party on hiker select. | A card snap and two bright kalimba notes going up. | Made |
| `select.remove` | A hiker leaves the party. | A card slid back into the deck: a swish down. | Made |
| `select.flip` | Flipping a hiker card to see the back. | A card flip: a snap and a short swish. | Made |
| `select.sort` | Sorting the hiker cards (the ribbons). | A short shuffle of cards. | Made |
| `select.go` | Let's go: the party is picked, on to packing. | Boots stomping twice and a rising whistle-like glock. | Made |

### Cards

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `card.deal` (4 versions) | Each card dealt (scavenge, crafting, challenge, level-up choices). | A quick card swish that lands with a tiny tap. | Made |
| `card.flip` (3 versions) | A card turns face up. | A crisp snap. | Made |
| `card.hover` | The pointer moves onto a face-down card (it lifts a little). | A very soft paper brush. | Made |
| `card.take` (2 versions) | A card is taken (a resource or item goes to the bag). | A swish up and a round pop. | Made |
| `card.discard` | Cards that weren't taken slide away. | A swish going down. | Made |
| `card.shuffle` | A deck is shuffled (a reroll, a new deal). | A riffle: a run of tiny card clicks that speeds up. | Made |
| `card.rare` | A rare card shows (a glow on a face-down card, a Tier II+ item). | A glassy shimmer that rises. | Made |
| `card.challenge` | A challenge card slides in from the top, flips and zooms in. | A longer slide, a thump as it lands, then a flip snap. | Made |

### Phase 12 UI

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `ui.frameOpen` | A hiker frame opens to show traits, conditions and gear. | A paper tag unfolding: a soft flap and a wooden tick. | Made |
| `ui.frameClose` | A hiker frame folds back up. | The same flap, shorter, ending a step lower. | Made |
| `ui.wheelOpen` | The action wheel pops open above the selected hiker. | A soft puff, then seven tiny wooden pops going up, one per button. | Made |
| `ui.wheelClose` | The action wheel closes. | The pops going back down, quicker and softer. | Made |
| `ui.star` | A recipe or a resource is starred as a favorite. | A bright kalimba ding-ding, going up. | Made |
| `ui.unstar` | A favorite is unstarred. | One soft, lower kalimba note. | Made |
| `book.page` (2 versions) | The recipe book turns to another tab. | A page turning: a soft paper sweep with a little crackle. | Made |
| `craft.slot` (2 versions) | A resource lands in a workbench slot (the game raises the pitch a step for each slot). | A short wooden clack with a soft thud under it. | Made |
| `craft.ghost` | A slot the recipe needs but the hiker is missing. | A hollow, muted knock. | Made |
| `craft.clear` | The workbench is cleared (Clear, or picking another recipe). | A quick wooden rattle sliding down. | Made |
| `craft.ready` | Every slot is filled: the recipe can be crafted. | Two small glockenspiel notes, a fifth apart. | Made |
| `scav.brush.forest` (3 versions) | Brushing leaves off a scavenge card (the brush reveal) on a Forest card; repeats while dragging. | A dry leaf rustle. | Made |
| `scav.brush.river` (3 versions) | Brushing water and pebbles off a River card. | A small water swish with a pebble click. | Made |
| `scav.brush.wildlife` (3 versions) | Brushing tall grass aside on a Wildlife card. | A grassy swish. | Made |
| `scav.brush.mountain` (3 versions) | Brushing gravel off a Mountain card. | A gravelly scrape. | Made |
| `scav.uncover` | A covered card is fully brushed clear and pops up. | A puff, then a little rising sparkle. | Made |
| `trans.irisIn` | The spotlight transition closes in on a point (a click, a tile, a button). | A soft, falling whoosh that tightens, ending in a small low thump as it goes dark. | Made |
| `trans.irisOut` | The spotlight transition opens on the new scene. | A rising, airy whoosh with a light shimmer at the top. | Made |
| `trans.door` | The Ranger Station doors swing open after the party checks in. | A wooden latch clack, a long creak of two heavy doors, and a little shop bell. | Made |
| `load.jump` | The little hiker jumps on the loading screen (runner and jumper). | A soft TrailMate boop sliding up. | Made |
| `title.logo` | The title logo drops in on the title screen. | A heavy wooden thunk and a puff of leaves. | Made |
| `card.reveal.uncommon` | A card flips face up and is uncommon (slot-machine style: one more chime per rarity step). Common cards just snap. | 2 quick bell chimes going up. | Made |
| `card.reveal.rare` | A card flips face up and is rare (slot-machine style: one more chime per rarity step). Common cards just snap. | 3 quick bell chimes going up. | Made |
| `card.reveal.veryRare` | A card flips face up and is very rare (slot-machine style: one more chime per rarity step). Common cards just snap. | 4 quick bell chimes going up. | Made |
| `card.reveal.legendary` | A card flips face up and is legendary (slot-machine style: one more chime per rarity step). Common cards just snap. | 5 quick bell chimes going up, over a low bell boom. | Made |
| `card.reveal.mythic` | A card flips face up and is mythic (slot-machine style: one more chime per rarity step). Common cards just snap. | 6 quick bell chimes going up, over a low bell boom. | Made |
| `card.wanted` | A revealed card is a resource a starred recipe still needs. | Two quick bright pings, like a metal detector finding something. | Made |

### Resources and caps

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `res.food` (2 versions) | Getting a Food resource (berries, mushrooms, fish). | A soft round pluck. | Made |
| `res.building` (2 versions) | Getting a Building resource (sticks, stone, logs). | Two quick wood knocks. | Made |
| `res.fiber` (2 versions) | Getting a Fiber resource (grass, bark, wool). | A soft rustle. | Made |
| `res.fire` | Getting a Fire resource (tinder, pinecones, sap). | A match flick: a scratch and a little whoosh. | Made |
| `res.trinket` (2 versions) | Getting a Trinket resource (shells, feathers, shiny things). | A small glass ting. | Made |
| `res.caps` (2 versions) | Getting acorn caps (the money). | Little wooden clicks, like caps dropping into a pouch. | Made |
| `res.capsSpend` | Spending caps (buying, the infoboard). | The pouch shaken: a clatter of caps. | Made |
| `res.lose` | Losing resources (a punishment, a night event). | A soft puff going down. | Made |
| `res.bundleBurst` | Packing: the bundles burst into resources when the hike starts. | A cluster of pops. | Made |

### Items

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `item.new` | An item card goes into a bag. | The TrailMate wakes: two quick soft bleeps going up. | Made |
| `item.equip` (2 versions) | Putting on clothes. | A cloth rustle and a light zip. | Made |
| `item.unequip` | Taking clothes off. | A shorter cloth rustle. | Made |
| `item.use` (2 versions) | Using a tool (a Shovel, the Binoculars, a Swiss Army Knife). | A small metal clink. | Made |
| `item.ledDown` | A use is spent: one LED on the card goes dark. | A TrailMate blip going down, with a flicker. | Made |
| `item.break` | An item is used up or breaks. | A crunch and a snap. | Made |
| `item.eat` (3 versions) | Eating a bite of food. | A crunchy bite. | Made |
| `item.drink` (2 versions) | Taking a sip of a drink. | A little gulp: two bubbly blips. | Made |
| `item.drop` | Dropping an item on the ground. | A thud on dirt. | Made |
| `item.give` | Giving an item or resource to another hiker. | A quick hand-off swish. | Made |
| `present.wrap` | Wrapping a present (holiday hikers). | Paper crinkling. | Made |
| `present.open` | Opening a present. | Paper ripping, then a little sparkle. | Made |

### Stats, conditions and XP

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `stat.energyUp` | Energy goes up (sleep, a drink). | Two light, rising chimes. | Made |
| `stat.appetiteUp` | Appetite goes up (food). | Two warm, low marimba notes. | Made |
| `stat.moraleUp` | Morale goes up. | A quick sparkly kalimba run up. | Made |
| `stat.down` | Any stat goes down (paying a cost). | A soft blip going down. | Made |
| `stat.low` | A stat drops below its warning line (Tired, Hungry, Sad). | Two low, soft heartbeat thumps. | Made |
| `cond.good` | Getting a good condition (Lucky, Energized, Refreshed). | A short sparkle. | Made |
| `cond.bad` | Getting a bad condition (Unlucky, Bleeding, Crippled, Buzzed). | A muffled, slightly sour low chord. | Made |
| `cond.cured` | A bad condition goes away. | A gentle chime, like something let go. | Made |
| `injury` | A hiker is hurt (an injury). | A dull thud and a low "dum". | Made |
| `healed` | An injury heals. | A warm, soft major chord. | Made |
| `passedOut` | A hiker passes out. | A slow whoosh going down and a body falling on grass. | Made |
| `xp.gain` | XP is added (it counts up). | Tiny TrailMate bleeps, one per point. | Made |
| `levelUp` | The party levels up. | A short jingle: marimba and glockenspiel climbing to a bright chord, with a soft cymbal swell. | Made |
| `trait.learn` | Learning a step on a skill trail. | A rubber stamp and a chime. | Made |
| `trait.levelStep` (3 versions) | Raising a leveled step (Game Sight, free crafting): level 2, 3, 4. | A chime that climbs one note higher each level. | Made |
| `trait.proc` | A trait works ("Family Cookbook: no Energy"). | A tiny sparkle. | Made |

### Map and moving

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `foot.dirt` (4 versions) | Each step on a normal trail line (people). | A boot on packed dirt: a soft heel-toe with a little grit. | Made |
| `foot.gravel` (4 versions) | Each step on a rough line. | A boot on gravel: a crunchier, longer step. | Made |
| `foot.paved` (4 versions) | Each step on a paved line. | A boot on stone: a harder click and less grit. | Made |
| `foot.steep` (3 versions) | Each step on a steep line. | A heavier step that scrapes a little as the boot slips. | Made |
| `foot.mud` (3 versions) | Each step on a muddy line. | A squelch: a wet suck as the boot pulls out. | Made |
| `foot.snow` (4 versions) | Each step while it snows (replaces the line's step). | A soft snow crunch with a tiny squeak. | Made |
| `foot.paw` (3 versions) | Each step for the dogs and cats (soft ground). | A light, quick paw pat. | Made |
| `foot.pawHard` (3 versions) | Dog steps on paved lines and rock. | A paw pat with tiny claw clicks. | Made |
| `foot.plush` (3 versions) | Each step for plush hikers. | A soft, squishy "fwump". | Made |
| `map.select` | Picking a hiker on the map (clicking their icon). | Picking up a wooden game piece. | Made |
| `map.arrive` | A hiker reaches a tile and stops. | A game piece set down on a board. | Made |
| `map.reveal` | New tiles are revealed (the fog lifts). | An airy whoosh with a faint shimmer. | Made |
| `map.challengeLand` | A hiker steps onto a challenge tile (just before the card slides in). | A low drum hit and a short rising string-like swell. | Made |
| `map.checkpoint` | The party reaches a checkpoint (a new section begins). | A ranger's handbell, ding-ding, and a warm chord. | Made |
| `map.pan` | The map pans by itself (to a found tile, to the next section). | A soft, long air whoosh. | Made |
| `map.pin` | A pin drops on the map (the infoboard's WHERE IS IT?). | A thumbtack pressed into cork. | Made |

### Spaces on the map

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `space.trailSign` | Landing on a Trail Sign. | Knock-knock on a wooden post. | Made |
| `space.geoCache` | Landing on a Geocache. | A metal detector: TrailMate beeps that speed up, then a found chime. | Made |
| `space.campsite` | Landing on a Campsite. | A fire catching, and a warm guitar-like chord. | Made |
| `space.overlook` | Landing on an Overlook. | A gust of wind and a wide, airy chord that swells. | Made |
| `space.narrowPath` | Landing on a Narrow Path. | Careful steps and a few pebbles falling away. | Made |
| `space.mystery` | Landing on a Mystery space. | A mysterious glassy shimmer (whole-tone notes). | Made |
| `space.choice` | Landing on a Choice space (pick one of two). | A marimba question: up, then hanging. | Made |
| `space.opportunity` | Landing on an opportunity (when they come back). | A bright "oh!": two quick glockenspiel notes. | Made |

### Actions

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `act.scavenge.forest` | Scavenging on a Forest node (as the cards are dealt). | Rummaging in bushes: leaves rustling and a twig snapping. | Made |
| `act.scavenge.river` | Scavenging on a River node. | Hands in a stream: a splash and pebbles. | Made |
| `act.scavenge.wildlife` | Scavenging on a Wildlife node. | Rustling in tall grass with a little critter squeak. | Made |
| `act.scavenge.mountain` | Scavenging on a Mountain node. | Turning over rocks: a stony scrape and a clack. | Made |
| `act.tend` | Tending a node (raising Abundance). | Patting soil and a soft rustle. | Made |
| `act.craft.tool` | Crafting a tool. | Three hammer taps on wood and metal. | Made |
| `act.craft.clothes` | Crafting clothes. | Sewing: three quick needle pulls. | Made |
| `act.craft.food` | Crafting food. | Chopping on a board, then a sizzle. | Made |
| `act.craft.shelter` | Crafting a shelter. | Tent stakes hammered in and fabric pulled tight. | Made |
| `act.craft.trinket` | Crafting a trinket. | Tinkering: small clicks and a tiny chime. | Made |
| `act.craftDone` | The crafted item is picked and made. | A little success jingle, half marimba, half TrailMate. | Made |
| `act.sleep` | Sleep is picked for the night. | A sleeping bag zip, then three slow lullaby notes. | Made |
| `act.keepWatch` | Keep Watch is picked. | A lantern clicking on and a low hum. | Made |
| `act.sitByFire` | Sit by the Fire is picked. | A log dropped on a fire and a burst of crackle. | Made |
| `act.shelterUp` | Setting up a shelter. | A long tent zip and two stake taps. | Made |
| `act.shelterDown` | Packing up a shelter. | A zip and fabric being rolled up. | Made |
| `act.teach` | Teaching a blueprint to another hiker. | A page turning and a chime. | Made |
| `act.returnToNature` | Returning a resource to nature. | A leafy rustle and a soft, low chime. | Made |
| `act.carry` | Picking up a hiker to carry them. | A cloth rustle and an effort thump. | Made |
| `act.abandon` | A hiker leaves the party. | Two slow, sad marimba notes. | Made |

### Day and night

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `day.morning` | Morning begins (with the new day banner). | A sunrise: a soft rising swell, a glockenspiel twinkle and a bird. | Made |
| `day.afternoon` | Afternoon begins. | Two light, warm notes. | Made |
| `day.night` | Night falls. | A low, soft chime and a swell of crickets. | Made |

### Weather

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `weather.rain` | The weather turns to rain (with the weather change screen). | Rain starting: patters growing into a shower. | Made |
| `weather.thunder` (3 versions) | Now and then while it rains (random, rare). | Thunder: a close crack and rumble, and two farther rolls. From Pixabay (soundreality), Pixabay Content License. | Made |
| `weather.snow` | The weather turns to snow. | A hush: soft wind and a few glassy, high notes. | Made |
| `weather.wind` | The weather turns windy. | A big gust that whistles through trees. | Made |
| `weather.heatwave` | A heatwave begins. | Cicadas buzzing up in a long swell. | Made |
| `weather.clear` | The weather clears up. | Birdsong coming back: two bright chirps. | Made |

### Ranger Station

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `station.enter` | Entering the Ranger Station. | A shop door bell jingling and the door creaking shut. | Made |
| `station.leave` | Leaving the station. | The door bell, shorter. | Made |
| `station.buy` | Buying something. | A cash register: "ka-ching". | Made |
| `station.sell` | Selling something. | Caps poured onto the counter. | Made |
| `station.trade` | Trading an item. | A paper slid across the counter and stamped. | Made |
| `station.ask` | Asking the ranger what's ahead (the radio). | Radio static and a beep. | Made |
| `station.rest` | Rest and Go. | A chair creak and a content sigh of a chord. | Made |
| `station.workbench` | Using the Workbench. | A wood plane stroke and a tap. | Made |

### Wonders, skill trails and the infoboard

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `wonder.open` | A Wonder's window opens. | An awe chord swelling, like light breaking through. | Made |
| `wonder.done` | A Wonder is accomplished. | A short fanfare on glockenspiel and marimba. | Made |
| `trails.open` | The skill trails window opens. | A trail map unfolding. | Made |
| `infoboard.open` | The Trail Infoboard opens. | A knock on a wooden board and paper fluttering. | Made |
| `infoboard.clink` | The infoboard's acorn flies and the caps are paid ("the clink"). | A single bright cap clink. | Made |
| `infoboard.shake` | Not enough caps: the box shakes. | A few rattly clicks. | Made |

### Challenges and minigames (shared)

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `chal.prepareSlot` | Putting a resource or item into a Prepare slot. | A solid "clunk" into a slot. | Made |
| `chal.prepareRemove` | Taking it back out. | A lighter "clunk" going up. | Made |
| `chal.start` | Play: the party GPS powers on for the minigame. | The TrailMate starting up: a rising sweep and two bleeps. | Made |
| `mg.count` | Each number of the 3-2-1 countdown. | A TrailMate beep. | Made |
| `mg.go` | GO! | A higher, longer beep. | Made |
| `mg.turn` | The next hiker's turn. | A quick two-tone swap blip. | Made |
| `mg.point` (3 versions) | Something right (a dodge, a catch, a match, a locked bearing). | A bright bleep up. | Made |
| `mg.wrong` | Something wrong (a wrong key, a miss). | A low double bleep. | Made |
| `mg.heartLost` | A heart (or a try) is lost. | A crunchy TrailMate hit going down. | Made |
| `mg.heartGained` | A heart is gained (Bandages). | A warm bleep arpeggio up. | Made |
| `mg.tick` (5 versions) | The last 5 seconds on a clock (one per second, getting higher). | A clock tick from the device. | Made |
| `mg.timeUp` | Time runs out. | A low buzzer. | Made |
| `mg.hikerPassed` | One hiker passes their part. | Three quick notes up. | Made |
| `mg.hikerFailed` | One hiker fails their part. | Three notes down. | Made |
| `mg.passed` | Challenge Passed (the end screen). | A TrailMate fanfare, 2 seconds. | Made |
| `mg.failed` | Challenge Failed (the end screen). | A slow, sad TrailMate tune going down, 2 seconds. | Made |
| `mg.stamp` | The PASSED or FAILED stamp hits. | A heavy rubber stamp thunk. | Made |
| `mg.punish` | A punishment is applied after a fail. | A soft thud and a blip down. | Made |
| `mg.place` | Hook `place`: placing a piece, a block, a pot shard. | A small solid click. | Made |
| `mg.ready` | Hook `ready`: something is ready (a bear about to wake, a turn about to start). | Two soft bleeps. | Made |
| `mg.pop` (3 versions) | Hook `pop`: something pops up (a raccoon, a firefly, a sign). | A quick bubbly pop. | Made |
| `mg.hit` (2 versions) | Hook `hit`: hitting the target (a whack, a swat). | A punchy bonk. | Made |
| `mg.miss` | Hook `miss`: missing (a whoosh through air). | A small swish. | Made |
| `mg.bearUp` | Hook `bearUp`: the Sleeping Bear sits up. | A low grumble rising: the bear growl, slowed a little and faded in. From Pixabay (universfield), Pixabay Content License. | Made |
| `mg.note1` | Hook `note`: Birdsong note 1 (one per color). | A whistled bird note, its own pitch (76 in MIDI), with a little slide. | Made |
| `mg.note2` | Hook `note`: Birdsong note 2 (one per color). | A whistled bird note, its own pitch (79 in MIDI), with a little slide. | Made |
| `mg.note3` | Hook `note`: Birdsong note 3 (one per color). | A whistled bird note, its own pitch (81 in MIDI), with a little slide. | Made |
| `mg.note4` | Hook `note`: Birdsong note 4 (one per color). | A whistled bird note, its own pitch (84 in MIDI), with a little slide. | Made |
| `mg.note5` | Hook `note`: Birdsong note 5 (one per color). | A whistled bird note, its own pitch (86 in MIDI), with a little slide. | Made |
| `mg.note6` | Hook `note`: Birdsong note 6 (one per color). | A whistled bird note, its own pitch (88 in MIDI), with a little slide. | Made |

### Minigame signatures

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `bike.bell` | **Incoming Bike!:** a bike appears up the trail. | A bicycle bell: ring-ring. | Made |
| `bike.whoosh` (2 versions) | **Incoming Bike!:** a bike flies past. | Tires and air rushing by. | Made |
| `bike.hop` | **Incoming Bike!:** the hiker hops aside. | A springy little hop. | Made |
| `bike.clip` | **Incoming Bike!:** a bike clips the hiker. | A clatter: bike rattle and a bump. | Made |
| `compass.ratchet` | **Wrong Turn:** the needle turns (a tick every few degrees). | A fine ratchet tick. | Made |
| `compass.hold` | **Wrong Turn:** the needle is in the notch and the lock bar fills. | A soft rising tone. | Made |
| `compass.lock` | **Wrong Turn:** a bearing locks. | A firm click and a chime. | Made |
| `saw.stroke` (2 versions) | **Fallen Branch:** each saw stroke (A pushes, D pulls). | A raspy saw stroke; push and pull sound a little different. | Made |
| `saw.bind` | **Fallen Branch:** the saw binds (too fast). | A dull clunk and a metal twang. | Made |
| `saw.knot` | **Fallen Branch:** the cut reaches a knot. | A woody creak. | Made |
| `saw.through` | **Fallen Branch:** the branch is cut through and falls. | A crack and a heavy thud. | Made |
| `rope.drag` | **Snagged Pack:** dragging a rope from cell to cell (a tick per cell). | A soft rope rub. | Made |
| `rope.join` | **Snagged Pack:** a rope reaches its socket. | A snug click. | Made |
| `whackoon.bonk` | **Whackoon:** the mallet hits a raccoon (Wyatt's hammer). | A cartoon wooden BONK with a squeak. | Made |
| `raccoon.chitter` | **Whackoon:** a raccoon pops up. | A raccoon chitter (a real recording would be better). | Placeholder |
| `fly.buzz` | **Fly Swatter:** flies buzzing (a loop while they fly). | A fly buzz that wanders in pitch. | Made |
| `fly.splat` | **Fly Swatter:** a fly is swatted. | A wet splat. | Made |
| `firefly.catch` (2 versions) | **Firefly Catch:** a firefly is caught. | A twinkle and a jar clink. | Made |
| `sizeup.stretch` (2 versions) | **Size Up:** growing or shrinking a step. | A springy "boing" up or down. | Made |
| `safari.shutter` | **Safari:** taking a photo. | A camera shutter and film wind. | Made |
| `safari.bigfoot` | **Safari:** the rare Bigfoot appears. | A big distant roar: the bear growl, slowed way down, with a lot of echo. From Pixabay (universfield), Pixabay Content License. | Made |
| `shuffle.slide` (2 versions) | **Raccoon Shuffle:** the cups slide around. | Wooden cups scraping on a table. | Made |
| `shuffle.lift` | **Raccoon Shuffle:** a cup is lifted. | A light wood clack. | Made |
| `train.horn` | **Train!:** a train is coming (with the headlight flash). | A three-note train horn. | Made |
| `train.pass` | **Train!:** a train rumbles past. | A rumble with wheels clacking over rail joints. | Made |
| `train.crossing` | **Train!:** the crossing bell (a loop while a train is near). | Ding-ding of a railroad crossing. | Made |
| `crossing.car` (2 versions) | **Crossing:** a car whooshes by. | A car passing: engine hum and air. | Made |
| `crossing.horn` | **Crossing:** a car honks at a slow hiker. | A short car horn. | Made |
| `crossing.hop` | **Crossing:** each hop forward. | A small hop. | Made |
| `crossing.splash` | **Crossing:** falling in the river. | A splash. | Made |
| `raft.paddle` (2 versions) | **Rafting:** each paddle stroke. | A paddle dipping into water. | Made |
| `raft.bump` | **Rafting:** the raft hits a rock. | A rubbery thud and a splash. | Made |
| `bear.snore` | **Sleeping Bear:** the bear sleeps (a loop). | Slow, rumbly snoring. | Made |
| `bear.tiptoe` (2 versions) | **Sleeping Bear:** a careful step near the bear. | A tiny, careful step. | Made |
| `bear.roar` | **Sleeping Bear:** the bear wakes up. | A bear growl. From Pixabay (universfield), Pixabay Content License. | Made |
| `ghost.wail` | **Spooky Ghost!:** a ghost floats by. | A wavering, theremin-like wail with an echo. | Made |
| `ghost.flashlight` | **Spooky Ghost!:** the flashlight clicks on or off. | A plastic switch click. | Made |
| `ghost.heartbeat` | **Spooky Ghost!:** sanity is low (a loop that speeds up). | A heartbeat. | Made |
| `ghost.mitten` | **Spooky Ghost!:** a hiker's mitten is found. | A soft, relieved chime. | Made |
| `pots.shard` (3 versions) | **Cracked Pots:** a shard is picked up or set down. | A ceramic clink. | Made |
| `pots.whole` | **Cracked Pots:** a pot is whole again. | A ringing "ting" of a full pot. | Made |
| `ice.crack` (2 versions) | **Thin Ice:** the ice cracks under a step. | A sharp, zinging ice crack. | Made |
| `ice.fall` | **Thin Ice:** a hiker falls through. | Ice breaking and a cold splash. | Made |
| `minefield.squish` | **Minefield:** stepping in dog waste. | A wet squish (and an "ew" if Wyatt records one). | Made |
| `minefield.sniff` | **Minefield:** the dog sniffs a square. | Two quick sniffs. | Made |
| `blocks.land` (2 versions) | **Trail Blocks:** a block lands. | A wooden block clack. | Made |
| `blocks.clear` | **Trail Blocks:** a line clears. | A sweep and a chime. | Made |
| `bridge.creak` (2 versions) | **Sketchy Bridge:** the bridge creaks (louder as it weakens). | Old wood and rope creaking. | Made |
| `bridge.break` | **Sketchy Bridge:** the bridge breaks. | Planks snapping and falling. | Made |
| `rocks.fall` (2 versions) | **Falling Rocks:** a rock falls toward its shadow. | A falling whistle. | Made |
| `rocks.impact` (2 versions) | **Falling Rocks:** a rock lands. | A heavy thud and gravel. | Made |
| `rocks.rumble` | **Falling Rocks:** a rockslide or avalanche warning. | A deep rumble. | Made |
| `climb.grab` (2 versions) | **Rock Climb:** a hand grabs a hold. | A hand slap on rock. | Made |
| `climb.power` | **Rock Climb:** the power meter goes up and down. | A soft tone that rises and falls with it. | Made |
| `climb.fall` | **Rock Climb:** a climber falls. | A whoosh down and a bump. | Made |
| `dodge.bees` | **Dodge:** bees (a loop while they swarm). | A swarm buzz. | Made |
| `dodge.swordSwing` (2 versions) | **Dodge:** a sword swings or flies. | A sharp blade whoosh. | Made |
| `dodge.swordPoke` | **Dodge:** Sword Volley: a numbered sword pokes in. | A metal "shing". | Made |
| `dodge.shot` | **Dodge:** Bear with a Gun fires (cartoony). | A cartoon pop-bang with a short echo. | Made |
| `dodge.aim` | **Dodge:** an aim line locks on. | A rising lock-on beep. | Made |
| `dodge.ricochet` | **Dodge:** Ricochet bounces. | A cartoon "pew-yeww". | Made |
| `dodge.trap` | **Dodge:** a bear trap snaps. | A metal snap and clank. | Made |
| `dodge.ants` | **Dodge:** ants march (a loop). | Tiny skittering clicks. | Made |
| `dodge.antPop` | **Dodge:** a fire ant explodes. | A small pop and fizz. | Made |
| `dodge.arrow` | **Dodge:** an arrow flies. | A thin arrow whistle and a thunk. | Made |
| `dodge.hurt` | **Dodge:** the party icon is hit. | A bump and a down blip. | Made |
| `dodge.eagle` | **Dodge:** an Eagle swoops. | An eagle screech. From Pixabay (u_jfkxueyart), Pixabay Content License. | Made |
| `dodge.snowLeopard` | **Dodge:** the Snow Leopard pounces. | A big-cat snarl (the first roar of the leopard recording). From Pixabay (dffdv), Pixabay Content License. | Made |
| `dodge.snowgirl` | **Dodge:** the Abominable Snowgirl roars. | A smaller, higher roar: the bear growl sped up, with an icy echo. *(Claude's pick)* From Pixabay (universfield), Pixabay Content License. | Made |
| `dodge.bearRoar` | **Dodge:** Bear with a Sword or Gun arrives. | The bear growl, a little bigger. From Pixabay (universfield), Pixabay Content License. | Made |
| `dodge.monster` | **Dodge:** the Woods Monster attacks. | A deep, weird growl. | Placeholder |
| `squirrel.scurry` | **Squirrel Theft:** a squirrel scurries. | Tiny claws pattering on bark. | Made |
| `squirrel.chitter` | **Squirrel Theft:** a squirrel steals something. | A squirrel chitter (a real recording would be better). | Placeholder |
| `pack.drop` (2 versions) | **Pack It Up:** an item drops into the pack grid. | A soft canvas thunk. | Made |
| `pack.rotate` | **Pack It Up:** rotating an item. | A quick click-turn. | Made |
| `cleanup.pick` (2 versions) | **Camp Cleanup:** trash is picked up. | A plastic crinkle. | Made |
| `cleanup.crash` | **Camp Cleanup:** the line crashes and drops bags. | A bump and bags tumbling. | Made |
| `signs.stamp` (2 versions) | **Fake Trail Signs:** a sign is judged REAL or FAKE. | A wooden stamp. | Made |
| `trails.offTrail` | **Trails:** the hiker leaves the trail (a loop while off it). | Brushing through undergrowth. | Made |
| `trails.gust` | **Trails:** Ridgeline: a wind gust. | A strong gust. | Made |
| `trails.scree` | **Trails:** Ridgeline: scree slides. | Gravel sliding away. | Made |
| `crossroads.arrow` (4 versions) | **Crossroads:** each arrow of the row shows. | A soft blip, higher for each arrow. | Made |
| `traildle.key` (2 versions) | **Traildle:** typing a letter. | A typewriter-ish key tick. | Made |
| `memory.match` | **Memory Puzzle:** two cards match. | A bright two-note chime. | Made |
| `puzzle.snap` | **Picture Puzzle:** a piece snaps into place. | A satisfying cardboard snap. | Made |
| `birdsong.phrase` | **Birdsong:** the bird sings the phrase to repeat (uses notes 1-6). | Uses the six `mg.note` sounds. | Made |

### Night events

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `night.nuisance` | A nuisance night event begins (Raccoons, Opossums, Foxes, Bats, Drunk Hiker). | A sneaky pizzicato-like sting: four plucks tiptoeing down. | Made |
| `night.danger` | A dangerous night event begins (Wolves, Coyotes, Hyenas, Bears, Leopards, Bobcats, Robbers). | A tense low sting: a deep hit and a dark swell. | Made |
| `night.eerie` | An eerie night event begins (Cultists, the Monster). | A weird, wavering low drone and glassy notes. | Made |
| `night.good` | The night event ends well. | A relieved, warm two-note chime. | Made |
| `night.bad` | The night event ends badly (something lost or hurt). | A soft, low "oh no" of two notes falling. | Made |
| `night.bats` | Bats. | Quick, very high squeaks and wing flutters. | Made |
| `night.robbers` | Robbers. | Sneaking footsteps and a bag being rummaged. | Made |
| `night.opossums` | Opossums. | A hiss. | Placeholder |
| `night.wolves` | Wolves. | A wolf howl (a real recording would be much better). | Placeholder |
| `night.monster` | The Monster. | Uses the Woods Monster growl from Dodge. Same file as dodge.monster. | Placeholder |
| `night.bears` | Bears. | The bear growl, slower, out in the dark. From Pixabay (universfield), Pixabay Content License. | Made |
| `night.leopards` | Leopards. | The whole leopard recording: a snarling attack. From Pixabay (dffdv), Pixabay Content License. | Made |
| `night.bobcats` | Bobcats. | The leopard snarls sped up into a smaller, higher cat. From Pixabay (dffdv), Pixabay Content License. | Made |
| `night.cultists` | Cultists. | Low occult chanting, faded in and out (12 seconds of the recording). From Pixabay (alex_jauk), Pixabay Content License. | Made |
| `night.drunkHiker` | The Drunk Hiker. | A can cracking open, a laugh, then a hiccup. From Pixabay (saboteurcomics, universfield, freesound_community), Pixabay Content License. | Made |
| `night.raccoons` | Raccoons. | Raccoon chitters and trash rattling. | **Needs a recording** |
| `night.foxes` | Foxes. | A fox scream. | **Needs a recording** |
| `night.coyotes` | Coyotes. | Coyote yips. | **Needs a recording** |
| `night.hyenas` | Hyenas. | Hyena laughs. | **Needs a recording** |
| `night.raccoonGang` | Raccoon Gang. | Lots of raccoon chitters. | **Needs a recording** |

### Hiker voices

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `voice.man.cheer` | Any man hiker: a level up, a passed challenge, a Wonder. | A happy "Yes!" or "Woo!". A generic stock sound. | **Needs a recording** |
| `voice.man.oof` | Any man hiker: an injury, a failed part, passing out. | An "oof" or a hurt grunt. A generic stock sound. | **Needs a recording** |
| `voice.man.yawn` | Any man hiker: Sleep. | A big yawn. A generic stock sound. | **Needs a recording** |
| `voice.woman.cheer` | Any woman hiker: a level up, a passed challenge, a Wonder. | A happy "Yay!" or "Woo!". A generic stock sound. | **Needs a recording** |
| `voice.woman.oof` | Any woman hiker: an injury, a failed part, passing out. | An "oof" or a hurt grunt. A generic stock sound. | **Needs a recording** |
| `voice.woman.yawn` | Any woman hiker: Sleep. | A big yawn. A generic stock sound. | **Needs a recording** |
| `voice.dog.cheer` | Any dog hiker: a level up, a passed challenge, a Wonder. | A happy bark or two. A generic stock sound. | **Needs a recording** |
| `voice.dog.oof` | Any dog hiker: an injury, a failed part, passing out. | A whimper. A generic stock sound. | **Needs a recording** |
| `voice.dog.yawn` | Any dog hiker: Sleep. | A dog yawn or a big sigh. A generic stock sound. | **Needs a recording** |
| `voice.cat.cheer` | Any cat hiker: a level up, a passed challenge, a Wonder. | A happy meow. A generic stock sound. | **Needs a recording** |
| `voice.cat.oof` | Any cat hiker: an injury, a failed part, passing out. | A hiss or yowl. A generic stock sound. | **Needs a recording** |
| `voice.cat.yawn` | Any cat hiker: Sleep. | A purr. A generic stock sound. | **Needs a recording** |
| `voice.plush.cheer` | Any plush hiker: a level up, a passed challenge, a Wonder. | Two happy squeaks of a squeaky toy, going up. | Made |
| `voice.plush.oof` | Any plush hiker: an injury, a failed part, passing out. | A long, deflating squeak going down. | Made |
| `voice.plush.yawn` | Any plush hiker: Sleep. | A slow, soft squeak like air leaving a cushion. | Made |

### Ambience

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `amb.meadow.day` (loop) | The Meadow by day (loops under everything). | A sunny forest edge full of songbirds. From Pixabay (dany_photo), Pixabay Content License. | Made |
| `amb.meadow.night` (loop) | The Meadow at night. | A steady chorus of crickets. From Pixabay (capaholiczsfx), Pixabay Content License. | Made |
| `amb.rainforest.day` (loop) | The Temperate Rainforest by day. | A rich, busy forest: many birds, rustling leaves. From Pixabay (soundreality), Pixabay Content License. | Made |
| `amb.rainforest.night` (loop) | The Temperate Rainforest at night. | Frogs and crickets pulsing together. From Pixabay (eryliaa), Pixabay Content License. | Made |
| `amb.alpine.day` (loop) | The Alpine biome by day. | A steady mountain wind (the one-shot birds still come now and then). From Pixabay (soundreality), Pixabay Content License. | Made |
| `amb.alpine.night` (loop) | The Alpine biome at night. | A cold, hollow blizzard wind, softened. From Pixabay (dragon-studio), Pixabay Content License. | Made |
| `amb.river` (loop) | Layered on top when the selected hiker is on a tile with a River node. | A babbling stream. | Made |
| `amb.fire` (loop) | Layered on at night when someone sits by the fire, at campsites, and in the station. | A crackling campfire. | Made |
| `amb.rain` (loop) | Layered on while it rains (any biome). | Steady rain in a forest. From Pixabay (soundsforyou), Pixabay Content License. | Made |
| `amb.wind` (loop) | Layered on while it's windy. | Strong winter gusts. From Pixabay (dragon-studio), Pixabay Content License. | Made |
| `amb.snow` (loop) | Layered on while it snows. | A hush: very soft, muffled wind. | Made |
| `amb.heat` (loop) | Layered on during a heatwave (by day). | Cicadas buzzing in slow waves. | Made |
| `amb.station` (loop) | Inside the Ranger Station. | A quiet room: the fireplace, a ticking clock, an old radio murmuring very low. | Placeholder |
| `amb.title` (loop) | The title screen (under the menu music). | Evening forest: a few crickets and a soft breeze. | Made |

### Ambience one-shots

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `amb.bird` (4 versions) | Random birds by day (the ambience scheduler plays these now and then, panned). | Songbird calls: a "fee-bee", a trill, a robin phrase, a chirp. | Placeholder |
| `amb.woodpecker` | Random, in the Forest and Rainforest by day. | A woodpecker drumming. | Made |
| `amb.owl` | Random at night. | An owl: "hoo, hoo-hoooo". | Placeholder |
| `amb.twig` | Random, all biomes by day and night. | A twig snapping somewhere nearby. | Made |
| `amb.frog` | Random near River nodes and in the Rainforest. | A single frog croak. | Placeholder |
| `amb.wolfFar` | Very rarely, Alpine nights. | A wolf howling far away. Uses night.wolves, quieter and with more reverb. | Placeholder |

### Start and end of a hike

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `hike.start` | The hike starts (after packing, as the map appears). | A trail whistle and boots setting off. | Made |
| `hike.summit` | The party reaches the summit (the hike is won). | A big, happy fanfare: marimba, glockenspiel and a cymbal swell, 4 seconds. | Made |
| `hike.over` | The hike is over: everyone passed out or left. | A gentle, sad phrase going down, 3 seconds. | Made |
| `hike.tally` | Counting up the final numbers on the end screen. | Quick ticks, one per point. | Made |

### Packing machines

| Sound | When it plays | What it sounds like | Status |
| --- | --- | --- | --- |
| `packing.reels` | Packing: reels. | Already made in code for both looks: tick, stop, ratchet. | In code |
| `packing.taking` | Packing: taking and bonuses. | Already made in code for both looks: clink, pop, clack. | In code |
| `packing.rows` | Packing: rows and jackpots. | Already made in code for both looks: chime, win, fanfare, drum. | In code |
| `packing.second` | Packing: Second Wind and misses. | Already made in code for both looks: whoosh, sad. | In code |
| `packing.trailmate` | Packing: TrailMate only. | Already made in code for both looks: crtOn, zap, modem, boot, sweep. | In code |
