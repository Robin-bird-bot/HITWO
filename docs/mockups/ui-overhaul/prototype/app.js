{
/* ───────────────────────── helpers ───────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const P = {
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41',
  sunrise:'M12 2v6 M5 10.5l1.4 1.4 M2 18h2 M20 18h2 M19 10.5l-1.4 1.4 M22 22H2 M8 6l4-4 4 4 M16 18a4 4 0 0 0-8 0',
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  zap:'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  heart:'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z',
  utensils:'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z M21 15v7',
  footprints:'M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z M16 17h4 M4 13h4',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  hammer:'M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9 M17.64 15 22 10.64 M20.91 11.7l-1.25-1.25a3.2 3.2 0 0 1-.93-2.25v-.86L16.01 4.6A5.56 5.56 0 0 0 12.07 3H9l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h2.47l2.26 1.91',
  sprout:'M7 20h10 M10 20c5.5-2.5.8-6.4 3-10 M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z',
  bag:'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
  book:'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  star:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  sparkles:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M5 3v4 M3 5h4 M19 17v4 M17 19h4',
  droplet:'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z',
  acorn:'M4 9c0-3 3.6-5 8-5s8 2 8 5H4z M6 9c0 6 3 10.5 6 12 3-1.5 6-6 6-12 M12 4V2',
  menu:'M4 6h16 M4 12h16 M4 18h16', plus:'M12 5v14 M5 12h14', minus:'M5 12h14',
  crosshair:'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M12 2v3 M12 19v3 M2 12h3 M19 12h3',
  x:'M18 6 6 18 M6 6l12 12', check:'M20 6 9 17l-5-5',
  alert:'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  flame:'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  arrowLeft:'M19 12H5 M12 19l-7-7 7-7',
  shirt:'M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z',
  boot:'M5 3h6v8l7 3a3 3 0 0 1 2 2.8V19H4V4z M4 15h16',
  backpack:'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5 M8 10h8',
  frown:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M16 16s-1.5-2-4-2-4 2-4 2 M9 9h.01 M15 9h.01',
};
const ic = (n, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg>`;

/* ───────────────────────── sound ───────────────────────── */
const VAR = {'ui.click':3,'ui.tab':2,'card.deal':4,'card.flip':3,'card.take':2,'book.page':2,'craft.slot':2,
  'scav.brush.forest':3,'scav.brush.river':3,'scav.brush.wildlife':3,'scav.brush.mountain':3};
const FIX = {'ui.hover':'ui-hover-1','item.eat':'item-eat-1','item.use':'item-use-1','item.equip':'item-equip-1','res.food':'res-food-1','res.building':'res-building-1','res.fiber':'res-fiber-1','res.trinket':'res-trinket-1'};
let soundOn = true, amb = null;
function play(id, o = {}) {
  if (!soundOn) return;
  let f = FIX[id] || id.replace(/\./g, '-');
  if (VAR[id]) f += '-' + (1 + Math.floor(Math.random() * VAR[id]));
  try {
    const a = new Audio('sfx/' + f + '.mp3');
    a.volume = Math.min(1, (o.vol ?? 1) * 0.8);
    a.preservesPitch = false; a.mozPreservesPitch = false;
    a.playbackRate = o.rate ?? rnd(0.97, 1.03);
    a.play().catch(() => {});
  } catch (e) {}
}
function ambience() {
  try {
    if (!amb) { amb = new Audio('sfx/amb-meadow-day.mp3'); amb.loop = true; amb.volume = 0.22; }
    if (soundOn && screen === 'main') amb.play().catch(() => {}); else amb.pause();
  } catch (e) {}
}

/* ───────────────────────── data ───────────────────────── */
const NODE_RES = {forest:['wood','moss','mushroom','grass'], river:['fish','clay','shell','seaweed'], wildlife:['meat','fur','oil','bones'], mountain:['stone','metal','flint','salt']};
const NODE_OF = {}; for (const [n, rs] of Object.entries(NODE_RES)) rs.forEach(r => NODE_OF[r] = n);
const ALLRES = Object.values(NODE_RES).flat();
const CAT = {wood:'building',stone:'building',metal:'building',clay:'building',grass:'fiber',moss:'fiber',fur:'fiber',seaweed:'fiber',meat:'food',fish:'food',mushroom:'food',salt:'food',oil:'fire',flint:'fire',shell:'trinket',bones:'trinket'};
const NODE_LOOK = {
  forest:{g:'#2f5443', name:'FOREST', ab:7},
  river:{g:'#284a66', name:'RIVER', ab:6},
  wildlife:{g:'#6c5233', name:'WILDLIFE', ab:5},
  mountain:{g:'#55524c', name:'MOUNTAIN', ab:8},
};
const RAR = ['common','uncommon','rare','veryRare','legendary','mythic'];
const RAR_NAME = {common:'Common',uncommon:'Uncommon',rare:'Rare',veryRare:'Very rare',legendary:'Legendary',mythic:'Mythic'};
const TYPE_C = {tool:'#ED642B',clothes:'#895637',food:'#45A86C',shelter:'#545C8E',trinket:'#C95FE6'};
const START = [690, 452];
const TILES = {start:START, a:[569, 320], b:[819, 306]};
const OFF = [[-20,-17],[20,-17],[-20,17],[20,17]], OFF2 = [[0,8],[22,-10],[-22,-10],[0,-28]];
const TH = {e:3, a:3, m:7};

const ITEMS = {
  trowel:{n:'Trowel',t:'tool',fx:'Scavenging this phase: see 1 extra card.'},
  shovel:{n:'Shovel',t:'tool',fx:'Scavenging this phase costs no Energy.'},
  sack:{n:'Sack',t:'tool',fx:'Scavenging this phase: keep 1 extra card.'},
  binoculars:{n:'Binoculars',t:'tool',fx:'Look at the challenge on a tile next to you.'},
  'woodcutting-axe':{n:'Woodcutting Axe',t:'tool',fx:'Forest resources are twice as likely this phase.'},
  'fishing-rod':{n:'Fishing Rod',t:'tool',fx:'River resources are twice as likely this phase.'},
  scanner:{n:'Scanner',t:'tool',fx:'Scan a tile next to you for a challenge.'},
  camera:{n:'Camera',t:'tool',fx:'Reveal the challenge on a tile next to you.'},
  'plain-shirt':{n:'Plain Shirt',t:'clothes',fx:'No ability, but cheap, and it lasts longer.'},
  'soup-socks':{n:'Soup Socks',t:'clothes',fx:'Food eaten or made here may give +1 Morale.'},
  'rain-jacket':{n:'Rain Jacket',t:'clothes',fx:'Can’t become Wet or Soaked.'},
  flannel:{n:'Flannel',t:'clothes',fx:'Scavenging: see 1 extra card.'},
  'trail-shoes':{n:'Trail Shoes',t:'clothes',fx:'Pay moves with Energy when Appetite is lower.'},
  'trail-mix':{n:'Trail Mix',t:'food',fx:'+1 Appetite and Lucky this phase.'},
  smores:{n:'S’mores',t:'food',fx:'+1 Appetite. At night, +1 more and +1 Morale.'},
  salad:{n:'Salad',t:'food',fx:'+2 Appetite.'},
  salmon:{n:'Salmon',t:'food',fx:'+2 Appetite.'},
  jerky:{n:'Jerky',t:'food',fx:'+2 Appetite. Never goes bad.'},
  tent:{n:'Tent',t:'shelter',fx:'A basic shelter. Lasts 3 nights.'},
  hammock:{n:'Hammock',t:'shelter',fx:'A basic shelter for 1 night.'},
  textbook:{n:'Textbook',t:'trinket',fx:'+1 XP from every scavenge and craft.'},
  ukulele:{n:'Ukulele',t:'trinket',fx:'Everyone on this tile gains 1 Morale.'},
  'old-photo':{n:'Old Photo',t:'trinket',fx:'Swap one of this hiker’s traits.'},
  bandages:{n:'Bandages',t:'trinket',fx:'Remove 1 injury.'},
};
const POOLS = {tool:['trowel','shovel','sack','binoculars','woodcutting-axe','fishing-rod','scanner','camera'],
  clothes:['plain-shirt','soup-socks','rain-jacket','flannel','trail-shoes'], food:['trail-mix','smores','salad','salmon','jerky'],
  shelter:['tent','hammock'], trinket:['textbook','ukulele','old-photo']};

const BP = [
  {id:'trowel',t:'tool',tier:1,cost:{metal:1,wood:2,stone:1},any:2},
  {id:'shovel',t:'tool',tier:1,cost:{metal:2,wood:2},any:2},
  {id:'sack',t:'tool',tier:1,cost:{grass:3,fur:1},any:2},
  {id:'binoculars',t:'tool',tier:1,cost:{shell:2,metal:1,fur:1},any:2},
  {id:'woodcutting-axe',t:'tool',tier:1,cost:{metal:2,wood:2,flint:1},any:1},
  {id:'plain-shirt',t:'clothes',tier:1,cost:{moss:2,fur:1},any:2},
  {id:'soup-socks',t:'clothes',tier:1,cost:{fur:2,moss:1},any:3},
  {id:'rain-jacket',t:'clothes',tier:1,cost:{seaweed:2,oil:1,moss:1},any:2},
  {id:'trail-mix',t:'food',tier:1,cost:{grass:1,salt:1,mushroom:1},any:1},
  {id:'smores',t:'food',tier:1,cost:{grass:2,wood:1},any:1},
  {id:'salmon',t:'food',tier:2,cost:{fish:3,salt:1},any:0},
  {id:'tent',t:'shelter',tier:1,cost:{fur:2,wood:2,moss:1},any:2},
  {id:'hammock',t:'shelter',tier:1,cost:{fur:2,moss:1,wood:2},any:1},
].map(b => ({...b, key:'b:' + b.id, n:ITEMS[b.id].n, kind:'bp'}));
const BASIC = {
  tool:{key:['metal','wood'],k:2,nodes:['mountain','forest'],b:3},
  clothes:{key:['fur','moss'],k:2,nodes:['wildlife','forest'],b:3},
  food:{key:['fish','meat','mushroom'],k:2,nodes:['forest','river'],b:2},
  shelter:{key:['wood','stone'],k:3,nodes:null,b:3},
  trinket:{key:null,k:0,nodes:'diff',b:5},
};
const basicRecipe = (t, tier) => { const B = BASIC[t]; const add = tier - 1; return {kind:'basic', key:`k:${t}${tier}`, t, tier, n:`${cap(t)} · Tier ${'I'.repeat(tier)}`, keyRes:B.key, k:B.key ? B.k + add : 0, nodes:B.nodes, b:B.b + (B.key ? add : 0)}; };
const RECIPES = [...BP, ...Object.keys(BASIC).flatMap(t => [1, 2, 3].map(tr => basicRecipe(t, tr)))];
const RBY = Object.fromEntries(RECIPES.map(r => [r.key, r]));

const HIKERS0 = [
  {id:'wyatt',name:'WYATT',c:'#E2683C',fy:.337,e:7,a:6,m:8,inj:0,acted:false,lvup:true,lv:3,xp:35,
    conds:[{n:'Inspired',d:'2 days',k:'pos',i:'star'}],
    traits:[['artisan-crafter','Crafter','#ED642B'],['eagle-eye','Eagle Eye','#4A8FD4'],['careful-hands','Careful Hands','#4FA477'],['coach','Coach','#9466C4']],
    gear:{body:'flannel',feet:'trail-shoes'}, bag:['trail-mix','bandages']},
  {id:'ellie',name:'ELLIE',c:'#4A8FD4',fy:.678,e:4,a:2,m:6,inj:1,acted:true,lv:2,xp:60,
    conds:[{n:'Hungry',d:'',k:'thr',i:'utensils'},{n:'Wet',d:'1 day',k:'neg',i:'droplet'}],
    traits:[['dog-lover','Dog Lover','#E2683C'],['copydog','Copydog','#9466C4'],['alpha-dog','Alpha Dog','#C4562E']], gear:{}, bag:[]},
  {id:'gdog',name:'GDOG',c:'#EBC04A',fy:.836,e:8,a:8,m:9,inj:0,acted:false,lv:3,xp:90,conds:[],
    traits:[['caring','Caring','#4FA477'],['chatty','Chatty','#E0A631'],['chef','Chef','#45A86C']], gear:{gear:'tent'}, bag:['salad']},
  {id:'finn',name:'FINN',c:'#A06CC9',fy:.569,e:5,a:7,m:4,inj:0,acted:false,lv:1,xp:20,
    conds:[{n:'Grumpy',d:'1 day',k:'neg',i:'frown'}],
    traits:[['day-napper','Day Napper','#545C8E'],['close-company','Close Company','#E2683C']], gear:{}, bag:[]},
];
const PACK0 = {wood:3, metal:1, stone:2, grass:2, fur:1, fish:1, flint:1};
const POOL0 = {mushroom:['gdog',2], clay:['ellie',1], shell:['finn',1], salt:['gdog',1]};

let H, PACK, POOL, favR, favS, sel, openSet, phase, screen = 'main', amode = 'wheel', rmode = 'deal', node = 'forest';
function reset() {
  H = HIKERS0.map(h => ({...h, conds:[...h.conds], tile:'start'}));
  PACK = {...PACK0}; POOL = JSON.parse(JSON.stringify(POOL0));
  favR = new Set(['b:trowel','b:sack','b:tent','b:binoculars']); favS = new Set(['fur','shell']);
  sel = 'wyatt'; openSet = new Set(['wyatt']); phase = 0;
}
reset();
const hk = id => H.find(h => h.id === id);
const avail = () => { const a = {}; ALLRES.forEach(r => a[r] = (PACK[r] || 0) + (POOL[r] ? POOL[r][1] : 0)); return a; };

/* ───────────────────────── stage scale ───────────────────────── */
const stage = $('#stage'), wrap = $('#wrap');
let S = 1;
function fit() {
  S = Math.min(wrap.clientWidth / 1440, wrap.clientHeight / 900);
  stage.style.transform = `translate(${(wrap.clientWidth - 1440 * S) / 2}px,${(wrap.clientHeight - 900 * S) / 2}px) scale(${S})`;
}
const fitRO = new ResizeObserver(fit); fitRO.observe(wrap);
const barRO = new ResizeObserver(() => document.documentElement.style.setProperty('--bh', $('#bar').offsetHeight + 'px')); barRO.observe($('#bar'));
function sp(el) { const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return {x:(r.left - s.left) / S, y:(r.top - s.top) / S, w:r.width / S, h:r.height / S}; }
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2400); }

/* portraits: the game's faceY puts the face in the middle */
function por(h, s, z = 1.75) {
  const w = s * z, hh = w * 620 / 750; let top = s / 2 - h.fy * hh; top = Math.max(top, s - hh); top = Math.min(top, 0);
  return `<img src="img/por/${h.id}.webp" alt="" style="width:${w}px;left:${(s - w) / 2}px;top:${top}px">`;
}
const resImg = r => `img/res/${r}.webp`;

/* ───────────────────────── static chrome ───────────────────────── */
$('#ph0').innerHTML = ic('sunrise'); $('#ph1').innerHTML = ic('sun'); $('#ph2').innerHTML = ic('moon');
$('#wx').innerHTML = ic('sun'); $('#acorn').innerHTML = ic('acorn'); $('#menu').innerHTML = ic('menu');
$('#zin').innerHTML = ic('plus'); $('#zout').innerHTML = ic('minus'); $('#zc').innerHTML = ic('crosshair');
$('#cx').innerHTML = ic('x');

/* ───────────────────────── party frames ───────────────────────── */
const worst = h => h.conds.some(c => c.k === 'neg') ? 'neg' : h.conds.some(c => c.k === 'thr') ? 'thr' : h.conds.length ? 'pos' : '';
function barHTML(h, k, icon, color) {
  const v = h[k], pct = v * 10;
  return `<div class="bar" style="--k:${color}">${ic(icon, 2.4)}<div class="trk"><i class="ghost" id="g-${h.id}-${k}" style="width:${pct}%"></i><i class="fill" id="f-${h.id}-${k}" style="width:${pct}%"></i><i class="th" style="left:${TH[k] * 10}%"></i></div><b id="v-${h.id}-${k}">${v}</b></div>`;
}
function frameHTML(h) {
  const w = worst(h);
  const tip = h.conds.map(c => c.n + (c.d ? ' · ' + c.d : '')).join(', ');
  return `<div class="frame tag ${h.id === sel ? 'sel' : ''} ${h.acted ? 'acted' : ''} ${openSet.has(h.id) ? 'open' : ''}" style="--c:${h.c}" data-h="${h.id}" role="button" tabindex="0" aria-label="${h.name}: show details">
    <div class="por">${por(h, 60)}</div>
    ${w ? `<span class="cdot ${w}" title="${tip}">${h.conds.length}</span>` : ''}
    <span class="stamp">ACTED</span>
    <div class="banner"><span class="nm">${h.name}</span><span class="inj" title="Injuries: ${h.inj} of 3">${[0, 1, 2].map(i => `<i class="${i < h.inj ? 'on' : ''}"></i>`).join('')}</span></div>
    <div class="bars">${barHTML(h, 'e', 'zap', 'var(--energy)')}${barHTML(h, 'a', 'utensils', 'var(--appetite)')}${barHTML(h, 'm', 'heart', 'var(--morale)')}</div>
    <div class="more"><div>
      <div class="stl">${ic('zap')}<span>Energy</span><b>${h.e}/10</b><span>Fatigued at ${TH.e}</span>${ic('utensils')}<span>Appetite</span><b>${h.a}/10</b><span>Hungry at ${TH.a}</span>${ic('heart')}<span>Morale</span><b>${h.m}/10</b><span>Luck +1 at ${TH.m}</span></div>
      <div class="lbl" style="margin:8px 0 5px">CONDITIONS</div>
      <div class="mrow">${h.conds.length ? h.conds.map(c => `<span class="chip ${c.k}">${ic(c.i)}${c.n}${c.d ? ' · ' + c.d : ''}</span>`).join('') : '<span class="hint">None right now</span>'}</div>
      <div class="lbl" style="margin-bottom:5px">TRAITS · LV ${h.lv} <span class="xp" style="display:inline-block;vertical-align:middle;margin-left:4px"><i style="width:${h.xp}%"></i></span></div>
      <div class="mrow">${h.traits.map(t => `<span class="tbadge" style="background:${t[2]}" data-n="${t[1]}"><img src="img/trait/${t[0]}.webp" alt="${t[1]}"></span>`).join('')}</div>
      <div class="lbl" style="margin-bottom:5px">WEARING</div>
      <div class="gear">${[['body','shirt'],['feet','boot'],['gear','backpack']].map(([s, i]) => h.gear[s] ? `<span class="f" title="${ITEMS[h.gear[s]].n}"><img src="img/item/${h.gear[s]}.webp" alt=""></span>` : `<span title="${cap(s)}: empty">${ic(i)}</span>`).join('')}</div>
    </div></div>
  </div>`;
}
function renderParty() { $('#party').innerHTML = H.map(frameHTML).join(''); }
$('#party').addEventListener('click', e => {
  const f = e.target.closest('.frame'); if (!f) return;
  const id = f.dataset.h; const wasOpen = openSet.has(id);
  wasOpen ? openSet.delete(id) : openSet.add(id);
  play(wasOpen ? 'ui.frameClose' : 'ui.frameOpen');
  f.classList.toggle('open', !wasOpen);
  if (sel !== id) select(id, true);
});

/* stat changes: the bar jumps, a pale ghost drains after it, a number floats up */
function setStat(h, k, v) {
  v = Math.max(0, Math.min(10, v)); const old = h[k]; if (v === old) return; h[k] = v;
  const f = $(`#f-${h.id}-${k}`), g = $(`#g-${h.id}-${k}`), t = $(`#v-${h.id}-${k}`);
  if (!f) return;
  if (v < old) { f.style.width = v * 10 + '%'; requestAnimationFrame(() => g.style.width = v * 10 + '%'); }
  else { g.style.width = v * 10 + '%'; f.style.width = v * 10 + '%'; }
  t.textContent = v;
  const r = sp(f.parentElement);
  floatText((v > old ? '+' : '−') + Math.abs(v - old), r.x + r.w * v / 10, r.y - 6, v > old ? 'var(--ok)' : 'var(--rust)');
  const fr = f.closest('.frame'); if (v < old) { fr.classList.remove('nudge'); void fr.offsetWidth; fr.classList.add('nudge'); }
  play(v < old ? (v <= TH[k] && old > TH[k] ? 'stat.low' : 'stat.down') : k === 'm' ? 'stat.moraleUp' : 'stat.energyUp');
  const stl = fr.querySelector('.stl'); if (stl) stl.querySelectorAll('b')['eam'.indexOf(k)].textContent = v + '/10';
}
function floatText(txt, x, y, color) {
  const el = document.createElement('div'); el.className = 'float'; el.textContent = txt; el.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
  stage.appendChild(el);
  el.animate([{transform:'translate(-50%,0) scale(.6)', opacity:0}, {transform:'translate(-50%,-14px) scale(1.2)', opacity:1, offset:.25}, {transform:'translate(-50%,-34px) scale(1)', opacity:0}], {duration:1100, easing:'ease-out'}).onfinish = () => el.remove();
}
function sparks(x, y, colors, n = 16, spread = 90, gravity = 120) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.cssText = `left:${x}px;top:${y}px;background:${pick(colors)}`;
    stage.appendChild(s);
    const a = rnd(0, Math.PI * 2), d = rnd(spread * .4, spread);
    s.animate([{transform:'translate(-50%,-50%) scale(1)', opacity:1}, {transform:`translate(${Math.cos(a) * d - 3}px,${Math.sin(a) * d - 3 + gravity * .3}px) scale(.9) rotate(${rnd(-180, 180)}deg)`, opacity:1, offset:.6}, {transform:`translate(${Math.cos(a) * d * 1.15}px,${Math.sin(a) * d + gravity}px) scale(.4)`, opacity:0}], {duration:rnd(650, 950), easing:'cubic-bezier(.2,.8,.4,1)'}).onfinish = () => s.remove();
  }
}

/* ───────────────────────── tokens and the wheel ───────────────────────── */
function renderTokens() {
  const byTile = {};
  $('#tokens').innerHTML = H.map((h, i) => {
    const c = TILES[h.tile]; const n = (byTile[h.tile] = (byTile[h.tile] ?? -1) + 1);
    const o = h.tile === 'start' ? OFF[i] : OFF2[n];
    return `<button class="tok ${h.id === sel ? 'sel' : ''} ${h.acted ? 'acted' : ''}" style="--c:${h.c};left:${c[0] + o[0]}px;top:${c[1] + o[1]}px" data-h="${h.id}" aria-label="${h.name}">${por(h, 34, 1.9)}</button>`;
  }).join('');
}
$('#tokens').addEventListener('click', e => {
  const t = e.target.closest('.tok'); if (!t) return; e.stopPropagation();
  const id = t.dataset.h;
  if (id === sel && wheelOn) closeWheel(); else select(id);
});
function select(id, fromFrame) {
  sel = id; play('ui.click');
  $$('.frame').forEach(f => f.classList.toggle('sel', f.dataset.h === id));
  $$('.tok').forEach(t => t.classList.toggle('sel', t.dataset.h === id));
  clearHex(); renderRight();
  if (amode === 'wheel') openWheel(); else closeWheel(true);
}
const ACTIONS = () => {
  const h = hk(sel), acted = h.acted ? `${cap(h.name.toLowerCase())} has already acted this ${['morning','afternoon','night'][phase]}.` : null;
  const ok = (x) => acted ? {...x, blk:acted} : x;
  return [
    ok({id:'move', n:'Move', i:'footprints', cost:['−1','utensils'], why:'Walk to a connected tile.'}),
    ok({id:'moveAll', n:'Move all', i:'users', cost:['−1 each','utensils'], why:'Bring the hikers on this tile along.'}),
    ok({id:'scav', n:'Scavenge', i:'search', cost:['−1','zap'], why:`Draw cards from this tile’s ${node.replace('+', ' and ')} node${node.includes('+') ? 's' : ''} and keep 1.`}),
    ok({id:'craft', n:'Craft', i:'hammer', cost:['−1','zap'], why:'Make an item from the resources on this tile.'}),
    {id:'tend', n:'Tend', i:'sprout', blk:'There’s nothing to tend on this tile.'},
    {id:'abil', n:'Abilities', i:'sparkles', cost:['1 ready'], why:'Trespasser: no challenges here today.'},
  ];
};
let wheelOn = false;
function center(h) { return TILES[h.tile]; }
function openWheel() {
  const h = hk(sel), [cx, cy] = center(h), W = $('#wheel'), acts = ACTIONS();
  W.innerHTML = acts.map((a, i) => `<button class="wb tag ${a.blk ? 'blk' : ''}" data-a="${a.id}" data-i="${i}" aria-label="${a.n}">${ic(a.i)}${a.cost ? `<span class="cost">${a.cost[0]}${a.cost[1] ? ' ' + ic(a.cost[1], 3).replace('<svg', '<svg style="width:9px;height:9px;vertical-align:-1px"') : ''}</span>` : ''}</button>`).join('');
  W.style.left = cx + 'px'; W.style.top = cy + 'px';
  const R = 122, n = acts.length;
  $$('.wb', W).forEach((b, i) => {
    const ang = Math.PI + i * Math.PI / (n - 1);
    b.style.transitionDelay = i * 28 + 'ms';
    requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transform = `translate(${Math.cos(ang) * R}px,${Math.sin(ang) * R - 6}px) scale(1)`; }));
  });
  W.classList.add('on'); wheelOn = true; play('ui.wheelOpen');
  bubble(null);
}
function closeWheel(silent) {
  const W = $('#wheel'); if (!wheelOn) { W.innerHTML = ''; return; }
  wheelOn = false; if (!silent) play('ui.wheelClose');
  $$('.wb', W).forEach((b, i, all) => { b.style.transitionDelay = (all.length - i) * 15 + 'ms'; b.style.transform = 'translate(0,0) scale(.2)'; b.style.opacity = 0; });
  setTimeout(() => { if (!wheelOn) { W.innerHTML = ''; W.classList.remove('on'); } }, 400);
  $('#bubble').classList.remove('on');
}
function bubble(a) {
  const b = $('#bubble'), h = hk(sel), [cx, cy] = center(h);
  b.style.left = cx + 'px'; b.style.top = cy - 166 + 'px';
  b.innerHTML = a ? `<b>${a.n.toUpperCase()}${a.cost ? ' · ' + a.cost[0] + (a.cost[1] === 'zap' ? ' Energy' : a.cost[1] === 'utensils' ? ' Appetite' : '') : ''}</b><span>${a.blk || a.why}</span>` : `<b>${h.name}’S TURN</b><span>Pick an action, or press 1 to 6</span>`;
  b.classList.add('on');
}
$('#wheel').addEventListener('mouseover', e => { const b = e.target.closest('.wb'); if (!b) return; bubble(ACTIONS()[b.dataset.i]); play('ui.hover', {vol:.6}); });
$('#wheel').addEventListener('mouseleave', () => wheelOn && bubble(null));
$('#wheel').addEventListener('click', e => { const b = e.target.closest('.wb'); if (b) { e.stopPropagation(); doAction(b.dataset.a); } });
stage.addEventListener('click', e => { if (screen === 'main' && wheelOn && !e.target.closest('.wb,.tok,.frame,#right,#bar,.hexhi')) closeWheel(); });

function doAction(id) {
  const a = ACTIONS().find(x => x.id === id);
  if (a.blk) { play('ui.error'); toast(a.blk); $$(`.wb[data-a=${id}],.ab2[data-a=${id}]`).forEach(b => { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }); return; }
  play('ui.confirm');
  if (id === 'scav') { closeWheel(true); setScreen('scav'); }
  else if (id === 'craft') { closeWheel(true); setScreen('craft'); }
  else if (id === 'move' || id === 'moveAll') { closeWheel(true); showHex(id === 'moveAll'); }
  else if (id === 'abil') toast('Abilities open a small fan of the hiker’s ability badges here.');
}
function showHex(all) {
  const h = hk(sel);
  $('#hexes').innerHTML = ['a', 'b'].filter(t => t !== h.tile).map(t => { const [x, y] = TILES[t];
    return `<div class="hexhi" data-t="${t}" style="left:${x - 56}px;top:${y - 64}px;width:112px;height:128px"><svg viewBox="0 0 112 128" width="112" height="128"><polygon points="56,3 109,33 109,95 56,125 3,95 3,33" fill="rgba(255,220,130,.28)" stroke="#E9B44C" stroke-width="5" stroke-dasharray="10 7"/></svg><span class="ct">−1 Appetite${all ? ' each' : ''}</span></div>`; }).join('');
  $('#hexes').dataset.all = all ? 1 : '';
  toast(all ? 'Pick a tile for the whole group' : 'Pick a tile to walk to · Esc cancels');
}
function clearHex() { $('#hexes').innerHTML = ''; }
$('#hexes').addEventListener('click', e => {
  const x = e.target.closest('.hexhi'); if (!x) return; e.stopPropagation();
  const t = x.dataset.t, all = !!$('#hexes').dataset.all, h = hk(sel);
  const movers = all ? H.filter(o => o.tile === h.tile && !o.acted) : [h];
  movers.forEach(m => { m.tile = t; m.acted = true; });
  clearHex(); renderTokens(); play('ui.confirm');
  movers.forEach((m, i) => setTimeout(() => { setStat(m, 'a', m.a - 1); markActed(m); }, 300 + i * 120));
});
function markActed(h) {
  h.acted = true;
  const f = $(`.frame[data-h=${h.id}]`); if (f) f.classList.add('acted');
  const t = $(`.tok[data-h=${h.id}]`); if (t) t.classList.add('acted');
  updateEnd();
}

/* ───────────────────────── right side ───────────────────────── */
function nodesOf() { return node.split('+'); }
function renderRight() {
  const h = hk(sel), here = H.filter(o => o.tile === h.tile && o.id !== h.id).map(o => cap(o.name.toLowerCase()));
  const acts = ACTIONS();
  let html = `<div class="tile tag"><h3>${nodesOf().map(n => NODE_LOOK[n].name).join(' + ')} TILE</h3><div class="sub">Meadow · ${here.length ? 'with ' + here.join(', ') + ' · resources pooled' : 'alone here'}</div>
    <div class="nodes">${nodesOf().map(n => `<img src="img/scav/node-${n}.webp" alt="${n}"><span class="ab" title="${cap(n)} abundance ${NODE_LOOK[n].ab}/10">${[...Array(10)].map((_, i) => `<i class="${i < NODE_LOOK[n].ab ? 'f' : ''}"></i>`).join('')}</span>`).join('')}</div></div>`;
  if (amode === 'side') html += `<div class="acts tag"><div class="hd"><span class="lbl">${h.name}’S TURN</span><span class="hint">${['Morning','Afternoon','Night'][phase]}</span></div>
    <div class="agrid">${acts.map(a => `<button class="ab2 ${a.blk ? 'blk' : ''}" data-a="${a.id}">${ic(a.i)}${a.n.toUpperCase()}${a.cost ? `<span class="cost">${a.cost[0]}</span>` : ''}</button>`).join('')}</div>
    <div class="why" id="why">Point at an action to see what it does.</div></div>`;
  const bag = [...h.bag, null, null, null, null].slice(0, 4);
  const res = Object.entries(PACK).filter(([, n]) => n > 0);
  html += `<div class="pack tag"><span class="lbl">${h.name}’S PACK</span>
    <div class="slots">${bag.map((b, i) => b ? `<button class="slot f" data-bi="${i}" aria-label="${ITEMS[b].n}: eat, use or wear"><img src="img/item/${b}.webp" alt=""></button>` : '<span class="slot"></span>').join('')}</div>
    <div class="hint">Click an item to eat, use or wear it.</div>
    <div class="rlist" id="rlist">${h.id === 'wyatt' ? res.map(([r, n]) => `<span class="rc" data-r="${r}" title="${cap(r)}"><img src="${resImg(r)}" alt=""><b>${n}</b></span>`).join('') : '<span class="hint">No resources</span>'}</div></div>`;
  $('#right').innerHTML = html;
}
$('#right').addEventListener('click', e => {
  const b = e.target.closest('.ab2'); if (b) doAction(b.dataset.a);
  const s = e.target.closest('.slot.f'); if (s) { e.stopPropagation(); itemPop(+s.dataset.bi, s); }
});
/* items are used from the pack: a small card pops out with what you can do */
const VERB = {food:['EAT', 'item.eat'], tool:['USE', 'item.use'], clothes:['WEAR', 'item.equip'], shelter:['SET UP', 'item.use'], trinket:['USE', 'item.use']};
function itemPop(i, el) {
  const h = hk(sel), id = h.bag[i], it = ITEMS[id], pop = $('#ipop'), r = sp(el);
  play('ui.click');
  pop.innerHTML = `${itemCard(id, 3)}<div class="ipb"><b class="px">${it.n.toUpperCase()}</b><span>${it.fx}</span>
    <div class="ipa"><button class="btn go" data-go="${i}">${VERB[it.t][0]}</button><button class="btn" data-give="${i}">GIVE</button></div><small>${it.t === 'food' ? 'Eating is free: it doesn’t use the action.' : 'Using an item doesn’t use the action.'}</small></div>`;
  const pk = sp($('#right .pack')); pop.style.left = (1440 - 16 - 392) + 'px'; pop.style.top = (pk.y + pk.h + 10) + 'px';
  pop.classList.add('on');
}
function closePop() { $('#ipop').classList.remove('on'); }
$('#ipop').addEventListener('click', e => {
  e.stopPropagation();
  const g = e.target.closest('[data-go]'), gv = e.target.closest('[data-give]');
  if (gv) { play('ui.click'); toast('Give: drag the item onto another hiker’s tag (as now).'); return; }
  if (!g) return;
  const h = hk(sel), i = +g.dataset.go, id = h.bag[i], it = ITEMS[id];
  const card = $('#ipop .ic'), from = sp(card), to = sp($(`.frame[data-h=${h.id}] .por`));
  const f = card.cloneNode(true); f.classList.add('fly'); f.style.cssText = `left:${from.x}px;top:${from.y}px`; stage.appendChild(f);
  f.animate([{transform:'none'}, {transform:`translate(${to.x - from.x - 30}px,${to.y - from.y - 50}px) scale(.25) rotate(-16deg)`, opacity:.8}], {duration:520, easing:'cubic-bezier(.5,0,.7,1)', fill:'forwards'});
  closePop(); play(VERB[it.t][1]);
  setTimeout(() => {
    f.remove(); h.bag.splice(i, 1);
    if (id === 'bandages' && h.inj) { h.inj--; const pip = $$(`.frame[data-h=${h.id}] .inj i`)[h.inj]; pip && pip.classList.remove('on'); play('cond.cured'); }
    else if (it.t === 'food') setStat(h, 'a', h.a + (id === 'trail-mix' ? 1 : 2));
    else if (it.t === 'clothes') { toast(`${it.n} is on`); }
    else toast(`${it.n} used`);
    renderRight();
  }, 520);
});
document.addEventListener('click', e => { if (!e.target.closest('#ipop')) closePop(); });
$('#right').addEventListener('mouseover', e => { const b = e.target.closest('.ab2'); if (!b) return; const a = ACTIONS().find(x => x.id === b.dataset.a); $('#why').innerHTML = `<b class="px" style="font-weight:400">${a.n.toUpperCase()}</b> · ${a.blk || a.why}`; });
function updateEnd() { const n = H.filter(h => !h.acted).length; $('#endsub').textContent = n ? `${n} hiker${n > 1 ? 's' : ''} haven’t acted` : 'Everyone has acted'; $('#end b').textContent = 'END ' + ['MORNING', 'AFTERNOON', 'NIGHT'][phase]; }
$('#end').addEventListener('click', () => {
  play('ui.endPhase'); phase = (phase + 1) % 3; H.forEach(h => h.acted = false);
  [0, 1, 2].forEach(i => $('#ph' + i).classList.toggle('on', i === phase));
  renderParty(); renderTokens(); renderRight(); updateEnd(); if (wheelOn) openWheel();
  toast(['Morning', 'Afternoon', 'Night'][phase] + ' begins');
});

/* ───────────────────────── scavenge ───────────────────────── */
const CARDS = {
  forest:[{r:['wood'],rar:'common'},{r:['moss'],rar:'common'},{r:['grass'],rar:'common'},{r:['mushroom'],rar:'common'},{r:['wood'],x:2,rar:'uncommon'},{r:['moss','mushroom'],rar:'uncommon'},{r:['grass'],x:3,rar:'rare'},{r:['wood','moss','grass'],rar:'rare'},{item:'tool',rar:'rare'}],
  river:[{r:['fish'],rar:'common'},{r:['clay'],rar:'common'},{r:['shell'],rar:'common'},{r:['seaweed'],rar:'common'},{r:['fish'],x:2,rar:'uncommon'},{r:['shell','seaweed'],rar:'uncommon'},{r:['shell'],x:3,rar:'rare'},{item:'food',rar:'rare'}],
  wildlife:[{r:['meat'],rar:'common'},{r:['fur'],rar:'common'},{r:['oil'],rar:'common'},{r:['bones'],rar:'common'},{r:['fur'],x:2,rar:'uncommon'},{r:['meat','bones'],rar:'uncommon'},{r:['meat','fur','oil'],rar:'rare'},{item:'clothes',rar:'veryRare'}],
  mountain:[{r:['stone'],rar:'common'},{r:['metal'],rar:'common'},{r:['flint'],rar:'common'},{r:['salt'],rar:'common'},{r:['metal'],x:2,rar:'uncommon'},{r:['flint','salt'],rar:'uncommon'},{r:['stone'],x:3,rar:'rare'},{item:'tool',rar:'rare'}],
};
function cardInfo(c) {
  if (c.item) return {name:`${cap(c.item)} find`, desc:`A random ${c.item} card`};
  if (c.mixed) return {name:c.r.map(cap).join(' + '), desc:'One from each node'};
  if (c.x) return {name:`${cap(c.r[0])} ×${c.x}`, desc:c.x === 2 ? 'Two of the same' : 'Three of the same'};
  if (c.r.length > 1) return {name:c.r.length === 2 ? c.r.map(cap).join(' + ') : 'Trio', desc:c.r.length === 2 ? 'Two different, same node' : 'Three different, same node'};
  return {name:cap(c.r[0]), desc:'One resource'};
}
/* what the starred recipes still need */
function missingOf(rec, av = avail()) {
  const miss = []; let spare = 0;
  if (rec.kind !== 'bp') return miss;
  for (const [r, n] of Object.entries(rec.cost)) { const have = av[r] || 0; if (have < n) miss.push([r, n - have]); }
  const used = Object.entries(rec.cost).reduce((s, [r, n]) => s + Math.min(n, av[r] || 0), 0);
  spare = Object.values(av).reduce((s, n) => s + n, 0) - used;
  if (spare < rec.any) miss.push(['any', rec.any - spare]);
  return miss;
}
function wanted(r) {
  for (const k of favR) { const rec = RBY[k]; if (rec.kind === 'bp' && missingOf(rec).some(([m]) => m === r)) return 'NEEDED · ' + rec.n.toUpperCase(); }
  if (favS.has(r)) return 'STARRED';
  return null;
}

/* poster headers: flat two-tone shapes like the map's stamps, so they stay crisp at any size */
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sceneSVG(n) {
  const r = rng({forest:3, river:7, wildlife:11, mountain:5}[n]), R = (a, b) => a + r() * (b - a);
  const pal = {
    forest:{sky:['#eaf0d9', '#c9dcbb'], sun:'#fbf3d5', far:'#a7c29f', lit:['#79a684', '#4f7f61'], dark:['#557f63', '#2d5441'], ground:'#2f5443'},
    river:{sky:['#e9f1f3', '#c3d8e4'], sun:'#fbf6e3', far:'#a3b9c9', farD:'#87a1b5', lit:['#6f97b3', '#3f6c8c'], dark:['#4f7896', '#264a66'], ground:'#284a66', water:'#a8d4ea'},
    wildlife:{sky:['#f7e8c4', '#efcd94'], sun:'#fff3d2', far:'#dcb984', mid:'#bb915a', midD:'#9c7444', ground:'#6c5233'},
    mountain:{sky:['#eff1f0', '#d3d9db'], sun:'#fbf8ee', lit:['#cfd3d5', '#a5abb0'], dark:['#8f959a', '#6c7277'], ground:'#55524c'},
  }[n];
  const W = 1000, Hh = 208; let s = `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%"><defs><linearGradient id="sk${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky[0]}"/><stop offset="1" stop-color="${pal.sky[1]}"/></linearGradient></defs><rect width="${W}" height="${Hh}" fill="url(#sk${n})"/>`;
  const sx = 790, sy = n === 'wildlife' ? 120 : 112;
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, b = a + Math.PI / 56; s += `<polygon points="${sx},${sy} ${sx + Math.cos(a) * 900},${sy + Math.sin(a) * 900} ${sx + Math.cos(b) * 900},${sy + Math.sin(b) * 900}" fill="#fff" opacity=".22"/>`; }
  s += `<circle cx="${sx}" cy="${sy}" r="${n === 'wildlife' ? 74 : 56}" fill="${pal.sun}"/>`;
  const tree = (x, base, h, lit, dark) => { let o = `<rect x="${x - h * .035}" y="${base - h * .08}" width="${h * .07}" height="${h * .1}" fill="#3b2a1e"/>`;
    for (let i = 0; i < 3; i++) { const ay = base - h + i * h * .27, by = ay + h * .46, hw = h * (.2 + .07 * i);
      o += `<polygon points="${x},${ay} ${x - hw},${by} ${x},${by}" fill="${lit}"/><polygon points="${x},${ay} ${x},${by} ${x + hw},${by}" fill="${dark}"/>`; } return o; };
  const peak = (x, base, w, h, lit, dark, snow) => { const ax = x + R(-w * .08, w * .08), ay = base - h, m = ax + w * .07;
    let o = `<polygon points="${x - w / 2},${base} ${ax},${ay} ${m},${base}" fill="${lit}"/><polygon points="${ax},${ay} ${x + w / 2},${base} ${m},${base}" fill="${dark}"/>`;
    if (snow) o += `<polygon points="${ax},${ay} ${ax - w * .11},${ay + h * .26} ${ax - w * .04},${ay + h * .2} ${ax + w * .02},${ay + h * .29} ${ax + w * .1},${ay + h * .23}" fill="#f6f6f1"/>`; return o; };
  const hills = (y, amp, color, k = 5) => { let d = `M0 ${Hh} L0 ${y}`; for (let i = 0; i < k; i++) { const x0 = i * W / k, x1 = (i + 1) * W / k; d += ` Q${(x0 + x1) / 2} ${y - R(amp * .4, amp)} ${x1} ${y + R(-8, 8)}`; } return `<path d="${d} L${W} ${Hh}Z" fill="${color}"/>`; };
  if (n === 'forest') {
    s += hills(120, 40, pal.far, 4);
    for (let x = -10; x < W + 40; x += R(34, 50)) s += tree(x, 168, R(70, 100), pal.lit[0], pal.dark[0]);
    for (let x = -30; x < W + 60; x += R(70, 110)) s += tree(x, 232, R(130, 190), pal.lit[1], pal.dark[1]);
  } else if (n === 'river') {
    for (let x = -60; x < W + 100; x += R(120, 190)) s += peak(x, 130, R(180, 260), R(60, 95), pal.far, pal.farD, false);
    s += `<path d="M0 ${Hh} L0 132 Q250 120 470 128 L520 128 Q760 118 ${W} 134 L${W} ${Hh}Z" fill="${pal.lit[0]}"/>`;
    s += `<path d="M470 128 Q505 150 440 175 Q360 200 300 ${Hh} L700 ${Hh} Q600 196 575 170 Q545 145 525 128Z" fill="${pal.water}"/>`;
    for (let i = 0; i < 7; i++) { const y = 140 + i * 10; s += `<path d="M${490 - i * 22} ${y} q${14 + i * 3} -3 ${28 + i * 6} 0" stroke="#e9f6fc" stroke-width="2.5" fill="none" stroke-linecap="round"/>`; }
    for (let x = -20; x < 360; x += R(40, 64)) s += tree(x, 226, R(120, 170), pal.lit[1], pal.dark[1]);
    for (let x = 700; x < W + 60; x += R(40, 64)) s += tree(x, 226, R(120, 170), pal.lit[1], pal.dark[1]);
  } else if (n === 'wildlife') {
    s += hills(126, 36, pal.far, 3);
    s += `<path d="M0 ${Hh} L0 150 Q220 104 480 140 Q700 172 ${W} 128 L${W} ${Hh}Z" fill="${pal.mid}"/><path d="M480 140 Q700 172 ${W} 128 L${W} ${Hh} L520 ${Hh}Z" fill="${pal.midD}"/>`;
    s += `<image href="img/deer.png" x="560" y="74" width="82" height="101"/><image href="img/deer.png" x="660" y="96" width="56" height="69" transform="translate(1376 0) scale(-1 1)"/>`;
    s += `<path d="M0 ${Hh} L0 182 Q300 168 600 186 Q820 196 ${W} 176 L${W} ${Hh}Z" fill="${pal.ground}"/>`;
    for (let x = 6; x < W; x += R(16, 30)) { const h = R(16, 34); s += `<path d="M${x} 196 q-2 ${-h * .6} -7 ${-h} M${x} 196 q1 ${-h * .7} 6 ${-h * .95} M${x} 196 l0 ${-h * .8}" stroke="#8d6c42" stroke-width="3" fill="none" stroke-linecap="round"/>`; }
  } else {
    for (let x = -40; x < W + 120; x += R(140, 210)) s += peak(x, 150, R(220, 320), R(100, 140), pal.lit[0], pal.dark[0], true);
    for (let x = -80; x < W + 120; x += R(110, 170)) s += peak(x, 190, R(170, 240), R(60, 90), pal.lit[1], pal.dark[1], r() > .5);
    s += `<path d="M0 ${Hh} L0 186 L120 172 L230 188 L380 168 L520 190 L660 174 L800 192 L${W} 170 L${W} ${Hh}Z" fill="${pal.ground}"/>`;
    for (let x = 30; x < W; x += R(110, 200)) s += tree(x, 214, R(60, 90), '#4f6f5c', '#34503f');
  }
  return s + '</svg>';
}
let SC = null;
function dealCards() {
  const nodes = nodesOf(); const n = 4; const out = [];
  for (let i = 0; i < n; i++) { const nd = nodes[i % nodes.length]; const pool = CARDS[nd];
    const w = pool.map(c => ({common:6, uncommon:3, rare:1.5, veryRare:.8}[c.rar]));
    let t = Math.random() * w.reduce((a, b) => a + b), j = 0; while ((t -= w[j]) > 0) j++;
    out.push({...pool[j], node:nd});
  }
  if (nodes.length > 1) out[2] = {r:[NODE_RES[nodes[0]][0], NODE_RES[nodes[1]][0]], mixed:true, rar:'rare', node:'any'};
  if (!out.some(c => c.r && c.r.some(wanted))) { const nd = nodes[0]; const want = CARDS[nd].filter(c => c.r && c.r.some(wanted)); if (want.length) out[0] = {...pick(want), node:nd}; }
  if (!out.some(c => RAR.indexOf(c.rar) >= 2)) out[3] = {...CARDS[nodes[nodes.length - 1]].filter(c => c.rar === 'rare')[0], node:nodes[nodes.length - 1]};
  return out;
}
function openScav() {
  const h = hk(sel), nodes = nodesOf();
  $('#poster').innerHTML = nodes.map((n, i) => `<div class="art ${i ? 'b' : ''}">${sceneSVG(n)}</div>`).join('') +
    `<div class="ttl"><small>SCAVENGE</small><b>${nodes.map(n => NODE_LOOK[n].name).join(' + ')}</b></div>
     <div class="who"><span class="chip">${ic('sparkles')}Trowel · +1 card</span><span class="chip" style="--c:${h.c}"><span class="mini" style="width:22px;height:22px;border-width:1.5px;--c:${h.c}">${por(h, 19, 1.9)}</span>${h.name} · ${ic('zap')} ${h.e} → ${h.e - 1}</span></div>`;
  $('#ground').style.setProperty('--g1', NODE_LOOK[nodes[0]].g);
  if (nodes.length > 1) $('#ground').style.background = `linear-gradient(100deg,${NODE_LOOK[nodes[0]].g} 45%,${NODE_LOOK[nodes[1]].g} 55%)`; else $('#ground').style.background = '';
  $('#bookov').classList.remove('on');
  SC = {cards:dealCards(), picked:-1, flips:0, busy:true, done:false};
  renderLook();
  const T = $('#table'); T.innerHTML = '';
  const gap = 18, w = 158, x0 = (700 - (4 * w + 3 * gap)) / 2;
  SC.cards.forEach((c, i) => {
    const inf = cardInfo(c), lv = RAR.indexOf(c.rar) + 1;
    const want = c.r ? c.r.map(wanted).find(Boolean) : null;
    c.want = want;
    const back = c.node === 'any' ? 'any-node' : c.node;
    const frontBg = c.item ? 'items' : back;
    const el = document.createElement('div'); el.className = 'sc' + (lv >= 3 ? ' glow' : '');
    const x = x0 + i * (w + gap), y = 64 + rnd(-8, 8), r = rnd(-4, 4);
    el.style.cssText = `--x:${x}px;--y:${y}px;--r:${r}deg;--rarc:var(--${c.rar});transform:translate(${350 - w / 2}px,-520px) rotate(-28deg) scale(.85)`;
    const imgs = c.item ? `<img src="img/scav/item-back.webp" alt="" style="width:96px;height:96px">` : (c.mixed || c.r.length > 1 || c.x) ? (c.x ? [0, 1, 2].slice(0, c.x).map(k => `<img src="${resImg(c.r[0])}" style="transform:translate(${(k - (c.x - 1) / 2) * 26}px,${(k % 2 ? -10 : 8)}px);width:76px;height:76px">`).join('') : c.r.map((rr, k) => `<img src="${resImg(rr)}" style="transform:translate(${(k - (c.r.length - 1) / 2) * 34}px,${k % 2 ? -12 : 8}px);width:74px;height:74px">`).join('')) : `<img src="${resImg(c.r[0])}">`;
    el.innerHTML = `${want ? `<div class="want">★ ${want}</div>` : ''}<div class="in">
      <div class="face back"><div class="bg" style="background-image:url(img/scav/${back}.webp)"></div>${c.node === 'any' ? '' : `<img class="ic" src="img/scav/node-${c.node}.webp" alt="">`}</div>
      <div class="face front"><div class="bg" style="background-image:url(img/scav/${frontBg}.webp)"></div><div class="rays" style="background-image:url(img/scav/rays-${c.item ? 'items-white' : c.node === 'any' ? 'forest' : c.node}.webp)"></div><div class="res">${imgs}</div>${c.x ? `<span class="x2">×${c.x}</span>` : ''}</div>
    </div><div class="cap"><b>${inf.name.toUpperCase()}</b><span>${inf.desc}</span><div class="pips" style="--rarc:var(--${c.rar})">${[...Array(Math.max(lv, 6))].map((_, k) => k < 6 ? `<i class="${k < lv ? 'f' : ''}"></i>` : '').join('')}&nbsp;${RAR_NAME[c.rar]}</div></div>`;
    el.dataset.i = i; c.el = el; T.appendChild(el);
    setTimeout(() => { play('card.deal'); el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`; }, 250 + i * 160);
  });
  setTimeout(() => {
    SC.busy = false;
    if (rmode === 'brush') SC.cards.forEach(addCover);
    smsg();
  }, 250 + 4 * 160 + 420);
  $('#take').disabled = true; $('#take').textContent = 'Take'; $('#notnow').disabled = false;
  $('#flipall').textContent = rmode === 'brush' ? 'Brush all' : 'Flip all'; $('#flipall').disabled = false;
  smsg('The dealer slides you ' + SC.cards.length + ' cards…');
}
function smsg(t) {
  if (t) { $('#smsg').textContent = t; return; }
  const left = SC.cards.filter(c => !c.shown).length;
  $('#smsg').textContent = SC.picked >= 0 ? 'Take it, or pick another card.' : left ? (rmode === 'brush' ? 'Drag across a card to brush it clear.' : 'Click a card to flip it.') + (SC.flips ? '' : ' Not now is free until you look.') : 'Pick one card to keep.';
}
function renderLook() {
  const av = avail();
  const favs = [...favR].map(k => RBY[k]).filter(r => r.kind === 'bp');
  $('#look').innerHTML = `<h4>LOOKING FOR</h4><div class="hint" style="margin-bottom:4px">Your starred recipes</div>` + favs.map(rec => {
    const miss = missingOf(rec, av);
    return `<div class="lrow"><div class="n">${rec.n}<span style="color:${miss.length ? 'var(--rust)' : 'var(--ok)'}">${miss.length ? 'needs ' + miss.reduce((s, m) => s + m[1], 0) : '✓ ready'}</span></div><div class="toks">${tokens(rec, av)}</div></div>`;
  }).join('') + `<div class="lrow"><div class="n">Starred resources</div><div class="toks">${[...favS].map(r => `<span class="tk" title="${cap(r)}"><img src="${resImg(r)}" alt=""></span>`).join('') || '<span class="hint">None</span>'}</div></div>
  <button class="btn" id="openbook" style="width:100%;margin-top:8px;height:40px">${ic('book').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px;margin-right:6px"')}RECIPE BOOK</button>`;
}
function tokens(rec, av = avail(), small = false) {
  const left = {...av}; let out = '';
  if (rec.kind === 'bp') {
    for (const [r, n] of Object.entries(rec.cost)) for (let i = 0; i < n; i++) { const ok = left[r] > 0; if (ok) left[r]--; out += `<span class="tk ${ok ? '' : 'miss'}" title="${cap(r)}"><img src="${resImg(r)}" alt=""></span>`; }
    let spare = Object.values(left).reduce((s, n) => s + n, 0);
    for (let i = 0; i < rec.any; i++) out += `<span class="tk any ${spare-- > 0 ? '' : 'miss'}" title="Any resource">?</span>`;
  } else if (rec.keyRes) {
    const best = rec.keyRes.reduce((b, r) => (av[r] || 0) > (av[b] || 0) ? r : b, rec.keyRes[0]);
    out += `<span class="tk grp ${(av[best] || 0) >= rec.k ? '' : 'miss'}" title="${rec.keyRes.map(cap).join(' or ')} (${rec.k} of the same)">${rec.keyRes.slice(0, 2).map(r => `<img src="${resImg(r)}" alt="">`).join('')}<sup>×${rec.k}</sup></span>`;
    const grp = rec.nodes ? rec.nodes.flatMap(n => NODE_RES[n]) : ALLRES;
    const have = grp.reduce((s, r) => s + (av[r] || 0), 0) - (grp.includes(best) ? Math.min(rec.k, av[best] || 0) : 0);
    out += `<span class="tk grp ${have >= rec.b ? '' : 'miss'}" title="${rec.nodes ? rec.nodes.map(cap).join(' or ') + ' resources' : 'Any resources'}, any mix">${rec.nodes ? rec.nodes.map(n => `<img src="img/scav/node-${n}.webp" alt="">`).join('') : '<b style="font-family:GameQuotes">?</b>'}<sup>×${rec.b}</sup></span>`;
  } else {
    out += `<span class="tk any" title="5 different resources, picked at random each time">?</span><span class="tk any">?</span><span class="tk any">?</span><span class="tk any">?</span><span class="tk any">?</span>`;
  }
  return out;
}
$('#look').addEventListener('click', e => { if (e.target.closest('#openbook')) { play('book.page'); const ov = $('#bookov'); ov.innerHTML = `<div class="book">${bookHTML(true)}</div><button class="x" id="bookx" aria-label="Close the book" style="top:-6px;right:-6px">${ic('x')}</button>`; ov.classList.add('on'); } });
$('#bookov').addEventListener('click', e => {
  if (e.target.closest('#bookx')) { play('ui.windowClose'); $('#bookov').classList.remove('on'); return; }
  bookClick(e, true);
});
$('#table').addEventListener('mouseover', e => { const c = e.target.closest('.sc'); if (c && !c.classList.contains('flip') && rmode === 'deal' && SC && !SC.busy && c !== lastHover) { lastHover = c; play('card.hover', {vol:.5}); } });
let lastHover = null;
$('#table').addEventListener('click', e => {
  const el = e.target.closest('.sc'); if (!el || !SC || SC.busy || SC.done) return;
  const c = SC.cards[el.dataset.i];
  if (!c.shown) { if (rmode === 'deal') flipCard(c); return; }
  SC.picked = SC.picked === +el.dataset.i ? -1 : +el.dataset.i; play('card.take', {vol:.6});
  SC.cards.forEach((k, i) => { k.el.classList.toggle('pick', i === SC.picked); k.el.classList.toggle('dimc', SC.picked >= 0 && i !== SC.picked); });
  const t = $('#take'); t.disabled = SC.picked < 0;
  t.textContent = SC.picked < 0 ? 'Take' : 'TAKE ' + cardInfo(SC.cards[SC.picked]).name.toUpperCase();
  smsg();
});
function revealFx(c) {
  c.shown = true; SC.flips++; c.el.classList.add('shown');
  const r = sp(c.el.querySelector('.in')), lv = RAR.indexOf(c.rar);
  setTimeout(() => {
    if (lv > 0) play('card.reveal.' + c.rar);
    if (lv >= 2) sparks(r.x + r.w / 2, r.y + r.h / 2, [`var(--${c.rar})`, '#fff6dc', '#E9B44C'], 10 + lv * 6, 110 + lv * 15);
    c.el.querySelector('.in').animate([{transform:c.el.classList.contains('flip') ? 'rotateY(180deg) scale(1)' : 'scale(1)'}, {transform:(c.el.classList.contains('flip') ? 'rotateY(180deg) ' : '') + 'scale(1.1)', offset:.4}, {transform:(c.el.classList.contains('flip') ? 'rotateY(180deg) ' : '') + 'scale(1)'}], {duration:380, easing:'cubic-bezier(.3,1.5,.5,1)'});
    if (c.want) { const w = c.el.querySelector('.want'); setTimeout(() => { w.classList.add('on'); play('card.wanted'); }, 260); }
  }, rmode === 'deal' ? 430 : 0);
  $('#notnow').disabled = true;
  if (SC.cards.every(k => k.shown)) { $('#flipall').disabled = true; }
  setTimeout(smsg, 300);
}
function flipCard(c) { if (c.shown) return; c.el.classList.add('flip'); play('card.flip'); revealFx(c); }
$('#flipall').addEventListener('click', async () => {
  if (!SC || SC.busy) return; SC.busy = true;
  for (const c of SC.cards) if (!c.shown) { if (rmode === 'deal') flipCard(c); else autoBrush(c); await wait(rmode === 'deal' ? 260 : 320); }
  SC.busy = false;
});
$('#notnow').addEventListener('click', () => { if (SC && SC.flips === 0) setScreen('main'); });
$('#take').addEventListener('click', async () => {
  if (!SC || SC.picked < 0 || SC.done) return; SC.done = true;
  const c = SC.cards[SC.picked], h = hk(sel);
  const from = sp(c.el.querySelector('.in'));
  const fr = $(`.frame[data-h=${h.id}] .por`), to = sp(fr);
  const fly = c.el.querySelector('.face.front').cloneNode(true); fly.className = 'fly face'; fly.style.cssText = `left:${from.x}px;top:${from.y}px;width:${from.w}px;height:${from.h}px;transform:none;backface-visibility:visible`;
  stage.appendChild(fly); c.el.style.opacity = 0; play('card.take');
  fly.animate([{transform:'translate(0,0) scale(1) rotate(0)'}, {transform:`translate(${(to.x - from.x) * .45}px,${(to.y - from.y) * .45 - 90}px) scale(.7) rotate(-12deg)`, offset:.45}, {transform:`translate(${to.x + to.w / 2 - from.x - from.w / 2}px,${to.y + to.h / 2 - from.y - from.h / 2}px) scale(.22) rotate(-30deg)`, opacity:.9}], {duration:700, easing:'cubic-bezier(.5,0,.6,1)', fill:'forwards'});
  setTimeout(() => {
    fly.remove(); fr.animate([{transform:'scale(1)'}, {transform:'scale(1.18)'}, {transform:'scale(1)'}], {duration:360, easing:'cubic-bezier(.3,1.6,.5,1)'});
    const gains = c.item ? [] : c.x ? Array(c.x).fill(c.r[0]) : c.r;
    gains.forEach(r => PACK[r] = (PACK[r] || 0) + 1);
    if (c.item) { const it = pick(POOLS[c.item]); if (h.bag.length < 4) h.bag.push(it); play('item.new'); floatText('+ ' + ITEMS[it].n, to.x + to.w + 40, to.y + 10, 'var(--ok)'); }
    else { play('res.' + CAT[gains[0]], {vol:.9}); floatText('+' + gains.length + ' ' + (new Set(gains).size === 1 ? cap(gains[0]) : 'resources'), to.x + to.w + 40, to.y + 10, 'var(--ok)'); }
    setStat(h, 'e', h.e - 1); markActed(h); renderRight();
    $$('.rc').forEach(x => { if (gains.includes(x.dataset.r)) x.classList.add('bump'); });
  }, 700);
  await wait(150);
  SC.cards.forEach((k, i) => { if (i !== SC.picked) { play('card.discard', {vol:.5}); k.el.style.transition = 'transform .7s cubic-bezier(.5,0,.8,.6),opacity .7s'; k.el.style.transform = `translate(${parseFloat(k.el.style.getPropertyValue('--x'))}px,760px) rotate(${rnd(-50, 50)}deg)`; k.el.style.opacity = 0; } });
  await wait(1100); setScreen('main');
});

/* brush reveal: each card hides under its node's cover; drag to clear it */
function paintCover(cv, nd) {
  const x = cv.getContext('2d'), W = cv.width, Hh = cv.height, s = W / 158, r = rng(Math.floor(Math.random() * 1e6)), R = (a, b) => a + r() * (b - a), P = a => a[Math.floor(r() * a.length)];
  const shadow = (blur, oy, a = .35) => { x.shadowColor = `rgba(0,0,0,${a})`; x.shadowBlur = blur * s; x.shadowOffsetY = oy * s; x.shadowOffsetX = oy * .4 * s; };
  const noShadow = () => { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetX = x.shadowOffsetY = 0; };
  const grad = (y0, y1, c0, c1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
  if (nd === 'forest' || nd === 'any') {
    x.fillStyle = grad(0, Hh, '#3e3020', '#2c2216'); x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 40; i++) { x.strokeStyle = P(['#5a4428', '#6b5232']); x.lineWidth = R(1, 2.2) * s; x.beginPath(); const px = R(0, W), py = R(0, Hh); x.moveTo(px, py); x.lineTo(px + R(-30, 30) * s, py + R(-12, 12) * s); x.stroke(); }
    const cols = [['#7d9b3e', '#a9c05a'], ['#5f7f34', '#8aa64a'], ['#c98d2c', '#ecc25a'], ['#c4622a', '#e8904a'], ['#a8402a', '#d2684a'], ['#8c5c2a', '#b98448'], ['#b9a23a', '#e0cd68']];
    for (let i = 0; i < 95; i++) {
      const [c0, c1] = P(cols), l = R(16, 30) * s, w = l * R(.36, .5), maple = r() < .3;
      x.save(); x.translate(R(-14, W + 14), R(-14, Hh + 14)); x.rotate(R(0, 6.3)); shadow(5, 2.5);
      const g = x.createLinearGradient(-l, -w, l, w); g.addColorStop(0, c0); g.addColorStop(.55, c1); g.addColorStop(1, c0); x.fillStyle = g;
      x.beginPath();
      if (maple) { for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rr = (k % 2 ? .45 : 1) * l * .75; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); }
      else { x.moveTo(-l, 0); x.bezierCurveTo(-l * .4, -w * 1.25, l * .5, -w * 1.1, l, 0); x.bezierCurveTo(l * .5, w * 1.1, -l * .4, w * 1.25, -l, 0); }
      x.fill(); noShadow();
      x.strokeStyle = 'rgba(60,35,10,.45)'; x.lineWidth = 1.1 * s; x.beginPath();
      if (maple) { for (let k = 0; k < 10; k += 2) { const a = k / 10 * Math.PI * 2; x.moveTo(0, 0); x.lineTo(Math.cos(a) * l * .65, Math.sin(a) * l * .65); } }
      else { x.moveTo(-l * 1.15, 0); x.lineTo(l * .9, 0); for (let k = -2; k <= 2; k++) { if (!k) continue; const vx = k * l * .3; x.moveTo(vx, 0); x.lineTo(vx + l * .22, (k % 2 ? 1 : -1) * w * .6); x.moveTo(vx, 0); x.lineTo(vx + l * .22, (k % 2 ? -1 : 1) * w * .6); } }
      x.stroke(); x.restore();
    }
    for (let i = 0; i < 7; i++) { x.save(); x.translate(R(0, W), R(0, Hh)); x.rotate(R(0, 6.3)); shadow(3, 2); x.strokeStyle = '#5a3a1c'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(-30 * s, 0); x.lineTo(30 * s, 2 * s); x.moveTo(5 * s, 1 * s); x.lineTo(18 * s, -10 * s); x.stroke(); x.restore(); }
    noShadow();
  } else if (nd === 'river') {
    x.fillStyle = grad(0, Hh, '#4f9bc0', '#25587a'); x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(220,245,255,${R(.1, .32).toFixed(2)})`; x.lineWidth = R(1.2, 3) * s; x.beginPath(); const cx = R(0, W), cy = R(0, Hh), rr = R(10, 26) * s; x.ellipse(cx, cy, rr, rr * R(.4, .7), R(-.3, .3), R(0, 3), R(3.5, 6.3)); x.stroke(); }
    for (let i = 0; i < 46; i++) {
      const cx = R(-8, W + 8), cy = R(-8, Hh + 8), rx = R(9, 22) * s, ry = rx * R(.6, .85), rot = R(0, 3.14);
      const base = P(['#8c8f8e', '#a7a49a', '#6e7476', '#b8ad96', '#8a7f6e', '#c4c0b6']);
      x.save(); x.translate(cx, cy); x.rotate(rot); shadow(6, 3, .45);
      const g = x.createRadialGradient(-rx * .35, -ry * .4, 1, 0, 0, rx * 1.1); g.addColorStop(0, '#ffffff'); g.addColorStop(.18, base); g.addColorStop(1, '#3d4446');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill(); noShadow();
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(-rx * .35, -ry * .45, rx * .22, ry * .12, -.3, 0, 7); x.fill(); x.restore();
    }
    for (let i = 0; i < 20; i++) { x.strokeStyle = 'rgba(235,250,255,.55)'; x.lineWidth = 1.2 * s; x.beginPath(); x.arc(R(0, W), R(0, Hh), R(2, 5) * s, 0, 7); x.stroke(); }
  } else if (nd === 'wildlife') {
    x.fillStyle = grad(0, Hh, '#8a6a3a', '#5e4524'); x.fillRect(0, 0, W, Hh);
    const blade = (bx, by, h, lean, w, c0, c1) => { const g = x.createLinearGradient(bx, by, bx + lean, by - h); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g;
      x.beginPath(); x.moveTo(bx - w, by); x.quadraticCurveTo(bx - w * .2 + lean * .3, by - h * .55, bx + lean, by - h); x.quadraticCurveTo(bx + w * .4 + lean * .3, by - h * .5, bx + w, by); x.closePath(); x.fill(); };
    const pal = [['#5c5a26', '#c9b35a'], ['#4e6a2c', '#a8c060'], ['#6d5a2a', '#e2cb7a'], ['#3f5a2a', '#88a858'], ['#7a5f2c', '#d8b860']];
    for (let row = 0; row < 7; row++) { const by = Hh * (.25 + row * .15) + 10 * s;
      for (let i = 0; i < 46; i++) { const [c0, c1] = P(pal); shadow(2, 1, .25); blade(R(-6, W + 6), by + R(-8, 8) * s, R(50, 110) * s, R(-26, 26) * s, R(2.2, 4.2) * s, c0, c1); } }
    noShadow();
    for (let i = 0; i < 16; i++) { const hx = R(0, W), hy = R(0, Hh * .7); x.fillStyle = '#e8d08a'; for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(hx + Math.sin(k) * 2 * s, hy + k * 4 * s, 2.6 * s, 4 * s, .3 * (k % 2 ? 1 : -1), 0, 7); x.fill(); } }
    for (let i = 0; i < 10; i++) { x.fillStyle = P(['#f4efe2', '#f2d26a', '#c9a3d8']); const fx = R(0, W), fy = R(Hh * .3, Hh); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(fx + Math.cos(k * 1.26) * 3 * s, fy + Math.sin(k * 1.26) * 3 * s, 2.2 * s, 0, 7); x.fill(); } x.fillStyle = '#d99a2a'; x.beginPath(); x.arc(fx, fy, 1.6 * s, 0, 7); x.fill(); }
  } else {
    x.fillStyle = '#4b4a46'; x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 260; i++) { x.fillStyle = P(['#5b5a55', '#6c6a64', '#3e3d3a', '#7c7a73']); x.beginPath(); x.arc(R(0, W), R(0, Hh), R(1, 3.5) * s, 0, 7); x.fill(); }
    const slab = (cx, cy, w, h, rot) => {
      const pts = []; const cut = () => R(.04, .16);
      const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
      corners.forEach(([px, py], k) => { const nx = corners[(k + 1) % 4], pv = corners[(k + 3) % 4];
        pts.push([px + (pv[0] - px) * cut(), py + (pv[1] - py) * cut()]); pts.push([px + (nx[0] - px) * cut(), py + (nx[1] - py) * cut()]);
        const mx = (px + nx[0]) / 2, my = (py + nx[1]) / 2; pts.push([mx + R(-6, 6) * s, my + R(-4, 4) * s]); });
      x.save(); x.translate(cx, cy); x.rotate(rot); shadow(8, 4, .5);
      const path = () => { x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); };
      path(); x.fillStyle = '#8f8f8c'; x.fill(); noShadow();
      x.save(); path(); x.clip();
      for (let k = 0; k < pts.length; k++) { const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length]; const v = Math.floor(R(128, 168));
        x.fillStyle = `rgb(${v},${v},${v - 3})`; x.beginPath(); x.moveTo(R(-w * .12, w * .12), R(-h * .12, h * .12)); x.lineTo(ax, ay); x.lineTo(bx, by); x.closePath(); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(-w / 2, -h / 2, w, h * .4);
      x.restore();
      path(); x.lineJoin = 'round'; x.strokeStyle = '#3f3f3c'; x.lineWidth = 4 * s; x.stroke();
      x.save(); x.scale(.9, .9); path(); x.strokeStyle = 'rgba(236,236,230,.85)'; x.lineWidth = 3.2 * s; x.stroke(); x.restore();
      x.restore();
    };
    const cells = [[.27, .27], [.75, .25], [.25, .75], [.74, .76], [.5, .5]];
    cells.forEach(([u, v], k) => slab(W * u + R(-6, 6) * s, Hh * v + R(-6, 6) * s, (k === 4 ? 62 : R(70, 84)) * s, (k === 4 ? 56 : R(66, 80)) * s, R(-.25, .25)));
    for (let i = 0; i < 26; i++) { const cx = R(0, W), cy = R(0, Hh), rr = R(3, 7) * s; shadow(3, 2, .45); x.fillStyle = P(['#9a9a96', '#b4b3ae', '#7d7c78']); x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + R(-.3, .3); x.lineTo(cx + Math.cos(a) * rr * R(.7, 1.2), cy + Math.sin(a) * rr * R(.7, 1.2)); } x.fill(); noShadow(); }
  }
}
/* little bits fly off the card while you brush */
function brushBits(px, py, nd) {
  const kinds = {forest:[['#c98d2c', '50% 0'], ['#7d9b3e', '50% 0'], ['#c4622a', '50% 0']], any:[['#c98d2c', '50% 0'], ['#7d9b3e', '50% 0']], river:[['#bfe6f7', '50%'], ['#ffffff', '50%'], ['#9a9a96', '40%']], wildlife:[['#c9b35a', '2px'], ['#a8c060', '2px'], ['#e8d08a', '50%']], mountain:[['#a3a39e', '2px'], ['#7d7c78', '1px'], ['#cfcfca', '2px']]}[nd];
  for (let i = 0; i < 3; i++) {
    const [c, br] = pick(kinds), el = document.createElement('div'); el.className = 'spark';
    const w = nd === 'wildlife' ? 3 : rnd(5, 9), h = nd === 'wildlife' ? rnd(9, 14) : rnd(4, 7);
    el.style.cssText = `left:${px}px;top:${py}px;width:${w}px;height:${h}px;background:${c};border-radius:${br}`;
    stage.appendChild(el);
    const a = rnd(-Math.PI, 0), d = rnd(18, 46);
    el.animate([{transform:'translate(-50%,-50%) rotate(0)', opacity:1}, {transform:`translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 40}px) rotate(${rnd(-300, 300)}deg)`, opacity:0}], {duration:rnd(450, 750), easing:'cubic-bezier(.2,.7,.5,1)'}).onfinish = () => el.remove();
  }
}
function addCover(c) {
  c.el.classList.add('flip', 'cov'); c.el.querySelector('.in').style.transition = 'none';
  const cv = document.createElement('canvas'); cv.className = 'cover'; cv.width = cv.height = 316;
  paintCover(cv, c.node); c.el.querySelector('.face.front').appendChild(cv); c.cv = cv; c.strokes = 0;
  let down = false, last = null, lastSnd = 0;
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  const erase = (p) => {
    const x = cv.getContext('2d'); x.globalCompositeOperation = 'destination-out'; x.lineCap = 'round'; x.lineWidth = 64;
    x.beginPath(); x.moveTo(...(last || p)); x.lineTo(...p); x.stroke(); last = p;
    const now = performance.now(); if (now - lastSnd > 130) { lastSnd = now; play('scav.brush.' + (c.node === 'any' ? 'forest' : c.node), {vol:.7}); const cr = cv.getBoundingClientRect(), st = stage.getBoundingClientRect(); brushBits((cr.left - st.left + p[0] / cv.width * cr.width) / S, (cr.top - st.top + p[1] / cv.height * cr.height) / S, c.node); }
    if (++c.strokes % 5 === 0) check(c);
  };
  cv.addEventListener('pointerdown', e => { if (SC.busy) return; down = true; last = null; cv.setPointerCapture(e.pointerId); erase(at(e)); e.stopPropagation(); });
  cv.addEventListener('pointermove', e => { if (down) erase(at(e)); });
  cv.addEventListener('pointerup', () => { down = false; last = null; check(c); });
  cv.addEventListener('click', e => e.stopPropagation());
}
function check(c) {
  if (c.shown || !c.cv) return;
  const d = c.cv.getContext('2d').getImageData(0, 0, c.cv.width, c.cv.height).data; let clear = 0;
  for (let i = 3; i < d.length; i += 64) if (d[i] < 40) clear++;
  if (clear / (d.length / 64) > .5) uncover(c);
}
function uncover(c) {
  if (c.shown) return;
  c.cv.classList.add('gone'); play('scav.uncover');
  const r = sp(c.el.querySelector('.in'));
  const cols = {forest:['#6b8f3e', '#c46a2c', '#d9a441'], any:['#6b8f3e', '#c46a2c'], river:['#bfe3f5', '#8fb4d6', '#ffffff'], wildlife:['#c8a85a', '#d9c07a', '#8d7a3e'], mountain:['#a3a098', '#5f5d58', '#c2bdb1']}[c.node];
  sparks(r.x + r.w / 2, r.y + r.h / 2, cols, 22, 120, 160);
  revealFx(c);
}
async function autoBrush(c) {
  const x = c.cv.getContext('2d'); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 70; x.lineCap = 'round';
  for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(20, 30 + k * 52); x.lineTo(296, 50 + k * 52); x.stroke(); if (k % 2 === 0) play('scav.brush.' + (c.node === 'any' ? 'forest' : c.node), {vol:.6}); await wait(40); }
  uncover(c);
}

/* ───────────────────────── craft ───────────────────────── */

/* the workbench: planks with grain, knots, nails, wear, shavings and a ruler on the front lip */
function benchSVG(W, Hh) {
  const r = rng(42), R = (a, b) => a + r() * (b - a);
  const tones = ['#b17a42', '#a46f39', '#b8834c', '#9d6834'];
  const lip = 26, ph = (Hh - lip) / 4;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><defs>`;
  tones.forEach((c, i) => s += `<linearGradient id="p${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="1"/><stop offset=".45" stop-color="#c99459" stop-opacity=".55"/><stop offset="1" stop-color="${c}"/></linearGradient>`);
  s += `<radialGradient id="burn"><stop offset="0" stop-color="#2a1608" stop-opacity=".55"/><stop offset="1" stop-color="#2a1608" stop-opacity="0"/></radialGradient></defs>`;
  for (let i = 0; i < 4; i++) {
    const y0 = i * ph, c = tones[i];
    s += `<rect x="0" y="${y0}" width="${W}" height="${ph}" fill="${c}"/><rect x="0" y="${y0}" width="${W}" height="${ph}" fill="url(#p${i})"/>`;
    for (let k = 0; k < 16; k++) {
      let y = y0 + R(3, ph - 3), d = `M-10 ${y.toFixed(1)}`; const amp = R(.6, 2.4), f = R(.004, .012), ph0 = R(0, 6);
      for (let x = 0; x <= W + 20; x += 24) d += ` L${x} ${(y + Math.sin(x * f + ph0) * amp + Math.sin(x * f * 3.1) * amp * .4).toFixed(1)}`;
      s += `<path d="${d}" fill="none" stroke="#5a3417" stroke-opacity="${R(.12, .32).toFixed(2)}" stroke-width="${R(.7, 2).toFixed(1)}"/>`;
    }
    const knots = r() > .35 ? 1 + (r() > .7 ? 1 : 0) : 0;
    for (let k = 0; k < knots; k++) { const kx = R(120, W - 260), ky = y0 + ph * R(.35, .65);
      for (let q = 5; q > 0; q--) s += `<ellipse cx="${kx}" cy="${ky}" rx="${q * 5.5}" ry="${q * 1.9}" fill="${q === 1 ? '#4a2810' : 'none'}" stroke="#5a3417" stroke-opacity="${.18 + .08 * (5 - q)}" stroke-width="1.3"/>`; }
    if (i > 0) s += `<rect x="0" y="${y0 - 1.5}" width="${W}" height="3" fill="#3b220f" opacity=".75"/><rect x="0" y="${y0 + 1.5}" width="${W}" height="1" fill="#f3c98f" opacity=".3"/>`;
    const butt = i % 2 ? R(380, 640) : R(900, 1000);
    s += `<rect x="${butt}" y="${y0}" width="2.5" height="${ph}" fill="#3b220f" opacity=".7"/>`;
    for (const nx of [16, W - 16, butt - 12, butt + 14]) s += `<circle cx="${nx}" cy="${y0 + ph / 2}" r="3.4" fill="#57524b"/><circle cx="${nx - 1}" cy="${y0 + ph / 2 - 1}" r="1.3" fill="#d8d2c6"/>`;
  }
  for (let k = 0; k < 40; k++) { const x = R(20, W - 20), y = R(6, Hh - lip - 6), l = R(8, 30), a = R(-.4, .4);
    s += `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(a) * l).toFixed(1)}" y2="${(y + Math.sin(a) * l).toFixed(1)}" stroke="#f6d6a8" stroke-opacity="${R(.12, .3).toFixed(2)}" stroke-width="1"/>`; }
  for (let k = 0; k < 14; k++) s += `<ellipse cx="${R(20, W - 20)}" cy="${R(8, Hh - lip - 8)}" rx="${R(2, 6)}" ry="${R(1, 2.5)}" fill="#3a1d08" opacity=".18"/>`;
  s += `<circle cx="${W - 300}" cy="${44}" r="26" fill="none" stroke="#5a2e12" stroke-opacity=".22" stroke-width="5" stroke-dasharray="120 30 18 20"/>`;
  s += `<ellipse cx="${W - 405}" cy="${Hh - lip - 30}" rx="30" ry="18" fill="url(#burn)"/>`;
  for (let k = 0; k < 6; k++) { const x = R(560, 700), y = R(Hh - lip - 50, Hh - lip - 14);
    s += `<path d="M${x} ${y} q6 -8 12 0 q4 6 -2 9 q-6 2 -6 -4" fill="none" stroke="#f0c98e" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`; }
  for (let k = 0; k < 70; k++) s += `<circle cx="${R(0, W)}" cy="${R(0, Hh - lip)}" r="${R(.5, 1.4)}" fill="#f8deb4" opacity="${R(.2, .5).toFixed(2)}"/>`;
  s += `<rect x="0" y="${Hh - lip}" width="${W}" height="${lip}" fill="#7a4a22"/><rect x="0" y="${Hh - lip}" width="${W}" height="2" fill="#2e1909" opacity=".8"/><rect x="0" y="${Hh - lip + 2}" width="${W}" height="2" fill="#e8b878" opacity=".35"/>`;
  for (let k = 0; k < 6; k++) { const y = Hh - lip + 6 + k * 3.4; s += `<path d="M0 ${y} Q${W / 2} ${y + R(-1.5, 1.5)} ${W} ${y}" stroke="#3d220e" stroke-opacity=".25" fill="none"/>`; }
  const rx = 22, rw = 640; s += `<rect x="${rx}" y="${Hh - lip + 6}" width="${rw}" height="14" rx="2" fill="#c9ccc8"/><rect x="${rx}" y="${Hh - lip + 6}" width="${rw}" height="3" fill="#eef0ec"/>`;
  for (let k = 0; k <= 64; k++) { const x = rx + 4 + k * 9.9, big = k % 8 === 0; s += `<rect x="${x.toFixed(1)}" y="${Hh - lip + 6}" width="1.2" height="${big ? 9 : k % 4 === 0 ? 6 : 4}" fill="#3d3f3c"/>`; }
  return s + '</svg>';
}
let CR = null, bookTab = 'tool';
function craftState() { return {bench:[], target:null, busy:false}; }
function openCraft() {
  const h = hk('wyatt');
  $('#who2').innerHTML = `<span class="mini" style="--c:${h.c}">${por(h, 30, 1.9)}</span><b class="px" style="font-weight:400">WYATT</b> · crafts with everyone’s resources here`;
  CR = craftState(); $('#deal').classList.remove('on');
  const bn = $('#bench'); if (!bn.dataset.bg) { bn.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(benchSVG(1140, 200))}")`; bn.dataset.bg = 1; }
  $('#tabC').setAttribute('aria-pressed', 'true'); $('#tabT').setAttribute('aria-pressed', 'false'); $('#cmain').style.display = ''; $('#teach').style.display = 'none';
  renderBench(); renderTray(); renderBook();
}
const reserved = () => { const r = {}; CR.bench.forEach(s => { if (s.r && !s.ghost) r[s.r] = (r[s.r] || 0) + 1; }); return r; };
function left() { const a = avail(), rv = reserved(); ALLRES.forEach(r => a[r] -= rv[r] || 0); return a; }
function renderTray() {
  const l = left();
  const chip = (r, own) => `<button class="rch ${l[r] ? '' : 'zero'}" data-r="${r}" title="${cap(r)}"><img src="${resImg(r)}" alt="${r}"><b>${l[r]}</b>${own ? `<span class="own" style="--c:${hk(own).c}"></span>` : ''}<span class="st ${favS.has(r) ? 'on' : ''}" data-star="${r}" role="button" aria-label="Star ${r}">${ic('star', 2.4)}</span></button>`;
  $('#tray').innerHTML = `<div class="grp"><span class="lbl">WYATT’S PACK</span><div class="row">${Object.keys(PACK).filter(r => PACK[r] > 0).map(r => chip(r)).join('')}</div></div>
    <div class="grp"><span class="lbl">ON THIS TILE · POOLED</span><div class="row">${Object.keys(POOL).map(r => chip(r, POOL[r][0])).join('')}</div></div>
    <div class="grp" style="margin-left:auto;max-width:230px"><span class="lbl">TIP</span><span class="hint" style="font-size:12.5px">Click a recipe to fill the bench, or click resources to fill it yourself. ★ marks what to save and look for.</span></div>`;
}
function renderBench(anim) {
  const B = $('#bslots'); const n = Math.max(CR.bench.length, CR.size || 6);
  B.innerHTML = [...Array(n)].map((_, i) => { const s = CR.bench[i];
    if (!s) return `<div class="bs" data-i="${i}"></div>`;
    if (s.ghost) return `<div class="bs ghost" data-i="${i}" title="Missing: ${s.r ? cap(s.r) : 'any resource'}">${s.r ? `<img src="${resImg(s.r)}" alt="">` : '<span class="q">?</span>'}</div>`;
    return `<div class="bs" data-i="${i}" title="${cap(s.r)} (click to take it back)"><img src="${resImg(s.r)}" alt=""></div>`;
  }).join('');
  evalBench();
}
/* does the bench, as filled, make a recipe? */
function benchMatch() {
  if (CR.bench.some(s => s.ghost) || !CR.bench.length) return null;
  const cnt = {}; CR.bench.forEach(s => cnt[s.r] = (cnt[s.r] || 0) + 1); const tot = CR.bench.length;
  const okBP = rec => { let need = 0; for (const [r, n] of Object.entries(rec.cost)) { if ((cnt[r] || 0) < n) return false; need += n; } return tot - need === rec.any; };
  const okB = rec => { if (rec.tier > 1) return false; if (!rec.keyRes) return tot === rec.b && Object.keys(cnt).length === tot;
    return rec.keyRes.some(k => { if ((cnt[k] || 0) < rec.k) return false; const rest = {...cnt}; rest[k] -= rec.k; const grp = rec.nodes ? rec.nodes.flatMap(n => NODE_RES[n]) : ALLRES; let m = 0; for (const [r, n] of Object.entries(rest)) { if (!n) continue; if (!grp.includes(r)) return false; m += n; } return m === rec.b; }); };
  if (CR.target && (CR.target.kind === 'bp' ? okBP(CR.target) : okB(CR.target))) return CR.target;
  return BP.find(okBP) || RECIPES.filter(r => r.kind === 'basic').find(okB) || null;
}
function evalBench() {
  const m = benchMatch(), go = $('#cgo'), ghosts = CR.bench.filter(s => s.ghost), bi = $('#binfo'), res = $('#res2');
  go.disabled = !m || CR.busy; go.classList.toggle('ready', !!m && !CR.busy);
  go.textContent = m ? 'CRAFT' : ghosts.length ? `MISSING ${ghosts.length}` : 'CRAFT';
  if (m) { bi.innerHTML = m.kind === 'bp' ? `<b>${m.n.toUpperCase()}</b> · blueprint · you get exactly this` : `<b>${m.n.toUpperCase()}</b> · basic recipe · flip 3 of 9, keep 1`;
    res.innerHTML = m.kind === 'bp' ? `<img src="img/item/${m.id}.webp" alt="" style="width:84px;opacity:.5;filter:grayscale(.3)">` : `<div class="iback" style="--tc:${TYPE_C[m.t]};--rays:url(img/type/rays-${m.t}.webp);transform:scale(.85)" data-t="${m.t.toUpperCase()}"><img src="img/type/${m.t}.webp" alt=""></div>`; }
  else if (ghosts.length) { const need = {}; ghosts.forEach(g => need[g.r || 'any'] = (need[g.r || 'any'] || 0) + 1);
    bi.innerHTML = `<b>${CR.target.n.toUpperCase()}</b> · missing ${Object.entries(need).map(([r, n]) => n + ' ' + (r === 'any' ? 'more of anything' : cap(r))).join(', ')}`; res.innerHTML = '<span class="q">?</span>'; }
  else { bi.innerHTML = CR.bench.length ? 'No recipe matches yet. Keep adding, or pick a recipe below.' : 'Pick a recipe in the book, or click resources to fill the bench yourself.'; res.innerHTML = '<span class="q">?</span>'; }
}
function benchAdd(r) {
  if (CR.busy) return; const l = left(); if (!l[r]) { play('ui.error'); return; }
  let i = CR.bench.findIndex(s => s.ghost && (s.r === r || (!s.r && (!s.grp || s.grp.includes(r)))));
  if (i < 0) { if (CR.bench.length >= 10) { play('ui.error'); return; } CR.target = CR.bench.some(s => s.ghost) ? CR.target : null; i = CR.bench.length; CR.bench.push({}); }
  const chip = $(`.rch[data-r=${r}]`); const from = sp(chip);
  CR.bench[i] = {r};
  renderBench(); renderTray();
  const slot = $(`.bs[data-i="${i}"]`), im = slot.querySelector('img'); im.style.visibility = 'hidden';
  flyTo(resImg(r), from, sp(slot), 240).then(() => { im.style.visibility = ''; slot.classList.add('land'); play('craft.slot', {rate:1 + i * .05}); if (benchMatch()) setTimeout(() => play('craft.ready'), 150); });
}
$('#tray').addEventListener('click', e => {
  const st = e.target.closest('[data-star]');
  if (st) { e.stopPropagation(); const r = st.dataset.star; favS.has(r) ? favS.delete(r) : favS.add(r); play(favS.has(r) ? 'ui.star' : 'ui.unstar'); renderTray(); renderBook(); return; }
  const c = e.target.closest('.rch'); if (c) benchAdd(c.dataset.r);
});
$('#bslots').addEventListener('click', e => {
  const s = e.target.closest('.bs'); if (!s || CR.busy) return; const i = +s.dataset.i; const v = CR.bench[i]; if (!v || v.ghost) return;
  if (CR.target) CR.bench[i] = {ghost:true, r:v.r}; else CR.bench.splice(i, 1);
  play('ui.click'); renderBench(); renderTray();
});
$('#cclear').addEventListener('click', () => { if (CR.busy) return; CR.bench = []; CR.target = null; CR.size = 0; play('craft.clear'); renderBench(); renderTray(); });
function flyTo(src, from, to, dur) {
  const f = document.createElement('img'); f.src = src; f.className = 'fly'; f.style.cssText = `left:${from.x + from.w / 2 - 20}px;top:${from.y + from.h / 2 - 20}px;width:40px;height:40px`;
  stage.appendChild(f);
  const dx = to.x + to.w / 2 - from.x - from.w / 2, dy = to.y + to.h / 2 - from.y - from.h / 2;
  f.animate([{transform:'translate(0,0) scale(1)'}, {transform:`translate(${dx * .5}px,${dy * .5 - 60}px) scale(1.25)`, offset:.5}, {transform:`translate(${dx}px,${dy}px) scale(1.05)`}], {duration:dur, easing:'cubic-bezier(.4,0,.6,1)', fill:'forwards'});
  return wait(dur).then(() => f.remove());
}
/* auto-fill: spend spare resources first, save starred ones */
function planFill(rec) {
  const l = avail(); const out = [];
  const take = (r) => { if (l[r] > 0) { l[r]--; out.push({r}); } else out.push({r, ghost:true}); };
  const score = r => (favS.has(r) ? 100 : 0) + ([...favR].some(k => k !== rec.key && RBY[k].kind === 'bp' && RBY[k].cost[r]) ? 10 : 0) - l[r];
  const spare = (grp) => { const c = grp.filter(r => l[r] > 0).sort((a, b) => score(a) - score(b))[0]; if (c) { l[c]--; out.push({r:c}); } else out.push({ghost:true, grp}); };
  if (rec.kind === 'bp') { for (const [r, n] of Object.entries(rec.cost)) for (let i = 0; i < n; i++) take(r); for (let i = 0; i < rec.any; i++) spare(ALLRES); }
  else if (rec.keyRes) { const k = [...rec.keyRes].sort((a, b) => (l[b] - l[a]) || (score(a) - score(b)))[0]; for (let i = 0; i < rec.k; i++) take(k); const grp = rec.nodes ? rec.nodes.flatMap(n => NODE_RES[n]) : ALLRES; for (let i = 0; i < rec.b; i++) spare(grp); }
  else { const c = ALLRES.filter(r => l[r] > 0).sort(() => Math.random() - .5).slice(0, 5); c.forEach(take); while (out.length < 5) out.push({ghost:true}); }
  return out;
}
async function autoFill(rec) {
  if (CR.busy || rec.tier > 1) return; CR.busy = true;
  if (CR.bench.length) { play('craft.clear'); CR.bench = []; renderBench(); renderTray(); await wait(160); }
  CR.target = rec; const plan = planFill(rec);
  CR.bench = []; CR.size = plan.length; renderBench();
  const land = (i, s) => { CR.bench[i] = s; renderBench(); renderTray(); const el = $(`.bs[data-i="${i}"]`); el && el.classList.add('land'); s.ghost ? play('craft.ghost') : play('craft.slot', {rate:1 + i * .05}); };
  let last = Promise.resolve();
  for (let i = 0; i < plan.length; i++) {
    const s = plan[i];
    if (s.ghost) last = wait(240).then(() => land(i, s));
    else {
      const chip = $(`.rch[data-r=${s.r}]`); const from = chip ? sp(chip) : {x:600, y:330, w:40, h:40};
      const slotEl = $(`.bs[data-i="${i}"]`) || $('#bslots');
      last = flyTo(resImg(s.r), from, sp(slotEl), 240).then(() => land(i, s));
    }
    await wait(105);
  }
  await last; await wait(60);
  CR.busy = false; evalBench();
  if (benchMatch()) setTimeout(() => play('craft.ready'), 120); else play('ui.error', {vol:.5});
}
function rowHTML(rec, av) {
  const lock = rec.tier > 1;
  const miss = rec.kind === 'bp' ? missingOf(rec, av).reduce((s, m) => s + m[1], 0) : basicMiss(rec, av);
  const ico = rec.kind === 'bp' ? `<span class="ico"><img src="img/item/${rec.id}.webp" alt=""></span>` : `<span class="ico ty" style="--tc:${TYPE_C[rec.t]}"><img src="img/type/${rec.t}.webp" alt=""></span>`;
  const sub = rec.kind === 'bp' ? `Tier ${'I'.repeat(rec.tier)} · ${ITEMS[rec.id].fx}` : rec.keyRes ? `${rec.k} ${rec.keyRes.map(cap).join(' or ')} + ${rec.b} ${rec.nodes ? rec.nodes.map(cap).join('/') : 'any'}` : '5 different resources, picked each time';
  return `<div class="rr ${lock ? 'lock' : ''}" data-k="${rec.key}"><button class="sb ${favR.has(rec.key) ? 'on' : ''}" data-fav="${rec.key}" aria-label="Star ${rec.n}">${ic('star', 2)}</button>${ico}
    <div><div class="nm">${rec.kind === 'bp' ? rec.n : rec.n.toUpperCase()}<small>${lock ? 'Unlocks at crafter Tier ' + 'I'.repeat(rec.tier) : sub}</small></div><div class="toks">${tokens(rec, av)}</div></div>
    <span class="stt ${lock ? '' : miss ? 'no' : 'ok'}">${lock ? 'LOCKED' : miss ? 'NEEDS ' + miss : '✓ READY'}</span></div>`;
}
function basicMiss(rec, av) {
  if (!rec.keyRes) return Object.values(av).filter(n => n > 0).length >= 5 ? 0 : 5 - Object.values(av).filter(n => n > 0).length;
  const best = rec.keyRes.reduce((b, r) => (av[r] || 0) > (av[b] || 0) ? r : b, rec.keyRes[0]);
  const km = Math.max(0, rec.k - (av[best] || 0));
  const grp = rec.nodes ? rec.nodes.flatMap(n => NODE_RES[n]) : ALLRES;
  const have = grp.reduce((s, r) => s + (av[r] || 0), 0) - (grp.includes(best) ? Math.min(rec.k, av[best] || 0) : 0);
  return km + Math.max(0, rec.b - have);
}
function bookHTML(ro) {
  const av = avail(); const tabs = [['fav', 'Starred', '#C98D16'], ...Object.keys(BASIC).map(t => [t, cap(t === 'clothes' ? t : t + 's'), TYPE_C[t]])];
  let L, R;
  if (bookTab === 'fav') {
    const favs = [...favR].map(k => RBY[k]).sort((a, b) => (missingOf(a, av).length ? 1 : 0) - (missingOf(b, av).length ? 1 : 0));
    L = `<h5>STARRED RECIPES <span>ready first</span></h5>` + (favs.length ? favs.map(r => rowHTML(r, av)).join('') : '<div class="empty">Star a recipe with ☆ to keep it here and on the scavenge screen.</div>');
    R = `<h5>STARRED RESOURCES <span>where to find them</span></h5>` + ([...favS].map(r => `<div class="rr" style="cursor:default"><button class="sb on" data-sfav="${r}" aria-label="Unstar ${r}">${ic('star', 2)}</button><span class="ico"><img src="${resImg(r)}" alt=""></span><div><div class="nm">${cap(r)}<small>${cap(NODE_OF[r])} nodes · ${CAT[r]} · you have ${av[r]}</small></div></div><img src="img/scav/node-${NODE_OF[r]}.webp" alt="" style="width:26px"></div>`).join('') || '<div class="empty">Star resources in the tray to save them from auto-fill and spot them while scavenging.</div>');
  } else {
    L = `<h5>BASIC RECIPES <span>flip 3 of 9, keep 1</span></h5>` + [1, 2, 3].map(t => rowHTML(RBY[`k:${bookTab}${t}`], av)).join('');
    const bps = BP.filter(b => b.t === bookTab);
    R = `<h5>BLUEPRINTS <span>you get exactly this</span></h5>` + (bps.length ? bps.map(r => rowHTML(r, av)).join('') : `<div class="empty">No ${bookTab} blueprints yet. Find them while scavenging, or have someone teach you.</div>`) + `<div class="empty">More ${bookTab} blueprints turn up while scavenging.</div>`;
  }
  return `<div class="btabs">${tabs.map(([k, n, c]) => `<button class="bt" data-tab="${k}" style="--tc:${c}" aria-pressed="${bookTab === k}">${k === 'fav' ? ic('star', 2.5) : `<img src="img/type/${k}.webp" alt="">`}${n.toUpperCase()}</button>`).join('')}</div>
    ${ro ? '' : `<div class="tiers">${['I', 'II', 'III'].map((t, i) => `<span class="${i ? 'lock' : ''}">TIER ${t}</span>`).join('')}</div>`}
    <div class="pages"><div class="page">${L}</div><div class="page">${R}</div></div>${ro ? '<span class="ro">Read only while scavenging</span>' : ''}`;
}
function renderBook() { $('#book').innerHTML = bookHTML(false); }
function bookClick(e, ro) {
  const t = e.target.closest('.bt'); if (t) { bookTab = t.dataset.tab; play('book.page'); ro ? ($('#bookov .book').innerHTML = bookHTML(true)) : renderBook(); return; }
  const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); const k = f.dataset.fav; favR.has(k) ? favR.delete(k) : favR.add(k); play(favR.has(k) ? 'ui.star' : 'ui.unstar'); ro ? ($('#bookov .book').innerHTML = bookHTML(true)) : renderBook(); if (SC) { renderLook(); } return; }
  const sf = e.target.closest('[data-sfav]'); if (sf) { favS.delete(sf.dataset.sfav); play('ui.unstar'); ro ? ($('#bookov .book').innerHTML = bookHTML(true)) : (renderBook(), renderTray()); return; }
  const r = e.target.closest('.rr[data-k]'); if (!r) return;
  const rec = RBY[r.dataset.k]; if (rec.tier > 1) { play('ui.error'); return; }
  if (ro) { play('ui.error'); toast('The book is read-only while scavenging'); return; }
  r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 600);
  autoFill(rec);
}
$('#book').addEventListener('click', e => bookClick(e, false));
$('#tabC').addEventListener('click', () => { play('ui.tab'); $('#tabC').setAttribute('aria-pressed', 'true'); $('#tabT').setAttribute('aria-pressed', 'false'); $('#cmain').style.display = ''; $('#teach').style.display = 'none'; });
$('#tabT').addEventListener('click', () => { play('ui.tab'); $('#tabT').setAttribute('aria-pressed', 'true'); $('#tabC').setAttribute('aria-pressed', 'false'); $('#cmain').style.display = 'none'; $('#teach').style.display = 'grid'; });
$('#cx').addEventListener('click', () => { if (!CR.busy) setScreen('main'); });

function consume() {
  CR.bench.forEach(s => { if (PACK[s.r] > 0) PACK[s.r]--; else if (POOL[s.r] && POOL[s.r][1] > 0) POOL[s.r][1]--; });
  for (const r of Object.keys(PACK)) if (!PACK[r]) delete PACK[r];
}
$('#cgo').addEventListener('click', async () => {
  const m = benchMatch(); if (!m || CR.busy) return; CR.busy = true; evalBench();
  const bench = $('#bench'), bs = sp($('#bslots')), cx = bs.x + Math.min(bs.w, CR.bench.length * 69) / 2, cy = bs.y + 30;
  play('act.craft.' + m.t);
  $$('.bs img').forEach((im, i) => { const r = sp(im); im.animate([{transform:'translate(0,0)'}, {transform:'translate(0,-16px)', offset:.3}, {transform:`translate(${cx - r.x - r.w / 2}px,${cy - r.y - r.h / 2}px) scale(.3)`, opacity:0}], {duration:420, delay:i * 25, easing:'cubic-bezier(.5,0,.7,1)', fill:'forwards'}); });
  for (const t of [0, 200, 380]) setTimeout(() => { bench.classList.remove('shake'); void bench.offsetWidth; bench.classList.add('shake'); sparks(cx, cy, ['#ffd27a', '#ff9e45', '#fff3c4'], 14, 70, 60); }, 300 + t);
  await wait(900);
  consume(); const h = hk('wyatt');
  if (m.kind === 'bp') await reveal(m.id, 3 + Math.floor(Math.random() * 2));
  else { await deal9(m); }
  CR.bench = []; CR.target = null; CR.size = 0; CR.busy = false;
  renderBench(); renderTray(); renderBook();
  setStat(h, 'e', h.e - 1); markActed(h); renderRight();
});
function itemCard(id, q, isNew) {
  const it = ITEMS[id];
  return `<div class="ic" style="--tc:${TYPE_C[it.t]}"><div class="top"><img src="img/type/${it.t}.webp" alt="">${it.t.toUpperCase()}</div><div class="rays" style="background-image:url(img/type/rays-${it.t}.webp)"></div><img class="art" src="img/item/${id}.webp" alt=""><div class="nm">${it.n.toUpperCase()}</div><div class="tx">${it.fx}</div><div class="leds">${[...Array(q)].map(() => '<i></i>').join('')}</div>${isNew ? '<span class="newst">NEW</span>' : ''}</div>`;
}
async function reveal(id, q) {
  const res = $('#res2'); res.innerHTML = itemCard(id, q, true); const c = res.firstElementChild;
  c.animate([{transform:'rotateY(90deg) scale(.6)'}, {transform:'rotateY(0) scale(1.15)', offset:.6}, {transform:'scale(1)'}], {duration:620, easing:'cubic-bezier(.3,1.3,.5,1)'});
  play('act.craftDone'); setTimeout(() => play('item.new'), 250);
  const r = sp(res); sparks(r.x + r.w / 2, r.y + r.h / 2, [TYPE_C[ITEMS[id].t], '#fff6dc', '#E9B44C'], 26, 130);
  await wait(1500);
  const to = sp($('#who2 .mini')); const from = sp(c);
  const f = c.cloneNode(true); f.className += ' fly'; f.style.cssText = `left:${from.x}px;top:${from.y}px`; stage.appendChild(f); res.innerHTML = '<span class="q">?</span>';
  play('card.take');
  f.animate([{transform:'none'}, {transform:`translate(${to.x - from.x - 40}px,${to.y - from.y - 60}px) scale(.2) rotate(20deg)`, opacity:.8}], {duration:560, easing:'cubic-bezier(.5,0,.7,1)', fill:'forwards'});
  await wait(560); f.remove();
  const h = hk('wyatt'); if (h.bag.length < 4) h.bag.push(id);
  toast(`${ITEMS[id].n} is in Wyatt’s bag`);
}
async function deal9(m) {
  const D = $('#deal'); const pool = POOLS[m.t];
  const cards = [...Array(9)].map(() => ({id:pick(pool), q:pick([1, 2, 2, 3, 3, 3, 4, 5])}));
  let flips = 3, picked = -1;
  D.innerHTML = `<h3>${m.n.toUpperCase()}</h3><div class="sub">Flip 3 cards, then keep 1.</div>
    <div class="dgrid">${cards.map((c, i) => `<div class="dc" data-i="${i}" style="transform:translate(${(1 - i % 3) * 150}px,-560px) rotate(${rnd(-30, 30)}deg)"><div class="in"><div class="iback" style="--tc:${TYPE_C[m.t]};--rays:url(img/type/rays-${m.t}.webp)" data-t="${m.t.toUpperCase()}"><img src="img/type/${m.t}.webp" alt=""></div>${itemCard(c.id, c.q)}</div></div>`).join('')}</div>
    <div class="dside"><div>Flips left</div><div class="left3" id="fl">3</div><p id="dmsg">Each card is a random ${m.t} at Wyatt’s tier. Quality shows as green lights.</p><button class="btn go" id="keep" disabled>Keep</button></div>`;
  D.classList.add('on');
  $$('.dc', D).forEach((el, i) => setTimeout(() => { if (i % 2 === 0) play('card.deal'); el.style.transform = `rotate(${rnd(-2.5, 2.5)}deg)`; }, 80 + i * 70));
  return new Promise(done => {
    D.onclick = async e => {
      const el = e.target.closest('.dc'); const keep = e.target.closest('#keep');
      if (keep && picked >= 0) {
        play('card.take'); const c = cards[picked]; const fromEl = $$('.dc', D)[picked]; const from = sp(fromEl), to = sp($('#who2 .mini'));
        fromEl.animate([{transform:'none'}, {transform:`translate(${to.x - from.x - 40}px,${to.y - from.y - 60}px) scale(.2) rotate(20deg)`, opacity:0}], {duration:560, easing:'cubic-bezier(.5,0,.7,1)', fill:'forwards'});
        await wait(560); D.classList.remove('on'); D.onclick = null;
        const h = hk('wyatt'); if (h.bag.length < 4) h.bag.push(c.id); toast(`${ITEMS[c.id].n} is in Wyatt’s bag`); done(); return;
      }
      if (!el || el.classList.contains('lock')) return; const i = +el.dataset.i;
      if (!el.classList.contains('flip')) {
        if (!flips) return; flips--; el.classList.add('flip'); play('card.flip'); $('#fl').textContent = flips;
        const q = cards[i].q; setTimeout(() => { if (q >= 4) { play(q === 5 ? 'card.reveal.veryRare' : 'card.reveal.rare'); const r = sp(el); sparks(r.x + r.w / 2, r.y + r.h / 2, ['#56d67e', '#fff6dc', '#E9B44C'], 22, 120); } else if (q === 3) play('card.reveal.uncommon'); }, 240);
        if (!flips) { setTimeout(() => $$('.dc:not(.flip)', D).forEach(x => x.classList.add('lock')), 500); $('#dmsg').textContent = 'Pick the one to keep.'; }
        return;
      }
      if (flips) { $('#dmsg').textContent = `Flip ${flips} more first, or pick now.`; }
      picked = i; play('ui.click'); $$('.dc', D).forEach((x, k) => x.classList.toggle('pick', k === i));
      const k = $('#keep'); k.disabled = false; k.textContent = 'KEEP ' + ITEMS[cards[i].id].n.toUpperCase();
    };
  });
}

/* ───────────────────────── screens and bar ───────────────────────── */
function setScreen(s) {
  const was = screen; screen = s;
  $$('#bar [data-for]').forEach(el => el.style.display = el.dataset.for.split(' ').includes(s) ? '' : 'none');
  if (window.HX2) HX2.leave(was, s);
  $$('#screens button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === s));
  $('#scav').classList.toggle('on', s === 'scav'); $('#craft').classList.toggle('on', s === 'craft');
  if (s !== 'main') closeWheel(true); clearHex();
  if (s === 'scav') { play('ui.windowOpen'); play('act.scavenge.' + nodesOf()[0], {vol:.6}); openScav(); }
  if (s === 'craft') { play('ui.windowOpen'); openCraft(); }
  if (window.HX2) HX2.enter(s, was);
  if (s === 'main') { if (was !== 'main' && ['scav', 'craft'].includes(was)) play('ui.windowClose'); SC = null; renderTokens(); renderRight(); updateEnd(); if (amode === 'wheel') setTimeout(openWheel, 250); }
  stage.dataset.s = s;
  ambience();
}
function seg(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$(id + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); play('ui.tab'); fn(b.dataset.v || b.dataset.s); }); }
seg('#screens', s => setScreen(s));
seg('#amode', v => { amode = v; renderRight(); if (screen === 'main') { if (v === 'wheel') openWheel(); else closeWheel(true); } });
seg('#rmode', v => { rmode = v; if (screen === 'scav') openScav(); });
seg('#nodesel', v => { node = v; renderRight(); if (screen === 'scav') openScav(); });
seg('#snd', v => { soundOn = v === 'on'; ambience(); });
seg('#cmode', v => { $('#cw').classList.toggle('tm', v === 'tm');  });
['#logosel', '#loadsel', '#transel'].forEach(id => seg(id, v => window.HX2 && HX2.option(id, v)));
$('#bar').addEventListener('click', e => {
  const d = e.target.closest('.demo'); if (!d) return; const h = hk(sel);
  if (screen !== 'main') setScreen('main');
  const f = () => $(`.frame[data-h=${h.id}]`);
  if (d.dataset.d === 'hit') setStat(h, 'e', h.e - 2);
  if (d.dataset.d === 'mor') setStat(h, 'm', h.m + 1);
  if (d.dataset.d === 'inj') { if (h.inj >= 3) return toast('Three injuries: the hiker passes out'); h.inj++; const i = f().querySelectorAll('.inj i')[h.inj - 1]; i.classList.add('on'); play('injury'); f().querySelector('.por').animate([{boxShadow:'0 0 0 0 rgba(196,86,46,0)'}, {boxShadow:'0 0 0 6px rgba(196,86,46,.9)'}, {boxShadow:'0 0 0 0 rgba(196,86,46,0)'}], {duration:600}); }
  if (d.dataset.d === 'cond') { const opts = [{n:'Wet',d:'2 days',k:'neg',i:'droplet'}, {n:'Hungry',d:'',k:'thr',i:'utensils'}, {n:'Refreshed',d:'1 day',k:'pos',i:'sparkles'}]; const c = opts.find(o => !h.conds.some(x => x.n === o.n)); if (!c) return toast('That’s enough conditions for one hiker'); h.conds.push(c); renderParty(); play(c.k === 'pos' ? 'cond.good' : 'cond.bad'); const dot = f().querySelector('.cdot'); dot && dot.classList.add('pop'); toast(`${cap(h.name.toLowerCase())} is ${c.n}`); }
  if (d.dataset.d === 'reset') { reset(); [0, 1, 2].forEach(i => $('#ph' + i).classList.toggle('on', i === 0)); renderParty(); setScreen('main'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (screen !== 'main' && !(CR && CR.busy)) setScreen('main'); else if ($('#hexes').innerHTML) { clearHex(); openWheel(); } else if (wheelOn) closeWheel(); }
  if (screen === 'main' && wheelOn && /^[1-6]$/.test(e.key)) doAction(ACTIONS()[+e.key - 1].id);
});
document.addEventListener('pointerdown', () => ambience(), {once:true});

renderParty(); renderTokens(); renderRight(); updateEnd(); fit();
stage.dataset.s = 'main';
setTimeout(() => { if (amode === 'wheel' && screen === 'main') openWheel(); }, 500);
window.HX = {$, $$, wait, rnd, pick, cap, ic, play, sparks, floatText, toast, por, sp, stage, hk, itemCard, rng, setScreen, get H() { return H; }, get S() { return S; }, get screen() { return screen; }, closeWheel, openWheel, renderTokens, TILES, sceneSVG};
const hp = location.hash.slice(1).split('-');
const press = (id, v) => $$(id + ' button').forEach(x => x.setAttribute('aria-pressed', (x.dataset.v || x.dataset.s) === v));
if (hp.includes('side')) { amode = 'side'; press('#amode', 'side'); closeWheel(true); renderRight(); }
if (hp.includes('brush')) { rmode = 'brush'; press('#rmode', 'brush'); }
for (const n of ['river', 'wildlife', 'mountain']) if (hp.includes(n)) { node = n; press('#nodesel', n); renderRight(); }
if (hp.includes('mixed')) { node = 'forest+river'; press('#nodesel', 'forest+river'); renderRight(); }
if (hp.includes('tm')) { press('#cmode', 'tm'); $('#cw').classList.add('tm'); }
for (const [id, vals] of [['#logosel', ['wood', 'sign', 'stone', 'mint']], ['#loadsel', ['gps', 'runner', 'jumper', 'wheel']]]) for (const v of vals) if (hp.includes(v)) press(id, v);
const go0 = hp.find(x => ['scav', 'craft', 'night', 'title', 'load', 'trans'].includes(x)); addEventListener('load', () => setTimeout(() => setScreen(go0 || 'main'), go0 ? 600 : 0));
}
