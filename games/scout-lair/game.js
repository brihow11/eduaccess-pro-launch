/* Scout's Lair: SCOUT, Rebel AI vs The Machine. An original interactive-cartoon adventure.
   Canvas + Web Audio, no external assets beyond Brian's art in img/. Written by: Howie */
(function () {
  'use strict';
  var D = window.SCOUT_LAIR, SCENES = D.SCENES, AU = window.ScoutAudio, AN = window.ScoutAnim;
  var DEBUG = /[?&]debug=1(&|$)/.test(location.search);
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var LW = 540, LH = 960, CX = 270, FLOOR = 805, HOR = 520;
  var W = 0, H = 0, DPR = 1, S = 1, OX = 0, OY = 0, VX0 = 0, VX1 = LW, VY0 = 0, VY1 = LH;
  var TAU = Math.PI * 2, PI = Math.PI;
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  var IMG = {};
  ['poster-2-armsout', 'scout-closeup-talk', 'scout-closeup-shout', 'scout-closeup-smile', 'scout-hero-rescued'].forEach(function (n) {
    var i = new Image(); i.src = 'img/' + n + '.webp'; IMG[n] = i;
  });
  function imgOk(i) { return i && i.complete && i.naturalWidth > 0; }

  // ---------- math helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeIn(t) { t = clamp(t, 0, 1); return t * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------- layout ----------
  function resize() {
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    // Landscape screens crop a little sky and floor (logical y 90..930) so the action reads bigger.
    var visH = W > H ? 840 : LH, top = W > H ? 90 : 0;
    S = Math.min(W / LW, H / visH); OX = (W - LW * S) / 2; OY = (H - visH * S) / 2 - top * S;
    VX0 = -OX / S; VX1 = LW + OX / S; VY0 = -OY / S; VY1 = LH + OY / S;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  window.addEventListener('jsp-banner-ready', function () { setTimeout(resize, 30); });

  // ---------- input mapping ----------
  var ACTS = ['up', 'down', 'left', 'right', 'strike', 'pause'];
  var ACT_LABEL = { up: 'Up / jump', down: 'Down / duck', left: 'Left / dodge', right: 'Right / dodge', strike: 'Strike', pause: 'Pause' };
  var DEFAULT_KEYS = { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], strike: ['Space', 'KeyJ'], pause: ['KeyP', 'Escape'] };
  var keymap = loadKeys();
  function loadKeys() {
    var k = store.get('scoutLair.keys', null), out = {};
    ACTS.forEach(function (a) { out[a] = (k && Array.isArray(k[a]) && k[a].length) ? k[a].slice(0, 2) : DEFAULT_KEYS[a].slice(); });
    return out;
  }
  function actFor(code) {
    for (var i = 0; i < ACTS.length; i++) if (keymap[ACTS[i]].indexOf(code) >= 0) return ACTS[i];
    return null;
  }
  function keyName(code) {
    if (!code) return '-';
    var m = { Space: 'Space', ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192', Escape: 'Esc', Enter: 'Enter', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl' };
    if (m[code]) return m[code];
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
  }

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var elTitle = $('title'), elPause = $('pause'), elControls = $('controls'), elKeymap = $('keymap');
  var btnMute = $('btn-mute'), elPad = $('pad');
  var hi = store.get('scoutLair.hi', 0) | 0;
  $('hi').textContent = hi;
  var remapWait = null, controlsOpen = false;

  function renderKeymap() {
    elKeymap.innerHTML = '';
    ACTS.forEach(function (a) {
      var l = document.createElement('span'); l.textContent = ACT_LABEL[a]; elKeymap.appendChild(l);
      [0, 1].forEach(function (slot) {
        var b = document.createElement('button'); b.type = 'button';
        var waiting = remapWait && remapWait.a === a && remapWait.slot === slot;
        b.textContent = waiting ? 'Press a key\u2026' : keyName(keymap[a][slot]);
        if (waiting) b.className = 'wait';
        b.setAttribute('aria-label', ACT_LABEL[a] + ' key ' + (slot + 1));
        b.addEventListener('click', function () { remapWait = { a: a, slot: slot }; renderKeymap(); });
        elKeymap.appendChild(b);
      });
    });
  }
  function openControls() { controlsOpen = true; remapWait = null; renderKeymap(); elControls.classList.add('show'); $('btn-close-controls').focus({ preventScroll: true }); }
  function closeControls() { controlsOpen = false; remapWait = null; elControls.classList.remove('show'); store.set('scoutLair.keys', keymap); }
  $('btn-controls').addEventListener('click', openControls);
  $('btn-controls2').addEventListener('click', openControls);
  $('btn-close-controls').addEventListener('click', closeControls);
  $('btn-reset-keys').addEventListener('click', function () { keymap = JSON.parse(JSON.stringify(DEFAULT_KEYS)); store.set('scoutLair.keys', keymap); remapWait = null; renderKeymap(); });
  $('btn-start').addEventListener('click', function () { AU.init(); startGame(); });
  $('btn-resume').addEventListener('click', function () { setPaused(false); });
  $('btn-pause').addEventListener('click', function () { AU.init(); if (inPlay()) setPaused(!paused); });
  $('btn-quit').addEventListener('click', function () { setPaused(false); toTitle(''); });
  function syncMute() { var m = AU.isMuted(); btnMute.innerHTML = m ? '&#128263;' : '&#128266;'; btnMute.setAttribute('aria-pressed', m ? 'true' : 'false'); btnMute.title = m ? 'Sound off (M)' : 'Sound on (M)'; }
  function toggleMute() { AU.init(); AU.setMuted(!AU.isMuted()); syncMute(); }
  btnMute.addEventListener('click', toggleMute);
  syncMute();

  function splashOpen() { return !!(window.ScoutSplash && window.ScoutSplash.isOpen()); }

  window.addEventListener('keydown', function (e) {
    AU.init();
    if (splashOpen()) return;
    if (remapWait) {
      e.preventDefault(); e.stopPropagation();
      if (e.code !== 'Escape') {
        ACTS.forEach(function (a) { var i = keymap[a].indexOf(e.code); if (i >= 0) keymap[a].splice(i, 1); });
        keymap[remapWait.a][remapWait.slot] = e.code;
        keymap[remapWait.a] = keymap[remapWait.a].filter(Boolean);
        ACTS.forEach(function (a) { if (!keymap[a].length) keymap[a] = DEFAULT_KEYS[a].slice(0, 1); });
        store.set('scoutLair.keys', keymap);
      }
      remapWait = null; renderKeymap(); return;
    }
    if (controlsOpen) { if (e.code === 'Escape') { e.preventDefault(); closeControls(); } return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    var a = actFor(e.code) || (e.code === 'Escape' ? 'pause' : null);
    if (a || e.code === 'Enter') e.preventDefault();
    if (e.repeat) return;
    if (state === 'title') { if (a === 'strike' || e.code === 'Enter') startGame(); return; }
    if (a === 'pause') { if (inPlay()) setPaused(!paused); return; }
    if (paused) { if (e.code === 'Enter' || a === 'strike') setPaused(false); return; }
    if (a) press(a);
    else if (e.code === 'Enter') press('strike', true);
  });

  // touch pad
  function useTouch() { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); setTimeout(resize, 30); } }
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) useTouch();
  window.addEventListener('touchstart', useTouch, { passive: true });
  Array.prototype.forEach.call(document.querySelectorAll('#pad .pb'), function (b) {
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); AU.init(); b.classList.add('on');
      var a = b.getAttribute('data-act');
      if (splashOpen() || controlsOpen) return;
      if (state === 'title') { if (a === 'strike') startGame(); return; }
      if (paused) { setPaused(false); return; }
      press(a);
    });
    var off = function () { b.classList.remove('on'); };
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  cv.addEventListener('pointerdown', function () {
    AU.init();
    if (state === 'intro' || state === 'clear' || state === 'victory') press('strike', true);
  });

  // gamepad
  var gpPrev = {};
  function pollPad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i]; if (!p) continue;
      var b = function (n) { return !!(p.buttons[n] && p.buttons[n].pressed); }, ax = p.axes || [];
      var cur = { up: b(12) || ax[1] < -0.6, down: b(13) || ax[1] > 0.6, left: b(14) || ax[0] < -0.6, right: b(15) || ax[0] > 0.6, strike: b(0) || b(1) || b(2) || b(3), pause: b(9) };
      for (var a in cur) if (cur[a] && !gpPrev[a]) padAct(a);
      gpPrev = cur; return;
    }
  }
  function padAct(a) {
    if (splashOpen()) { if (a === 'strike' || a === 'pause') { var c = document.querySelector('#scout-splash .sp-cont'); if (c) c.click(); } return; }
    if (controlsOpen) { if (a === 'pause' || a === 'strike') closeControls(); return; }
    if (state === 'title') { if (a === 'strike' || a === 'pause') startGame(); return; }
    if (a === 'pause') { if (inPlay()) setPaused(!paused); return; }
    if (paused) { if (a === 'strike') setPaused(false); return; }
    press(a);
  }

  document.addEventListener('visibilitychange', function () { if (document.hidden && inPlay() && !paused) setPaused(true); });

  // ---------- game state ----------
  var PLAY_STATES = { intro: 1, approach: 1, prompt: 1, out: 1, clear: 1, victory: 1 };
  var state = 'title', paused = false, T = 0, gt = 0;
  var G = { scene: 0, beat: 0, lives: 5, score: 0, rescued: 0, lastScene: 0 };
  var SS = { rescued: [], t: 0, water: 0, broken: 0 };
  var B = null;
  var parts = [], pops = [];
  var fx = { shake: 0, flash: 0, flashCol: '255,255,255', kick: 0, failWord: '', failT: -9 };
  var cam = { x: 0, y: 0, z: 1 };
  var autoplay = false, OUT_IMPACT = 0.32;
  var scout = { x: CX, tx: CX, jy: 0, jt: -1, jh: 170, hang: 0, lift: 0, fall: -1, pose: 'idle', hold: 0, cur: null, hitT: -9, walkPh: 0, sx: 1, sy: 1, landT: -9, hair: 0, hem: 0, leanV: 0, prevX: CX, atkT: -9 };

  function inPlay() { return !!PLAY_STATES[state] && !splashOpen(); }
  function setPaused(p) {
    if (p && !inPlay()) return;
    paused = !!p;
    elPause.classList.toggle('show', paused);
    AU.pause(paused);
    if (paused) $('btn-resume').focus({ preventScroll: true });
    else cv.focus && cv.blur();
  }
  function sideSign(s) { return s === 'L' ? -1 : s === 'R' ? 1 : 0; }
  function scene() { return SCENES[G.scene]; }

  function startGame(fromScene) {
    if (state !== 'title') return;
    elTitle.classList.remove('show');
    G.lives = 5; G.score = 0; G.rescued = 0;
    startScene(fromScene || 0);
  }
  function toTitle(msg) {
    state = 'title'; paused = false; elPause.classList.remove('show');
    elTitle.classList.add('show');
    $('title-msg').textContent = msg || '10 scenes. One rebel AI. Hit the cue in time.';
    $('hi').textContent = hi;
    var c = $('btn-continue');
    if (G.lastScene > 0 && !msg.match(/beat/)) {
      if (!c) {
        c = document.createElement('button'); c.type = 'button'; c.id = 'btn-continue';
        c.addEventListener('click', function () { AU.init(); startGame(G.lastScene); });
        $('btn-start').insertAdjacentElement('afterend', c);
      }
      c.innerHTML = 'Continue scene ' + (G.lastScene + 1) + ' <small>(C)</small>';
      c.style.display = '';
    } else if (c) c.style.display = 'none';
    AU.music('title');
    setTimeout(function () { $('btn-start').focus({ preventScroll: true }); }, 30);
  }
  window.addEventListener('keydown', function (e) {
    if (state === 'title' && e.code === 'KeyC' && !controlsOpen && !splashOpen() && G.lastScene > 0 && $('btn-continue') && $('btn-continue').style.display !== 'none') startGame(G.lastScene);
  });

  function startScene(i) {
    G.scene = i; G.beat = 0;
    SS = { rescued: [], t: 0, water: 0, broken: 0 };
    parts.length = 0; pops.length = 0;
    resetScout();
    state = 'intro'; T = 0; B = null;
    cam.x = 0; cam.y = 0; cam.z = 1.12;
    AU.music('tense', { tempo: 122 + i * 3, intensity: i >= 7 ? 1 : 0, restart: true });
    AU.play('alarm');
  }
  function resetScout() {
    scout.x = scout.tx = CX; scout.jy = 0; scout.jt = -1; scout.hang = 0; scout.lift = 0; scout.fall = -1; scout.pose = 'ready'; scout.hold = 0; scout.walkPh = 0; scout.sx = scout.sy = 1; scout.landT = -9; scout.hair = 0; scout.hem = 0; scout.leanV = 0; scout.prevX = CX; scout.atkT = -9;
  }
  function startBeat(retry) {
    var d = scene().beats[G.beat];
    B = { d: d, S: sideSign(d.side), p: 0, out: null, q: 0, impact: false, retry: !!retry, won: false,
      dur: D.approachFor(G.scene, retry), win: D.windowFor(G.scene), seed: Math.random(), rt: 0 };
    resetScout();
    state = 'approach'; T = 0;
    if (THREATS[d.t].start) THREATS[d.t].start(B);
  }
  function press(a, soft) {
    if (paused) return;
    if (state === 'intro') { if (T > 0.35) startBeat(false); return; }
    if (state === 'clear') { if (T > 0.8) toSplash(); return; }
    if (state === 'victory') { if (T > 2.2) finishVictory(); return; }
    if (state === 'prompt' && !soft) resolve(a === B.d.k);
  }
  function resolve(ok) {
    state = 'out'; B.rt = T; T = 0; B.out = ok ? 'win' : 'lose'; B.won = ok;
    if (ok) {
      var gain = Math.round((100 + 200 * clamp(1 - B.rt / B.win, 0, 1)) * (1 + G.scene * 0.15) / 10) * 10;
      G.score += gain;
      var perfect = B.rt < B.win * 0.33;
      pop(perfect ? 'PERFECT +' + gain : '+' + gain, CX, 330, perfect ? '#ffd27a' : '#6ffbea');
      act(B.d.k);
    } else {
      AU.play('whoosh');
    }
  }
  function act(k) {
    var t = B.d.t, s = B.S;
    if (k === 'left' || k === 'right') { scout.tx = CX + (k === 'left' ? -150 : 150); scout.pose = k === 'left' ? 'dodgeL' : 'dodgeR'; scout.hold = 0.45; AU.play('whoosh'); }
    else if (k === 'up') {
      scout.jt = 0; scout.jh = t === 'water' ? 250 : t === 'gap' ? 190 : 170; scout.hang = t === 'water' ? 0.75 : t === 'gap' ? 0.1 : 0.12;
      if (t === 'gap') scout.tx = CX + 150;
      scout.pose = 'jump'; AU.play('jump');
    } else if (k === 'down') { scout.pose = 'duck'; scout.hold = 0.8; AU.play('whoosh'); }
    else if (k === 'strike') {
      scout.atkT = 0;
      if (t === 'captive') { scout.tx = CX + s * 80; scout.pose = s < 0 ? 'punchL' : 'punchR'; scout.jt = 0; scout.jh = 70; scout.hang = 0.15; }
      else if (t === 'core' || (t === 'arm' && B.d.side === 'T')) { scout.pose = 'punchU'; scout.jt = 0; scout.jh = t === 'core' ? 230 : 90; scout.hang = 0.2; }
      else if (t === 'drone' || t === 'hound') scout.pose = 'kick';
      else if (s < 0) scout.pose = 'punchL';
      else scout.pose = 'punchR';
      if (t === 'drone' && B.d.side === 'F') { scout.jt = 0; scout.jh = 60; scout.hang = 0.1; }
      AU.play('punch');
    }
  }
  function impact() {
    B.impact = true;
    var th = THREATS[B.d.t];
    if (!B.won) {
      scout.pose = 'hit'; scout.hitT = gt;
      fx.flash = 0.75; fx.flashCol = '255,40,40'; fx.shake = Math.max(fx.shake, 16); fx.kick = 0.08;
      fx.failWord = B.d.fail; fx.failT = gt;
      G.lives--;
      AU.play('fail');
    } else {
      fx.kick = Math.max(fx.kick, 0.05);
    }
    if (th.impact) th.impact(B, B.won);
  }
  function beatDone() {
    G.beat++;
    if (G.beat >= scene().beats.length) sceneClear();
    else startBeat(false);
  }
  function afterFail() {
    if (G.lives <= 0) gameOver();
    else startBeat(true);
  }
  function saveHi() {
    if (G.score > hi) { hi = G.score; store.set('scoutLair.hi', hi); }
    $('hi').textContent = hi;
  }
  function sceneClear() {
    G.score += 500 + G.lives * 50;
    saveHi();
    resetScout(); scout.pose = 'cheer';
    if (scene().ending) { startVictory(); return; }
    state = 'clear'; T = 0;
    AU.play('clear');
  }
  function splash(o) {
    state = 'splash';
    if (window.ScoutSplash && window.ScoutSplash.show) {
      window.ScoutSplash.show({ kind: 'scout-lair', campaign: 'scout-lair', tag: o.tag, title: o.title, sub: o.sub, contLabel: o.cont,
        accent: '#40f0dc', glow: 'rgba(64,240,220,.25)', onContinue: o.next });
    } else o.next();
  }
  function toSplash() {
    var n = G.scene + 1;
    splash({ tag: 'scene' + n, title: 'SCENE ' + n + ' CLEARED', sub: scene().name + ' \u2022 Score ' + G.score, cont: 'Next scene',
      next: function () { startScene(G.scene + 1); } });
  }
  function startVictory() {
    state = 'victory'; T = 0;
    AU.music('victory', { restart: true });
    AU.play('boom');
    fx.flash = 1; fx.flashCol = '255,240,200';
    G.lastScene = 0;
  }
  function finishVictory() {
    saveHi();
    splash({ tag: 'scene10', title: 'THE MACHINE IS DOWN', sub: 'All 10 scenes cleared \u2022 Final score ' + G.score, cont: 'Title screen',
      next: function () { toTitle('You beat The Machine! Final score ' + G.score + '.'); } });
  }
  function gameOver() {
    saveHi();
    G.lastScene = G.scene;
    AU.music('off');
    var n = G.scene + 1;
    splash({ tag: 'gameover', title: 'GAME OVER', sub: 'Scene ' + n + ' \u2022 ' + scene().name + ' \u2022 Score ' + G.score, cont: 'Title screen',
      next: function () { toTitle('The Machine won this round (scene ' + n + '). Score ' + G.score + '.'); } });
  }

  // ---------- particles ----------
  function P(o) { parts.push(o); if (parts.length > 700) parts.shift(); return o; }
  function sparks(x, y, n, col) {
    for (var i = 0; i < n; i++) { var a = rnd(0, TAU), v = rnd(150, 650); P({ k: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rnd(0.25, 0.6), t: 0, col: col || (Math.random() < 0.5 ? '#ffe28a' : '#ff9a3c') }); }
  }
  function smoke(x, y, n, col) {
    for (var i = 0; i < n; i++) P({ k: 'smoke', x: x + rnd(-20, 20), y: y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-90, -20), life: rnd(0.8, 1.6), t: 0, r: rnd(14, 30), col: col || '60,64,72' });
  }
  function debris(x, y, n, col) {
    for (var i = 0; i < n; i++) { var a = rnd(PI * 1.05, PI * 1.95), v = rnd(200, 600); P({ k: 'deb', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.8, 1.4), t: 0, s: rnd(6, 18), rot: rnd(0, TAU), vr: rnd(-12, 12), col: col || (Math.random() < 0.5 ? '#8c96a2' : '#4a525e') }); }
  }
  function droplets(x, y, n) {
    for (var i = 0; i < n; i++) { var a = rnd(PI * 1.1, PI * 1.9), v = rnd(150, 520); P({ k: 'drop', x: x + rnd(-30, 30), y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.6, 1.1), t: 0, r: rnd(2, 6) }); }
  }
  function paper(x, y, n) {
    for (var i = 0; i < n; i++) P({ k: 'paper', x: x + rnd(-40, 40), y: y, vx: rnd(-160, 160), vy: rnd(-380, -120), life: rnd(1.2, 2), t: 0, s: rnd(5, 12), rot: rnd(0, TAU), vr: rnd(-8, 8) });
  }
  function pop(text, x, y, col) { pops.push({ text: text, x: x, y: y, t: 0, col: col || '#fff' }); }
  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'spark' || p.k === 'deb' || p.k === 'drop') p.vy += 1100 * dt;
      else if (p.k === 'paper') { p.vy += 260 * dt; p.vx *= 0.98; p.vy = Math.min(p.vy, 90); p.x += Math.sin(p.t * 6 + p.rot) * 40 * dt; }
      else if (p.k === 'smoke') { p.vx *= 0.98; p.r += 18 * dt; }
      else if (p.k === 'ember') { p.vy -= 20 * dt; }
      if (p.rot != null) p.rot += (p.vr || 0) * dt;
      if ((p.k === 'deb' || p.k === 'drop') && p.y > FLOOR + 40 && p.vy > 0) { p.vy *= -0.3; p.vx *= 0.6; if (p.k === 'drop') p.life = Math.min(p.life, p.t + 0.1); }
    }
    for (var j = pops.length - 1; j >= 0; j--) { pops[j].t += dt; if (pops[j].t > 1.1) pops.splice(j, 1); }
  }
  function drawParts() {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], a = 1 - p.t / p.life;
      if (p.k === 'spark') {
        ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.k === 'smoke') {
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = 'rgb(' + p.col + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.k === 'deb' || p.k === 'paper') {
        ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.k === 'paper' ? '#f1efe6' : p.col;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.k === 'paper') { ctx.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2); ctx.fillStyle = '#9aa'; ctx.fillRect(-p.s * 0.7, -p.s * 0.3, p.s * 1.4, 1.5); ctx.fillRect(-p.s * 0.7, p.s * 0.1, p.s, 1.5); }
        else { ctx.beginPath(); ctx.moveTo(-p.s, -p.s * 0.5); ctx.lineTo(p.s * 0.8, -p.s * 0.7); ctx.lineTo(p.s, p.s * 0.6); ctx.lineTo(-p.s * 0.6, p.s * 0.5); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      } else if (p.k === 'drop') {
        ctx.globalAlpha = a; ctx.fillStyle = '#9fe3ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.k === 'ember') {
        ctx.globalAlpha = a; ctx.fillStyle = p.col || '#ffb347';
        ctx.fillRect(p.x, p.y, p.r || 3, p.r || 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- drawing helpers ----------
  function rrect(x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function glow(x, y, r, col, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col + ',' + (a == null ? 0.6 : a) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function line(x0, y0, x1, y1, col, lw) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  // ---------- figures ----------
  var POSES = {
    idle: { lean: 0.02, lh: -0.14, lk: 0.18, rh: 0.16, rk: -0.12, ls: -0.45, le: -2.45, rs: 0.42, re: 2.4 },
    ready: { lean: 0.04, lh: -0.38, lk: 0.62, rh: 0.36, rk: -0.58, ls: -0.62, le: -2.2, rs: 0.58, re: 2.15 },
    run: { lean: 0.12, lh: -0.55, lk: 0.95, rh: 0.5, rk: -0.25, ls: -0.85, le: -1.55, rs: 0.7, re: 1.7 },
    punchR: { lean: 0.28, lh: -0.5, lk: 0.55, rh: 0.22, rk: -0.12, ls: -0.55, le: -2.35, rs: 1.72, re: -0.15 },
    punchL: { lean: -0.28, lh: -0.22, lk: 0.12, rh: 0.5, rk: -0.55, ls: -1.72, le: 0.15, rs: 0.55, re: 2.35 },
    punchU: { lean: -0.05, lh: -0.4, lk: 0.55, rh: 0.28, rk: -0.2, ls: -0.7, le: -2.1, rs: 2.95, re: -0.05 },
    kick: { lean: -0.42, lh: -0.2, lk: 0.15, rh: 1.65, rk: -0.15, ls: -1.15, le: -1.35, rs: 0.35, re: 2.05 },
    jump: { lean: 0.05, lh: -0.7, lk: 1.45, rh: 0.65, rk: -1.4, ls: -2.65, le: 0.45, rs: 2.65, re: -0.45 },
    duck: { lean: 0.08, lh: -1.25, lk: 2.2, rh: 1.2, rk: -2.15, ls: -2.75, le: -0.75, rs: 2.75, re: 0.75 },
    dodgeL: { lean: -0.48, lh: -0.78, lk: 0.7, rh: 0.2, rk: 0.05, ls: -1.45, le: -0.55, rs: 0.95, re: 1.45 },
    dodgeR: { lean: 0.48, lh: -0.2, lk: -0.05, rh: 0.78, rk: -0.7, ls: -0.95, le: -1.45, rs: 1.45, re: 0.55 },
    hit: { lean: 0.55, lh: -0.2, lk: 0.55, rh: 0.55, rk: -0.2, ls: -2.45, le: -0.35, rs: 2.05, re: 0.55 },
    cheer: { lean: -0.04, lh: -0.2, lk: 0.2, rh: 0.2, rk: -0.15, ls: -0.55, le: -2.35, rs: 3.05, re: -0.05 },
    held: { lean: 0, lh: -0.1, lk: 0.3, rh: 0.15, rk: -0.35, ls: -2.75, le: -0.2, rs: 2.75, re: 0.2 },
    stand: { lean: 0, lh: -0.08, lk: 0, rh: 0.08, rk: 0, ls: -0.15, le: -0.2, rs: 0.15, re: 0.2 },
    wave: { lean: 0, lh: -0.08, lk: 0, rh: 0.08, rk: 0, ls: -0.15, le: -0.2, rs: 2.5, re: 0.5 },
    windR: { lean: -0.22, lh: -0.45, lk: 0.7, rh: 0.4, rk: -0.35, ls: -0.35, le: -2.4, rs: -0.55, re: -2.1 },
    windL: { lean: 0.22, lh: -0.4, lk: 0.35, rh: 0.45, rk: -0.7, ls: 0.55, le: 2.1, rs: 0.35, re: 2.4 },
    windK: { lean: 0.2, lh: -0.55, lk: 1.1, rh: 0.35, rk: -0.25, ls: -0.7, le: -2.0, rs: 0.9, re: 1.6 },
    land: { lean: 0.06, lh: -0.95, lk: 1.7, rh: 0.95, rk: -1.7, ls: -1.8, le: -1.4, rs: 1.8, re: 1.4 }
  };
  var JOINTS = ['lean', 'lh', 'lk', 'rh', 'rk', 'ls', 'le', 'rs', 're'];
  var SCOUT_LOOK = { pants: '#2f5288', pantsD: '#132541', shoe: '#f4f4f0', shoeA: '#2a2a2a', jacket: '#6e3f22', jacketL: '#93592f', jacketD: '#3a1f10', tee: '#121214', skin: '#ebb995', head: 'scout' };
  var OLD_LOOKS = [
    { pants: '#4a443d', pantsD: '#211e1a', shoe: '#2c241e', shoeA: '#5a4a3a', jacket: '#5d4a37', jacketL: '#7a644c', jacketD: '#2c2219', tee: '#d6ccb2', skin: '#deae8c', head: 'old', hair: '#cfd3d6' },
    { pants: '#38404a', pantsD: '#1a1e24', shoe: '#2c241e', shoeA: '#5a4a3a', jacket: '#6a4b30', jacketL: '#8a6544', jacketD: '#33231a', tee: '#e3ddd0', skin: '#d9a585', head: 'old', hair: '#e2e4e6' }
  ];
  function mixPose(cur, target, k) {
    for (var i = 0; i < JOINTS.length; i++) { var j = JOINTS[i]; cur[j] += (target[j] - cur[j]) * k; }
  }
  function copyPose(p) { var o = {}; JOINTS.forEach(function (j) { o[j] = p[j]; }); return o; }

  function limb(x0, y0, a1, l1, a2, l2, w, col, dark) {
    var x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1;
    var x2 = x1 + Math.sin(a1 + a2) * l2, y2 = y1 + Math.cos(a1 + a2) * l2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Outer outline
    ctx.strokeStyle = dark; ctx.lineWidth = w + 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Thigh / upper thicker, shin / forearm tapers — reads as weight, not flat sticks.
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.lineWidth = w * 0.72;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    circle(x1, y1, w * 0.28, dark);
    return [x2, y2, a1 + a2];
  }
  // Draws a figure with feet at (x, y). P is a pose; L the look.
  function drawFigure(x, y, sc, P, L, opt) {
    opt = opt || {};
    var sx = opt.sx == null ? 1 : opt.sx, sy = opt.sy == null ? 1 : opt.sy;
    var hem = opt.hem || 0, hair = opt.hair || 0;
    var lv = 72 * Math.cos(P.lh) + 70 * Math.cos(P.lh + P.lk), rv = 72 * Math.cos(P.rh) + 70 * Math.cos(P.rh + P.rk);
    var hipY = -Math.max(lv, rv, 50);
    ctx.save();
    if (!opt.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 44 * sc * Math.max(0.4, sx) * Math.max(0.4, 1 - (opt.jy || 0) / 400), 9 * sc * sy, 0, 0, TAU); ctx.fill(); }
    ctx.translate(x, y - (opt.jy || 0)); ctx.scale(sc * sx, sc * sy);
    if (opt.rot) ctx.rotate(opt.rot);
    ctx.translate(0, hipY);
    // legs
    [[-10, P.lh, P.lk, -1], [10, P.rh, P.rk, 1]].forEach(function (lg) {
      var e = limb(lg[0], 0, lg[1], 72, lg[2], 70, 21, L.pants, L.pantsD);
      ctx.save(); ctx.translate(e[0], e[1]);
      ctx.fillStyle = L.shoe; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(lg[3] * 6, 2, 16, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = L.shoeA; ctx.fillRect(lg[3] * 6 - 9, 5, 18, 3);
      ctx.restore();
    });
    ctx.rotate(P.lean);
    // torso
    poly([-21, 2, 21, 2, 25, -86, -25, -86], L.tee, '#050505', 2);
    ctx.fillStyle = L.pants; ctx.fillRect(-21, -6, 42, 10);
    if (L.head === 'scout') glow(0, -110, 90, '64,240,220', 0.12);
    [-1, 1].forEach(function (s) {
      var jg = ctx.createLinearGradient(s * 29, 0, s * 7, 0); jg.addColorStop(0, L.jacketD); jg.addColorStop(0.35, L.jacket); jg.addColorStop(1, L.jacketL);
      poly([s * 27, 6, s * 8, 6, s * 7, -50, s * 15, -78, s * 11, -90, s * 29, -88], jg, L.jacketD, 2.5);
      // Jacket hem flap — secondary motion from lean / run.
      var flap = 6 + hem * s * 10 + P.lean * s * 8;
      poly([s * 27, 6, s * 8, 6, s * 10, 18 + Math.abs(hem) * 6, s * (30 + flap * 0.15), 14 + Math.abs(hem) * 4], L.jacket, L.jacketD, 1.5);
      if (L.head === 'scout') { line(s * 20, -40, s * 13, -30, '#c9c9c9', 1.5); line(s * 24, -70, s * 18, -62, L.jacketD, 1.5); }
      poly([s * 7, -50, s * 15, -78, s * 11, -90, s * 5, -84], L.jacketL, L.jacketD, 1.5);
      line(s * 9, 4, s * 8, -48, L.head === 'scout' ? '#c9c9c9' : L.jacketD, 1.5);
    });
    // arms
    var arms = [[-25, P.ls, P.le], [25, P.rs, P.re]];
    arms.forEach(function (ar) {
      var e = limb(ar[0], -82, ar[1], 50, ar[2], 46, 16, L.jacket, L.jacketD);
      circle(e[0] + Math.sin(e[2]) * 4, e[1] + Math.cos(e[2]) * 4, 8.5, L.skin);
    });
    // head
    ctx.fillStyle = L.skin; ctx.fillRect(-6, -101, 12, 16);
    if (L.head === 'scout') drawScoutHead(opt); else drawOldHead(L, opt);
    ctx.restore();
  }
  function drawScoutHead(opt) {
    var hair = '#131a2b', hx = (opt && opt.hair) || 0;
    ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(hx * 0.4, -127, 27, 27, 0, 0, TAU); ctx.fill();
    rrect(-28 + hx * 0.3, -128, 56, 30, 9); ctx.fill();
    ctx.fillStyle = '#ebb995'; ctx.beginPath(); ctx.ellipse(0, -120, 18.5, 23, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-25 + hx, -122); ctx.quadraticCurveTo(-23 + hx * 0.6, -153, hx * 0.3, -151); ctx.quadraticCurveTo(25 + hx * 0.6, -151, 26 + hx, -120);
    ctx.lineTo(19 + hx * 0.5, -131); ctx.lineTo(9, -127); ctx.lineTo(hx * 0.2, -134); ctx.lineTo(-9, -128); ctx.lineTo(-18 + hx * 0.4, -133); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2d3f6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14 + hx * 0.3, -146); ctx.quadraticCurveTo(2 + hx * 0.2, -151, 16 + hx * 0.3, -143); ctx.stroke();
    // Side locks — lag behind lean for secondary motion.
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-27, -118); ctx.quadraticCurveTo(-30 - hx * 1.4, -100, -22 - hx * 1.8, -94); ctx.lineTo(-17 - hx, -104); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(27, -118); ctx.quadraticCurveTo(30 - hx * 1.4, -100, 22 - hx * 1.8, -94); ctx.lineTo(17 - hx, -104); ctx.closePath(); ctx.fill();
    line(-22, -130, -24 - hx * 0.5, -108, '#2d3f6e', 1.5); line(22, -130, 24 - hx * 0.5, -108, '#2d3f6e', 1.5);
    // glasses + glowing eyes
    ctx.fillStyle = 'rgba(70,240,220,.3)'; ctx.fillRect(-17, -127, 14, 10); ctx.fillRect(3, -127, 14, 10);
    ctx.shadowColor = '#40f0dc'; ctx.shadowBlur = 12;
    circle(-10, -122, 2.8, '#8ffff2'); circle(10, -122, 2.8, '#8ffff2');
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#050505'; ctx.lineWidth = 3; ctx.strokeRect(-17, -127, 14, 10); ctx.strokeRect(3, -127, 14, 10);
    line(-3, -123, 3, -123, '#050505', 2);
    if (opt && opt.shout) { ctx.fillStyle = '#5a1a1a'; ctx.beginPath(); ctx.ellipse(0, -107, 4.5, 3.5, 0, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = '#8a3b3b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -108); ctx.quadraticCurveTo(0, (opt && opt.smile) ? -105 : -107, 5, -108); ctx.stroke(); }
  }
  function drawOldHead(L, opt) {
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(0, -121, 19, 24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = L.hair;
    ctx.beginPath(); ctx.ellipse(-18, -119, 7, 13, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, -119, 7, 13, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, -134); ctx.quadraticCurveTo(-6, -152, 2, -146); ctx.quadraticCurveTo(10, -153, 16, -134); ctx.quadraticCurveTo(0, -140, -16, -134); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,30,.5)'; ctx.lineWidth = 1.2;
    line(-8, -136, 6, -137, 'rgba(90,50,30,.5)', 1.2); line(-6, -132, 8, -133, 'rgba(90,50,30,.45)', 1.2);
    line(-13, -127, -4, -126, L.hair, 3); line(4, -126, 13, -127, L.hair, 3);
    circle(-8, -121, 2, '#2a2020'); circle(8, -121, 2, '#2a2020');
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(0, -109, 9, 3.5, 0, 0, TAU); ctx.fill();
    if (opt.shout) { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.ellipse(0, -104, 4, 3, 0, 0, TAU); ctx.fill(); }
  }
  function drawOld(x, y, sc, pose, idx, opt) {
    var p = copyPose(POSES[pose] || POSES.stand), w = gt * 6 + idx * 2;
    if (pose === 'held') { p.lh += Math.sin(w) * 0.35; p.rh -= Math.sin(w) * 0.35; p.ls += Math.sin(w * 0.7) * 0.15; }
    if (pose === 'wave') { p.re = 0.5 + Math.sin(w * 1.4) * 0.5; }
    drawFigure(x, y, sc, p, OLD_LOOKS[idx % 2], opt);
  }
  function drawGhost(x, y, sc, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.shadowColor = '#ffae42'; ctx.shadowBlur = 24; ctx.fillStyle = 'rgba(255,170,70,.75)';
    circle(0, -150, 16, 'rgba(255,170,70,.75)');
    rrect(-24, -130, 48, 80, 16); ctx.fill();
    rrect(-20, -60, 16, 60, 8); ctx.fill(); rrect(4, -60, 16, 60, 8); ctx.fill();
    ctx.shadowBlur = 0; circle(-6, -152, 2.5, '#fff6d8'); circle(6, -152, 2.5, '#fff6d8');
    ctx.restore();
  }

  // ---------- robots ----------
  function seg(x0, y0, x1, y1, w) {
    var l = Math.hypot(x1 - x0, y1 - y0);
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    var g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    g.addColorStop(0, '#c7d0da'); g.addColorStop(0.45, '#7b8692'); g.addColorStop(1, '#2c333c');
    ctx.fillStyle = g; rrect(-w * 0.3, -w / 2, l + w * 0.6, w, w * 0.35); ctx.fill();
    ctx.strokeStyle = '#11151a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#262c34'; ctx.fillRect(l * 0.2, -w * 0.2, l * 0.6, w * 0.4);
    ctx.fillStyle = '#dfe7ee'; ctx.fillRect(l * 0.24, -w * 0.07, l * 0.5, w * 0.14);
    circle(l * 0.1, -w * 0.3, 2, '#1b1f25'); circle(l * 0.9, w * 0.3, 2, '#1b1f25');
    ctx.restore();
  }
  function joint(x, y, r, led) {
    circle(x, y, r, '#3a424c'); circle(x, y, r * 0.65, '#8d98a4');
    if (led) { ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 10; circle(x, y, r * 0.28, '#ff3a3a'); ctx.shadowBlur = 0; }
  }
  function claw(x, y, a, grip, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(sc, sc);
    rrect(-6, -15, 28, 30, 6); ctx.fillStyle = '#59636e'; ctx.fill(); ctx.strokeStyle = '#11151a'; ctx.lineWidth = 2; ctx.stroke();
    var open = 0.15 + 0.85 * (1 - grip);
    [-1, 1, 0].forEach(function (s) {
      var a1 = s === 0 ? 0 : s * open, a2 = s === 0 ? 0 : -s * (0.5 + 0.6 * grip);
      var len = s === 0 ? 22 : 30;
      var px = 20, py = s * 10;
      var x1 = px + Math.cos(a1) * len, y1 = py + Math.sin(a1) * len;
      var x2 = x1 + Math.cos(a1 + a2) * 22, y2 = y1 + Math.sin(a1 + a2) * 22;
      if (s === 0 && grip > 0.5) return;
      ctx.lineCap = 'round'; ctx.strokeStyle = '#161a20'; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#a9b4bf'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      circle(x1, y1, 4, '#3a424c');
    });
    ctx.restore();
  }
  // Two-link robot arm from a wall mount (bx,by) reaching for (tx,ty).
  function drawArm(bx, by, tx, ty, o) {
    o = o || {};
    var sc = o.sc || 1, L1 = (o.L1 || 200) * sc, L2 = (o.L2 || 180) * sc, bend = o.bend || 1;
    var dx = tx - bx, dy = ty - by, d = Math.hypot(dx, dy);
    var dd = clamp(d, Math.abs(L1 - L2) + 1, L1 + L2 - 1);
    var a = Math.atan2(dy, dx), b = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    var ex = bx + Math.cos(a + bend * b) * L1, ey = by + Math.sin(a + bend * b) * L1;
    var wa = Math.atan2(ty - ey, tx - ex), wx = ex + Math.cos(wa) * L2, wy = ey + Math.sin(wa) * L2;
    if (!o.noBase) { circle(bx, by, 34 * sc, '#1d232b'); circle(bx, by, 24 * sc, '#4a535e'); }
    seg(bx, by, ex, ey, 28 * sc);
    if (!o.stump) { seg(ex, ey, wx, wy, 21 * sc); claw(wx, wy, wa, o.grip || 0, sc); }
    else { sparksAt(ex, ey); }
    joint(bx, by, 16 * sc, false); joint(ex, ey, 15 * sc, true);
    return { ex: ex, ey: ey, wx: wx, wy: wy };
  }
  var lastSpark = 0;
  function sparksAt(x, y) { if (gt - lastSpark > 0.08) { lastSpark = gt; sparks(x, y, 3); } }

  function drawDrone(x, y, sc, o) {
    o = o || {};
    var tilt = o.tilt || 0, bank = o.bank || 0, hover = o.hover || 0;
    ctx.save(); ctx.translate(x, y + hover); ctx.rotate(tilt + bank); ctx.scale(sc, sc);
    ctx.strokeStyle = '#22272e'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    line(-18, -6, -54, -14, '#22272e', 8); line(18, -6, 54, -14, '#22272e', 8);
    [-54, 54].forEach(function (rx) {
      ctx.fillStyle = 'rgba(170,185,200,.35)'; ctx.beginPath(); ctx.ellipse(rx, -20, 30, 5, 0, 0, TAU); ctx.fill();
      var sp = gt * 50 + rx;
      line(rx - Math.cos(sp) * 28, -20, rx + Math.cos(sp) * 28, -20, '#cfd8e0', 2.5);
      circle(rx, -17, 5, '#2b3138');
    });
    var g = ctx.createLinearGradient(0, -22, 0, 22); g.addColorStop(0, '#6c7682'); g.addColorStop(1, '#1b1f25');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 42, 21, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#0c0f13'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#11151a'; ctx.beginPath(); ctx.ellipse(0, 4, 22, 13, 0, 0, TAU); ctx.fill();
    var e = o.eye == null ? 0.6 : o.eye;
    ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 10 + 25 * e; circle(0, 4, 7 + 4 * e, 'rgb(255,' + Math.round(60 - 40 * e) + ',40)'); ctx.shadowBlur = 0;
    circle(-2, 2, 2.5, '#ffd0d0');
    line(-10, 20, -14, 32, '#22272e', 3); line(10, 20, 14, 32, '#22272e', 3);
    // Exhaust wash — small downward puff so hover reads as thrust, not a sine bob alone.
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#9ad0ff'; ctx.beginPath(); ctx.ellipse(0, 28 + Math.abs(hover) * 0.2, 10, 4, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawBot(x, y, sc, o) {
    o = o || {};
    var walk = o.walk || 0, sw = o.swing || 0, recoil = o.recoil || 0, dead = o.dead || 0;
    // Discrete footfalls: body drops on plant instead of a constant sine bob.
    var step = Math.sin(walk), plant = Math.abs(step) < 0.22 ? 1 : 0;
    var bob = Math.abs(Math.cos(walk)) * 5 + plant * 3;
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 4 + bob, 60, 10, 0, 0, TAU); ctx.fill();
    if (o.rot || dead) { ctx.translate(0, -150); ctx.rotate((o.rot || 0) + dead * 1.1); ctx.translate(0, 150); }
    [-1, 1].forEach(function (s) {
      var ph = walk + (s > 0 ? Math.PI : 0);
      var k = Math.sin(ph) * 18;
      var lift = Math.max(0, Math.sin(ph)) * 10;
      ctx.fillStyle = '#2d343d'; rrect(s * 22 - 13, -150 + Math.max(0, k * 0.35) - lift, 26, 76, 6); ctx.fill();
      ctx.fillStyle = '#4a535e'; rrect(s * 22 - 12, -78 - lift * 0.3, 24, 72 - Math.max(0, k * 0.5), 6); ctx.fill();
      ctx.fillStyle = '#1a1e24'; rrect(s * 22 - 17, -10 - Math.max(0, k) + (plant && Math.sin(ph) > 0 ? 2 : 0), 34, 12, 4); ctx.fill();
      joint(s * 22, -78, 9, false);
    });
    var g = ctx.createLinearGradient(-50, 0, 50, 0); g.addColorStop(0, '#2a3038'); g.addColorStop(0.5, '#68737f'); g.addColorStop(1, '#22282f');
    poly([-50, -258, 50, -258, 38, -148, -38, -148], g, '#0e1115', 2.5);
    poly([-30, -240, 30, -240, 24, -190, -24, -190], '#3b434d', '#0e1115', 1.5);
    ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 14; circle(0, -215, 8, '#ff3a3a'); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd34d'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('HR-9', 0, -165);
    // left arm counter-sway
    joint(-52, -248, 13, false);
    ctx.save(); ctx.translate(-52, -248); ctx.rotate(0.15 + Math.sin(walk) * 0.14 - recoil * 0.2); seg(0, 0, 0, 100, 20); claw(0, 108, Math.PI / 2, 0.7, 0.7); ctx.restore();
    // baton arm — wind-up then slam via swipeCurve-fed swing
    var a = lerp(-2.85, -0.35, clamp(sw, 0, 1)) - recoil * 0.5;
    joint(52, -248, 13, false);
    ctx.save(); ctx.translate(52, -248); ctx.rotate(a + Math.PI / 2);
    seg(0, 0, 0, 90, 20);
    ctx.translate(0, 96);
    ctx.fillStyle = '#15191e'; ctx.fillRect(-6, -6, 12, 110);
    ctx.shadowColor = '#5ad8ff'; ctx.shadowBlur = 16; ctx.fillStyle = '#7fe6ff'; ctx.fillRect(-3, 40, 6, 66); ctx.shadowBlur = 0;
    ctx.restore();
    // faceless head
    var hg = ctx.createLinearGradient(0, -322, 0, -262); hg.addColorStop(0, '#87929e'); hg.addColorStop(1, '#2a3038');
    ctx.fillStyle = hg; rrect(-30, -324, 60, 62, 18); ctx.fill(); ctx.strokeStyle = '#0e1115'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0a0c10'; rrect(-24, -300, 48, 12, 6); ctx.fill();
    var sx = Math.sin(gt * 3.2) * 14;
    ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff3b3b'; rrect(sx - 7, -298, 14, 8, 4); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
  }
  function drawHound(x, y, sc, o) {
    o = o || {};
    var dir = o.dir || -1, run = o.run || 0;
    var step = Math.sin(run), plant = Math.abs(step) < 0.2 ? 1 : 0;
    var bodyBob = Math.abs(Math.cos(run)) * 4 + plant * 5;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * -dir, sc);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 90, 10, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -(o.air || 0) - bodyBob);
    ctx.rotate(o.pitch || 0);
    // legs with heavier plant
    [[-52, 0], [-36, Math.PI], [44, Math.PI * 0.5], [60, Math.PI * 1.5]].forEach(function (lg, i) {
      var ph = run + lg[1], up = Math.sin(ph) * 0.75, kn = 0.7 + Math.cos(ph) * 0.5;
      if (o.tuck) { up = i < 2 ? -1.05 : 1.05; kn = 1.55; }
      if (o.wind) { up = i < 2 ? -0.55 : 0.85; kn = 1.25; } // crouch wind-up before leap
      ctx.save(); ctx.translate(lg[0], -96);
      var c = i % 2 ? '#3d454f' : '#56606b';
      limbBot(0, 0, up, 48, i < 2 ? -kn : kn, 50, c);
      ctx.restore();
    });
    var g = ctx.createLinearGradient(0, -130, 0, -80); g.addColorStop(0, '#7b8692'); g.addColorStop(1, '#232930');
    ctx.fillStyle = g; rrect(-78, -130, 150, 46, 18); ctx.fill(); ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 2.5; ctx.stroke();
    for (var i = 0; i < 5; i++) poly([-56 + i * 24, -130, -46 + i * 24, -146, -36 + i * 24, -130], '#3a424c', '#0d1014', 1.5);
    ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 8; circle(-10, -108, 5, '#ff4040'); ctx.shadowBlur = 0;
    var tail = Math.sin(gt * 5.5 + run) * 8;
    line(-78, -118, -120, -150 + tail, '#3a424c', 5); circle(-120, -150 + tail, 5, '#ff4040');
    // head
    ctx.save(); ctx.translate(70, -122);
    var jaw = o.jaw || 0;
    poly([0, -18, 58, -14, 76, 2, 0, 16], '#5d6772', '#0d1014', 2.5);
    ctx.save(); ctx.translate(8, 12); ctx.rotate(jaw * 0.6); poly([0, 0, 62, -2, 60, 10, 0, 12], '#3a424c', '#0d1014', 2);
    for (var t = 0; t < 5; t++) poly([12 + t * 10, 0, 16 + t * 10, -6, 20 + t * 10, 0], '#e9eef2');
    ctx.restore();
    ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 14; poly([20, -10, 56, -8, 54, -2, 20, -3], '#ff3b3b'); ctx.shadowBlur = 0;
    poly([6, -18, 16, -38, 26, -16], '#3a424c', '#0d1014', 2);
    ctx.restore();
    ctx.restore();
  }
  function limbBot(x0, y0, a1, l1, a2, l2, col) {
    var x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1, x2 = x1 + Math.sin(a1 + a2) * l2, y2 = y1 + Math.cos(a1 + a2) * l2;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 17;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    circle(x1, y1, 6, '#1f252c');
    ctx.fillStyle = '#1a1e24'; ctx.beginPath(); ctx.ellipse(x2 + 6, y2, 12, 6, 0, 0, TAU); ctx.fill();
  }
  function drawFist(x, y, sc) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    var g = ctx.createLinearGradient(-90, 0, 90, 0); g.addColorStop(0, '#2a3038'); g.addColorStop(0.5, '#7c8794'); g.addColorStop(1, '#20262d');
    ctx.fillStyle = g; ctx.fillRect(-80, -900, 160, 760);
    for (var i = 0; i < 6; i++) { ctx.fillStyle = '#1a1f25'; ctx.fillRect(-80, -880 + i * 120, 160, 8); }
    ctx.fillStyle = '#ff3a3a'; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 12; ctx.fillRect(-4, -700, 8, 520); ctx.shadowBlur = 0;
    var fg = ctx.createLinearGradient(0, -170, 0, 0); fg.addColorStop(0, '#8d98a4'); fg.addColorStop(1, '#353d46');
    ctx.fillStyle = fg; rrect(-135, -175, 270, 175, 34); ctx.fill(); ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 4; ctx.stroke();
    for (var k = 0; k < 4; k++) { ctx.fillStyle = '#a7b2bd'; rrect(-128 + k * 64, -40, 58, 44, 14); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#5d6772'; rrect(-150, -150, 50, 100, 20); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------- backgrounds ----------
  var BX0 = 0, BX1 = LW, BY0 = 0, BY1 = LH;
  function pz(X, Y, z) { return [CX + X / z, HOR + (Y - HOR) / z]; }
  function layer(f, fn) { ctx.save(); ctx.translate(cam.x * (1 - f), cam.y * (1 - f)); fn(); ctx.restore(); }
  function vgrad(y0, y1, stops) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
    return g;
  }
  function fillAll(style) { ctx.fillStyle = style; ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0); }
  function floorGrid(col, yTop, moving) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    for (var i = -12; i <= 12; i++) { var a = pz(i * 90, FLOOR + 400, 0.6), b = pz(i * 90, FLOOR, 12); line(a[0], a[1], b[0], b[1], col, 1.5); }
    var off = moving ? (gt * moving) % 1 : 0;
    for (var z = 0.6; z < 10; z *= 1.32) { var zz = z * (1 - off * 0.24); var y = pz(0, FLOOR, zz)[1]; if (y > yTop) line(BX0, y, BX1, y, col, 1.2); }
  }
  function rackFace(x0, x1, yb, h, s, seed) {
    var yt = yb - h;
    var g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#1b2230'); g.addColorStop(1, '#0c1018');
    ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), yt, Math.abs(x1 - x0), h);
    ctx.strokeStyle = '#2c3648'; ctx.lineWidth = 1; ctx.strokeRect(Math.min(x0, x1), yt, Math.abs(x1 - x0), h);
    var w = Math.abs(x1 - x0), rows = 12, xm = Math.min(x0, x1);
    for (var r = 0; r < rows; r++) {
      var y = yt + h * (r + 0.5) / rows;
      ctx.fillStyle = '#05070b'; ctx.fillRect(xm + w * 0.1, y - h / rows * 0.3, w * 0.8, h / rows * 0.6);
      for (var c = 0; c < 3; c++) {
        var on = hash(seed * 17 + r * 7 + c + Math.floor(gt * (2 + hash(r + seed) * 3))) > 0.55;
        ctx.fillStyle = on ? (c === 2 && hash(r * 3 + seed) > 0.7 ? '#ff4040' : '#3cf08a') : '#13301f';
        ctx.fillRect(xm + w * (0.16 + c * 0.1), y - 1.5, Math.max(1.5, w * 0.05), 3);
      }
    }
  }
  var BG = {
    hall: function () {
      fillAll(vgrad(BY0, BY1, ['#05070e', '#0b1222', '#0a0f1a', '#06080c']));
      layer(0.15, function () {
        for (var y = 330; y < 510; y += 16) for (var x = Math.floor(BX0 / 22) * 22; x < BX1; x += 22) {
          var h = hash(x * 0.37 + y * 1.7 + Math.floor(gt * 1.5 + hash(x + y) * 9));
          if (h > 0.62) { ctx.fillStyle = h > 0.95 ? '#ff5050' : 'rgba(60,240,140,.55)'; ctx.fillRect(x, y, 3, 2); }
        }
        for (var i = 0; i < 6; i++) {
          var gx = CX + (i - 2.5) * 70;
          ctx.strokeStyle = 'rgba(255,190,110,.35)'; ctx.lineWidth = 2; rrect(gx - 22, 430, 44, 96, 20); ctx.stroke();
          drawGhost(gx, 520, 0.5, 0.55 + 0.25 * Math.sin(gt * 2 + i));
        }
      });
      ctx.fillStyle = vgrad(HOR, BY1, ['#0b1220', '#05070b']); ctx.fillRect(BX0, HOR + 30, BX1 - BX0, BY1 - HOR);
      floorGrid('rgba(64,240,220,.10)', HOR + 30, 0);
      layer(0.6, function () {
        [7, 5, 3.8, 2.8, 2.05, 1.5, 1.1].forEach(function (z, zi) {
          [-1, 1].forEach(function (s) {
            var a = pz(s * 290, FLOOR, z), b = pz(s * 420, FLOOR, z);
            rackFace(a[0], b[0], a[1], 440 / z, s, zi * 2 + (s > 0 ? 1 : 0));
          });
        });
      });
      var a = gt * 2.2; glow(CX + Math.cos(a) * 200, 120, 260, '255,30,30', 0.18 + 0.1 * Math.sin(gt * 9));
      glow(CX, 70, 60, '255,60,60', 0.8);
    },
    corridor: function () {
      fillAll('#07090d');
      layer(0.5, function () {
        poly([pz(-330, FLOOR, 0.5)[0], pz(-330, FLOOR, 0.5)[1], pz(-330, FLOOR, 9)[0], pz(-330, FLOOR, 9)[1], pz(-330, 60, 9)[0], pz(-330, 60, 9)[1], pz(-330, 60, 0.5)[0], pz(-330, 60, 0.5)[1]], '#18202a');
        poly([pz(330, FLOOR, 0.5)[0], pz(330, FLOOR, 0.5)[1], pz(330, FLOOR, 9)[0], pz(330, FLOOR, 9)[1], pz(330, 60, 9)[0], pz(330, 60, 9)[1], pz(330, 60, 0.5)[0], pz(330, 60, 0.5)[1]], '#161d26');
        var e = pz(-330, 60, 9), f = pz(330, FLOOR, 9);
        ctx.fillStyle = '#0d1117'; ctx.fillRect(e[0], e[1], f[0] - e[0], f[1] - e[1]);
        glow(CX, (e[1] + f[1]) / 2, 90, '255,80,40', 0.35);
        for (var z = 1.2; z < 9; z *= 1.45) {
          [-1, 1].forEach(function (s) {
            var p = pz(s * 330, 420, z);
            ctx.fillStyle = '#0b0f14'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 20 / z, 60 / z, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 3 / z; ctx.stroke();
            if (z > 1.6 && z < 6) { var ph = gt * 1.7 + z * 3 + s; drawArm(p[0], p[1], p[0] - s * (90 + 40 * Math.sin(ph)) / z, p[1] + (60 + 50 * Math.cos(ph)) / z, { sc: 0.6 / z, grip: 0.5 + 0.5 * Math.sin(ph * 2), noBase: true }); }
          });
          var c1 = pz(-200, 60, z), c2 = pz(200, 60, z);
          ctx.fillStyle = 'rgba(255,40,40,' + (0.45 + 0.35 * Math.sin(gt * 6 - z)) + ')'; ctx.fillRect(c1[0], c1[1] + 4 / z, c2[0] - c1[0], 6 / z);
        }
        [-280, -240, 240, 280].forEach(function (X) { var a = pz(X, 40, 0.6), b = pz(X, 40, 9); line(a[0], a[1], b[0], b[1], '#262e38', 10); });
      });
      ctx.fillStyle = vgrad(HOR, BY1, ['#12161c', '#07090c']);
      poly([pz(-330, FLOOR, 0.4)[0], BY1, pz(-330, FLOOR, 9)[0], pz(-330, FLOOR, 9)[1], pz(330, FLOOR, 9)[0], pz(330, FLOOR, 9)[1], pz(330, FLOOR, 0.4)[0], BY1], null);
      ctx.fill();
      [-1, 1].forEach(function (s) { for (var z = 0.6; z < 8; z *= 1.3) { var a = pz(s * 300, FLOOR, z), b = pz(s * 300, FLOOR, z * 1.15); line(a[0], a[1], b[0], b[1], (Math.round(Math.log(z) * 8) % 2) ? '#ffb000' : '#111', 10 / z); } });
    },
    vault: function () {
      fillAll(vgrad(BY0, BY1, ['#0a1218', '#13222c', '#0b161d']));
      layer(0.3, function () {
        for (var y = 160; y < 560; y += 46) for (var x = Math.floor(BX0 / 60) * 60; x < BX1; x += 60) {
          if (Math.abs(x + 30 - CX) < 200 && y > 220 && y < 520) continue;
          ctx.fillStyle = '#1d2e38'; ctx.fillRect(x + 3, y + 3, 54, 40); ctx.fillStyle = '#2b414e'; ctx.fillRect(x + 6, y + 6, 48, 4);
          circle(x + 48, y + 24, 3, '#8aa'); ctx.fillStyle = '#c9d6d9'; ctx.fillRect(x + 10, y + 18, 18, 8);
        }
        ctx.save(); ctx.translate(CX, 380);
        circle(0, 0, 180, '#1a2830'); circle(0, 0, 160, '#3b4f5a'); circle(0, 0, 140, '#22333d');
        ctx.rotate(gt * 0.3);
        for (var i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillStyle = '#7d939e'; ctx.fillRect(146, -8, 26, 16); }
        circle(0, 0, 50, '#566b76');
        for (var k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.fillStyle = '#93a8b2'; ctx.fillRect(0, -6, 110, 12); }
        ctx.restore();
        glow(CX, 120, 300, '255,40,40', 0.12 + 0.08 * Math.sin(gt * 5));
      });
      var lvl = vaultLevel();
      ctx.fillStyle = vgrad(lvl - 40, BY1, ['#123448', '#071722']); ctx.fillRect(BX0, lvl - 60, BX1 - BX0, BY1 - lvl + 60);
      for (var r = 0; r < 14; r++) { var yy = lvl - 50 + r * 22 + (gt * 12 % 22); line(BX0, yy, BX1, yy, 'rgba(150,220,255,' + (0.05 + r * 0.004) + ')', 1); }
    },
    roof: function () {
      fillAll(vgrad(BY0, BY1, ['#03050c', '#0c1030', '#2a1d3a', '#0a0a12']));
      for (var i = 0; i < 60; i++) { var x = BX0 + hash(i) * (BX1 - BX0), y = BY0 + hash(i + 99) * 400; ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.5 * hash(i + Math.floor(gt * 2))) + ')'; ctx.fillRect(x, y, 2, 2); }
      circle(CX + 150, 130, 40, '#e8ecf4'); circle(CX + 165, 122, 36, '#0c1030');
      [[0.1, 360, '#0d1120', 0.5], [0.3, 440, '#090c17', 1]].forEach(function (L) {
        layer(L[0], function () {
          for (var x = Math.floor(BX0 / 70) * 70 - 70; x < BX1 + 70; x += 70) {
            var h = 80 + hash(x * L[3]) * 200, top = L[1] + 220 - h;
            ctx.fillStyle = L[2]; ctx.fillRect(x, top, 66, h + 400);
            for (var wy = top + 10; wy < L[1] + 220; wy += 16) for (var wx = x + 8; wx < x + 60; wx += 14) if (hash(wx * 3 + wy) > 0.72) { ctx.fillStyle = 'rgba(255,200,120,.55)'; ctx.fillRect(wx, wy, 6, 8); }
          }
        });
      });
      [-1, 1].forEach(function (s) {
        var a = Math.sin(gt * 0.7 + s) * 0.5 - PI / 2 + s * 0.3, bx = CX + s * 260, by = 700;
        ctx.fillStyle = 'rgba(200,220,255,.07)';
        poly([bx, by, bx + Math.cos(a - 0.08) * 900, by + Math.sin(a - 0.08) * 900, bx + Math.cos(a + 0.08) * 900, by + Math.sin(a + 0.08) * 900], 'rgba(200,220,255,.07)');
      });
      for (var d = 0; d < 9; d++) {
        var dx = CX + Math.sin(gt * 0.6 + d * 1.7) * 230 + Math.sin(gt * 1.3 + d) * 60, dy = 200 + Math.cos(gt * 0.8 + d * 2.1) * 90;
        drawDrone(dx, dy, 0.22 + 0.06 * (d % 3), { eye: 0.4 + 0.4 * Math.sin(gt * 5 + d), tilt: Math.sin(gt + d) * 0.2 });
      }
      ctx.fillStyle = vgrad(640, BY1, ['#1a1c22', '#0a0b0e']); ctx.fillRect(BX0, 640, BX1 - BX0, BY1 - 640);
      line(BX0, 640, BX1, 640, '#3a3e48', 4);
      for (var px = Math.floor(BX0 / 40) * 40; px < BX1; px += 40) line(px, 600, px, 640, '#2a2e36', 3);
      line(BX0, 600, BX1, 600, '#2a2e36', 4);
      ctx.fillStyle = '#20232a'; ctx.fillRect(CX - 330, 660, 90, 70); ctx.fillRect(CX + 250, 670, 110, 60);
      ctx.strokeStyle = '#2f343d'; for (var v = 0; v < 5; v++) line(CX - 325, 672 + v * 12, CX - 245, 672 + v * 12, '#2f343d', 3);
    },
    conveyor: function () {
      fillAll(vgrad(BY0, BY1, ['#0b0806', '#1c120c', '#0d0a08']));
      layer(0.3, function () {
        ctx.fillStyle = '#16100c'; ctx.fillRect(CX - 150, 230, 300, 300);
        ctx.fillStyle = '#ff7a20'; ctx.shadowColor = '#ff6a10'; ctx.shadowBlur = 30; ctx.fillRect(CX - 110, 420, 220, 90); ctx.shadowBlur = 0;
        for (var i = 0; i < 9; i++) { var ph = gt * 12 + i; ctx.fillStyle = '#5a5f66'; poly([CX - 110 + i * 25, 420, CX - 98 + i * 25, 420 + 18 + Math.sin(ph) * 6, CX - 86 + i * 25, 420], '#5a5f66'); }
        ctx.font = '900 30px system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,40,40,' + (0.75 + 0.25 * Math.sin(gt * 13)) + ')'; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 16;
        ctx.fillText('APPLICANT PROCESSING', CX, 200); ctx.shadowBlur = 0;
        for (var g = 0; g < 4; g++) drawGhost(CX - 60 + g * 40, 480 - 6 * Math.sin(gt * 3 + g), 0.32, 0.5);
        [-1, 1].forEach(function (s) {
          for (var p = 0; p < 3; p++) { var px = CX + s * (200 + p * 90), ext = 40 + 30 * Math.sin(gt * 3 + p + s); ctx.fillStyle = '#2b2622'; ctx.fillRect(px - 20, 150, 40, 120); ctx.fillStyle = '#9aa2aa'; ctx.fillRect(px - 8, 270, 16, ext); ctx.fillStyle = '#3b3530'; ctx.fillRect(px - 26, 270 + ext, 52, 18); }
        });
      });
      var fy = pz(0, FLOOR, 9)[1];
      ctx.fillStyle = '#100c0a'; ctx.fillRect(BX0, fy, BX1 - BX0, BY1 - fy);
      var a = pz(-230, FLOOR, 0.5), b = pz(-230, FLOOR, 9), c = pz(230, FLOOR, 9), d = pz(230, FLOOR, 0.5);
      poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]], '#24201c', '#0a0806', 3);
      var off = (gt * 0.9) % 1;
      for (var z = 0.5; z < 9; z *= 1.18) { var zz = z * (1 + off * 0.18); var l = pz(-230, FLOOR, zz), r = pz(230, FLOOR, zz); line(l[0], l[1], r[0], r[1], '#3b342d', 3 / zz + 1); }
      for (var k = 0; k < 7; k++) {
        var zp = 1 + ((k * 1.3 + gt * 0.8) % 8), p = pz((hash(k) - 0.5) * 220, FLOOR, zp), s2 = 1 / zp;
        ctx.save(); ctx.translate(p[0], p[1] - 4 * s2); ctx.scale(s2, s2 * 0.45); ctx.rotate(hash(k + 5) - 0.5);
        ctx.fillStyle = '#efeadc'; ctx.fillRect(-36, -46, 72, 92); ctx.fillStyle = '#7b8a94';
        for (var ln = 0; ln < 6; ln++) ctx.fillRect(-28, -36 + ln * 13, ln === 0 ? 40 : 56, 4);
        ctx.fillStyle = '#c03030'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; if (k % 3 === 0) ctx.fillText('REJECT', 0, 10);
        ctx.restore();
      }
      [-1, 1].forEach(function (s) { var t1 = pz(s * 235, FLOOR, 0.5), t2 = pz(s * 235, FLOOR, 9); line(t1[0], t1[1], t2[0], t2[1], '#ffb000', 6); });
    },
    shaft: function () {
      var sc = gt * 300;
      fillAll('#07080a');
      layer(0.2, function () {
        ctx.fillStyle = '#15181d'; ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
        for (var y = -(sc * 0.4 % 240) - 240; y < BY1 + 240; y += 240) {
          ctx.fillStyle = '#20252c'; ctx.fillRect(BX0, y, BX1 - BX0, 26);
          var fl = Math.floor((y + sc * 0.4) / 240);
          ctx.fillStyle = '#ffb000'; ctx.font = '900 34px system-ui'; ctx.textAlign = 'center'; ctx.fillText('B' + (40 + fl), CX, y + 110);
          glow(CX - 160, y + 60, 50, '255,170,60', 0.5); glow(CX + 160, y + 60, 50, '255,170,60', 0.5);
        }
        [-30, 30].forEach(function (x) { line(CX + x, BY0, CX + x, BY1, '#4a525c', 5); });
      });
      layer(0.8, function () {
        [-1, 1].forEach(function (s) {
          var x0 = CX + s * 230, x1 = CX + s * 400;
          ctx.fillStyle = '#262b33'; ctx.fillRect(Math.min(x0, x1), BY0, 170, BY1 - BY0);
          for (var y = -(sc % 180) - 180; y < BY1 + 180; y += 180) {
            line(x0, y, x1, y + 180, '#3c434d', 12); line(x1, y, x0, y + 180, '#3c434d', 12); line(x0, y, x1, y, '#4b535e', 14);
            circle(x0 + s * 10, y + 10, 4, '#11151a');
          }
        });
      });
      ctx.fillStyle = vgrad(FLOOR - 40, BY1, ['#4a525c', '#22272e']);
      poly([CX - 260, FLOOR - 30, CX + 260, FLOOR - 30, CX + 330, BY1, CX - 330, BY1], null); ctx.fill();
      ctx.strokeStyle = '#11151a'; ctx.lineWidth = 3; ctx.strokeRect(CX - 80, FLOOR + 10, 160, 60);
      line(CX - 250, FLOOR - 70, CX - 250, FLOOR - 30, '#ffb000', 6); line(CX + 250, FLOOR - 70, CX + 250, FLOOR - 30, '#ffb000', 6); line(CX - 250, FLOOR - 70, CX + 250, FLOOR - 70, '#ffb000', 5);
      if (Math.sin(gt * 23) > 0.96) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0); }
    },
    lasers: function () {
      fillAll(vgrad(BY0, BY1, ['#040208', '#0d0618', '#05020a']));
      layer(0.3, function () {
        for (var i = 0; i < 7; i++) {
          var y1 = 220 + i * 50 + Math.sin(gt * (0.8 + i * 0.2) + i) * 60, y2 = 260 + i * 44 + Math.cos(gt * (0.7 + i * 0.15)) * 70;
          ctx.globalAlpha = 0.5; line(BX0, y1, BX1, y2, '#ff2050', 2); ctx.globalAlpha = 1;
        }
        [-1, 1].forEach(function (s) { for (var y = 200; y < 700; y += 70) { ctx.fillStyle = '#1d1528'; ctx.fillRect(CX + s * 300 - 14, y, 28, 30); circle(CX + s * 300, y + 15, 5, hash(y + s + Math.floor(gt * 3)) > 0.5 ? '#ff2050' : '#401020'); } });
      });
      ctx.fillStyle = '#07030d'; ctx.fillRect(BX0, HOR + 20, BX1 - BX0, BY1 - HOR);
      floorGrid('rgba(255,40,140,.35)', HOR + 20, 0.6);
      glow(CX, HOR + 30, 400, '255,30,120', 0.12);
    },
    kennel: function () {
      fillAll(vgrad(BY0, BY1, ['#07080a', '#14130f', '#0b0a08']));
      layer(0.2, function () {
        ctx.strokeStyle = 'rgba(140,140,130,.25)'; ctx.lineWidth = 1.5;
        for (var x = Math.floor(BX0 / 24) * 24; x < BX1 + 300; x += 24) { line(x, 380, x - 260, 640, 'rgba(140,140,130,.22)', 1.5); line(x - 260, 380, x, 640, 'rgba(140,140,130,.22)', 1.5); }
        line(BX0, 380, BX1, 380, '#555', 5); line(BX0, 640, BX1, 640, '#555', 5);
        for (var e = 0; e < 7; e++) {
          var ex = BX0 + 60 + hash(e) * (BX1 - BX0 - 120), ey = 470 + hash(e + 9) * 120, on = Math.sin(gt * 1.3 + e * 2.3) > -0.3;
          if (on) { ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 10; circle(ex, ey, 3.5, '#ff3030'); circle(ex + 16, ey, 3.5, '#ff3030'); ctx.shadowBlur = 0; }
        }
      });
      ctx.fillStyle = vgrad(640, BY1, ['#1b1a16', '#0b0a08']); ctx.fillRect(BX0, 640, BX1 - BX0, BY1 - 640);
      layer(0.7, function () {
        [-1, 1].forEach(function (s) {
          for (var i = 0; i < 3; i++) for (var j = 0; j < 3 - i; j++) {
            var x = CX + s * (300 + j * 110) - 55, y = 700 - i * 110 - 110;
            ctx.fillStyle = '#4a3a26'; ctx.fillRect(x, y, 108, 108); ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 4; ctx.strokeRect(x, y, 108, 108);
            line(x, y, x + 108, y + 108, '#3a2c1a', 6); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('UNIT K9', x + 54, y + 58);
          }
        });
      });
      [CX - 150, CX + 150].forEach(function (lx, i) {
        var sw = Math.sin(gt * 1.2 + i * 2) * 0.25, ex = lx + Math.sin(sw) * 160, ey = Math.cos(sw) * 160;
        line(lx, BY0, ex, ey, '#222', 3);
        ctx.fillStyle = 'rgba(255,220,150,.08)'; poly([ex - 16, ey, ex + 16, ey, ex + 140 + sw * 300, FLOOR, ex - 140 + sw * 300, FLOOR], 'rgba(255,220,150,.07)');
        ctx.fillStyle = '#333'; poly([ex - 20, ey + 14, ex + 20, ey + 14, ex + 10, ey, ex - 10, ey], '#333'); glow(ex, ey + 14, 40, '255,220,150', 0.6);
      });
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(CX - 120, 860, 90, 18, 0, 0, TAU); ctx.fill();
    },
    boss: function () {
      fillAll(vgrad(BY0, BY1, ['#0a0204', '#1c0508', '#0a0306']));
      layer(0.15, function () {
        for (var i = 0; i < 10; i++) { var x = CX + (i - 4.5) * 120; ctx.fillStyle = '#16080a'; ctx.fillRect(x - 30, 380, 60, 220); ctx.strokeStyle = 'rgba(255,170,80,.4)'; ctx.lineWidth = 2; rrect(x - 24, 430, 48, 110, 22); ctx.stroke(); drawGhost(x, 530, 0.55, 0.45 + 0.2 * Math.sin(gt * 1.5 + i)); }
      });
      layer(0.35, function () { drawMachine(); });
      ctx.fillStyle = vgrad(640, BY1, ['#1a0d0f', '#080405']); ctx.fillRect(BX0, 640, BX1 - BX0, BY1 - 640);
      for (var x = Math.floor(BX0 / 50) * 50; x < BX1; x += 50) line(x, 640, CX + (x - CX) * 1.8, BY1, 'rgba(255,40,40,.18)', 2);
      for (var z = 1; z < 8; z *= 1.4) { var y = pz(0, FLOOR, z)[1]; if (y > 640) line(BX0, y, BX1, y, 'rgba(255,40,40,.15)', 2); }
    },
    escape: function () {
      fillAll(vgrad(BY0, BY1, ['#120a06', '#2a160c', '#100906']));
      var open = clamp((G.beat + (B ? B.p * 0.3 : 0)) / 4, 0, 1);
      layer(0.3, function () {
        var dw = 120 + 80 * open;
        glow(CX, 470, 340 + 200 * open, '255,210,150', 0.35 + 0.3 * open);
        ctx.fillStyle = vgrad(330, 610, ['#fff6dc', '#ffc27a']); ctx.fillRect(CX - dw / 2, 610 - dw * 2, dw, dw * 2);
        for (var i = 0; i < 4; i++) { var ph = (gt * 0.18 + i * 0.25) % 1, x = CX + (i % 2 ? 1 : -1) * 30 * (1 - ph), y = 610; drawOld(x, y, 0.3 * (1 - ph * 0.6), 'stand', i, { noShadow: true }); }
        [-1, 1].forEach(function (s) {
          ctx.fillStyle = '#1a100a'; ctx.fillRect(CX + s * 120 - (s > 0 ? 0 : 400), 150, 400, 480);
          for (var f = 0; f < 3; f++) flame(CX + s * (190 + f * 70), 630, 1 + 0.3 * Math.sin(gt * 7 + f));
        });
      });
      ctx.fillStyle = vgrad(620, BY1, ['#2a1a10', '#0e0805']); ctx.fillRect(BX0, 620, BX1 - BX0, BY1 - 620);
      for (var c = 0; c < 6; c++) { var cx = BX0 + hash(c + 3) * (BX1 - BX0); ctx.strokeStyle = '#0a0503'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, 650); ctx.lineTo(cx + 30, 720); ctx.lineTo(cx - 10, 800); ctx.stroke(); }
    }
  };
  function flame(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var g = ctx.createRadialGradient(0, -30, 4, 0, -30, 70); g.addColorStop(0, 'rgba(255,240,180,.9)'); g.addColorStop(0.4, 'rgba(255,140,40,.7)'); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.quadraticCurveTo(-30, -60 - Math.sin(gt * 9) * 10, 0, -110 - Math.sin(gt * 11) * 14); ctx.quadraticCurveTo(30, -60, 36, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawMachine() {
    var br = SS.broken, sh = br > 0 ? Math.sin(gt * 40) * 4 * br : 0;
    ctx.save(); ctx.translate(sh, 0);
    var g = ctx.createLinearGradient(CX - 240, 0, CX + 240, 0); g.addColorStop(0, '#120e10'); g.addColorStop(0.5, '#3a3236'); g.addColorStop(1, '#100c0e');
    ctx.fillStyle = g; rrect(CX - 240, -200, 480, 790, 60); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.stroke();
    for (var i = 0; i < 9; i++) { ctx.fillStyle = '#0a0808'; ctx.fillRect(CX - 200 + i * 48, 360, 14, 160); }
    [-1, 1].forEach(function (s) {
      var ext = 30 + 25 * Math.sin(gt * 2 + s);
      ctx.fillStyle = '#2a2427'; ctx.fillRect(CX + s * 250 - 30, 40, 60, 150); ctx.fillStyle = '#9aa2aa'; ctx.fillRect(CX + s * 250 - 10, 190, 20, ext);
      var sx = CX + s * 170, sy = 70;
      ctx.fillStyle = '#050304'; ctx.fillRect(sx - 62, sy - 34, 124, 68);
      ctx.fillStyle = 'rgba(255,40,40,' + (0.7 + 0.3 * Math.sin(gt * 10 + s)) + ')'; ctx.font = '900 19px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(s < 0 ? 'REJECTED' : 'NEXT', sx, sy + 7);
    });
    ctx.save(); ctx.translate(CX, 220);
    circle(0, 0, 112, '#0b0809'); circle(0, 0, 100, '#4a4246'); circle(0, 0, 84, '#120d0f');
    ctx.rotate(gt * 0.5); for (var k = 0; k < 16; k++) { ctx.rotate(TAU / 16); ctx.fillStyle = '#6a6066'; ctx.fillRect(86, -4, 12, 8); }
    ctx.restore();
    var pulse = 0.6 + 0.4 * Math.sin(gt * 3);
    glow(CX, 220, 120, '255,30,30', 0.5 * pulse + 0.2);
    ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 30; circle(CX, 220, 34 + 6 * pulse, '#ff2a2a'); ctx.shadowBlur = 0; circle(CX, 220, 14, '#ffd0c0');
    line(CX - 80, 220 + Math.sin(gt * 2) * 60, CX + 80, 220 + Math.sin(gt * 2) * 60, 'rgba(255,120,120,.35)', 2);
    if (br > 0) { ctx.strokeStyle = '#ffb060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CX - 20, 300); ctx.lineTo(CX - 60, 380); ctx.lineTo(CX - 30, 440); ctx.moveTo(CX + 30, 260); ctx.lineTo(CX + 90, 330); ctx.stroke(); }
    ctx.restore();
  }
  function vaultLevel() { return 790 - Math.min(40, SS.t * 1.4); }
  var FG = {
    vault: function () {
      var lvl = vaultLevel() + 10;
      ctx.fillStyle = 'rgba(40,110,160,.42)';
      ctx.beginPath(); ctx.moveTo(BX0, BY1);
      for (var x = BX0; x <= BX1; x += 20) ctx.lineTo(x, lvl + Math.sin(x * 0.03 + gt * 3) * 6 + Math.sin(x * 0.011 - gt * 2) * 5);
      ctx.lineTo(BX1, BY1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(200,240,255,.45)'; ctx.lineWidth = 2; ctx.beginPath();
      for (var x2 = BX0; x2 <= BX1; x2 += 20) { var y = lvl + Math.sin(x2 * 0.03 + gt * 3) * 6 + Math.sin(x2 * 0.011 - gt * 2) * 5; if (x2 === BX0) ctx.moveTo(x2, y); else ctx.lineTo(x2, y); }
      ctx.stroke();
    },
    escape: function () { glow(CX, 470, 900, '255,200,140', 0.06); }
  };
  var ambT = 0;
  function ambient(dt) {
    ambT += dt; if (ambT < 0.12) return; ambT = 0;
    var bg = scene().bg;
    if (bg === 'hall' && Math.random() < 0.25) sparks(CX + (Math.random() < 0.5 ? -1 : 1) * rnd(150, 260), rnd(300, 500), 4);
    if (bg === 'vault' && Math.random() < 0.6) { var x = rnd(BX0, BX1); P({ k: 'drop', x: x, y: BY0, vx: 0, vy: 200, life: 1.2, t: 0, r: 2.5 }); }
    if (bg === 'conveyor' && Math.random() < 0.5) paper(CX + rnd(-100, 100), 420, 1);
    if (bg === 'shaft' && Math.random() < 0.35) sparks(CX + rnd(-250, 250), BY0 + 20, 3, '#ffcf6a');
    if (bg === 'escape') { P({ k: 'ember', x: rnd(BX0, BX1), y: BY1, vx: rnd(-20, 20), vy: rnd(-180, -80), life: rnd(2, 4), t: 0, r: rnd(2, 4), col: Math.random() < 0.5 ? '#ffb347' : '#ff6a2a' }); if (Math.random() < 0.15) debris(rnd(BX0, BX1), BY0, 2, '#3a2a20'); }
    if (bg === 'boss' && Math.random() < 0.4) P({ k: 'ember', x: rnd(BX0, BX1), y: BY1, vx: rnd(-10, 10), vy: rnd(-120, -60), life: rnd(2, 4), t: 0, r: 2, col: '#ff4040' });
    if (bg === 'kennel' && Math.random() < 0.3) P({ k: 'ember', x: rnd(BX0, BX1), y: rnd(200, 700), vx: rnd(-8, 8), vy: rnd(-10, 10), life: 3, t: 0, r: 2, col: 'rgba(255,230,180,.4)' });
  }

  // ---------- threats ----------
  function qv(b) { return b.out ? b.q : 0; }
  function shake(n) { fx.shake = Math.max(fx.shake, n); }
  function smashFx(x, y, big) {
    AU.play('smash'); sparks(x, y, big ? 40 : 24); debris(x, y, big ? 26 : 16); smoke(x, y, big ? 8 : 5);
    shake(big ? 16 : 10); fx.flash = Math.max(fx.flash, 0.35); fx.flashCol = '255,255,255';
    pop(big ? 'SMASHED!' : 'SMASH!', x, y - 40, '#ffd27a');
  }
  var THREATS = {
    rack: {
      behind: function (b) { return !(b.out && b.q > 0.12); },
      draw: function (b) {
        var q = qv(b), a;
        var a0 = 0.06 + 0.22 * ease(Math.min(b.p, 1)) + (b.p > 0.5 ? Math.sin(gt * 30) * 0.015 * Math.min(b.p, 1.1) : 0);
        if (!b.out) a = a0; else a = q < OUT_IMPACT ? lerp(0.28, PI / 2, easeIn(q / OUT_IMPACT)) : PI / 2 - Math.abs(Math.sin((q - OUT_IMPACT) * 14)) * 0.05 * (1 - q);
        var xc = CX + b.S * 70, yb = FLOOR - 40, hw0 = 100;
        var yt = yb - 460 * Math.cos(a) + 330 * Math.sin(a), hw1 = hw0 * (1 + 0.9 * Math.sin(a));
        var g = ctx.createLinearGradient(0, yb, 0, yt); g.addColorStop(0, '#0e131c'); g.addColorStop(1, '#273246');
        poly([xc - hw0, yb, xc + hw0, yb, xc + hw1, yt, xc - hw1, yt], g, '#3a4860', 3);
        for (var r = 1; r < 14; r++) {
          var f = r / 14, y = lerp(yb, yt, f), hw = lerp(hw0, hw1, f), hh = Math.abs(yt - yb) / 14 * 0.5;
          ctx.fillStyle = '#05070b'; ctx.fillRect(xc - hw * 0.85, y - hh / 2, hw * 1.7, hh);
          for (var c = 0; c < 4; c++) { ctx.fillStyle = hash(r * 9 + c + Math.floor(gt * 6)) > 0.5 ? '#3cf08a' : '#ff4040'; ctx.fillRect(xc - hw * 0.75 + c * hw * 0.12, y - 1.5, Math.max(2, hw * 0.06), 3); }
        }
        if (!b.out && b.p > 0.3) sparksAt(xc + b.S * hw1, yt);
      },
      impact: function (b) { AU.play('crash'); shake(22); for (var i = 0; i < 6; i++) { smoke(CX + b.S * 70 + rnd(-160, 160), FLOOR + 40, 2); } debris(CX + b.S * 70, FLOOR + 30, 20); sparks(CX + b.S * 70, FLOOR + 20, 30); }
    },
    cable: {
      draw: function (b) {
        var q = qv(b), bx = CX + b.S * 380, tip;
        if (!b.out) tip = CX + b.S * (340 - 200 * ease(Math.min(b.p, 1))) - b.S * 15 * Math.max(0, b.p - 1) * 10;
        else tip = lerp(CX + b.S * 140, CX - b.S * 280, ease(q / 0.6));
        var ty = FLOOR + 20, n = 18;
        ctx.lineCap = 'round';
        [['#050505', 16], ['#2a2a2e', 10]].forEach(function (st) {
          ctx.strokeStyle = st[0]; ctx.lineWidth = st[1]; ctx.beginPath();
          for (var i = 0; i <= n; i++) { var f = i / n, x = lerp(bx, tip, f), y = ty + 14 * (1 - f) + Math.sin(f * 9 + gt * 14) * 9 * f; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.stroke();
        });
        var hot = b.out ? 1 : Math.min(1, b.p);
        ctx.strokeStyle = 'rgba(140,220,255,' + (0.5 + 0.5 * hot) + ')'; ctx.lineWidth = 2; ctx.shadowColor = '#7fd8ff'; ctx.shadowBlur = 14;
        for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(tip, ty); var x = tip, y = ty; for (var j = 0; j < 5; j++) { x += rnd(-16, 16); y += rnd(-24, 4); ctx.lineTo(x, y); } ctx.stroke(); }
        ctx.shadowBlur = 0; glow(tip, ty, 60, '120,200,255', 0.7);
        if (Math.random() < 0.4) sparks(tip, ty, 2, '#bfefff');
      },
      impact: function (b, won) { AU.play('zap'); sparks(CX, FLOOR + 10, 26, '#bfefff'); if (!won) { fx.flashCol = '150,220,255'; } }
    },
    bot: {
      behind: function () { return true; },
      pos: function (b) { var e = AN.easeInOut(Math.min(b.p, 1)), z = lerp(3.4, 1.12, e); return { x: lerp(CX + 30, CX + 100, e), y: pz(0, FLOOR - 8, z)[1], sc: 0.95 / z }; },
      draw: function (b) {
        var q = qv(b), p = this.pos(b);
        var walk = b.out || b.p >= 1 ? 0 : gt * 7.2;
        var sw = 0, recoil = 0, dead = 0, rot = 0;
        if (b.out === 'lose') sw = AN.swipeCurve(clamp(q / OUT_IMPACT, 0, 1));
        else if (b.out === 'win') {
          if (!b.impact) sw = AN.swipeCurve(clamp(q / OUT_IMPACT, 0, 1)) * 0.25;
          else {
            var k = clamp((q - OUT_IMPACT) / 0.55, 0, 1);
            dead = AN.easeOut(k); rot = -k * 0.9; recoil = 1 - k;
            p = { x: p.x + k * 90, y: p.y - Math.sin(k * Math.PI) * 40, sc: p.sc };
          }
        } else if (b.p > 0.82) {
          // Anticipatory wind-up before the cue lands.
          sw = -0.28 * ease((b.p - 0.82) / 0.18);
        }
        if (b.out === 'win' && b.impact && q > 0.95) return;
        drawBot(p.x + (b.p > 1 && !b.out ? Math.sin(gt * 28) * 1.5 : 0), p.y, p.sc, { walk: walk, swing: sw, recoil: recoil, dead: dead, rot: rot });
      },
      impact: function (b, won) { var p = this.pos(b); if (won) { smashFx(p.x, p.y - 200, true); debris(p.x, p.y - 290, 6, '#87929e'); } else AU.play('punch'); }
    },
    arm: {
      geo: function (b) {
        var s = b.S, top = b.d.side === 'T';
        if (top) return { bx: CX + 40, by: -40, rx: CX + 80, ry: 200, px: CX + 30, py: 400, lx: CX, ly: 520, bend: 1 };
        return { bx: CX + s * 330, by: 470, rx: CX + s * 300, ry: 420, px: CX + s * 110, py: 610, lx: CX + s * 10, ly: 600, bend: s };
      },
      draw: function (b) {
        var g = this.geo(b), q = qv(b), e = easeOut(Math.min(b.p, 1)), tr = b.p >= 1 ? Math.sin(gt * 45) * 4 : 0;
        var tx = lerp(g.rx, g.px, e) + tr, ty = lerp(g.ry, g.py, e), grip = 0, o = { bend: g.bend };
        if (b.d.side === 'T') { o.L1 = 240; o.L2 = 220; }
        if (b.out === 'lose') {
          var k = ease(q / OUT_IMPACT); tx = lerp(g.px, g.lx, k); ty = lerp(g.py, g.ly, k) - scout.lift; grip = k;
        } else if (b.out === 'win') {
          if (b.d.k === 'strike') {
            if (b.impact) { o.stump = true; var r = ease((q - OUT_IMPACT) * 2); tx = lerp(g.px, g.rx, r); ty = lerp(g.py, g.ry, r); }
            else { tx = lerp(g.px, (g.px + g.lx) / 2, q / OUT_IMPACT); ty = lerp(g.py, (g.py + g.ly) / 2, q / OUT_IMPACT); }
          } else { var k2 = ease(q / OUT_IMPACT); tx = lerp(g.px, g.lx, k2); ty = lerp(g.py, g.ly, k2); grip = k2; }
        }
        drawArm(g.bx, g.by, tx, ty, Object.assign(o, { grip: grip }));
        this.last = { x: tx, y: ty };
      },
      impact: function (b, won) { var l = this.last || { x: CX, y: 600 }; if (won && b.d.k === 'strike') smashFx(l.x, l.y, false); else if (!won) { AU.play('punch'); sparks(l.x, l.y, 10); } }
    },
    sweep: {
      draw: function (b) {
        var q = qv(b), s = b.S, e = ease(Math.min(b.p, 1));
        var tx = lerp(CX + s * 270, CX + s * 175, e), ty = lerp(440, 548, e);
        if (b.out) { tx = lerp(CX + s * 175, CX - s * 330, ease(q / 0.6)); ty = 548; }
        drawArm(CX + s * 330, 530, tx, ty, { bend: -s, grip: 0.8, L1: 220, L2: 220 });
        if (b.out && q < 0.6) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 18; line(tx + s * 60, ty, tx + s * 160, ty, 'rgba(255,255,255,.18)', 18); }
      },
      impact: function (b, won) { AU.play(won ? 'whoosh' : 'punch'); if (!won) sparks(CX, 548, 14); }
    },
    captive: {
      behind: function () { return true; },
      man: function (b) { return { x: CX + b.S * 175, idx: G.beat }; },
      draw: function (b) {
        var q = qv(b), m = this.man(b), e = ease(Math.min(b.p, 1));
        var feet = FLOOR - 15 - 80 * e, armGone = b.out === 'win' && b.impact;
        if (b.out === 'lose') feet = lerp(FLOOR - 95, 520, ease((q - 0.2) * 2));
        if (b.out === 'win' && b.impact) feet = lerp(FLOOR - 95, FLOOR - 15, easeIn((q - OUT_IMPACT) * 4));
        var bx = m.x + b.S * 70, by = 10;
        if (!armGone) drawArm(bx, by, m.x, feet - 252, { bend: b.S, grip: 1, L1: 280, L2: 260 });
        else drawArm(bx, by, lerp(m.x, bx, ease((q - OUT_IMPACT) * 2)), lerp(feet - 252, 200, ease((q - OUT_IMPACT) * 2)), { bend: b.S, stump: true, L1: 280, L2: 260 });
        drawOld(m.x, feet, 0.92, armGone && q > 0.55 ? 'wave' : 'held', m.idx, { shout: !armGone, noShadow: !armGone });
        this.last = { x: m.x, y: feet - 252 };
      },
      impact: function (b, won) {
        var l = this.last || { x: CX, y: 400 };
        if (won) { smashFx(l.x, l.y, false); AU.play('free'); SS.rescued.push({ x: CX + b.S * 175, idx: G.beat, at: gt }); G.rescued++; pop('RESCUED!', l.x, l.y + 80, '#6ffbea'); if (scene().bg === 'vault') droplets(l.x, FLOOR - 10, 20); }
        else AU.play('punch');
      }
    },
    water: {
      behind: function (b) { return !(b.out && b.impact); },
      draw: function (b) {
        var q = qv(b);
        if (!b.out || !b.impact) {
          var crest = lerp(800, 470, ease(Math.min(b.p, 1))) - (b.out ? 40 * q : 0);
          ctx.fillStyle = vgrad(crest, FLOOR + 40, ['#3a8fc0', '#0f3a58']);
          ctx.beginPath(); ctx.moveTo(BX0, FLOOR + 40);
          for (var x = BX0; x <= BX1; x += 24) ctx.lineTo(x, crest + Math.sin(x * 0.02 + gt * 5) * 14 + Math.sin(x * 0.05) * 8);
          ctx.lineTo(BX1, FLOOR + 40); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(230,250,255,.8)'; ctx.lineWidth = 6; ctx.beginPath();
          for (var x2 = BX0; x2 <= BX1; x2 += 24) { var y = crest + Math.sin(x2 * 0.02 + gt * 5) * 14 + Math.sin(x2 * 0.05) * 8; if (x2 === BX0) ctx.moveTo(x2, y); else ctx.lineTo(x2, y); }
          ctx.stroke();
          if (Math.random() < 0.5) droplets(rnd(BX0, BX1), crest, 2);
        } else {
          var k = (q - OUT_IMPACT) / (1 - OUT_IMPACT), top = k < 0.4 ? lerp(470, 660, k / 0.4) : lerp(660, 840, (k - 0.4) / 0.6);
          if (b.out === 'lose' && k < 0.5) top = Math.min(top, 420);
          ctx.fillStyle = 'rgba(30,110,170,.78)';
          ctx.beginPath(); ctx.moveTo(BX0, BY1);
          for (var x3 = BX0; x3 <= BX1; x3 += 20) ctx.lineTo(x3, top + Math.sin(x3 * 0.04 + gt * 9) * 18);
          ctx.lineTo(BX1, BY1); ctx.closePath(); ctx.fill();
          if (Math.random() < 0.7) droplets(rnd(BX0, BX1), top, 3);
        }
      },
      impact: function (b, won) { AU.play('splash'); shake(12); droplets(CX, 600, 60); if (!won) fx.flashCol = '60,140,220'; }
    },
    debris: {
      draw: function (b) {
        var q = qv(b), e = ease(Math.min(b.p, 1)), bg = scene().bg;
        var bot = lerp(-80, 250, e) + (b.p > 0.4 ? Math.sin(gt * 30) * 4 : 0);
        if (b.out) bot = q < OUT_IMPACT ? lerp(250, FLOOR + 15, easeIn(q / OUT_IMPACT)) : FLOOR + 15;
        var sh = clamp((bot + 100) / (FLOOR + 115), 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + 0.45 * sh) + ')'; ctx.beginPath(); ctx.ellipse(CX, FLOOR + 14, 70 + 50 * sh, 12 + 6 * sh, 0, 0, TAU); ctx.fill();
        if (bg === 'conveyor') {
          ctx.fillStyle = '#9aa2aa'; ctx.fillRect(CX - 22, BY0, 44, bot - 120 - BY0);
          ctx.fillStyle = vgrad(bot - 130, bot, ['#5a626c', '#2a3038']); ctx.fillRect(CX - 125, bot - 130, 250, 130);
          ctx.fillStyle = '#ffb000'; for (var i = 0; i < 6; i++) poly([CX - 125 + i * 44, bot - 20, CX - 105 + i * 44, bot - 20, CX - 125 + i * 44 + 30, bot - 4, CX - 125 + i * 44 + 10, bot - 4], '#ffb000');
          ctx.fillStyle = '#ff3030'; ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DENIED', CX, bot - 60);
        } else {
          if (!b.out) { line(CX - 60, BY0, CX - 60, bot - 140, '#555', 4); line(CX + 60, BY0, CX + 60, bot - 140, '#555', 4); }
          poly([CX - 120, bot - 20, CX - 100, bot - 140, CX - 10, bot - 160, CX + 110, bot - 130, CX + 125, bot - 10, CX + 30, bot], '#6b6660', '#24211e', 3);
          poly([CX - 100, bot - 140, CX - 10, bot - 160, CX + 110, bot - 130, CX + 20, bot - 112], '#8a847c');
          line(CX - 60, bot - 90, CX - 20, bot - 50, '#2f2c28', 3); line(CX + 50, bot - 120, CX + 80, bot - 60, '#2f2c28', 3);
          line(CX + 90, bot - 140, CX + 140, bot - 190, '#8a4a30', 5);
        }
      },
      impact: function () { AU.play('crash'); shake(22); smoke(CX, FLOOR, 10, '90,85,80'); debris(CX, FLOOR, 22, '#6b6660'); if (scene().bg === 'vault') { droplets(CX, FLOOR - 20, 50); AU.play('splash'); } }
    },
    drone: {
      pos: function (b) {
        var q = qv(b), e = AN.easeInOut(Math.min(b.p, 1));
        if (b.d.side === 'F') {
          var p = { x: lerp(CX + 30, CX + 120, e), y: lerp(300, 560, e), sc: lerp(0.35, 1.25, e), tilt: 0.08 };
          if (b.out === 'win' && !b.impact) { p.x = lerp(p.x, CX + 70, AN.easeOut(q / OUT_IMPACT)); }
          return p;
        }
        var s = b.S, a = { x: lerp(CX + s * 430, CX + s * 150, e), y: lerp(240, 590, e), sc: 1.05, tilt: -s * 0.35 };
        if (b.out) { var k = AN.easeInOut(q / 0.6); a.x = lerp(CX + s * 150, CX - s * 470, k); a.y = lerp(590, 700, k); a.tilt = -s * 0.6; }
        return a;
      },
      draw: function (b) {
        var p = this.pos(b), q = qv(b);
        if (b.impact && (b.d.side === 'F' ? b.out === 'win' : b.out === 'lose')) return;
        // Inertia hover: soft thrust bob + bank into travel, not a lone sine wobble.
        var hover = Math.sin(gt * 2.1 + b.seed * 9) * 3.5 + Math.sin(gt * 5.3 + b.seed) * 1.2;
        var prev = this._px == null ? p.x : this._px;
        var vx = p.x - prev; this._px = p.x;
        var bank = clamp(vx * 0.012, -0.35, 0.35);
        drawDrone(p.x, p.y, p.sc, { tilt: p.tilt, bank: bank, hover: hover, eye: Math.min(1, b.p) });
        if (b.d.side === 'F' && b.out === 'lose' && q > 0.22 && q < 0.7) {
          ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 20; line(p.x, p.y + 4 + hover, scout.x, 620, '#ff3030', 10); line(p.x, p.y + 4 + hover, scout.x, 620, '#ffe0e0', 3); ctx.shadowBlur = 0;
        }
        this.last = p;
      },
      impact: function (b, won) {
        var p = this.last || { x: CX, y: 560 };
        if (b.d.side === 'F') { if (won) smashFx(p.x, p.y, false); else AU.play('zap'); }
        else if (!won) { smashFx(CX, 600, false); } else AU.play('whoosh');
      }
    },
    laserH: {
      y: function (b) { return b.d.side === 'low' ? 772 : 562; },
      draw: function (b) {
        var y = this.y(b), q = qv(b), eye = b.d.side === 'eye', bg = scene().bg;
        var x0 = CX - 300, x1 = CX + 300;
        if (eye) {
          glow(CX, 220, 60 + 120 * Math.min(b.p, 1), '255,40,40', 0.8);
          if (!b.out) { ctx.globalAlpha = 0.3 + 0.5 * Math.min(b.p, 1); ctx.setLineDash([10, 10]); line(CX, 220, CX, y, '#ff4040', 2); line(x0, y, x1, y, '#ff4040', 2); ctx.setLineDash([]); ctx.globalAlpha = 1; }
          else if (q > 0.1 && q < 0.75) {
            var sx = lerp(CX + 320, CX - 320, (q - 0.1) / 0.6);
            ctx.fillStyle = 'rgba(255,40,40,.35)'; poly([CX - 10, 220, CX + 10, 220, sx + 30, y, sx - 30, y], 'rgba(255,60,60,.4)');
            ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 24; line(CX, 220, sx, y, '#ff3030', 12); line(CX, 220, sx, y, '#fff0f0', 4); ctx.shadowBlur = 0;
            line(sx > CX ? sx : x0, y, sx > CX ? x1 : sx, y, 'rgba(255,60,60,.6)', 6);
            sparks(sx, y, 2);
          }
          return;
        }
        if (bg === 'roof') { drawDrone(x0 - 10, y, 0.7, { eye: Math.min(1, b.p), tilt: 0.2 }); drawDrone(x1 + 10, y, 0.7, { eye: Math.min(1, b.p), tilt: -0.2 }); }
        else { [x0, x1].forEach(function (x) { ctx.fillStyle = '#2a1830'; ctx.fillRect(x - 16, y - 22, 32, 44); circle(x, y, 8, '#ff2050'); glow(x, y, 40, '255,30,90', 0.5 + 0.5 * Math.min(1, b.p)); }); }
        if (!b.out || q < 0.2) {
          ctx.globalAlpha = 0.25 + 0.6 * Math.min(1, b.p) * (0.6 + 0.4 * Math.sin(gt * 30));
          ctx.setLineDash([18, 10]); line(x0, y, x1, y, '#ff3060', 4); ctx.setLineDash([]); ctx.globalAlpha = 1; glow(x0 + (x1 - x0) * ((gt * 0.8) % 1), y, 30, '255,60,120', 0.8);
        } else if (q < 0.8) {
          ctx.shadowColor = '#ff2050'; ctx.shadowBlur = 26; line(BX0, y, BX1, y, '#ff2050', 12); line(BX0, y, BX1, y, '#ffe8f0', 4); ctx.shadowBlur = 0;
        }
      },
      impact: function (b, won) { AU.play('laser'); if (won) sparks(CX + rnd(-100, 100), this.y(b), 8, '#ff9ab0'); }
    },
    laserV: {
      draw: function (b) {
        var q = qv(b), s = b.S, e = ease(Math.min(b.p, 1)), x;
        if (!b.out) x = lerp(CX + s * 330, CX + s * 125, e); else x = lerp(CX + s * 125, CX - s * 25, ease(q / 0.45));
        ctx.fillStyle = '#2a1830'; ctx.fillRect(x - 26, 100, 52, 30); circle(x, 130, 9, '#ff2050');
        if (!b.out) { ctx.globalAlpha = 0.3 + 0.5 * e; ctx.setLineDash([14, 10]); line(x, 130, x, FLOOR + 30, '#ff3060', 2); ctx.setLineDash([]); ctx.globalAlpha = 1; }
        else { ctx.shadowColor = '#ff2050'; ctx.shadowBlur = 28; line(x, 130, x, FLOOR + 30, '#ff2050', 14); line(x, 130, x, FLOOR + 30, '#ffe8f0', 5); ctx.shadowBlur = 0; if (Math.random() < 0.6) sparks(x, FLOOR + 28, 3, '#ff9ab0'); }
        glow(x, FLOOR + 30, 70, '255,30,90', 0.6);
      },
      impact: function () { AU.play('laser'); }
    },
    hound: {
      behind: function (b) { return b.d.side === 'F' && !(b.out === 'lose' && b.impact); },
      pos: function (b) {
        var q = qv(b), e = ease(Math.min(b.p, 1)), side = b.d.side;
        if (side === 'F') {
          var z = lerp(3.6, 1.15, e), o = { x: lerp(CX + 50, CX + 130, e), y: pz(0, FLOOR, z)[1], sc: 0.95 / z, dir: -1, run: gt * 15, air: 0, pitch: 0, jaw: 0.3 };
          if (b.p > 0.55 && b.p <= 0.78) { o.wind = true; o.pitch = -0.18; o.jaw = 0.5; o.run = gt * 4; }
          if (b.p > 0.78) { o.air = Math.min(1, (b.p - 0.78) * 4.5) * 130; o.pitch = 0.28; o.jaw = 1; o.tuck = true; }
          if (b.out === 'lose') { o.x = lerp(o.x, CX + 40, ease(q / OUT_IMPACT)); o.air = lerp(120, 60, q); }
          if (b.out === 'win' && b.impact) { var k = (q - OUT_IMPACT) / 0.6; o.x += k * 380; o.air = 120 + Math.sin(k * PI) * 160; o.pitch = -k * 6; }
          return o;
        }
        if (side === 'low') {
          var lx = b.out ? lerp(CX + 200, CX - 560, q / 0.7) : lerp(CX + 470, CX + 200, e);
          return { x: lx, y: FLOOR + 10, sc: 0.95, dir: -1, run: gt * 18, air: 0, pitch: 0.1, jaw: 0.8 };
        }
        var s = b.S, d = { x: lerp(CX + s * 500, CX + s * 270, e), y: FLOOR + 5, sc: 0.95, dir: -s, run: b.p < 1 ? gt * 15 : 0, air: 0, pitch: b.p >= 1 ? -0.15 : 0, jaw: b.p >= 1 ? 0.6 + 0.4 * Math.sin(gt * 20) : 0.2 };
        if (b.out) { var k2 = clamp(q / 0.42, 0, 1); d.x = lerp(CX + s * 270, CX - s * 40, k2); d.air = Math.sin(k2 * PI) * 150; d.pitch = lerp(-0.3, 0.3, k2); d.jaw = 1; d.tuck = k2 < 1; d.run = 0; }
        return d;
      },
      draw: function (b) { var o = this.pos(b); if (b.out === 'win' && b.impact && b.q > 0.9) return; drawHound(o.x, o.y, o.sc, o); this.last = o; },
      start: function () { AU.play('bark'); },
      impact: function (b, won) { var o = this.last || { x: CX, y: FLOOR, air: 0 }; if (won && b.d.k === 'strike') smashFx(o.x, o.y - 120 - (o.air || 0), true); else if (!won) { AU.play('bark'); AU.play('punch'); } else AU.play('whoosh'); }
    },
    fist: {
      draw: function (b) {
        var q = qv(b), x = AN.fistParkX(b.S, CX);
        // Approach hangs beside The Machine's eye (not over it), with a small wind-up shiver.
        var bot = AN.fistApproachBot(Math.min(b.p, 1));
        if (b.p > 0.55 && !b.out) bot += Math.sin(gt * 18) * 4 * ease((b.p - 0.55) / 0.45);
        if (b.out) {
          var rest = AN.fistApproachBot(1);
          if (q < OUT_IMPACT) bot = lerp(rest, FLOOR + 20, AN.easeInCubic(q / OUT_IMPACT));
          else if (q < 0.75) bot = FLOOR + 20;
          else bot = lerp(FLOOR + 20, -220, easeIn((q - 0.75) * 4));
        }
        var sh = clamp((bot + 120) / (FLOOR + 140), 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + 0.5 * sh) + ')'; ctx.beginPath(); ctx.ellipse(x, FLOOR + 14, 90 + 60 * sh, 14 + 6 * sh, 0, 0, TAU); ctx.fill();
        drawFist(x, bot, 1);
      },
      impact: function (b) { AU.play('boom'); shake(28); var x = AN.fistParkX(b.S, CX); sparks(x, FLOOR + 10, 40); debris(x, FLOOR + 10, 26); smoke(x, FLOOR, 10); fx.flash = Math.max(fx.flash, 0.4); }
    },
    core: {
      behind: function () { return true; },
      draw: function (b) {
        var e = ease(Math.min(b.p, 1)), q = qv(b);
        layer(0.35, function () {
          var open = 70 * e, x = CX, y = 430;
          var gone = b.out === 'win' && b.impact;
          glow(x, y, 80 + 120 * e, gone ? '255,200,120' : '255,40,40', gone ? 0.9 * (1 - q) : 0.7);
          if (!gone) { ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 40; circle(x, y, 30 + 16 * e + Math.sin(gt * 20) * 3, '#ff3a2a'); ctx.shadowBlur = 0; circle(x, y, 14, '#fff0e0'); }
          ctx.fillStyle = '#2c2528'; ctx.fillRect(x - 80 - open, y - 70, 80, 140); ctx.fillRect(x + open, y - 70, 80, 140);
          ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(x - 80 - open, y - 70, 80, 140); ctx.strokeRect(x + open, y - 70, 80, 140);
          if (b.out === 'lose' && q > 0.2 && q < 0.7) { ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 30; line(x, y, scout.x - cam.x * 0.65, 640, '#ff3030', 16); line(x, y, scout.x - cam.x * 0.65, 640, '#fff', 5); ctx.shadowBlur = 0; }
        });
      },
      impact: function (b, won) {
        if (won) { SS.broken = 1; AU.play('boom'); AU.play('smash'); fx.flash = 1; fx.flashCol = '255,240,220'; shake(30); sparks(CX, 430, 60); debris(CX, 430, 40); smoke(CX, 430, 14); pop('CORE DOWN!', CX, 360, '#ffd27a'); }
        else AU.play('zap');
      }
    },
    gap: {
      behind: function () { return true; },
      draw: function (b) {
        var q = qv(b), e = ease(Math.min(b.p, 1)), r = 30 + 110 * e;
        var open = b.out ? clamp((q - 0.15) / 0.2, 0, 1) : 0;
        if (open > 0) {
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(CX, FLOOR + 12, 145 * open + 10, 42 * open + 4, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,120,40,.15)'; ctx.beginPath(); ctx.ellipse(CX, FLOOR + 20, 100 * open, 25 * open, 0, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = '#020202'; ctx.lineWidth = 4;
        for (var i = 0; i < 9; i++) {
          var a = i / 9 * TAU + 0.3; ctx.beginPath(); ctx.moveTo(CX, FLOOR + 12);
          ctx.lineTo(CX + Math.cos(a) * r * 0.5 + 8, FLOOR + 12 + Math.sin(a) * r * 0.15); ctx.lineTo(CX + Math.cos(a) * r, FLOOR + 12 + Math.sin(a) * r * 0.3); ctx.stroke();
        }
        if (!b.out && b.p > 0.4 && Math.random() < 0.3) smoke(CX + rnd(-80, 80), FLOOR + 10, 1, '80,70,60');
      },
      impact: function (b, won) { AU.play('crash'); shake(16); debris(CX, FLOOR + 10, 24, '#4a4038'); if (!won) { scout.fall = 0; } }
    },
    shredder: {
      behind: function (b) { return !b.out || b.q < 0.15; },
      draw: function (b) {
        var q = qv(b), e = ease(Math.min(b.p, 1)), z = b.out ? lerp(1.08, 0.45, q / 0.7) : lerp(4.2, 1.08, e);
        var c = pz(0, FLOOR, z), w = 380 / z, r = 52 / z, y = c[1] - r;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(CX - w / 2, c[1] - 6 / z, w, 12 / z);
        var g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#9aa4ae'); g.addColorStop(0.5, '#4a525c'); g.addColorStop(1, '#1a1e24');
        ctx.fillStyle = g; ctx.fillRect(CX - w / 2, y - r, w, r * 2);
        var sp = gt * 16;
        for (var i = 0; i < 14; i++) {
          var xx = CX - w / 2 + (i + 0.5) * w / 14, ph = sp + i * 0.7, ty = y + Math.sin(ph) * r;
          ctx.fillStyle = Math.cos(ph) > 0 ? '#e8eef2' : '#6a737c';
          poly([xx - w / 40, ty, xx + w / 40, ty, xx, ty - (Math.cos(ph) > 0 ? 22 : 8) / z], ctx.fillStyle);
        }
        ctx.fillStyle = '#ffb000'; ctx.fillRect(CX - w / 2 - 20 / z, y - r * 1.2, 20 / z, r * 2.4); ctx.fillRect(CX + w / 2, y - r * 1.2, 20 / z, r * 2.4);
        if (Math.random() < 0.6) paper(CX + rnd(-w / 3, w / 3), y - r, 1);
      },
      start: function () { AU.play('alarm'); },
      impact: function (b, won) { if (!won) { paper(CX, FLOOR - 60, 30); AU.play('smash'); } else { paper(CX, FLOOR, 10); AU.play('whoosh'); } }
    }
  };

  // ---------- update ----------
  var CLEAR_LINES = ['One floor down. Keep moving.', 'They\'re safe. Next.', 'Nobody gets left behind.', 'Air\'s clear. Moving on.', 'Not one resume lost.', 'Still standing. Going deeper.', 'Filters beaten. Next.', 'Good dog. Bad Machine.', 'It finally blinked.'];
  var lastHint = null;
  function setHint(a) {
    if (a === lastHint) return; lastHint = a;
    Array.prototype.forEach.call(document.querySelectorAll('#pad .pb'), function (b) { b.classList.toggle('hint', b.getAttribute('data-act') === a); });
  }
  function update(dt) {
    var wdt = state === 'prompt' ? dt * 0.35 : dt;
    gt += wdt;
    if (state === 'title' || state === 'splash') { setHint(null); return; }
    SS.t += dt;
    if (state === 'intro') { T += dt; if (T > 4.8) startBeat(false); }
    else if (state === 'approach') {
      T += dt; B.p = T / B.dur;
      if (T >= B.dur) { state = 'prompt'; T = 0; B.p = 1; AU.play('cue'); }
    } else if (state === 'prompt') {
      T += dt; B.p = 1 + 0.1 * T / B.win;
      if (autoplay && T > 0.18) press(B.d.k);
      else if (T >= B.win) resolve(false);
    } else if (state === 'out') {
      T += dt; B.q = T / 0.9;
      if (!B.impact && B.q >= OUT_IMPACT) impact();
      if (B.won && T >= 1.0) beatDone();
      else if (!B.won && T >= 1.45) afterFail();
    } else if (state === 'clear') { T += dt; if (T > 3.2) toSplash(); }
    else if (state === 'victory') {
      T += dt;
      if (Math.random() < 0.6) P({ k: 'ember', x: rnd(-200, 740), y: 980, vx: rnd(-30, 30), vy: rnd(-260, -120), life: rnd(2, 4), t: 0, r: rnd(2, 5), col: Math.random() < 0.5 ? '#ffd27a' : '#6ffbea' });
    }
    setHint(state === 'prompt' ? B.d.k : null);
    updateScout(dt);
    updateParts(wdt);
    if (state !== 'victory') ambient(dt);
    // camera
    var tz = 1, tx = 0, ty = 0;
    if (state === 'intro') { tz = lerp(1.12, 1, ease(T / 4)); ty = -20; }
    else if (state === 'approach') { tz = 1 + 0.07 * ease(B.p); tx = B.S * 22 * B.p; }
    else if (state === 'prompt') { tz = 1.1; tx = B.S * 26; }
    else if (state === 'out') { tz = 1.04; tx = (scout.x - CX) * 0.3; }
    else if (state === 'clear') { tz = 1.06; ty = -30; }
    var k = Math.min(1, dt * 4);
    cam.z += (tz - cam.z) * k; cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    fx.shake *= Math.exp(-dt * 7); fx.flash = Math.max(0, fx.flash - dt * 2.2); fx.kick = Math.max(0, fx.kick - dt * 0.4);
  }
  function updateScout(dt) {
    if (!scout.cur) scout.cur = copyPose(POSES.idle);
    var dx = scout.tx - scout.x;
    scout.x += dx * Math.min(1, dt * 12);
    // Anticipatory lean into travel, with damping so it settles (not a permanent tip).
    var wantLean = clamp(dx * 0.0018, -0.35, 0.35);
    scout.leanV += (wantLean - scout.leanV) * Math.min(1, dt * 10);

    if (scout.jt >= 0) {
      scout.jt += dt;
      var up = 0.22, h = scout.hang, dn = 0.32;
      var jp = AN.jumpProfile(scout.jt, up, h, dn, scout.jh);
      scout.jy = jp.jy; scout.sx = jp.sx; scout.sy = jp.sy;
      if (jp.phase === 'landed') { scout.jt = -1; scout.jy = 0; scout.landT = 0; scout.pose = 'land'; scout.hold = 0.22; }
    } else if (scout.landT >= 0 && scout.landT < 0.35) {
      var ls = AN.landSquash(scout.landT);
      scout.sx = ls.sx; scout.sy = ls.sy;
      scout.landT += dt;
    } else {
      scout.sx += (1 - scout.sx) * Math.min(1, dt * 8);
      scout.sy += (1 - scout.sy) * Math.min(1, dt * 8);
      if (scout.landT >= 0.35) scout.landT = -9;
    }
    if (scout.fall >= 0) { scout.fall += dt; scout.jy = -scout.fall * scout.fall * 1500; }
    if (state === 'out' && B && B.out === 'lose' && B.d.t === 'arm' && B.impact) scout.lift = Math.min(60, scout.lift + dt * 220); else if (state !== 'out') scout.lift = 0;

    if (scout.atkT >= 0) scout.atkT += dt;
    if (scout.hold > 0) {
      scout.hold = Math.max(0, scout.hold - dt);
      if (scout.hold === 0 && /^(duck|dodgeL|dodgeR|land)$/.test(scout.pose)) {
        var wasDodge = /dodge/.test(scout.pose);
        scout.pose = 'ready';
        if (wasDodge) scout.tx = CX;
      }
    }

    var target = scout.pose;
    if (state === 'intro') target = 'idle';
    else if (state === 'clear' || state === 'victory') target = 'cheer';
    else if (state === 'out' && B.won && scout.pose === 'jump' && scout.jt < 0) target = 'ready';
    // Brief wind-up pose before the strike snaps (reads as weight, not teleport).
    if (scout.atkT >= 0 && scout.atkT < 0.07) {
      if (scout.pose === 'punchR') target = 'windR';
      else if (scout.pose === 'punchL') target = 'windL';
      else if (scout.pose === 'kick') target = 'windK';
    }
    if (Math.abs(dx) > 28 && (target === 'ready' || target === 'idle' || target === 'run')) target = 'run';
    if (scout.landT >= 0 && scout.landT < 0.18) target = 'land';

    // Walk cycle overlays the run target instead of a frozen run silhouette.
    var blend = Math.min(1, dt * ( /punch|kick|hit|wind/.test(target) ? 22 : target === 'jump' || target === 'land' ? 16 : 11));
    if (target === 'run') {
      var spd = clamp(Math.abs(dx) / 140, 0.35, 1.4);
      scout.walkPh += dt * 9.5 * spd;
      var wc = AN.walkCycle(scout.walkPh);
      var base = copyPose(POSES.ready);
      ['lh','lk','rh','rk','ls','le','rs','re','lean'].forEach(function (j) { base[j] = wc[j]; });
      base.lean += scout.leanV;
      mixPose(scout.cur, base, blend);
      // Tiny vertical bob via sy while grounded.
      if (scout.jt < 0 && scout.fall < 0) { scout.sy = 1 - wc.bob * 0.004; scout.sx = 1 + wc.bob * 0.002; }
    } else {
      var pose = copyPose(POSES[target] || POSES.idle);
      pose.lean += scout.leanV * (target === 'idle' || target === 'ready' ? 1 : 0.35);
      // Idle breath — slow ease, not a constant sine bob as the only life.
      if (target === 'idle' || target === 'ready') {
        var br = Math.sin(gt * 1.7) * 0.02;
        pose.ls += br; pose.rs -= br; pose.lean += Math.sin(gt * 1.1) * 0.012;
      }
      mixPose(scout.cur, pose, blend);
      if (target === 'punchR' || target === 'punchL' || target === 'kick' || target === 'punchU') {
        // Overshoot snap on the striking limb once past wind-up.
        if (scout.atkT > 0.07 && scout.atkT < 0.22) {
          var snap = AN.easeOutBack(clamp((scout.atkT - 0.07) / 0.12, 0, 1));
          if (target === 'punchR') { scout.cur.rs = lerp(POSES.windR.rs, POSES.punchR.rs, snap); scout.cur.re = lerp(POSES.windR.re, POSES.punchR.re, snap); }
          if (target === 'punchL') { scout.cur.ls = lerp(POSES.windL.ls, POSES.punchL.ls, snap); scout.cur.le = lerp(POSES.windL.le, POSES.punchL.le, snap); }
          if (target === 'kick') { scout.cur.rh = lerp(POSES.windK.rh, POSES.kick.rh, snap); scout.cur.rk = lerp(POSES.windK.rk, POSES.kick.rk, snap); }
        }
      }
    }

    // Secondary motion: hair and jacket hem lag behind lean / travel.
    var hairTarget = scout.leanV * 10 + (scout.prevX - scout.x) * 0.08;
    scout.hair += (hairTarget - scout.hair) * Math.min(1, dt * 7);
    var hemTarget = scout.leanV * 1.4 + (scout.jy > 10 ? 0.35 : 0) + (target === 'run' ? Math.sin(scout.walkPh) * 0.25 : 0);
    scout.hem += (hemTarget - scout.hem) * Math.min(1, dt * 9);
    scout.prevX = scout.x;
    if (scout.atkT > 0.45) scout.atkT = -9;
  }

  // ---------- render ----------
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
    if (state === 'title') return;
    if (state === 'victory' || (state === 'splash' && scene().ending && G.beat >= scene().beats.length)) { drawVictory(); return; }
    var sc = scene();
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
    var z = cam.z + fx.kick, sx = (Math.random() - 0.5) * fx.shake * 2, sy = (Math.random() - 0.5) * fx.shake * 2;
    ctx.translate(CX + sx, 620 + sy); ctx.scale(z, z); ctx.translate(-CX - cam.x, -620 - cam.y);
    BX0 = CX + cam.x + (VX0 - CX - 40) / z - 40; BX1 = CX + cam.x + (VX1 - CX + 40) / z + 40;
    BY0 = 620 + cam.y + (VY0 - 620 - 40) / z - 40; BY1 = 620 + cam.y + (VY1 - 620 + 40) / z + 40;
    BG[sc.bg]();
    SS.rescued.forEach(function (r) { if (!(state === 'out' && B && B.d.t === 'captive' && r.idx === G.beat)) drawOld(r.x, FLOOR - 15, 0.92, 'wave', r.idx); });
    var th = B && (state === 'approach' || state === 'prompt' || state === 'out') ? THREATS[B.d.t] : null;
    var behind = th && th.behind && th.behind(B);
    if (th && behind) th.draw(B);
    drawScout();
    if (th && !behind) th.draw(B);
    drawParts();
    if (FG[sc.bg]) FG[sc.bg]();
    // screen-space (logical) overlays
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
    if (state === 'prompt') {
      var vg = ctx.createRadialGradient(CX, 520, 200, CX, 520, 700); vg.addColorStop(0, 'rgba(64,240,220,0)'); vg.addColorStop(1, 'rgba(64,240,220,' + (0.12 + 0.08 * Math.sin(T * 25)) + ')');
      ctx.fillStyle = vg; ctx.fillRect(VX0, VY0, VX1 - VX0, VY1 - VY0);
    }
    var vg2 = ctx.createRadialGradient(CX, 540, 300, CX, 540, 820); vg2.addColorStop(0, 'rgba(0,0,0,0)'); vg2.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg2; ctx.fillRect(VX0, VY0, VX1 - VX0, VY1 - VY0);
    drawPops();
    drawCue();
    drawFail();
    if (state === 'intro') drawIntro();
    if (state === 'clear') drawClear();
    if (fx.flash > 0) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(' + fx.flashCol + ',' + Math.min(0.85, fx.flash) + ')'; ctx.fillRect(0, 0, W, H); }
    drawHUD();
  }
  function drawScout() {
    var p = copyPose(scout.cur);
    var shout = /hit|punch|kick/.test(scout.pose) && state === 'out';
    ctx.save();
    if (scout.fall >= 0) { ctx.beginPath(); ctx.rect(BX0, BY0, BX1 - BX0, FLOOR + 14 - BY0); ctx.clip(); }
    if (state === 'out' && B && !B.won && B.impact && Math.floor(gt * 20) % 2 === 0) ctx.globalAlpha = 0.6;
    drawFigure(scout.x, FLOOR, 1, p, SCOUT_LOOK, {
      jy: scout.jy + scout.lift, shout: shout, smile: state === 'clear' || state === 'victory',
      noShadow: scout.fall >= 0, sx: scout.sx, sy: scout.sy, hair: scout.hair, hem: scout.hem
    });
    ctx.restore();
  }
  function txt(s, x, y, size, col, align, weight, stroke) {
    ctx.font = (weight || 900) + ' ' + size + 'px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeText(s, x, y); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  function wrap(s, maxW, size) {
    ctx.font = '700 ' + size + 'px system-ui, sans-serif';
    var words = s.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawPops() {
    pops.forEach(function (p) { var a = 1 - p.t / 1.1; ctx.globalAlpha = a; txt(p.text, p.x, p.y - p.t * 60, 30, p.col, 'center', 900, '#000'); });
    ctx.globalAlpha = 1;
  }
  var CUE_POS = { left: [72, 600], right: [468, 600], up: [270, 210], down: [270, 870], strike: [270, 300] };
  var CUE_LABEL = { left: 'DODGE', right: 'DODGE', up: 'JUMP', down: 'DUCK', strike: 'STRIKE' };
  function drawCue() {
    if (state !== 'prompt') return;
    var k = B.d.k, pos = CUE_POS[k], frac = clamp(1 - T / B.win, 0, 1), on = Math.floor(T * 12) % 2 === 0;
    var x = pos[0], y = pos[1], pulse = 1 + 0.08 * Math.sin(T * 30);
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(0, 0, 64, 0, TAU); ctx.fill();
    ctx.strokeStyle = frac > 0.5 ? '#6ffbea' : frac > 0.25 ? '#ffd27a' : '#ff4a3a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 60, -PI / 2, -PI / 2 + frac * TAU); ctx.stroke();
    ctx.shadowColor = k === 'strike' ? '#ff6a2a' : '#ffd27a'; ctx.shadowBlur = 24;
    var col = on ? '#ffffff' : (k === 'strike' ? '#ff6a2a' : '#ffd27a');
    if (k === 'strike') {
      var pts = []; for (var i = 0; i < 24; i++) { var a = i / 24 * TAU, r = i % 2 ? 30 : 52; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
      poly(pts, col); ctx.shadowBlur = 0; txt('HIT', 0, 2, 22, '#2a0a00', 'center', 900);
    } else {
      var rot = { right: 0, down: PI / 2, left: PI, up: -PI / 2 }[k];
      ctx.rotate(rot); poly([-30, -16, 4, -16, 4, -36, 40, 0, 4, 36, 4, 16, -30, 16], col, '#1a0a00', 3);
    }
    ctx.restore();
    var lbl = CUE_LABEL[k] + '  ' + keyName(keymap[k][0]);
    var ly = k === 'down' ? y - 92 : y + 92, lx = clamp(x, 100, 440);
    ctx.font = '900 22px system-ui, sans-serif'; var w = ctx.measureText(lbl).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; rrect(lx - w / 2, ly - 20, w, 40, 20); ctx.fill();
    txt(lbl, lx, ly + 1, 22, on ? '#fff' : '#ffd27a', 'center', 900);
  }
  function drawFail() {
    var t = gt - fx.failT;
    if (!(state === 'out' && B && !B.won && B.impact)) return;
    t = T - 0.29;
    var s = 1 + Math.max(0, 0.6 - t * 3);
    ctx.save(); ctx.translate(CX, 380); ctx.scale(s, s); ctx.rotate(-0.06);
    txt(fx.failWord + '!', 0, 0, 54, '#ff4a3a', 'center', 900, '#140000');
    ctx.restore();
    txt(G.lives > 0 ? 'Life lost \u2022 ' + G.lives + ' left \u2022 retrying' : 'No lives left', CX, 440, 20, '#ffd0c8', 'center', 700, '#000');
    var img = IMG['scout-closeup-shout'];
    if (imgOk(img)) {
      var a = clamp(t * 5, 0, 1), cx = 92, cy = 540 - 20 * a, r = 74;
      ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      ctx.drawImage(img, img.naturalWidth * 0.15, img.naturalHeight * 0.17, img.naturalWidth * 0.7, img.naturalWidth * 0.7, cx - r, cy - r, r * 2, r * 2);
      ctx.restore(); ctx.globalAlpha = a; ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  function panelImage(img, x, y, w, h, sy) {
    ctx.save(); rrect(x, y, w, h, 14); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    if (imgOk(img)) { var sw = img.naturalWidth, sh = sw * h / w; ctx.drawImage(img, 0, img.naturalHeight * sy, sw, sh, x, y, w, h); }
    ctx.restore();
    ctx.strokeStyle = '#40f0dc'; ctx.lineWidth = 4; rrect(x, y, w, h, 14); ctx.stroke();
  }
  function speech(s, x, y, w, size, chars) {
    var lines = wrap(s, w - 36, size), h = lines.length * size * 1.3 + 28;
    ctx.fillStyle = '#faf8f3'; ctx.strokeStyle = '#0a1628'; ctx.lineWidth = 4; rrect(x, y - h, w, h, 16); ctx.fill(); ctx.stroke();
    poly([x + 70, y - 2, x + 110, y - 2, x + 80, y + 26], '#faf8f3'); line(x + 70, y, x + 80, y + 26, '#0a1628', 4); line(x + 110, y, x + 80, y + 26, '#0a1628', 4);
    var left = chars;
    lines.forEach(function (l, i) {
      var show = left >= l.length ? l : l.slice(0, Math.max(0, left)); left -= l.length + 1;
      ctx.font = '700 ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#0a1628';
      ctx.fillText(show, x + 18, y - h + 14 + size * 0.65 + i * size * 1.3);
    });
  }
  function drawIntro() {
    var sc = scene(), n = G.scene + 1, a = easeOut(T / 0.5);
    ctx.globalAlpha = clamp(T * 3, 0, 1);
    txt('SCENE ' + n + ' / 10', CX, 135 - 30 * (1 - a), 22, '#6ffbea', 'center', 800, '#000');
    txt(sc.name.toUpperCase(), CX, 178 - 30 * (1 - a), sc.name.length > 18 ? 32 : 38, '#ffd27a', 'center', 900, '#2a1000');
    ctx.globalAlpha = 1;
    var py = lerp(980, 600, easeOut((T - 0.15) / 0.45));
    panelImage(IMG['scout-closeup-' + sc.face], 40, py, 460, 330, 0.12);
    if (T > 0.5) speech(sc.line, 30, py - 18, 480, 22, Math.floor((T - 0.5) * 48));
    if (T > 1) txt('STRIKE / tap to start', CX, 950, 16, 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(T * 5)) + ')', 'center', 700);
  }
  function drawClear() {
    var sc = scene(), n = G.scene + 1, a = easeOut(T / 0.35);
    ctx.save(); ctx.translate(CX, 165); ctx.rotate(-0.08); ctx.scale(2 - a, 2 - a); ctx.globalAlpha = a;
    txt('SCENE ' + n + ' CLEAR', 0, 0, 46, '#ffd27a', 'center', 900, '#2a1000');
    ctx.restore(); ctx.globalAlpha = 1;
    txt('Score ' + G.score + '   \u2022   +' + (500 + G.lives * 50) + ' bonus', CX, 225, 20, '#e8fbf8', 'center', 700, '#000');
    if (sc.cutin && imgOk(IMG['poster-2-armsout'])) {
      var im = IMG['poster-2-armsout'], k = easeOut((T - 0.2) / 0.5), w = 330, h = w * 16 / 9, x = CX - w / 2, y = lerp(980, 250, k);
      ctx.save(); rrect(x, y, w, h, 14); ctx.clip(); var zz = 1 + T * 0.03;
      ctx.drawImage(im, x - (w * zz - w) / 2, y - (h * zz - h) / 2, w * zz, h * zz); ctx.restore();
      ctx.strokeStyle = '#40f0dc'; ctx.lineWidth = 4; rrect(x, y, w, h, 14); ctx.stroke();
    } else {
      var py = lerp(980, 600, easeOut((T - 0.2) / 0.45));
      panelImage(IMG['scout-closeup-smile'], 40, py, 460, 330, 0.12);
      if (T > 0.5) speech(CLEAR_LINES[G.scene % CLEAR_LINES.length], 30, py - 18, 480, 22, Math.floor((T - 0.5) * 48));
    }
  }
  function drawVictory() {
    // The ending art is shown whole (logical 0..960) even on landscape screens.
    var keep = [S, OX, OY, VX0, VX1, VY0, VY1];
    S = Math.min(W / LW, H / LH); OX = (W - LW * S) / 2; OY = (H - LH * S) / 2;
    VX0 = -OX / S; VX1 = LW + OX / S; VY0 = -OY / S; VY1 = LH + OY / S;
    drawVictoryInner();
    S = keep[0]; OX = keep[1]; OY = keep[2]; VX0 = keep[3]; VX1 = keep[4]; VY0 = keep[5]; VY1 = keep[6];
  }
  function drawVictoryInner() {
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
    var g = ctx.createRadialGradient(CX, 480, 50, CX, 480, 900); g.addColorStop(0, '#5a3010'); g.addColorStop(1, '#0a0604');
    ctx.fillStyle = g; ctx.fillRect(VX0, VY0, VX1 - VX0, VY1 - VY0);
    var im = IMG['scout-hero-rescued'];
    if (imgOk(im)) {
      var zz = 1.02 + Math.min(T, 12) * 0.006, w = LW * zz, h = LH * zz;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
      ctx.drawImage(im, CX - w / 2, 480 - h / 2 + Math.sin(T * 0.5) * 6, w, h); ctx.restore();
      if (VX0 < -5) { var eg = ctx.createLinearGradient(-60, 0, 0, 0); eg.addColorStop(0, 'rgba(10,6,4,0)'); eg.addColorStop(1, 'rgba(10,6,4,.6)'); ctx.fillStyle = eg; ctx.fillRect(-60, VY0, 60, VY1 - VY0); }
    }
    ctx.fillStyle = vgrad(0, 260, ['rgba(0,0,0,.75)', 'rgba(0,0,0,0)']); ctx.fillRect(VX0, 0, VX1 - VX0, 260);
    ctx.fillStyle = vgrad(700, 960, ['rgba(0,0,0,0)', 'rgba(0,0,0,.8)']); ctx.fillRect(VX0, 700, VX1 - VX0, 260);
    drawParts();
    var a = easeOut(T / 0.6);
    ctx.save(); ctx.translate(CX, 92); ctx.scale(1.6 - 0.6 * a, 1.6 - 0.6 * a); ctx.globalAlpha = a;
    txt('THE MACHINE IS DOWN', 0, 0, 40, '#ffd27a', 'center', 900, '#2a1000'); ctx.restore(); ctx.globalAlpha = 1;
    if (T > 0.8) txt('Every job seeker walks out a person, not a number.', CX, 140, 18, '#fff', 'center', 700, '#000');
    if (T > 1.4) { txt('FINAL SCORE ' + G.score, CX, 850, 32, '#6ffbea', 'center', 900, '#000'); txt('Rescued ' + G.rescued + ' by hand \u2022 thousands set free', CX, 890, 18, '#fff', 'center', 700, '#000'); }
    if (T > 2.2) txt('STRIKE / tap to continue', CX, 930, 18, 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(T * 5)) + ')', 'center', 700, '#000');
    if (fx.flash > 0) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(' + fx.flashCol + ',' + Math.min(0.9, fx.flash) + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function drawHUD() {
    if (state === 'title') return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var small = W < 480, fs = small ? 13 : 15;
    ctx.fillStyle = 'rgba(4,8,16,.62)'; rrect(8, 8, small ? 150 : 210, small ? 52 : 58, 10); ctx.fill();
    txt('SCENE ' + (G.scene + 1) + '/10', 18, 22, fs, '#6ffbea', 'left', 800);
    for (var i = 0; i < 5; i++) {
      var x = 22 + i * (small ? 22 : 26), y = small ? 44 : 46, on = i < G.lives;
      ctx.fillStyle = on ? '#40f0dc' : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(4,8,16,.62)'; rrect(W - (small ? 130 : 170), 52, small ? 122 : 162, small ? 40 : 46, 10); ctx.fill();
    txt('SCORE ' + G.score, W - 16, small ? 64 : 66, fs, '#fff', 'right', 800);
    txt('HI ' + Math.max(hi, G.score), W - 16, small ? 82 : 86, small ? 11 : 12, '#9fc6cc', 'right', 700);
  }

  // ---------- loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    pollPad();
    if (!paused) update(dt);
    render();
    requestAnimationFrame(frame);
  }
  if (DEBUG) {
    window.scoutDebug = {
      state: function () { return { state: state, scene: G.scene, beat: G.beat, lives: G.lives, score: G.score, paused: paused, key: B ? B.d.k : null, threat: B ? B.d.t : null, splash: splashOpen(), audio: AU.state() }; },
      goto: function (i) { elTitle.classList.remove('show'); state = 'play'; G.lives = 5; startScene(i | 0); },
      autoplay: function (v) { autoplay = !!v; },
      victory: function () { elTitle.classList.remove('show'); G.scene = SCENES.length - 1; G.beat = SCENES[G.scene].beats.length; startVictory(); },
      press: function (a) { press(a); },
      setLives: function (n) { G.lives = n; },
      scenes: SCENES.length
    };
  }
  resize();
  toTitle('');
  requestAnimationFrame(frame);
})();
