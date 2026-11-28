{
const X = window.HX;
const {$, $$, wait, rnd, pick, cap, ic, play, sparks, floatText, toast, por, sp, stage, hk, rng} = X;
const W0 = 1440, H0 = 900;
let runId = 0;                     // bumps whenever a screen is left, so old animations stop
const alive = id => id === runId;

/* ═══════════════════════════ night camp ═══════════════════════════ */
const XP_ROWS = [['search', 'Scavenged 4 times', 4], ['hammer', 'Crafted a Trowel', 2], ['alert', 'Passed Blisters', 3], ['eye', 'Found Blue Pool', 5], ['moon', 'Kept watch', 1]];
function fireflies(on) {
  const f = $('#flies'); f.innerHTML = '';
  if (!on) return;
  for (let i = 0; i < 26; i++) {
    const el = document.createElement('i');
    el.style.cssText = `left:${rnd(300, 1150)}px;top:${rnd(120, 820)}px;--fx:${rnd(-60, 60)}px;--fy:${rnd(-50, 50)}px;animation-delay:${rnd(-6, 0)}s;animation-duration:${rnd(4, 8)}s`;
    f.appendChild(el);
  }
}
async function nightCamp() {
  const id = ++runId, c = $('#camp');
  stage.classList.add('night'); fireflies(true);
  [0, 1, 2].forEach(i => $('#ph' + i).classList.toggle('on', i === 2)); $('#end b').textContent = 'END NIGHT';
  const pill = $('.pill .xp'); if (pill) { pill.parentElement.firstChild.textContent = 'PARTY LV 2 '; pill.firstElementChild.style.width = '80%'; }
  const tok = $('.tok[data-h="wyatt"]'); if (tok) { const r = sp(tok); stage.style.setProperty('--cx', r.x + r.w / 2 + 20 + 'px'); stage.style.setProperty('--cy', r.y + r.h / 2 + 18 + 'px'); }
  X.closeWheel(true);
  c.innerHTML = `<div class="rays"></div><div class="ctop"><span class="lbl">TONIGHT AT CAMP</span><span class="lbl">DAY 3 · MEADOW</span></div><div class="crows"></div>
    <div class="cxp"><div class="lvl" id="lvl"><span>PARTY LV</span><b id="lvn">2</b></div><div class="xbar" id="xbar"><i id="xfill"></i><span id="xnum">48 / 60 XP</span></div></div>
    <div class="cpts" id="cpts"></div>
    <div class="cbtns" id="cbtns"><button class="btn" id="later">LATER</button><button class="btn go" id="spend">SPEND POINTS</button></div>`;
  c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  await wait(900); if (!alive(id)) return;
  play('act.sleep', {vol:.6});
  let gained = 0;
  for (const [i, txt, n] of XP_ROWS) {
    const row = document.createElement('div'); row.className = 'crow'; row.innerHTML = `${ic(i)}<span>${txt}</span><b>+${n}</b>`;
    $('.crows', c).appendChild(row); play('ui.tab', {vol:.7}); gained += n;
    await wait(420); if (!alive(id)) return;
  }
  const row = document.createElement('div'); row.className = 'crow'; row.style.borderBottom = '0'; row.innerHTML = `<span></span><span class="px" style="font-size:13px">TODAY</span><b style="color:var(--ink)">+${gained} XP</b>`;
  $('.crows', c).appendChild(row);
  await wait(500); if (!alive(id)) return;
  let xp = 48, max = 60, lv = 2, left = gained;
  const fill = $('#xfill'), num = $('#xnum');
  const step = async () => { xp++; left--; fill.style.width = xp / max * 100 + '%'; num.textContent = `${xp} / ${max} XP`; play('xp.gain', {rate:1 + Math.min(xp / max, 1) * .35, vol:.8}); await wait(70); };
  while (left > 0 && xp < max) { await step(); if (!alive(id)) return; }
  if (xp >= max) {
    lv++; $('#xbar').classList.add('flash'); $('#lvn').textContent = lv; $('#lvl').classList.add('pop');
    const pill = $('.pill .xp'); if (pill) { pill.parentElement.firstChild.textContent = `PARTY LV ${lv} `; pill.firstElementChild.style.width = '4%'; pill.parentElement.classList.remove('pts'); void pill.offsetWidth; pill.parentElement.classList.add('pts'); }
    $('.rays', c).classList.add('on'); play('levelUp');
    const st = document.createElement('div'); st.className = 'stampL'; st.textContent = `PARTY LEVEL ${lv}!`; c.appendChild(st);
    const r = sp($('#lvl')); sparks(r.x + r.w / 2, r.y + r.h / 2, ['#E9B44C', '#9466C4', '#fff3c4', '#E2683C', '#4A8FD4'], 46, 230, 220);
    c.animate([{transform:'translate(0,0)'}, {transform:'translate(-5px,3px)'}, {transform:'translate(4px,-2px)'}, {transform:'translate(0,0)'}], {duration:280});
    await wait(1100); if (!alive(id)) return;
    xp = 0; max = 75; fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = '';
    num.textContent = `0 / ${max} XP`; $('#xbar').classList.remove('flash');
    while (left > 0) { await step(); if (!alive(id)) return; }
    $('#cpts').innerHTML = `<span class="chip pos">${ic('star')}+2 points to spend</span><span class="chip">${ic('sparkles')}Tier II steps are open</span>`;
    play('trait.learn', {vol:.7});
  }
  await wait(400); if (!alive(id)) return;
  $('#cbtns').classList.add('on'); $('#spend').classList.add('ready');
  $('#spend').onclick = () => { play('ui.confirm'); openPicker(); };
  $('#later').onclick = () => { play('ui.cancel'); c.classList.remove('on'); toast('The 2 points wait on the Party LV badge until you spend them.'); };
}
const TRAILS = {wyatt:[['Crafter', 2], ['Eagle Eye', 1], ['Coach', 0]], ellie:[['Copydog', 1], ['Alpha Dog', 1], ['Dog Lover', 2]], gdog:[['Chef', 2], ['Caring', 1], ['Chatty', 0]], finn:[['Leash Puller', 1], ['Day Napper', 0], ['Close Company', 1]]};
function bigPor(h, w, hgt) {
  const z = 1.25 + Math.max(0, h.fy - .55) * 2.4, iw = w * z, ih = iw * 620 / 750; let top = hgt * .55 - h.fy * ih; top = Math.min(0, Math.max(hgt - ih, top));
  return `<img src="img/por/${h.id}.webp" alt="" style="width:${iw}px;left:${(w - iw) / 2}px;top:${top}px">`;
}
function openPicker() {
  $('#camp').classList.remove('on');
  const pk = $('#picker');
  pk.innerHTML = `<h2>WHO LEARNS SOMETHING NEW?</h2><p>2 points to spend. Pick a hiker to open their skill trails.</p>
    <div class="pcards">${X.H.map((h, i) => `<button class="pc tag" data-h="${h.id}" style="--c:${h.c};animation-delay:${i * 110}ms">
      <div class="pw">${bigPor(h, 236, 210)}</div><div class="banner"><span class="nm">${h.name}</span></div>
      <div class="tr">${TRAILS[h.id].map(([n, k]) => `<div><span>${n}</span><span class="pips2">${[0, 1, 2].map(j => `<i class="${j < k ? 'f' : ''}"></i>`).join('')}</span></div>`).join('')}</div>
      <div class="can">${h.id === 'gdog' ? 'NOTHING NEW YET' : `${h.id === 'wyatt' ? 2 : 1} STEP${h.id === 'wyatt' ? 'S' : ''} TO LEARN`}</div></button>`).join('')}</div>
    <div id="trails"></div>`;
  pk.classList.add('on');
  X.H.forEach((h, i) => setTimeout(() => play('card.deal'), i * 110));
  $$('.pc', pk).forEach(c => { c.onmouseenter = () => play('card.hover', {vol:.5}); c.onclick = () => openTrails(c.dataset.h); });
}
function openTrails(hid) {
  const pk = $('#picker'); play('card.take');
  $$('.pc', pk).forEach(c => c.classList.add(c.dataset.h === hid ? 'go' : 'away'));
  setTimeout(() => {
    const h = hk(hid), tr = $('#trails');
    tr.innerHTML = `<div class="th"><span class="mini" style="--c:${h.c};width:52px;height:52px">${por(h, 48, 1.9)}</span><h3>SKILL TRAILS<br><span style="font-family:var(--body);font-size:14px;color:${h.c}">${cap(h.name.toLowerCase())}</span></h3>
      <div class="ports">${X.H.map(o => `<button class="${o.id === hid ? 'on' : ''}" data-h="${o.id}" style="--c:${o.c}" aria-label="${o.name}">${por(o, 40, 1.9)}</button>`).join('')}</div>
      <button class="btn" id="tback" style="margin-left:14px">${ic('arrowLeft').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px"')}PICK SOMEONE ELSE</button></div>
      <img src="img/trails.webp" alt="" style="position:absolute;left:0;top:86px;width:1140px;height:634px;object-fit:cover;opacity:.92">
      <div class="tag" style="position:absolute;left:24px;bottom:18px;padding:8px 12px;font-size:13px;color:var(--ink)">The Phase 10.7 skill trails window (Finn's trails in this picture), opened with 2 points to spend. The portraits up top switch hikers.</div>`;
    tr.classList.add('on'); play('ui.windowOpen');
    $('#tback').onclick = () => { play('ui.cancel'); tr.classList.remove('on'); $$('.pc', pk).forEach(c => c.classList.remove('go', 'away')); };
    $$('.ports button', tr).forEach(b => b.onclick = () => openTrails(b.dataset.h));
  }, 380);
}
function leaveNight() { [0, 1, 2].forEach(i => $('#ph' + i).classList.toggle('on', i === 0)); $('#end b').textContent = 'END MORNING'; stage.classList.remove('night'); fireflies(false); $('#camp').classList.remove('on'); $('#picker').classList.remove('on'); }

/* ═══════════════════════════ title and logos ═══════════════════════════ */
let logoV = 'mint';
const LOGO_FONT = {wood:'Titan One', sign:'Alfa Slab One', stone:'Bowlby One', mint:'Anton'};
function cnv(w, h, d = 2) { const c = document.createElement('canvas'); c.width = w * d; c.height = h * d; const x = c.getContext('2d'); x.scale(d, d); return [c, x]; }
function tint(m, color) { const [c, x] = cnv(m.width / 2, m.height / 2); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; }
function edges(m, bands) {
  const d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data, Wp = m.width, tops = [], bots = [];
  const a = (x, y) => d[(y * Wp + x) * 4 + 3];
  for (const [y0, y1] of bands) for (let x = 0; x < Wp; x += 4) {
    let t = -1; for (let y = Math.max(1, Math.floor(y0 * 2)); y < Math.min(m.height - 1, Math.floor(y1 * 2)); y++) if (a(x, y) > 128) { t = y; break; }
    if (t < 0) continue; tops.push([x / 2, t / 2]);
    for (let y = Math.min(m.height - 2, Math.floor(y1 * 2)); y > t; y--) if (a(x, y) > 128) { bots.push([x / 2, y / 2]); break; }
  }
  return {tops, bots};
}
function moss(x, tops, r, cols = ['#5f8f39', '#77a845', '#8fbf52', '#4d7a2e']) {
  const R = (a, b) => a + r() * (b - a);
  for (const [px, py] of tops) { x.fillStyle = cols[3]; x.fillRect(px - 1.2, py - 2, 3, R(4, 11)); }
  for (const [px, py] of tops) if (r() < .55) { x.fillStyle = cols[Math.floor(r() * 3)]; x.beginPath(); x.arc(px, py - 1, R(2.2, 4.6), 0, 7); x.fill(); }
}
function grass(x, tops, r, dens = .7) {
  const R = (a, b) => a + r() * (b - a);
  for (const [px, py] of tops) { if (r() > dens) continue;
    for (let k = 0; k < 2; k++) { const h = R(6, 17), lean = R(-6, 6), w = R(1.2, 2.1); x.fillStyle = ['#3f7a2e', '#5c9a3a', '#86bd4e', '#a6cf5e'][Math.floor(r() * 4)];
      x.beginPath(); x.moveTo(px - w, py + 1); x.quadraticCurveTo(px + lean * .3, py - h * .6, px + lean, py - h); x.quadraticCurveTo(px + lean * .3 + w * .3, py - h * .5, px + w, py + 1); x.fill(); } }
}
function flowers(x, tops, r, n) { for (let i = 0; i < n; i++) { const [px, py] = tops[Math.floor(r() * tops.length)]; const c = ['#fff6e0', '#f6d24a', '#e9a6d6', '#ff9b6a'][Math.floor(r() * 4)];
  x.strokeStyle = '#4d7a2e'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 1, py - 9); x.stroke();
  x.fillStyle = c; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + 1 + Math.cos(k * 1.26) * 2.6, py - 9 + Math.sin(k * 1.26) * 2.6, 2, 0, 7); x.fill(); } x.fillStyle = '#e0962a'; x.beginPath(); x.arc(px + 1, py - 9, 1.4, 0, 7); x.fill(); } }
function mushrooms(x, tops, r, n) { for (let i = 0; i < n; i++) { const [px, py] = tops[Math.floor(r() * tops.length)]; const s = 5 + r() * 4;
  x.fillStyle = '#f3e7cf'; x.fillRect(px - s * .25, py - s * 1.1, s * .5, s * 1.1);
  x.fillStyle = '#c8402e'; x.beginPath(); x.ellipse(px, py - s * 1.1, s, s * .7, 0, Math.PI, 0); x.fill();
  x.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(px - s * .5 + k * s * .5, py - s * 1.35, s * .14, 0, 7); x.fill(); } } }
function vines(x, bots, r, n) { for (let i = 0; i < n; i++) { const [px, py] = bots[Math.floor(r() * bots.length)]; const L = 18 + r() * 40;
  x.strokeStyle = '#4d7a2e'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py - 2); x.bezierCurveTo(px + 6, py + L * .3, px - 6, py + L * .6, px + 2, py + L); x.stroke();
  for (let k = 0; k < 4; k++) { const ly = py + L * (k + 1) / 5; x.fillStyle = k % 2 ? '#6fa043' : '#86bd4e'; x.beginPath(); x.ellipse(px + (k % 2 ? 5 : -4), ly, 4.2, 2.2, k % 2 ? .6 : -.6, 0, 7); x.fill(); } } }
function grain(w, h, base, line, seed) {
  const [c, x] = cnv(w, h), r = rng(seed), R = (a, b) => a + r() * (b - a);
  const g = x.createLinearGradient(0, 0, 0, h); base.forEach((b, i) => g.addColorStop(i / (base.length - 1), b)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let k = 0; k < h / 4; k++) { let y = R(0, h); x.strokeStyle = line; x.globalAlpha = R(.12, .35); x.lineWidth = R(.8, 2); x.beginPath(); x.moveTo(0, y);
    for (let px = 0; px <= w; px += 30) x.lineTo(px, y + Math.sin(px * .01 + k) * R(1, 4)); x.stroke(); }
  x.globalAlpha = 1;
  for (let k = 0; k < 6; k++) { const kx = R(0, w), ky = R(0, h); for (let q = 4; q > 0; q--) { x.strokeStyle = line; x.globalAlpha = .3; x.beginPath(); x.ellipse(kx, ky, q * 6, q * 2.2, 0, 0, 7); x.stroke(); } }
  x.globalAlpha = 1; return c;
}
function lettering(x, W, Hh, lines, o) {
  const [m, mx] = cnv(W, Hh);
  mx.fillStyle = '#fff'; mx.textAlign = 'center'; mx.textBaseline = 'alphabetic';
  for (const L of lines) { mx.save(); mx.font = `${L.size}px "${o.font}"`; if ('letterSpacing' in mx) mx.letterSpacing = (L.ls || 2) + 'px'; if (o.skew) { mx.translate(L.x || W / 2, L.y); mx.transform(1, 0, o.skew, 1, 0, 0); mx.fillText(L.t, 0, 0); } else mx.fillText(L.t, L.x || W / 2, L.y); mx.restore(); }
  const [s, sx] = cnv(W, Hh); sx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i <= o.ex.n; i++) sx.drawImage(m, i * o.ex.dx * 2, i * o.ex.dy * 2);
  const ol = tint(s, o.outline[1]); x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  for (let a = 0; a < 16; a++) x.drawImage(ol, Math.cos(a / 16 * 6.283) * o.outline[0] * 2, Math.sin(a / 16 * 6.283) * o.outline[0] * 2);
  const tA = tint(m, o.ex.c[0]), tB = tint(m, o.ex.c[1]);
  for (let i = o.ex.n; i > 0; i--) x.drawImage(i > o.ex.n * .5 ? tA : tB, i * o.ex.dx * 2, i * o.ex.dy * 2);
  const [f, fx] = cnv(W, Hh); fx.setTransform(1, 0, 0, 1, 0, 0); o.face(fx, f.width, f.height); fx.globalCompositeOperation = 'destination-in'; fx.drawImage(m, 0, 0);
  x.drawImage(f, 0, 0);
  const hi = tint(m, o.rim[0]), sh = tint(m, o.rim[1]);
  const [a, ax] = cnv(W, Hh); ax.setTransform(1, 0, 0, 1, 0, 0); ax.drawImage(hi, 0, 0); ax.globalCompositeOperation = 'destination-out'; ax.drawImage(m, o.rim[2] * 2, o.rim[2] * 2); x.drawImage(a, 0, 0);
  const [b, bx] = cnv(W, Hh); bx.setTransform(1, 0, 0, 1, 0, 0); bx.drawImage(sh, 0, 0); bx.globalCompositeOperation = 'destination-out'; bx.drawImage(m, -o.rim[2] * 2, -o.rim[2] * 2); x.drawImage(b, 0, 0);
  x.restore();
  return m;
}
async function drawLogo(v) {
  const cv = $('#logo'), W = 1100, Hh = 470;
  try { await document.fonts.load(`100px "${LOGO_FONT[v]}"`); } catch (e) {}
  cv.width = W * 2; cv.height = Hh * 2; const x = cv.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, W, Hh);
  const r = rng(7);
  if (v === 'sign') {
    const bx = 120, by = 70, bw = 860, bh = 300;
    for (const px of [205, 895]) { const pg = grain(46, 420, ['#6b4426', '#4a2c16', '#6b4426'], '#2a170a', px); x.drawImage(pg, px - 23, 150, 46, 330); x.strokeStyle = '#1e1008'; x.lineWidth = 4; x.strokeRect(px - 23, 150, 46, 330); }
    x.fillStyle = '#1e1008'; x.beginPath(); x.roundRect(bx - 10, by - 10, bw + 20, bh + 20, 18); x.fill();
    x.drawImage(grain(bw + 8, bh + 8, ['#7a4c2a', '#5e391e', '#6d4324'], '#2a170a', 3), bx - 4, by - 4, bw + 8, bh + 8);
    x.fillStyle = '#5a3a1d'; x.beginPath(); x.roundRect(bx + 14, by + 14, bw - 28, bh - 28, 10); x.fill();
    x.drawImage(grain(bw - 28, bh - 28, ['#6d4324', '#56351b', '#6d4324'], '#2a170a', 9), bx + 14, by + 14, bw - 28, bh - 28);
    x.strokeStyle = 'rgba(255,220,170,.25)'; x.lineWidth = 2; x.beginPath(); x.roundRect(bx + 14, by + 14, bw - 28, bh - 28, 10); x.stroke();
    x.fillStyle = '#3b6b3a'; x.beginPath(); x.moveTo(bx - 30, by + 6); x.lineTo(W / 2, by - 64); x.lineTo(bx + bw + 30, by + 6); x.lineTo(bx + bw + 14, by + 16); x.lineTo(W / 2, by - 46); x.lineTo(bx - 14, by + 16); x.closePath(); x.fill();
    x.strokeStyle = '#1e1008'; x.lineWidth = 4; x.stroke();
    const roofTops = []; for (let px = bx - 26; px < bx + bw + 26; px += 2) roofTops.push([px, px < W / 2 ? by + 6 - (px - (bx - 30)) / (W / 2 - (bx - 30)) * 70 : by - 64 + (px - W / 2) / (bx + bw + 30 - W / 2) * 70]);
    moss(x, roofTops, r); grass(x, roofTops, r, .45); flowers(x, roofTops, r, 6);
    try { await document.fonts.load('100px "Alfa Slab One"'); } catch (e) {}
    const carve = (t, size, y, col = '#f1e6c8') => { x.font = `${size}px "Alfa Slab One"`; x.textAlign = 'center'; if ('letterSpacing' in x) x.letterSpacing = '3px';
      x.fillStyle = '#1e1008'; x.fillText(t, W / 2, y - 2); x.fillStyle = col; x.fillText(t, W / 2, y + 1); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillText(t, W / 2, y + 4); x.fillStyle = col; x.fillText(t, W / 2, y + 2); };
    carve('HIKE IN THE', 62, by + 104); carve('WOODS', 150, by + 250);
    const tg = (cx) => { x.fillStyle = '#2f5a35'; x.beginPath(); x.moveTo(cx, by + 136); x.lineTo(cx - 26, by + 196); x.lineTo(cx + 26, by + 196); x.closePath(); x.fill(); x.beginPath(); x.moveTo(cx, by + 160); x.lineTo(cx - 32, by + 226); x.lineTo(cx + 32, by + 226); x.closePath(); x.fill(); x.fillStyle = '#f1e6c8'; x.fillRect(cx - 4, by + 226, 8, 12); };
    tg(bx + 82); tg(bx + bw - 82);
    const ty = by + bh + 34; x.strokeStyle = '#3b2a1a'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 110, by + bh - 4); x.lineTo(W / 2 - 96, ty); x.moveTo(W / 2 + 110, by + bh - 4); x.lineTo(W / 2 + 96, ty); x.stroke();
    x.fillStyle = '#E9B44C'; x.strokeStyle = '#1e1008'; x.lineWidth = 4; x.beginPath(); x.roundRect(W / 2 - 140, ty, 280, 62, 10); x.fill(); x.stroke();
    x.font = '38px "Alfa Slab One"'; x.fillStyle = '#2b1a0c'; x.fillText('ONLINE!', W / 2, ty + 46);
    return;
  }
  const P = {
    wood:{font:'Titan One', lines:[{t:'HIKE IN THE', size:94, y:150}, {t:'WOODS', size:200, y:342, ls:6}], ex:{n:12, dx:.35, dy:1, c:['#3e2310', '#5b3517']}, outline:[5, '#21120a'], rim:['rgba(255,226,170,.75)', 'rgba(40,18,4,.55)', 2.5],
      face:(fx, w, h) => fx.drawImage(grain(w / 2, h / 2, ['#d79b55', '#b8763a', '#cf9050', '#a6662f'], '#5a3215', 11), 0, 0, w, h)},
    stone:{font:'Bowlby One', lines:[{t:'HIKE IN THE', size:86, y:150}, {t:'WOODS', size:178, y:338, ls:6}], ex:{n:12, dx:.4, dy:1, c:['#3c3b38', '#55534f']}, outline:[5, '#232220'], rim:['rgba(245,245,238,.9)', 'rgba(20,20,18,.55)', 3],
      face:(fx, w, h) => { fx.fillStyle = '#9c9b96'; fx.fillRect(0, 0, w, h); const rr = rng(5); for (let i = 0; i < 260; i++) { const v = Math.floor(130 + rr() * 50); fx.fillStyle = `rgb(${v},${v},${v - 4})`; fx.beginPath(); const cx = rr() * w, cy = rr() * h, s = 18 + rr() * 50; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + rr(); fx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s * .7); } fx.fill(); }
        for (let i = 0; i < 1400; i++) { fx.fillStyle = rr() < .5 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)'; fx.fillRect(rr() * w, rr() * h, 2, 2); }
        fx.strokeStyle = 'rgba(40,40,38,.55)'; fx.lineWidth = 3; for (let i = 0; i < 14; i++) { let px = rr() * w, py = rr() * h; fx.beginPath(); fx.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (rr() - .5) * 60; py += rr() * 40; fx.lineTo(px, py); } fx.stroke(); } }},
    mint:{font:'Anton', skew:-.16, lines:[{t:'HIKE IN THE WOODS', size:138, y:250, x:530, ls:3}, {t:'ONLINE!', size:88, y:368, x:770, ls:3}], ex:{n:16, dx:.9, dy:1.05, c:['#1f6e66', '#2c9488']}, outline:[0, 'rgba(0,0,0,0)'], rim:['rgba(255,255,255,.55)', 'rgba(10,60,55,.4)', 2],
      face:(fx, w, h) => { const g = fx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5ce68f'); g.addColorStop(.55, '#5fe8c0'); g.addColorStop(1, '#69e3e0'); fx.fillStyle = g; fx.fillRect(0, 0, w, h);
        const rr = rng(3); fx.strokeStyle = 'rgba(255,255,255,.22)'; fx.lineWidth = 10; for (let i = 0; i < 18; i++) { fx.beginPath(); const y = rr() * h; fx.moveTo(0, y); fx.bezierCurveTo(w * .3, y - 60, w * .6, y + 60, w, y - 20); fx.stroke(); }
        for (let i = 0; i < 2600; i++) { fx.fillStyle = rr() < .5 ? 'rgba(255,255,255,.35)' : 'rgba(20,90,80,.25)'; fx.fillRect(rr() * w, rr() * h, 2, 2); } }},
  }[v];
  const m = lettering(x, W, Hh, P.lines, P);
  const per = P.lines.map(L => edges(m, [[L.y - L.size * 1.05, L.y + 6]]));
  const big = per.length > 1 && v !== 'mint' ? per[1] : per[0], small = per.length > 1 && v !== 'mint' ? per[0] : per[1];
  if (v === 'mint') { grass(x, per[0].tops, r, .3); flowers(x, per[0].tops, r, 5); vines(x, per[0].bots, r, 3); }
  else {
    moss(x, small.tops, r); grass(x, small.tops, r, .12); flowers(x, small.tops, r, 3);
    moss(x, big.tops, r); grass(x, big.tops, r, v === 'stone' ? .45 : .75); flowers(x, big.tops, r, v === 'stone' ? 6 : 9); vines(x, big.bots, r, v === 'stone' ? 5 : 7);
    if (v === 'wood') mushrooms(x, big.tops, r, 3);
  }
  if (v !== 'mint') {
    const px = 800, py = 384; x.save(); x.translate(px, py); x.rotate(-.06);
    x.strokeStyle = '#3b2a1a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-90, -40); x.lineTo(-80, 0); x.moveTo(90, -44); x.lineTo(80, 0); x.stroke();
    x.drawImage(grain(220, 64, v === 'stone' ? ['#8d8c87', '#6e6d69'] : ['#a8703b', '#8c5a2c', '#a06a37'], v === 'stone' ? '#3a3a37' : '#4a2a10', 21), -110, 0, 220, 64);
    x.strokeStyle = '#1e1008'; x.lineWidth = 4; x.strokeRect(-110, 0, 220, 64);
    for (const nx of [-98, 98]) { x.fillStyle = '#57524b'; x.beginPath(); x.arc(nx, 32, 4, 0, 7); x.fill(); }
    x.font = '40px "Titan One"'; x.textAlign = 'center'; x.fillStyle = '#1e1008'; x.fillText('ONLINE!', 0, 47); x.fillStyle = '#f6e7c4'; x.fillText('ONLINE!', 0, 45);
    x.restore();
  }
}
function buildTitle() {
  const t = $('#title');
  t.innerHTML = `<div class="sunrays"></div><div class="sun"></div>
    <div class="lay" data-d="6" style="top:60px;background-image:url(img/bg/mountains-blue.webp);opacity:.85"></div>
    <div class="lay" data-d="12" style="top:150px;background-image:url(img/bg/ridge-green-with-trees.webp)"></div>
    <div class="lay" data-d="20" style="top:240px;background-image:url(img/bg/pine-forest-dense.webp)"></div>
    <div class="lay" data-d="32" style="top:330px;background-image:url(img/bg/pine-row-bright.webp)"></div>
    <canvas id="logo"></canvas>
    <div class="tbtns"><button class="tbtn go" id="tnew">NEW HIKE</button><button class="tbtn" id="tcont">CONTINUE<small>Day 3 · Meadow · 4 hikers</small></button><button class="tbtn">SETTINGS</button></div>`;
  for (let i = 0; i < 16; i++) { const l = document.createElement('i'); l.className = 'leaf'; l.style.cssText = `left:${rnd(0, 1440)}px;background:${pick(['#d9a13a', '#c4622a', '#8aa64a', '#b8432c'])};animation-duration:${rnd(9, 16)}s;animation-delay:${rnd(-16, 0)}s`; t.appendChild(l); }
  t.onmousemove = e => { const r = t.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5; $$('.lay', t).forEach(l => l.style.transform = `translate(${-dx * l.dataset.d}px,${-dy * l.dataset.d * .4}px)`); };
  $('#tnew').onclick = e => { play('ui.confirm'); newHike(e); };
  $('#tcont').onclick = e => { play('ui.confirm'); spotlight(e, () => X.setScreen('main')); };
}
async function showTitle(silent) {
  const id = ++runId;
  if (!$('#logo')) buildTitle();
  const cv = $('#logo'); cv.classList.remove('drop'); cv.style.opacity = 0;
  await drawLogo(logoV); if (!alive(id)) return;
  cv.style.opacity = 1; void cv.offsetWidth; cv.classList.add('drop');
  if (!silent) setTimeout(() => { if (!alive(id)) return; play('title.logo'); const r = sp(cv); sparks(r.x + r.w / 2, r.y + r.h * .8, ['#d9a13a', '#8aa64a', '#c4622a', '#6f9f3f'], 30, 260, 160); }, 520);
}

/* ═══════════════════════════ loading screens ═══════════════════════════ */
let loadV = 'runner', loadRaf = 0, jumps = 0, manualJump = 0;
const TIPS = ['Eating or using an item doesn’t use a hiker’s action.', 'Rare cards glow before you flip them.', 'Star a recipe: the cards it needs get a gold ribbon.', 'Scavenging, tending and crafting cost Energy. Moving costs Appetite.', 'Sleeping in a shelter gives more Energy.', 'Low Abundance makes resource cards come up empty.'];
const SPR = {
  run1:['....KKKK....', '...KKKKKK...', '..KKKKKKKK..', '....KKKK....', '....KKgK....', '....KKKK....', '..ppKKKK....', '.pppKKKKK...', '.pppKKKKKK..', '.pppKKKK.K..', '..ppKKKK....', '....KKKK....', '...KK..KK...', '..KK....KK..', '.KK......KK.', '.K........K.'],
  run2:['............', '....KKKK....', '...KKKKKK...', '..KKKKKKKK..', '....KKKK....', '....KKgK....', '....KKKK....', '..ppKKKK....', '.pppKKKKK...', '.pppKKKKKK..', '..ppKKKK.K..', '....KKKK....', '....KKK.....', '....KKKK....', '....K..K....', '...KK..KK...'],
  jump:['....KKKK....', '...KKKKKK...', '..KKKKKKKK..', '....KKKK....', '....KKgK....', '....KKKK.K..', '..ppKKKKKK..', '.pppKKKKK...', '.pppKKKK....', '.pppKKKK....', '..ppKKKK....', '...KKKKKK...', '..KK....KK..', '..K......K..', '............', '............'],
  tree:['.....K.....', '....KKK....', '....KKK....', '...KKKKK...', '..KKKKKKK..', '....KKK....', '...KKKKK...', '..KKKKKKK..', '.KKKKKKKKK.', '...KKKKK...', '..KKKKKKK..', '.KKKKKKKKK.', 'KKKKKKKKKKK', '....ttt....', '....ttt....'],
  rock:['...KKKKK....', '..KKgKKKKK..', '.KKgKKKKKKK.', 'KKKKKKKKKKKK', 'KKKKKKKKKKKK'],
  log:['.KKKKKKKKKK.', 'KgKKKKKKKKgK', 'KKKKKKKKKKKK', '.KKKKKKKKKK.'],
  bush:['..KKK.KK..', '.KKKKKKKK.', 'KKKKgKKKKK', 'KKKKKKKKKK', '.KKKKKKKK.'],
};
const SC = 5, INK = '#1D2918', MID = '#3C4E2F', LT = '#859A66';
function drawSpr(x, name, px, py, flip) {
  const rows = SPR[name], w = rows[0].length;
  rows.forEach((row, j) => { for (let i = 0; i < w; i++) { const ch = row[flip ? w - 1 - i : i]; if (ch === '.') continue;
    x.fillStyle = ch === 'K' ? INK : ch === 'p' ? MID : ch === 't' ? MID : LT; x.fillRect(px + i * SC, py + j * SC, SC, SC); } });
}
function sprH(n) { return SPR[n].length * SC; }
function sprW(n) { return SPR[n][0].length * SC; }
function buildLoad() {
  const L = $('#load'); cancelAnimationFrame(loadRaf); L.className = 'full on ' + loadV; L.innerHTML = ''; L.style.background = ''; L.onclick = null;
  const tip = document.createElement('div'); tip.className = 'tip';
  const bar = document.createElement('div'); bar.className = 'lbar'; bar.innerHTML = Array(24).fill('<i></i>').join('');
  const lab = document.createElement('div'); lab.className = 'lbl2';
  let ti = 0; tip.textContent = 'TIP · ' + TIPS[0].toUpperCase();
  const start = performance.now(), DUR = 7000;
  const tickBar = now => { const p = ((now - start) % (DUR + 900)) / DUR; $$('i', bar).forEach((s, k) => s.classList.toggle('f', k < Math.min(24, Math.floor(p * 24)))); const t2 = Math.floor((now - start) / 3400) % TIPS.length; if (t2 !== ti) { ti = t2; tip.style.opacity = 0; setTimeout(() => { tip.textContent = 'TIP · ' + TIPS[ti].toUpperCase(); tip.style.opacity = 1; }, 350); } };
  if (loadV === 'wheel') {
    tip.style.top = '700px'; bar.style.top = '760px'; lab.style.top = '820px'; lab.textContent = 'LOADING THE RAINFOREST';
    tip.style.color = '#2B2520'; bar.style.borderColor = '#2B2520'; bar.style.background = '#e2d6b8';
    L.style.background = `#efe6cf url("data:image/svg+xml;utf8,${encodeURIComponent(topo())}")`;
    const orb = document.createElement('div'); orb.className = 'orbit';
    ['forest', 'river', 'wildlife', 'mountain'].forEach(n => { const im = document.createElement('img'); im.src = `img/scav/node-${n}.webp`; im.alt = ''; orb.appendChild(im); });
    const photos = ['forest', 'river', 'wildlife', 'mountain'].map((n, i) => { const ph = document.createElement('div'); ph.className = 'photo'; ph.innerHTML = `<div style="background-image:url(img/scav/${n}.webp)"></div><span>${['Blue Pool', 'Smith Rock', 'Elk Meadow', 'Cone Peak'][i]}</span>`; ph.style.opacity = 0; L.appendChild(ph); return ph; });
    L.append(orb, tip, bar, lab);
    const loop = now => { const t = (now - start) / 1000; $$('img', orb).forEach((im, k) => { const a = t * 1.6 + k * Math.PI / 2; im.style.transform = `translate(${Math.cos(a) * 90}px,${Math.sin(a) * 90}px) rotate(${Math.sin(t * 2 + k) * 8}deg) scale(${1 + .08 * Math.sin(a * 2)})`; });
      const pi = Math.floor(t / 2.4) % 4; photos.forEach((ph, k) => { const on = k === pi; ph.style.opacity = on ? 1 : 0; ph.style.left = (k % 2 ? 1030 : 160) + 'px'; ph.style.top = (k < 2 ? 170 : 250) + 'px'; ph.style.transform = `rotate(${(k % 2 ? 6 : -7) + (on ? 0 : 4)}deg) scale(${on ? 1 : .94})`; });
      tickBar(now); loadRaf = requestAnimationFrame(loop); };
    loadRaf = requestAnimationFrame(loop); return;
  }
  const cv = document.createElement('canvas'); cv.width = W0; cv.height = H0; const x = cv.getContext('2d');
  const scan = document.createElement('div'); scan.className = 'scan';
  L.append(cv, scan, tip, bar, lab);
  if (loadV === 'gps') {
    tip.style.top = '700px'; bar.style.top = '760px'; lab.style.top = '330px'; lab.innerHTML = '';
    const head = document.createElement('div'); head.className = 'tip'; head.style.cssText = 'top:150px;font-size:44px;letter-spacing:.12em'; head.textContent = 'ACQUIRING TRAIL'; L.appendChild(head);
    const sub = document.createElement('div'); sub.className = 'lbl2'; sub.style.top = '212px'; sub.textContent = 'MEADOW · SECTION I · TIER I'; L.appendChild(sub);
    const blips = Array.from({length:7}, () => [rnd(0, 6.28), rnd(30, 150)]);
    const loop = now => { const t = (now - start) / 1000; x.clearRect(0, 0, W0, H0);
      const cx = 720, cy = 450, R = 170; x.strokeStyle = MID; x.lineWidth = 3; for (const rr of [R, R * .66, R * .33]) { x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.stroke(); }
      x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
      const a = t * 2.2; const g = x.createConicGradient ? x.createConicGradient(a - .9, cx, cy) : null;
      if (g) { g.addColorStop(0, 'rgba(29,41,24,0)'); g.addColorStop(.14, 'rgba(29,41,24,.5)'); g.addColorStop(.15, 'rgba(29,41,24,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); }
      x.strokeStyle = INK; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke();
      blips.forEach(([ba, br]) => { const d = ((a - ba) % 6.283 + 6.283) % 6.283; if (d < 2.6) { x.fillStyle = `rgba(29,41,24,${1 - d / 2.6})`; x.fillRect(cx + Math.cos(ba) * br - 6, cy + Math.sin(ba) * br - 6, 12, 12); } });
      drawSpr(x, Math.floor(t * 6) % 2 ? 'run1' : 'run2', cx - 30, cy + R + 40 - 80, false);
      tickBar(now); loadRaf = requestAnimationFrame(loop); };
    loadRaf = requestAnimationFrame(loop); return;
  }
  // runner and jumper: a deep green floor across the bottom quarter
  const FLOOR = 675; tip.style.top = '120px'; bar.style.cssText += `;top:${FLOOR + 110}px;background:#3C4E2F;border-color:#111A10`; lab.style.top = `${FLOOR + 160}px`; lab.style.color = '#BAC995'; lab.textContent = 'LOADING THE MEADOW';
  bar.querySelectorAll('i').forEach(i => i.dataset.c = 1);
  const st = document.createElement('style'); st.textContent = '#load .lbar i.f{background:#BAC995!important}'; L.appendChild(st);
  const kinds = ['tree', 'rock', 'log', 'bush'];
  let hx = 150, dir = 1, jy = 0, jt = -1, obs = [], phase = 'run', phaseT = 0, swapped = false, last = performance.now();
  const newObs = () => { obs = []; const xs = [380, 640, 900, 1150]; xs.forEach(px => obs.push({x:px + rnd(-50, 50), k:pick(kinds), rise:0, sink:0})); };
  if (loadV === 'runner') newObs();
  const jumpNow = () => { if (jt < 0) { jt = 0; play('load.jump', {vol:.55}); } };
  const onKey = e => { if (e.code === 'Space' && loadV === 'jumper' && X.screen === 'load') { e.preventDefault(); manualJump = performance.now(); jumpNow(); jumps++; } };
  document.removeEventListener('keydown', window.__ldk || (() => {})); window.__ldk = onKey; document.addEventListener('keydown', onKey);
  L.onclick = () => { if (loadV === 'jumper') { manualJump = performance.now(); jumpNow(); jumps++; } };
  let spawnT = 0;
  const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; x.clearRect(0, 0, W0, H0);
    x.fillStyle = '#52653F'; x.fillRect(0, FLOOR, W0, H0 - FLOOR); x.fillStyle = MID; for (let i = 0; i < W0; i += 10) x.fillRect(i, FLOOR - (i % 30 ? 0 : 5), 5, 5 + (i % 30 ? 0 : 5));
    x.fillStyle = '#3C4E2F'; x.fillRect(0, FLOOR + 10, W0, 5);
    for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(29,41,24,.12)'; const bx = ((i * 330 - now * .02 * (loadV === 'jumper' ? 1 : 0)) % 1700 + 1700) % 1700 - 200; x.beginPath(); x.moveTo(bx, FLOOR); x.lineTo(bx + 160, FLOOR - 190); x.lineTo(bx + 320, FLOOR); x.fill(); }
    if (jt >= 0) { jt += dt; const T = .6; jy = Math.sin(Math.min(jt / T, 1) * Math.PI) * 135; if (jt >= T) { jt = -1; jy = 0; } }
    if (loadV === 'runner') {
      let vis = 1;
      if (phase === 'run') { hx += dir * 270 * dt;
        for (const o of obs) { const ahead = dir > 0 ? o.x - hx : hx - o.x; if (ahead > 40 && ahead < 110 && jt < 0 && !o.cleared) { o.cleared = true; jumpNow(); } }
        if ((dir > 0 && hx > 1290) || (dir < 0 && hx < 110)) { phase = 'swap'; phaseT = 0; }
      } else { phaseT += dt;
        if (phaseT < .4) vis = 1 - phaseT / .4; else if (phaseT < .45) vis = 0;
        else { if (!swapped) { newObs(); swapped = true; play('ui.wheelOpen', {vol:.35}); } vis = Math.min(1, (phaseT - .45) / .35); }
        if (phaseT > .9) { dir *= -1; phase = 'run'; swapped = false; vis = 1; } }
      for (const o of obs) { const h = sprH(o.k), w = sprW(o.k); if (vis <= 0) continue;
        x.save(); x.beginPath(); x.rect(0, 0, W0, FLOOR); x.clip(); drawSpr(x, o.k, o.x - w / 2, FLOOR - h * vis, false); x.restore(); }
    } else {
      spawnT -= dt; if (spawnT <= 0) { obs.push({x:W0 + 40, k:pick(kinds)}); spawnT = rnd(1.1, 2.2); }
      obs.forEach(o => o.x -= 380 * dt); obs = obs.filter(o => o.x > -80); hx = 230; dir = 1;
      const auto = now - manualJump > 4000;
      for (const o of obs) { const d = o.x - hx; if (auto && d > 50 && d < 120 && jt < 0 && !o.cleared) { o.cleared = true; jumpNow(); jumps++; } drawSpr(x, o.k, o.x - sprW(o.k) / 2, FLOOR - sprH(o.k), false); }
      x.fillStyle = INK; x.font = '22px EditUndo'; x.textAlign = 'right'; x.fillText(`JUMPS ${String(jumps).padStart(3, '0')}`, W0 - 60, 80);
      x.font = '14px EditUndo'; x.fillStyle = MID; x.fillText(auto ? 'PRESS SPACE OR CLICK TO JUMP' : 'NICE!', W0 - 60, 106);
    }
    const fr = jt >= 0 ? 'jump' : (Math.floor(now / 110) % 2 ? 'run1' : 'run2');
    drawSpr(x, fr, hx - sprW('run1') / 2, FLOOR - sprH('run1') - jy, dir < 0);
    tickBar(now); loadRaf = requestAnimationFrame(loop); };
  loadRaf = requestAnimationFrame(loop);
}
function topo() {
  const r = rng(12); let s = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="450" viewBox="0 0 720 450">';
  for (let k = 0; k < 4; k++) { const cx = r() * 720, cy = r() * 450; for (let i = 1; i < 9; i++) { let d = ''; for (let a = 0; a <= 6.3; a += .3) { const rr = i * 26 + Math.sin(a * 3 + k) * 8 + Math.sin(a * 5) * 4; d += (a ? 'L' : 'M') + (cx + Math.cos(a) * rr * 1.4).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } s += `<path d="${d}Z" fill="none" stroke="#b9a982" stroke-opacity=".45" stroke-width="1.5"/>`; } }
  return s + '</svg>';
}

/* ═══════════════════════════ transitions ═══════════════════════════ */
const ease = {in:t => t * t * t, out:t => 1 - Math.pow(1 - t, 3)};
function irisTo(px, py, r0, r1, dur, e) {
  const I = $('#iris'); I.classList.add('on'); I.style.setProperty('--ix', px + 'px'); I.style.setProperty('--iy', py + 'px');
  return new Promise(res => { const t0 = performance.now(); const f = now => { const t = Math.min(1, (now - t0) / dur); I.style.setProperty('--ir', (r0 + (r1 - r0) * e(t)) + 'px'); if (t < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
}
async function irisClose(px, py) { play('trans.irisIn'); await irisTo(px, py, 1800, 90, 520, ease.in); await wait(200); await irisTo(px, py, 90, 0, 200, ease.in); }
async function irisOpen(px, py) { play('trans.irisOut'); await irisTo(px, py, 0, 1800, 700, ease.out); $('#iris').classList.remove('on'); }
function stagePoint(e) { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / X.S, (e.clientY - r.top) / X.S]; }
async function spotlight(e, then) { const [px, py] = e ? stagePoint(e) : [720, 450]; await irisClose(px, py); then(); await wait(120); await irisOpen(px, py); }
async function newHike(e) {
  const [px, py] = stagePoint(e); await irisClose(px, py);
  loadV = 'runner'; X.setScreen('load'); $$('#loadsel button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'runner'));
  await irisOpen(720, 450); await wait(3600); if (X.screen !== 'load') return;
  await irisClose(720, 450); X.setScreen('main'); await wait(150); await irisOpen(690, 452);
}
let clickArmed = false;
stage.addEventListener('click', async e => {
  if (!clickArmed || X.screen !== 'trans') return; clickArmed = false;
  await spotlight(e, () => { X.setScreen('scav'); });
}, true);
function doorSVG(side) {
  const w = 720, h = 900, r = rng(side === 'l' ? 3 : 4); let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4a26"/><stop offset=".5" stop-color="#8c5a30"/><stop offset="1" stop-color="#6b3f1f"/></linearGradient></defs>`;
  const pw = 120; for (let i = 0; i < 6; i++) { s += `<rect x="${i * pw}" y="0" width="${pw}" height="${h}" fill="url(#g)"/><rect x="${i * pw}" y="0" width="3" height="${h}" fill="#2e1909"/>`;
    for (let k = 0; k < 9; k++) { const gx = i * pw + 8 + r() * (pw - 16); s += `<path d="M${gx} 0 Q${gx + (r() - .5) * 14} ${h / 2} ${gx + (r() - .5) * 8} ${h}" stroke="#3d220e" stroke-opacity="${(.15 + r() * .2).toFixed(2)}" fill="none" stroke-width="${(1 + r()).toFixed(1)}"/>`; } }
  s += `<rect x="20" y="150" width="${w - 40}" height="70" fill="#5a3418" stroke="#2e1909" stroke-width="4"/><rect x="20" y="680" width="${w - 40}" height="70" fill="#5a3418" stroke="#2e1909" stroke-width="4"/>`;
  s += `<path d="M40 680 L${w - 60} 220 L${w - 20} 220 L80 680Z" fill="#5a3418" stroke="#2e1909" stroke-width="4"/>`;
  const hx = side === 'l' ? 0 : w - 150; for (const hy of [160, 700]) s += `<rect x="${hx}" y="${hy}" width="150" height="50" rx="8" fill="#2f2f2c"/>` + [30, 75, 120].map(k => `<circle cx="${hx + k}" cy="${hy + 25}" r="6" fill="#6b6b66"/>`).join('');
  const wx = side === 'l' ? w - 220 : 70; s += `<rect x="${wx}" y="300" width="150" height="190" rx="70" fill="#ffcf7a" stroke="#2e1909" stroke-width="10"/><path d="M${wx + 75} 300 V490 M${wx} 395 H${wx + 150}" stroke="#2e1909" stroke-width="8"/>`;
  const kx = side === 'l' ? w - 50 : 50; s += `<circle cx="${kx}" cy="560" r="16" fill="#c99a3a" stroke="#2e1909" stroke-width="4"/>`;
  return s + '</svg>';
}
async function checkIn(doors) {
  const tok = $('.tok'), r = tok ? sp(tok) : {x:690, y:452, w:0, h:0}; const px = r.x + r.w / 2 + 20, py = r.y + r.h / 2 + 18;
  await irisClose(px, py);
  const D = $('#doors'); D.className = 'on';
  if (doors) {
    D.innerHTML = doorHTML();
    await irisOpen(720, 450); await wait(350);
    play('trans.door'); D.classList.add('open'); await wait(1300);
  } else { D.innerHTML = ''; await irisOpen(720, 450); }
  play('station.enter', {vol:.7});
  toast('The Ranger Station (its current design). Press Esc to go back to the map.');
}
function doorHTML() {
    return `<div class="glow"></div><div class="door l" style="background-image:url(&quot;data:image/svg+xml;utf8,${encodeURIComponent(doorSVG('l'))}&quot;)"></div><div class="door r" style="background-image:url(&quot;data:image/svg+xml;utf8,${encodeURIComponent(doorSVG('r'))}&quot;)"></div>
      <div class="sign"><svg width="520" height="96" viewBox="0 0 520 96"><rect x="4" y="4" width="512" height="88" rx="12" fill="#5a3a1d" stroke="#1e1008" stroke-width="6"/><text x="260" y="64" text-anchor="middle" font-family="Alfa Slab One" font-size="40" fill="#f1e6c8" letter-spacing="3">RANGER STATION</text></svg></div>`;
}
function leaveTrans() { const D = $('#doors'); D.className = ''; D.innerHTML = ''; clickArmed = false; }

/* ═══════════════════════════ screen hooks ═══════════════════════════ */
window.HX2 = {
  enter(s, was) {
    if (s === 'night') { X.closeWheel(true); nightCamp(); }
    if (s === 'title') { $('#title').classList.add('on'); showTitle(); }
    if (s === 'load') { $('#load').classList.add('on'); buildLoad(); }
    if (s === 'trans') { X.closeWheel(true); toast('Pick a transition in the bar.'); }
  },
  leave(was, s) {
    runId++;
    if (was === 'night' && s !== 'night') leaveNight();
    if (was === 'title') $('#title').classList.remove('on');
    if (was === 'load') { $('#load').classList.remove('on'); cancelAnimationFrame(loadRaf); }
    if (was === 'trans') leaveTrans();
  },
  freezeDoors(open, ang) { const D = $('#doors'); D.className = 'on'; D.innerHTML = doorHTML(); $$('.door', D).forEach((d, i) => { d.style.transition = 'none'; d.style.transform = `rotateY(${(i ? 1 : -1) * ang}deg)`; }); if (open) $('.glow', D).style.opacity = 1; if (ang) $('.sign', D).style.opacity = 0; },
  freezeIris(px, py, r) { const I = $('#iris'); I.classList.add('on'); I.style.setProperty('--ix', px + 'px'); I.style.setProperty('--iy', py + 'px'); I.style.setProperty('--ir', r + 'px'); },
  option(id, v, silent) {
    if (id === '#logosel') { logoV = v; if (X.screen === 'title') showTitle(silent); }
    if (id === '#loadsel') { loadV = v; jumps = 0; if (X.screen === 'load') buildLoad(); }
    if (id === '#transel') {
      if (X.screen !== 'trans') X.setScreen('trans');
      leaveTrans();
      if (v === 'click') { clickArmed = true; toast('Click anywhere on the map: the spotlight closes there and opens the scavenge window.'); }
      if (v === 'tile') checkIn(false);
      if (v === 'door') checkIn(true);
    }
  },
};
logoV = document.querySelector('#logosel [aria-pressed=true]')?.dataset.v || 'mint';
loadV = document.querySelector('#loadsel [aria-pressed=true]')?.dataset.v || 'runner';
['Titan One', 'Alfa Slab One', 'Bowlby One', 'Anton', 'Pixelify Sans'].forEach(f => { try { document.fonts.load(`40px "${f}"`); } catch (e) {} });
$('#replay').addEventListener('click', () => { if (X.screen !== 'night') X.setScreen('night'); else { runId++; nightCamp(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && X.screen === 'trans') leaveTrans(); if (e.key === 'Escape' && X.screen === 'night') $('#picker').classList.remove('on'); });
}
