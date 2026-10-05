/*
 * Defender-style arcade tribute for eduaccess.pro/games.
 * Built from scratch: every sprite is drawn in code and every sound is
 * synthesized with the Web Audio API. No original art or audio is used.
 * Written by: Howie
 */
(() => {
  "use strict";

  // ------------------------------------------------------------ constants
  let W = 960; // logical view width; 520 in phone portrait so the playfield is taller on screen
  const H = 540;
  const VIEW_W = 960, VIEW_W_PORTRAIT = 520;
  const HUD_H = 76;
  const PLAY_TOP = HUD_H + 8;
  const GROUND_Y = 524;
  const SHIP_MIN_Y = PLAY_TOP + 12;
  const SHIP_MAX_Y = 506;
  const WORLD_W = VIEW_W * 8;
  const STEP = 1 / 120;
  const PX = 3;
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';
  const TITLE_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
  const LS = {
    hi: "eduaccess.defender.hiscore.v1",
    keys: "eduaccess.defender.keys.v1",
    mute: "eduaccess.defender.mute.v1",
    fx: "eduaccess.defender.fx.v1",
    touch: "eduaccess.defender.touch.v1",
    rotate: "eduaccess.defender.rotatehint.v1"
  };
  const SC = { x: 300, y: 7, w: 360, h: 60 };
  function fitHud() { SC.w = W < 800 ? 230 : 360; SC.x = Math.round((W - SC.w) / 2); }

  const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

  const wrapX = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;
  const wdx = (from, to) => {
    let d = (to - from) % WORLD_W;
    if (d > WORLD_W / 2) d -= WORLD_W;
    if (d < -WORLD_W / 2) d += WORLD_W;
    return d;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sgn = () => (Math.random() < 0.5 ? -1 : 1);

  // ------------------------------------------------------------ controls
  const ACTIONS = [
    ["up", "Climb"],
    ["down", "Dive"],
    ["left", "Face left + thrust"],
    ["right", "Face right + thrust"],
    ["fire", "Fire laser"],
    ["bomb", "Smart bomb"],
    ["hyper", "Hyperspace"],
    ["pause", "Pause"],
    ["mute", "Sound on/off"]
  ];
  const DEFAULT_KEYS = {
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    fire: ["Space", "KeyZ"],
    bomb: ["KeyX", "KeyB"],
    hyper: ["KeyC", "KeyH"],
    pause: ["KeyP", "Escape"],
    mute: ["KeyM", ""]
  };
  function loadBindings() {
    let saved = null;
    try { saved = JSON.parse(lsGet(LS.keys) || "null"); } catch (e) { saved = null; }
    const out = {};
    for (const [a] of ACTIONS) {
      const d = DEFAULT_KEYS[a];
      const v = saved && Array.isArray(saved[a]) ? saved[a] : d;
      out[a] = [typeof v[0] === "string" && v[0] ? v[0] : d[0], typeof v[1] === "string" ? v[1] : d[1]];
    }
    return out;
  }
  let bindings = loadBindings();
  let codeMap = {};
  function rebuildCodeMap() {
    codeMap = {};
    for (const a in bindings) {
      for (const c of bindings[a]) {
        if (!c) continue;
        if (!codeMap[c]) codeMap[c] = [];
        codeMap[c].push(a);
      }
    }
  }
  rebuildCodeMap();
  const KEY_NAMES = {
    ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowLeft: "\u2190", ArrowRight: "\u2192", Space: "Space", Escape: "Esc",
    Enter: "Enter", ShiftLeft: "L Shift", ShiftRight: "R Shift", ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
    AltLeft: "L Alt", AltRight: "R Alt", MetaLeft: "L Cmd", MetaRight: "R Cmd", Backquote: "`", Minus: "-",
    Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",",
    Period: ".", Slash: "/", Tab: "Tab", Backspace: "Backspace", CapsLock: "Caps"
  };
  function keyLabel(code) {
    if (!code) return "\u2014";
    if (KEY_NAMES[code]) return KEY_NAMES[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return "Num " + code.slice(6);
    return code;
  }
  const keyOf = (a) => keyLabel(bindings[a][0]);

  const heldCodes = new Set();
  const touchHeld = {};
  const padHeld = {};
  const pressed = new Set();
  function isDown(a) {
    if (touchHeld[a] || padHeld[a]) return true;
    const ks = bindings[a];
    return !!ks && ((ks[0] && heldCodes.has(ks[0])) || (ks[1] && heldCodes.has(ks[1])));
  }

  // ------------------------------------------------------------ audio (all synthesized)
  const Sfx = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx = null, out = null, noise = null, thrustGain = null, thrustLevel = -1, lastShot = 0;
    let muted = lsGet(LS.mute) === "1";
    function unlock() {
      if (!AC) return;
      if (!ctx) {
        try { ctx = new AC(); } catch (e) { ctx = null; return; }
        out = ctx.createGain();
        out.gain.value = muted ? 0 : 0.55;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6;
        out.connect(comp); comp.connect(ctx.destination);
        const len = ctx.sampleRate * 2;
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = noise; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.7;
        thrustGain = ctx.createGain(); thrustGain.gain.value = 0;
        src.connect(lp); lp.connect(thrustGain); thrustGain.connect(out);
        src.start();
        const blank = ctx.createBuffer(1, 1, 22050);
        const b = ctx.createBufferSource(); b.buffer = blank; b.connect(ctx.destination); b.start(0);
      }
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    }
    const ok = () => ctx && ctx.state === "running" && !muted;
    function env(g, t0, attack, dur, vol) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    function tone(o) {
      if (!ok()) return;
      const t0 = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator();
      osc.type = o.type || "square";
      const g = ctx.createGain();
      if (o.curve) osc.frequency.setValueCurveAtTime(o.curve, t0, o.dur);
      else {
        osc.frequency.setValueAtTime(o.f0, t0);
        if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
      }
      if (o.detune) osc.detune.value = o.detune;
      env(g, t0, o.attack || 0.004, o.dur, o.vol || 0.2);
      osc.connect(g); g.connect(out);
      osc.start(t0); osc.stop(t0 + o.dur + 0.05);
    }
    function burst(o) {
      if (!ok()) return;
      const t0 = ctx.currentTime + (o.delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = o.rate || 1;
      const f = ctx.createBiquadFilter();
      f.type = o.filter || "lowpass"; f.Q.value = o.q || 0.8;
      f.frequency.setValueAtTime(o.f0 || 3000, t0);
      f.frequency.exponentialRampToValueAtTime(o.f1 || 120, t0 + o.dur);
      const g = ctx.createGain();
      env(g, t0, o.attack || 0.003, o.dur, o.vol || 0.4);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t0, Math.random() * 1.5); src.stop(t0 + o.dur + 0.05);
    }
    function wobble(f0, f1, dur, rate, depth, n = 96) {
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = i / (n - 1);
        c[i] = f0 * Math.pow(f1 / f0, p) * (1 + depth * Math.sin(p * dur * rate * Math.PI * 2));
      }
      return c;
    }
    function steps(arr, per = 6) {
      const c = new Float32Array(arr.length * per);
      for (let i = 0; i < c.length; i++) c[i] = arr[Math.floor(i / per)];
      return c;
    }
    return {
      unlock,
      get ready() { return !!ctx && ctx.state === "running"; },
      get muted() { return muted; },
      setMuted(m) {
        muted = m;
        lsSet(LS.mute, m ? "1" : "0");
        if (ctx && out) out.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
      },
      thrust(level) {
        if (!ctx || !thrustGain || level === thrustLevel) return;
        thrustLevel = level;
        thrustGain.gain.setTargetAtTime(muted ? 0 : level * 0.2, ctx.currentTime, 0.05);
      },
      laser() {
        tone({ type: "square", f0: 2300, f1: 170, dur: 0.16, vol: 0.085 });
        tone({ type: "sawtooth", f0: 1550, f1: 95, dur: 0.2, vol: 0.05, detune: 14 });
      },
      enemyShot() {
        const t = performance.now();
        if (t - lastShot < 80) return;
        lastShot = t;
        tone({ type: "triangle", f0: 820, f1: 1500, dur: 0.07, vol: 0.09 });
      },
      explode(big) {
        burst({ dur: big ? 0.75 : 0.42, vol: big ? 0.46 : 0.32, f0: 4200, f1: 90 });
        tone({ type: "sine", f0: big ? 170 : 230, f1: 38, dur: big ? 0.6 : 0.32, vol: 0.3 });
      },
      shipDie() {
        burst({ dur: 1.9, vol: 0.55, f0: 6500, f1: 60 });
        tone({ type: "sawtooth", curve: wobble(950, 50, 1.6, 9, 0.18), dur: 1.6, vol: 0.17 });
        tone({ type: "sine", f0: 130, f1: 30, dur: 1.4, vol: 0.4 });
      },
      bomb() {
        burst({ dur: 1.25, vol: 0.66, f0: 8000, f1: 50 });
        burst({ dur: 0.5, vol: 0.45, f0: 1300, f1: 200, filter: "bandpass", q: 2, delay: 0.05 });
        tone({ type: "sawtooth", f0: 330, f1: 28, dur: 1.1, vol: 0.24 });
      },
      hyper() {
        tone({ type: "sine", curve: wobble(170, 2400, 0.6, 18, 0.08), dur: 0.6, vol: 0.22 });
        tone({ type: "square", curve: wobble(85, 1200, 0.6, 18, 0.1), dur: 0.6, vol: 0.05 });
      },
      scream() {
        tone({ type: "sawtooth", curve: wobble(1350, 470, 0.8, 11, 0.07), dur: 0.8, vol: 0.09 });
        tone({ type: "square", curve: wobble(1365, 460, 0.8, 13, 0.06), dur: 0.8, vol: 0.035 });
      },
      warp() { tone({ type: "triangle", curve: steps([300, 420, 560, 760, 1000, 1350, 1700]), dur: 0.38, vol: 0.07 }); },
      mutant() { tone({ type: "sawtooth", curve: wobble(480, 1700, 0.38, 30, 0.25), dur: 0.38, vol: 0.12 }); },
      humanDie() { tone({ type: "square", f0: 720, f1: 80, dur: 0.55, vol: 0.12 }); },
      caught() {
        tone({ type: "square", f0: 660, dur: 0.08, vol: 0.1 });
        tone({ type: "square", f0: 990, dur: 0.12, vol: 0.1, delay: 0.08 });
      },
      saved() { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: "square", f0: f, dur: 0.09, vol: 0.085, delay: i * 0.07 })); },
      extraLife() { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: "square", f0: f, dur: 0.1, vol: 0.09, delay: i * 0.065 })); },
      wave() { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.17, vol: 0.14, delay: i * 0.1 })); },
      bonus() { tone({ type: "square", f0: 1046, dur: 0.06, vol: 0.07 }); },
      baiter() { [1250, 880, 1250, 880].forEach((f, i) => tone({ type: "square", f0: f, dur: 0.06, vol: 0.085, delay: i * 0.07 })); },
      planet() {
        burst({ dur: 2.8, vol: 0.75, f0: 5000, f1: 40 });
        tone({ type: "sawtooth", f0: 220, f1: 20, dur: 2.6, vol: 0.3 });
      }
    };
  })();

  // ------------------------------------------------------------ sprites (original pixel art)
  const PAL = {
    W: "#f2f5ff", B: "#5ce1ff", P: "#8d5bff", R: "#ff3d3d", G: "#38f26a", g: "#169c3c", Y: "#ffe23d",
    O: "#ff8a1e", M: "#ff3fd4", K: "#b4ff3a", C: "#3d8bff", E: "#ff2d6f", S: "#ffcfa6"
  };
  const swap = (rows, a, b) => rows.map((r) => r.replace(new RegExp("[" + a + b + "]", "g"), (c) => (c === a ? b : a)));
  const SHIP = [
    "WW..............",
    "WWW.............",
    "WWWW..BBB.......",
    "RWWWWWWBBBWWW...",
    "PPPPPPPPPPPPPPWW",
    "RPPPPPPPPPPPP...",
    ".R.............."
  ];
  const LANDER = [
    "...GGGGG...",
    "..GYGGGYG..",
    ".GGGGGGGGG.",
    ".GgGgGgGgG.",
    "..GGGGGGG..",
    "..Y..Y..Y..",
    ".Y...Y...Y.",
    "Y....Y....Y"
  ];
  const LANDER2 = LANDER.map((r, i) => (i === 1 ? "..GOGGGOG.." : i === 3 ? ".gGgGgGgGg." : r));
  const MUTANT = [
    "...MMMMM...",
    "..MKMMMKM..",
    ".MMMMMMMMM.",
    ".MKMKMKMKM.",
    "..MMMMMMM..",
    "..K..K..K..",
    ".K...K...K.",
    "K....K....K"
  ];
  const BOMBER = [
    ".CCCCCCC.",
    "CCPPPPPCC",
    "CP.....PC",
    "CP.YYY.PC",
    "CP.YWY.PC",
    "CP.YYY.PC",
    "CP.....PC",
    "CCPPPPPCC",
    ".CCCCCCC."
  ];
  const POD = [
    "E...M...E",
    ".E..M..E.",
    "..EMMME..",
    "...MYM...",
    "MMMYWYMMM",
    "...MYM...",
    "..EMMME..",
    ".E..M..E.",
    "E...M...E"
  ];
  const SWARMER = ["..RRR..", ".RYYYR.", "RRYWYRR", ".R...R.", "R.....R"];
  const SWARMER2 = ["..RRR..", ".RYYYR.", "RRYWYRR", ".R...R.", "..R.R.."];
  const baiterFrame = (f) => [
    ".....KKKKK.....",
    "...KKKKKKKKK...",
    Array.from({ length: 15 }, (_, i) => ((i + f) % 4 === 0 ? "W" : "K")).join(""),
    "...KKKKKKKKK...",
    ".....KKKKK....."
  ];
  const HUMAN = ["..S..", ".SSS.", "..P..", ".PPP.", "P.P.P", "..P..", ".G.G.", ".G.G."];
  const HUMAN2 = HUMAN.map((r, i) => (i === 7 ? "G...G" : r));
  const HUMAN_UP = ["S.S.S", ".SSS.", "..P..", ".PPP.", "..P..", "..P..", ".G.G.", "G...G"];
  const MINE = ["E.E", ".W.", "E.E"];
  const MINE2 = [".E.", "EWE", ".E."];

  const SPRITE_DEFS = {
    shipR: { frames: [SHIP], glow: "#a9b9ff" },
    shipL: { frames: [SHIP], glow: "#a9b9ff", flip: true },
    lander: { frames: [LANDER, LANDER2], glow: "#38f26a" },
    mutant: { frames: [MUTANT, swap(MUTANT, "M", "K")], glow: "#ff3fd4" },
    bomber: { frames: [BOMBER, swap(BOMBER, "Y", "O")], glow: "#3d8bff" },
    pod: { frames: [POD, swap(POD, "E", "R")], glow: "#ff3fd4" },
    swarmer: { frames: [SWARMER, SWARMER2], glow: "#ff3d3d" },
    baiter: { frames: [baiterFrame(0), baiterFrame(1), baiterFrame(2), baiterFrame(3)], glow: "#b4ff3a" },
    human: { frames: [HUMAN, HUMAN2, HUMAN_UP], glow: "#c9a3ff" },
    mine: { frames: [MINE, MINE2], glow: "#ff2d6f" }
  };
  function pixelList(rows) {
    const out = [];
    const cols = rows[0].length;
    rows.forEach((r, y) => {
      for (let x = 0; x < cols; x++) {
        const c = PAL[r[x]];
        if (c) out.push({ x: (x - cols / 2 + 0.5) * PX, y: (y - rows.length / 2 + 0.5) * PX, c });
      }
    });
    return out;
  }
  const WARP_PIXELS = { lander: pixelList(LANDER), mutant: pixelList(MUTANT) };

  let fxOn = lsGet(LS.fx) !== "0";
  let sprites = {};
  let spriteScale = 0;
  let bulletImg = null;

  function renderSprite(rows, scale, glow, flip) {
    const src = flip ? rows.map((r) => r.split("").reverse().join("")) : rows;
    const cols = src[0].length, nr = src.length, pad = 6;
    const w = cols * PX + pad * 2, h = nr * PX + pad * 2;
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    const at = (x, y) => (y >= 0 && y < nr && x >= 0 && x < cols ? src[y][x] : ".");
    const paint = (glowPass) => {
      for (let y = 0; y < nr; y++) {
        for (let x = 0; x < cols; x++) {
          const col = PAL[src[y][x]];
          if (!col) continue;
          const px = pad + x * PX, py = pad + y * PX;
          g.fillStyle = col;
          g.fillRect(px, py, PX, PX);
          if (glowPass) continue;
          if (!PAL[at(x, y - 1)]) { g.fillStyle = "rgba(255,255,255,0.42)"; g.fillRect(px, py, PX, PX * 0.32); }
          if (!PAL[at(x, y + 1)]) { g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(px, py + PX * 0.7, PX, PX * 0.3); }
          if (!PAL[at(x - 1, y)]) { g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(px, py, PX * 0.28, PX); }
        }
      }
    };
    if (fxOn && glow) {
      g.save();
      g.shadowColor = glow; g.shadowBlur = 7 * scale; g.globalAlpha = 0.75;
      paint(true);
      g.restore();
    }
    paint(false);
    return { img: c, w, h };
  }
  function buildSprites(scale) {
    sprites = {};
    for (const name in SPRITE_DEFS) {
      const d = SPRITE_DEFS[name];
      sprites[name] = d.frames.map((f) => renderSprite(f, scale, d.glow, d.flip));
    }
    const size = 14;
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(size * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.28, "#ffe6fb");
    grad.addColorStop(0.5, "rgba(255,80,210,0.75)"); grad.addColorStop(1, "rgba(255,60,200,0)");
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    bulletImg = { img: c, w: size, h: size };
    spriteScale = scale;
  }

  // ------------------------------------------------------------ world
  const TSEG = 16;
  const TN = WORLD_W / TSEG;
  const terrain = new Float32Array(TN);
  const backRange = new Float32Array(TN / 2);
  function genTerrain() {
    // Jagged arcade-style ridge line: alternating peaks and valleys, linearly joined, seamless at the wrap.
    const pts = [];
    let x = 0, peak = true;
    while (x < WORLD_W - 60) {
      pts.push({ x, y: peak ? rand(392, 468) : rand(478, 512) });
      x += rand(36, 120);
      peak = !peak;
    }
    if (pts.length % 2) pts.pop();
    for (let i = 0; i < TN; i++) {
      const wx = i * TSEG;
      let j = 0;
      while (j < pts.length - 1 && pts[j + 1].x <= wx) j++;
      const a = pts[j], b = j + 1 < pts.length ? pts[j + 1] : { x: WORLD_W, y: pts[0].y };
      const t = (wx - a.x) / Math.max(1, b.x - a.x);
      terrain[i] = a.y + (b.y - a.y) * clamp(t, 0, 1);
    }
    const back = [];
    for (let i = 0; i < 5; i++) back.push({ k: irand(2 + i * 2, 4 + i * 4), a: rand(10, 22) / (1 + i * 0.5), p: rand(0, Math.PI * 2) });
    for (let i = 0; i < TN / 2; i++) {
      const x = i / (TN / 2);
      let h = 0;
      for (const c of back) h += c.a * Math.sin(2 * Math.PI * c.k * x + c.p);
      backRange[i] = clamp(440 - Math.abs(h) * 1.6, 360, 470);
    }
  }
  function terrainY(x) {
    const fx = wrapX(x) / TSEG;
    const i = Math.floor(fx), t = fx - i;
    const a = terrain[i % TN], b = terrain[(i + 1) % TN];
    return a + (b - a) * t;
  }
  const STAR_COLORS = ["#ffffff", "#9fb6ff", "#ffd6a0", "#ff9ae6", "#a0fff0"];
  const stars = Array.from({ length: 150 }, () => ({
    x: rand(0, W), y: rand(HUD_H + 6, 440), p: pick([0.125, 0.25, 0.375]),
    s: pick([1, 1, 1.5, 2]), c: pick(STAR_COLORS), a: rand(0.35, 1), f: rand(0.8, 3.5), ph: rand(0, 6.3)
  }));

  const SPEC = {
    lander: { rx: 15, ry: 13, pts: 150, colors: [PAL.G, PAL.Y, PAL.W, PAL.g] },
    mutant: { rx: 15, ry: 13, pts: 150, colors: [PAL.M, PAL.K, PAL.W] },
    bomber: { rx: 13, ry: 13, pts: 250, colors: [PAL.C, PAL.P, PAL.Y, PAL.W] },
    pod: { rx: 13, ry: 13, pts: 1000, colors: [PAL.M, PAL.E, PAL.Y, PAL.W] },
    swarmer: { rx: 10, ry: 8, pts: 150, colors: [PAL.R, PAL.Y, PAL.W] },
    baiter: { rx: 22, ry: 8, pts: 200, colors: [PAL.K, PAL.W, PAL.G] }
  };
  const FIRE_RATE = { lander: 2.8, mutant: 1.5, swarmer: 2.4, baiter: 0.9 };
  const SCANNER_COLORS = { lander: "#38f26a", mutant: "#ff3fd4", bomber: "#3d8bff", pod: "#c06bff", swarmer: "#ff3d3d", baiter: "#b4ff3a" };

  const G = {
    state: "attract", paused: false, t: 0, msgT: 0, score: 0, hi: Number(lsGet(LS.hi)) || 0, lives: 3, bombs: 3,
    wave: 1, nextBonus: 10000, camX: 0, shipSX: W * 0.28, planet: true, toSpawn: 0, spawnT: 0, baiterT: 0,
    waveT: 0, flash: 0, flashColor: "255,255,255", shake: 0, banner: "", sub: "", bannerT: 0, newHi: false,
    deadT: 0, ring: null, bonusMult: 0, bonusHumans: 0, bonusShown: 0
  };
  const ship = { x: 0, y: 280, vx: 0, vy: 0, face: 1, alive: false, inv: 0, hyper: 0, fireCD: 0, lastShot: -1, thrust: 0, carry: null };
  let enemies = [], humans = [], beams = [], bullets = [], mines = [], parts = [], popups = [];

  const onScreenX = (x, m = 30) => { const sx = wdx(G.camX, x); return sx > -m && sx < W + m; };
  const countType = (t) => { let n = 0; for (const e of enemies) if (!e.dead && e.type === t) n++; return n; };
  const shipHittable = () => ship.alive && ship.hyper <= 0 && ship.inv <= 0 && G.state === "playing";

  function showBanner(text, sub, t) { G.banner = text; G.sub = sub || ""; G.bannerT = t || 2.2; }

  function makeHuman(x) {
    return { x: wrapX(x), y: GROUND_Y - 12, vx: rand(6, 14) * sgn(), vy: 0, state: "walk", t: rand(0, 10), targeted: null, fallFrom: 0, screamT: 0 };
  }
  function resetShip(x) {
    Object.assign(ship, { x: wrapX(x), y: 280, vx: 0, vy: 0, face: 1, alive: true, inv: 2.2, hyper: 0, fireCD: 0, lastShot: -1, thrust: 0, carry: null });
    G.shipSX = W * 0.28;
    G.camX = wrapX(ship.x - G.shipSX);
  }
  function newGame() {
    Sfx.unlock();
    Object.assign(G, { score: 0, lives: 3, bombs: 3, wave: 0, nextBonus: 10000, newHi: false, planet: true, ring: null, paused: false });
    genTerrain();
    humans = [];
    for (let i = 0; i < 10; i++) humans.push(makeHuman((i + rand(0.1, 0.9)) * (WORLD_W / 10)));
    parts = []; popups = [];
    resetShip(rand(0, WORLD_W));
    startWave(1);
  }
  function toAttract() {
    G.state = "attract"; G.paused = false;
    enemies = []; humans = []; bullets = []; mines = []; beams = []; popups = [];
    ship.alive = false;
    Sfx.thrust(0);
  }
  function farX(min) {
    return wrapX(ship.x + sgn() * rand(min || W * 0.8, WORLD_W / 2));
  }
  function addEnemy(type, x, y, warp) {
    const sp = SPEC[type];
    const e = {
      type, x: wrapX(x), y, vx: 0, vy: 0, rx: sp.rx, ry: sp.ry, t: rand(0, 10), ph: rand(0, 6.28), fireT: rand(1, 3),
      warp: warp || 0, state: "seek", target: null, carry: null, cruiseY: rand(PLAY_TOP + 40, 330), seekDelay: rand(1.5, 5),
      dropT: rand(0.6, 1.4), baseY: y, off: rand(-220, 220), dead: false
    };
    if (type === "lander") { e.vx = rand(28, 55) * sgn(); e.t = 0; }
    else if (type === "bomber") e.vx = rand(30, 50) * sgn();
    else if (type === "pod") { e.vx = rand(25, 45) * sgn(); e.vy = rand(18, 32) * sgn(); }
    else if (type === "swarmer") { e.vx = rand(-220, 220); e.fireT = rand(1.2, 2.6); }
    else if (type === "baiter") { e.vx = ship.vx; e.fireT = rand(0.8, 1.4); }
    enemies.push(e);
    return e;
  }
  function startWave(n) {
    G.wave = n;
    let sub = "";
    if (n > 1 && n % 5 === 0 && (!G.planet || humans.length < 10)) {
      G.planet = true;
      while (humans.length < 10) humans.push(makeHuman(rand(0, WORLD_W)));
      sub = "PLANET RESTORED";
    }
    enemies = []; bullets = []; mines = []; beams = [];
    for (const h of humans) { h.targeted = null; if (h.state !== "walk") { h.state = "walk"; h.y = GROUND_Y - 12; } }
    ship.carry = null;
    // Wave 1 is a gentler on-ramp: fewer landers, one bomber, no pods, a late baiter.
    G.toSpawn = n === 1 ? 10 : Math.min(15 + (n - 1) * 5, 35);
    G.spawnT = 1.4; G.waveT = 0; G.baiterT = n === 1 ? 70 : Math.max(18, 48 - n * 4);
    const nb = n === 1 ? 1 : Math.min(n + 1, 6), np = n === 1 ? 0 : Math.min(Math.ceil(n / 2), 4);
    for (let i = 0; i < nb; i++) addEnemy("bomber", farX(), rand(PLAY_TOP + 70, 380));
    for (let i = 0; i < np; i++) addEnemy("pod", farX(), rand(PLAY_TOP + 40, 360));
    G.state = "playing";
    let firstTip = false;
    if (n === 1 && lsGet("defender.tipSeen") !== "1") { firstTip = true; lsSet("defender.tipSeen", "1"); }
    if (firstTip && !sub) sub = "SHOOT THE LANDERS \u2022 CATCH FALLING HUMANOIDS";
    showBanner("ATTACK WAVE " + n, sub, firstTip ? 3.6 : 2.4);
    Sfx.wave();
  }
  function spawnBatch() {
    const n = Math.min(5, G.toSpawn);
    G.toSpawn -= n;
    for (let i = 0; i < n; i++) {
      const x = Math.random() < 0.55 ? wrapX(ship.x + sgn() * rand(260, W * 1.5)) : farX(400);
      addEnemy(G.planet ? "lander" : "mutant", x, rand(PLAY_TOP + 30, 300), 0.9);
    }
    Sfx.warp();
  }

  function addScore(n, at, label) {
    G.score += n;
    if (at) popups.push({ x: at.x, y: at.y - 20, text: label || String(n), t: 0 });
    while (G.score >= G.nextBonus) {
      G.nextBonus += 10000;
      G.lives = Math.min(G.lives + 1, 9);
      G.bombs = Math.min(G.bombs + 1, 9);
      Sfx.extraLife();
      popups.push({ x: ship.x, y: ship.y - 30, text: "BONUS SHIP + BOMB", t: 0, big: true });
    }
    if (G.score > G.hi) { G.hi = G.score; G.newHi = true; }
  }
  function saveHi() { lsSet(LS.hi, String(G.hi)); }

  function explode(x, y, colors, n, speed, life) {
    const count = fxOn ? n : Math.ceil(n * 0.5);
    for (let i = 0; i < count; i++) {
      if (parts.length > 1800) break;
      const a = rand(0, Math.PI * 2), v = rand(speed * 0.2, speed);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85, age: 0, life: rand(0.45, 1) * (life || 1), c: pick(colors), s: rand(2, 4.5) });
    }
  }

  function killHuman(h) {
    if (h.state === "dead") return;
    h.state = "dead";
    if (h.targeted) { h.targeted.target = null; if (h.targeted.state === "descend") h.targeted.state = "seek"; h.targeted = null; }
    explode(h.x, h.y, [PAL.S, PAL.P, PAL.G], 18, 120, 0.8);
    Sfx.humanDie();
  }
  function checkPlanet() {
    if (!G.planet) return;
    if (humans.some((h) => h.state !== "dead")) return;
    G.planet = false;
    G.flash = 1.2; G.flashColor = "255,200,140"; G.shake = 1;
    for (let sx = 0; sx <= W; sx += 12) {
      const wx = wrapX(G.camX + sx);
      explode(wx, terrainY(wx), ["#ff8a2a", "#ffd27a", "#ff3d3d", "#ffffff"], 6, 260, 1.6);
    }
    for (const e of enemies) if (e.type === "lander" && !e.dead) { e.type = "mutant"; e.state = "seek"; e.carry = null; e.target = null; }
    showBanner("PLANET DESTROYED", "ALL LANDERS MUTATE", 3);
    Sfx.planet();
  }
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const sp = SPEC[e.type];
    addScore(sp.pts, e.type === "pod" ? e : null);
    const big = e.type === "pod" || e.type === "baiter";
    explode(e.x, e.y, sp.colors, big ? 54 : 34, big ? 280 : 210);
    Sfx.explode(big);
    if (e.carry) {
      const h = e.carry;
      h.state = "falling"; h.vy = 0; h.fallFrom = h.y;
      e.carry = null;
    }
    if (e.target) { if (e.target.targeted === e) e.target.targeted = null; e.target = null; }
    if (e.type === "pod") {
      const n = irand(4, 6);
      for (let i = 0; i < n; i++) addEnemy("swarmer", e.x + rand(-12, 12), clamp(e.y + rand(-14, 14), PLAY_TOP + 12, 440));
    }
  }
  function dropCarried() {
    if (!ship.carry) return;
    const h = ship.carry;
    h.state = "falling"; h.vy = 0; h.fallFrom = h.y;
    ship.carry = null;
  }
  function killShip() {
    if (!ship.alive) return;
    ship.alive = false;
    G.state = "dying"; G.deadT = 0;
    explode(ship.x, ship.y, [PAL.W, PAL.P, PAL.R, PAL.Y, PAL.B], 150, 440, 1.7);
    G.flash = 0.75; G.flashColor = "255,80,80"; G.shake = 0.7;
    Sfx.thrust(0); Sfx.shipDie();
    bullets = [];
    dropCarried();
  }
  function respawn() {
    for (const e of enemies) if (Math.abs(wdx(ship.x, e.x)) < 420) e.x = wrapX(e.x + sgn() * rand(700, 1400));
    mines = []; bullets = [];
    resetShip(ship.x);
    G.state = "playing";
  }
  // Job Seeker Pro Scout AI splash after every completed wave and on game over.
  const Splash = window.ScoutSplash || null;
  function waveSplash() {
    if (!Splash) { startWave(G.wave + 1); return; }
    G.state = "splash"; Sfx.thrust(0); clearHeld();
    Splash.show({
      kind: "defender", campaign: "defender", tag: "wave" + G.wave, accent: "#7fd8ff", glow: "rgba(120,80,255,.3)",
      title: "ATTACK WAVE " + G.wave + " COMPLETED",
      sub: "Score " + G.score + " \u2022 Humanoids saved " + G.bonusHumans + " \u2022 Ships " + G.lives,
      contLabel: "Next wave",
      onContinue: () => { pressed.clear(); clearHeld(); startWave(G.wave + 1); }
    });
  }
  function overSplash() {
    if (G.state !== "gameover") return;
    if (!Splash) { newGame(); return; }
    G.state = "splash"; Sfx.thrust(0); clearHeld();
    Splash.show({
      kind: "defender", campaign: "defender", tag: "gameover", accent: "#ff6b9a", glow: "rgba(255,60,120,.28)",
      title: "GAME OVER", sub: "Score " + G.score + " \u2022 High " + G.hi + " \u2022 Wave " + G.wave,
      contLabel: "Play again",
      onContinue: () => { pressed.clear(); clearHeld(); newGame(); }
    });
  }
  function gameOver() {
    G.state = "gameover"; G.msgT = 0;
    saveHi();
    Sfx.thrust(0);
  }
  function fire() {
    if (beams.length >= 6) return;
    ship.fireCD = 0.075; ship.lastShot = G.t;
    beams.push({ x0: wrapX(ship.x + ship.face * 26), y: ship.y + 3, dir: ship.face, head: 0, tail: 0, life: 0, hue: irand(0, 4), dead: false });
    Sfx.laser();
  }
  function smartBomb() {
    if (G.bombs <= 0 || !ship.alive || ship.hyper > 0 || G.state !== "playing") return;
    G.bombs--;
    G.flash = 1; G.flashColor = "255,255,255"; G.shake = 0.4;
    G.ring = { x: ship.x, y: ship.y, t: 0 };
    Sfx.bomb();
    for (const e of enemies.slice()) if (!e.dead && e.warp <= 0 && onScreenX(e.x, 0)) killEnemy(e);
    bullets = bullets.filter((b) => !onScreenX(b.x, 0));
    mines = mines.filter((m) => !onScreenX(m.x, 0));
  }
  function startHyper() {
    if (!ship.alive || ship.hyper > 0 || G.state !== "playing") return;
    dropCarried();
    ship.hyper = 0.6;
    explode(ship.x, ship.y, [PAL.B, PAL.W, PAL.P], 40, 160, 0.7);
    Sfx.hyper(); Sfx.thrust(0);
  }
  function endHyper() {
    ship.x = rand(0, WORLD_W); ship.y = rand(SHIP_MIN_Y + 30, 420); ship.vx = 0;
    ship.face = sgn();
    G.shipSX = ship.face > 0 ? W * 0.28 : W * 0.72;
    G.camX = wrapX(ship.x - G.shipSX);
    explode(ship.x, ship.y, [PAL.B, PAL.W, PAL.P], 40, 160, 0.7);
    if (Math.random() < 0.1) {
      ship.inv = 0;
      killShip();
      popups.push({ x: ship.x, y: ship.y - 30, text: "HYPERSPACE MALFUNCTION", t: 0, big: true });
    } else ship.inv = 0.6;
  }

  // ------------------------------------------------------------ update
  function updateCamera(dt) {
    const target = ship.face > 0 ? W * 0.28 : W * 0.72;
    const d = target - G.shipSX;
    G.shipSX += Math.sign(d) * Math.min(Math.abs(d), dt * (200 + Math.abs(d) * 3.2));
    G.camX = wrapX(ship.x - G.shipSX);
  }
  function updateShip(dt) {
    const s = ship;
    s.thrust = 0;
    if (!s.alive) { Sfx.thrust(0); return; }
    if (s.hyper > 0) { s.hyper -= dt; if (s.hyper <= 0) endHyper(); return; }
    s.inv = Math.max(0, s.inv - dt);
    const L = isDown("left"), R = isDown("right");
    let th = 0;
    if (L !== R) { s.face = L ? -1 : 1; th = 1; }
    s.vx += s.face * th * 1500 * dt;
    s.vx *= Math.exp(-(th ? 0.55 : 1.35) * dt);
    s.vx = clamp(s.vx, -840, 840);
    s.x = wrapX(s.x + s.vx * dt);
    const vyT = (isDown("down") ? 1 : 0) - (isDown("up") ? 1 : 0);
    s.vy += (vyT * 340 - s.vy) * Math.min(1, dt * 16);
    s.y = clamp(s.y + s.vy * dt, SHIP_MIN_Y, SHIP_MAX_Y);
    s.thrust = th;
    Sfx.thrust(th);
    if (th && Math.random() < dt * 70) {
      parts.push({ x: wrapX(s.x - s.face * 28), y: s.y + rand(-2, 4), vx: -s.face * rand(80, 200) + s.vx * 0.6, vy: rand(-20, 20), age: 0, life: rand(0.15, 0.35), c: pick([PAL.Y, PAL.O, PAL.R]), s: rand(1.5, 3) });
    }
    s.fireCD -= dt;
    if (s.fireCD <= 0) {
      if (pressed.has("fire")) fire();
      else if (isDown("fire") && G.t - s.lastShot >= 0.16) fire();
    }
    if (pressed.has("bomb")) smartBomb();
    if (pressed.has("hyper")) startHyper();
  }
  function updateBeams(dt) {
    for (const b of beams) {
      b.life += dt;
      b.head = Math.min(b.life * 2700, 1100);
      b.tail = Math.max(0, b.life - 0.09) * 2700;
      if (b.tail >= b.head) { b.dead = true; continue; }
      let best = null, bestD = Infinity;
      for (const e of enemies) {
        if (e.dead || e.warp > 0) continue;
        const d = wdx(b.x0, e.x) * b.dir;
        if (d >= b.tail - e.rx && d <= b.head + e.rx && Math.abs(e.y - b.y) <= e.ry + 3 && d < bestD) { best = e; bestD = d; }
      }
      let hitHuman = null;
      for (const h of humans) {
        if (h.state !== "walk" && h.state !== "falling" && h.state !== "abducted") continue;
        const d = wdx(b.x0, h.x) * b.dir;
        if (d >= b.tail - 4 && d <= b.head + 4 && Math.abs(h.y - b.y) <= 10 && d < bestD) { hitHuman = h; bestD = d; }
      }
      if (hitHuman) {
        for (const e of enemies) if (e.carry === hitHuman) { e.carry = null; e.target = null; e.state = "seek"; }
        if (hitHuman.targeted) hitHuman.targeted.target = null;
        killHuman(hitHuman);
        popups.push({ x: hitHuman.x, y: hitHuman.y - 22, text: "HUMANOID HIT", t: 0 });
        b.dead = true;
      } else if (best) {
        killEnemy(best);
        b.dead = true;
        explode(best.x, b.y, [PAL.W, PAL.Y], 8, 140, 0.4);
      }
    }
    beams = beams.filter((b) => !b.dead);
  }
  function updateEnemies(dt) {
    const m = Math.min(1 + (G.wave - 1) * 0.08, 1.7);
    const live = ship.alive && ship.hyper <= 0;
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.warp > 0) { e.warp -= dt; continue; }
      switch (e.type) {
        case "lander": {
          if (e.state === "seek") {
            e.x = wrapX(e.x + e.vx * m * dt);
            e.y += (e.cruiseY + Math.sin(e.t * 1.6 + e.ph) * 26 - e.y) * Math.min(1, dt * 1.5);
            if (G.planet && e.t > e.seekDelay) {
              for (const h of humans) {
                if (h.state === "walk" && !h.targeted && Math.abs(wdx(e.x, h.x)) < 10) { e.target = h; h.targeted = e; e.state = "descend"; break; }
              }
            }
          } else if (e.state === "descend") {
            const h = e.target;
            if (!h || h.state !== "walk" || h.targeted !== e) {
              if (h && h.targeted === e) h.targeted = null;
              e.state = "seek"; e.target = null; e.cruiseY = rand(PLAY_TOP + 40, 330); e.t = 0;
            } else {
              const dx = wdx(e.x, h.x);
              e.x = wrapX(e.x + clamp(dx * 4, -60, 60) * dt);
              e.y += 62 * m * dt;
              if (e.y >= h.y - 24) {
                e.state = "abduct"; e.carry = h; e.target = null;
                h.state = "abducted"; h.targeted = null; h.screamT = 0;
                if (onScreenX(e.x)) Sfx.scream();
              }
            }
          } else if (e.state === "abduct") {
            const h = e.carry;
            e.y -= 34 * m * dt;
            e.x = wrapX(e.x + Math.sin(e.t * 3) * 12 * dt);
            if (h) {
              h.x = e.x; h.y = e.y + 22;
              h.screamT += dt;
              if (h.screamT > 1.5) { h.screamT = 0; if (onScreenX(e.x)) Sfx.scream(); }
            }
            if (e.y <= PLAY_TOP + 14) {
              if (h) killHuman(h);
              e.carry = null; e.type = "mutant"; e.state = "seek";
              explode(e.x, e.y, [PAL.M, PAL.K], 16, 120, 0.6);
              Sfx.mutant();
            }
          }
          break;
        }
        case "mutant": {
          const dx = wdx(e.x, ship.x), dy = ship.y - e.y;
          const vmax = Math.min(150 + G.wave * 14, 280);
          e.vx = clamp(e.vx + Math.sign(dx) * 380 * dt, -vmax, vmax);
          e.x = wrapX(e.x + (e.vx + rand(-140, 140)) * dt);
          e.y += (clamp(dy * 1.8, -120, 120) + rand(-280, 280)) * dt;
          break;
        }
        case "bomber": {
          e.x = wrapX(e.x + e.vx * dt);
          e.y = e.baseY + Math.sin(e.t * 1.2 + e.ph) * 55;
          e.dropT -= dt;
          if (e.dropT <= 0) {
            e.dropT = rand(0.8, 1.6);
            if (Math.abs(wdx(e.x, ship.x)) < W * 1.2 && mines.length < 40) mines.push({ x: e.x, y: e.y, t: 0, life: 4.5 });
          }
          break;
        }
        case "pod": {
          e.x = wrapX(e.x + e.vx * dt);
          e.y += e.vy * dt;
          if (e.y < PLAY_TOP + 24 || e.y > 420) e.vy = -e.vy;
          break;
        }
        case "swarmer": {
          const dx = wdx(e.x, ship.x);
          const vmax = Math.min(230 + G.wave * 12, 360);
          e.vx = clamp(e.vx + Math.sign(dx) * 260 * dt, -vmax, vmax);
          e.x = wrapX(e.x + e.vx * dt);
          e.y += ((ship.y - e.y) * 1.4 + Math.sin(e.t * 7 + e.ph) * 120) * dt;
          break;
        }
        case "baiter": {
          const dx = wdx(e.x, wrapX(ship.x + e.off));
          const lim = Math.abs(ship.vx) + 300;
          e.vx += (clamp(dx * 3, -lim, lim) - e.vx) * Math.min(1, dt * 3);
          e.x = wrapX(e.x + e.vx * dt);
          e.y += (ship.y - 40 + Math.sin(e.t * 2) * 80 - e.y) * Math.min(1, dt * 1.5);
          break;
        }
      }
      e.y = clamp(e.y, PLAY_TOP + 10, GROUND_Y - 14);
      const rate = FIRE_RATE[e.type];
      if (rate) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = (rate / (1 + 0.12 * (G.wave - 1))) * (G.wave === 1 ? 1.4 : 1) * rand(0.6, 1.4);
          if (live && G.state === "playing" && onScreenX(e.x, -10) && Math.abs(wdx(e.x, ship.x)) > 60) enemyFire(e);
        }
      }
      if (shipHittable() && Math.abs(wdx(ship.x, e.x)) < e.rx + 17 && Math.abs(ship.y - e.y) < e.ry + 6) {
        killEnemy(e);
        killShip();
      }
    }
    enemies = enemies.filter((e) => !e.dead);
  }
  function enemyFire(e) {
    const dx = wdx(e.x, ship.x), dy = ship.y - e.y;
    const sp = Math.min(170 + G.wave * 10, 300);
    const tt = Math.hypot(dx, dy) / sp;
    const lx = dx + clamp(ship.vx * tt * 0.6, -300, 300), ly = dy;
    const l = Math.hypot(lx, ly) || 1;
    bullets.push({ x: e.x, y: e.y, vx: (lx / l) * sp, vy: (ly / l) * sp, life: 2.6 });
    Sfx.enemyShot();
  }
  function updateHumans(dt) {
    for (const h of humans) {
      h.t += dt;
      if (h.state === "walk") {
        h.x = wrapX(h.x + h.vx * dt);
        if (Math.random() < dt * 0.15) h.vx = -h.vx;
        h.y = GROUND_Y - 12;
      } else if (h.state === "falling") {
        h.vy = Math.min(h.vy + 70 * dt, 140);
        h.y += h.vy * dt;
        if (ship.alive && ship.hyper <= 0 && !ship.carry && Math.abs(wdx(ship.x, h.x)) < 26 && Math.abs(ship.y + 16 - h.y) < 22) {
          h.state = "caught"; ship.carry = h;
          addScore(500, h);
          Sfx.caught();
        } else if (h.y >= GROUND_Y - 12) {
          h.y = GROUND_Y - 12;
          if (GROUND_Y - h.fallFrom > 200) killHuman(h);
          else { h.state = "walk"; addScore(250, h); Sfx.saved(); }
        }
      } else if (h.state === "caught") {
        if (!ship.alive) { h.state = "falling"; h.vy = 0; h.fallFrom = h.y; continue; }
        h.x = ship.x; h.y = ship.y + 18;
        if (h.y >= GROUND_Y - 22) {
          h.state = "walk"; h.y = GROUND_Y - 12; ship.carry = null;
          addScore(500, h);
          Sfx.saved();
        }
      }
    }
    const before = humans.length;
    humans = humans.filter((h) => h.state !== "dead");
    if (humans.length !== before) checkPlanet();
  }
  function updateShots(dt) {
    for (const b of bullets) {
      b.x = wrapX(b.x + b.vx * dt); b.y += b.vy * dt; b.life -= dt;
      if (b.y < PLAY_TOP || b.y > H) b.life = 0;
      if (b.life > 0 && shipHittable() && Math.abs(wdx(ship.x, b.x)) < 17 && Math.abs(ship.y - b.y) < 7) { b.life = 0; killShip(); }
    }
    bullets = bullets.filter((b) => b.life > 0);
    for (const m of mines) {
      m.t += dt;
      if (shipHittable() && Math.abs(wdx(ship.x, m.x)) < 18 && Math.abs(ship.y - m.y) < 8) { m.t = m.life; killShip(); }
    }
    mines = mines.filter((m) => m.t < m.life);
  }
  function updateParticles(dt) {
    const k = Math.exp(-1.7 * dt);
    for (const p of parts) {
      p.age += dt;
      p.x = wrapX(p.x + p.vx * dt); p.y += p.vy * dt;
      p.vx *= k; p.vy *= k;
    }
    parts = parts.filter((p) => p.age < p.life);
    for (const p of popups) { p.t += dt; p.y -= 22 * dt; }
    popups = popups.filter((p) => p.t < (p.big ? 2 : 1.2));
    if (G.ring) { G.ring.t += dt; if (G.ring.t > 0.5) G.ring = null; }
  }
  function checkWaveEnd() {
    if (G.toSpawn > 0) return;
    for (const e of enemies) if (!e.dead && (e.type === "lander" || e.type === "mutant")) return;
    G.state = "waveEnd"; G.msgT = 0;
    G.bonusMult = 100 * Math.min(G.wave, 5);
    G.bonusHumans = humans.filter((h) => h.state !== "dead").length;
    G.bonusShown = 0;
    for (const e of enemies) explode(e.x, e.y, SPEC[e.type].colors, 10, 120, 0.6);
    enemies = []; bullets = []; mines = [];
    saveHi();
  }
  function stepWorld(dt) {
    G.waveT += dt;
    if (G.state === "playing") {
      G.spawnT -= dt;
      const hostile = countType("lander") + countType("mutant");
      if (G.toSpawn > 0 && (G.spawnT <= 0 || (hostile < 2 && G.waveT > 2))) { spawnBatch(); G.spawnT = 10; }
      G.baiterT -= dt;
      if (G.baiterT <= 0) {
        if (countType("baiter") < 4) {
          addEnemy("baiter", wrapX(ship.x - ship.face * rand(W * 0.6, W * 0.9)), rand(PLAY_TOP + 30, 300));
          Sfx.baiter();
        }
        G.baiterT = rand(9, 14);
      }
    }
    if (G.state !== "gameover") { updateShip(dt); updateCamera(dt); }
    updateBeams(dt);
    if (G.state !== "waveEnd") updateEnemies(dt);
    updateHumans(dt);
    updateShots(dt);
    if (G.state === "playing") checkWaveEnd();
    else if (G.state === "dying") {
      G.deadT += dt;
      if (G.deadT > 2.6) {
        G.lives--;
        if (G.lives <= 0) gameOver();
        else respawn();
      }
    } else if (G.state === "waveEnd") {
      G.msgT += dt;
      const shouldShow = Math.min(G.bonusHumans, Math.max(0, Math.floor((G.msgT - 0.9) / 0.22) + 1));
      while (G.bonusShown < shouldShow) { G.bonusShown++; addScore(G.bonusMult); Sfx.bonus(); }
      if (G.msgT > 1.2 + G.bonusHumans * 0.22 + 1.8) waveSplash();
    } else if (G.state === "gameover") {
      G.msgT += dt;
    }
  }
  function step(dt) {
    G.t += dt;
    G.flash = Math.max(0, G.flash - dt * 2.2);
    G.shake = Math.max(0, G.shake - dt * 1.6);
    if (G.bannerT > 0) G.bannerT -= dt;
    switch (G.state) {
      case "attract":
        G.camX = wrapX(G.camX + 70 * dt);
        if (pressed.has("fire")) newGame();
        break;
      case "gameover":
        stepWorld(dt);
        G.camX = wrapX(G.camX + 30 * dt);
        if ((G.msgT > 1.2 && pressed.has("fire")) || G.msgT > 3.5) overSplash();
        break;
      case "splash":
        break;
      default:
        stepWorld(dt);
    }
    updateParticles(dt);
  }

  // ------------------------------------------------------------ render
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  let scale = 1;
  const isTouchUI = () => document.body.classList.contains("touch-ui");

  function spr(name, frame, x, y, s) {
    const fr = sprites[name];
    if (!fr) return;
    const f = fr[((frame % fr.length) + fr.length) % fr.length];
    const k = s || 1;
    ctx.drawImage(f.img, x - (f.w * k) / 2, y - (f.h * k) / 2, f.w * k, f.h * k);
  }
  function txt(s, x, y, size, color, align, glow, weight, font) {
    ctx.font = (weight || 800) + " " + size + "px " + (font || FONT);
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    if (glow && fxOn) { ctx.shadowColor = color; ctx.shadowBlur = glow * scale; }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
  }
  function drawStars() {
    for (const st of stars) {
      const sx = (((st.x - G.camX * st.p) % W) + W) % W;
      ctx.globalAlpha = st.a * (0.55 + 0.45 * Math.sin(G.t * st.f + st.ph));
      ctx.fillStyle = st.c;
      ctx.fillRect(sx, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }
  function drawBackRange() {
    const n2 = TN / 2, period = n2 * TSEG;
    const cam = (G.camX * 0.5) % period;
    const i0 = Math.floor(cam / TSEG) - 1;
    ctx.beginPath();
    for (let j = 0; j <= W / TSEG + 3; j++) {
      const wi = i0 + j;
      const sx = wi * TSEG - cam;
      const y = backRange[((wi % n2) + n2) % n2];
      if (j === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
    }
    ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, 360, 0, H);
    g.addColorStop(0, "rgba(70,40,160,0.28)"); g.addColorStop(1, "rgba(10,5,30,0.05)");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(130,100,255,0.35)"; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function terrainPath() {
    const i0 = Math.floor(G.camX / TSEG) - 1;
    ctx.beginPath();
    for (let j = 0; j <= W / TSEG + 3; j++) {
      const wi = i0 + j;
      const sx = wi * TSEG - G.camX;
      const y = terrain[((wi % TN) + TN) % TN];
      if (j === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
    }
  }
  function drawTerrain() {
    terrainPath();
    ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, 392, 0, H);
    g.addColorStop(0, "rgba(255,110,30,0.16)"); g.addColorStop(1, "rgba(40,10,0,0.02)");
    ctx.fillStyle = g; ctx.fill();
    terrainPath();
    ctx.lineJoin = "round";
    if (fxOn) { ctx.strokeStyle = "rgba(255,120,30,0.22)"; ctx.lineWidth = 6; ctx.stroke(); }
    ctx.strokeStyle = "#ff9a3c"; ctx.lineWidth = 2; ctx.stroke();
  }
  function drawWarp(e, sx) {
    const p = clamp(1 - e.warp / 0.9, 0, 1);
    const list = WARP_PIXELS[e.type] || WARP_PIXELS.lander;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 + 0.65 * p;
    for (let i = 0; i < list.length; i++) {
      const px = list[i];
      const a = i * 2.399 + e.ph;
      const spread = (1 - p) * (1 - p) * 110 * (0.5 + (i % 5) / 6);
      ctx.fillStyle = px.c;
      ctx.fillRect(sx + px.x + Math.cos(a) * spread - PX / 2, e.y + px.y + Math.sin(a) * spread - PX / 2, PX, PX);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function humanFrame(h) {
    if (h.state === "walk") return Math.floor(h.t * 4) % 2;
    if (h.state === "abducted") return Math.floor(h.t * 8) % 2 ? 2 : 0;
    if (h.state === "falling") return 2;
    return 0;
  }
  function drawWorld() {
    for (const h of humans) {
      const sx = wdx(G.camX, h.x);
      if (sx < -30 || sx > W + 30) continue;
      spr("human", humanFrame(h), sx, h.y);
    }
    for (const m of mines) {
      const sx = wdx(G.camX, m.x);
      if (sx < -20 || sx > W + 20) continue;
      spr("mine", Math.floor(m.t * 6), sx, m.y);
    }
    for (const e of enemies) {
      const sx = wdx(G.camX, e.x);
      if (sx < -60 || sx > W + 60) continue;
      if (e.warp > 0) { drawWarp(e, sx); continue; }
      let f;
      if (e.type === "mutant") f = Math.floor(G.t * 12 + e.ph);
      else if (e.type === "baiter") f = Math.floor(G.t * 10);
      else f = Math.floor(G.t * 5 + e.ph);
      if (e.type === "lander" && e.state === "abduct" && fxOn) {
        ctx.globalAlpha = 0.16 + 0.1 * Math.sin(G.t * 20);
        ctx.fillStyle = "#38f26a";
        ctx.beginPath(); ctx.moveTo(sx - 8, e.y + 10); ctx.lineTo(sx + 8, e.y + 10); ctx.lineTo(sx + 14, e.y + 36); ctx.lineTo(sx - 14, e.y + 36); ctx.fill();
        ctx.globalAlpha = 1;
      }
      spr(e.type, f, sx, e.y);
    }
    if (bulletImg) {
      for (const b of bullets) {
        const sx = wdx(G.camX, b.x);
        if (sx < -10 || sx > W + 10) continue;
        const k = 0.85 + 0.25 * Math.sin(G.t * 30 + b.x);
        ctx.drawImage(bulletImg.img, sx - 7 * k, b.y - 7 * k, 14 * k, 14 * k);
      }
    }
    drawBeams();
    drawShip();
  }
  const BEAM_COLORS = ["#ff3d3d", "#ffe23d", "#38f26a", "#5ce1ff", "#ff3fd4"];
  function drawBeams() {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";
    for (const b of beams) {
      const s0 = wdx(G.camX, b.x0);
      const x1 = s0 + b.dir * b.tail, x2 = s0 + b.dir * b.head;
      const y = b.y;
      if (fxOn) {
        ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      }
      const len = Math.abs(x2 - x1);
      const headLen = Math.min(80, len);
      ctx.lineWidth = 2.4; ctx.strokeStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - b.dir * headLen, y); ctx.stroke();
      ctx.lineWidth = 2;
      let k = b.hue;
      for (let d = headLen + 4; d < len; d += 26) {
        const seg = Math.min(20 - (d / len) * 8, len - d);
        ctx.strokeStyle = BEAM_COLORS[k++ % BEAM_COLORS.length];
        ctx.beginPath(); ctx.moveTo(x2 - b.dir * d, y); ctx.lineTo(x2 - b.dir * (d + seg), y); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
  function drawShip() {
    if (!ship.alive || ship.hyper > 0) return;
    if (ship.inv > 0 && G.state === "playing" && Math.floor(G.t * 14) % 2) return;
    const sx = G.shipSX, y = ship.y;
    if (ship.thrust) {
      const back = sx - ship.face * 25;
      const L = rand(14, 30);
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(back, 0, back - ship.face * L, 0);
      g.addColorStop(0, "rgba(255,240,150,1)"); g.addColorStop(0.4, "rgba(255,140,30,0.9)"); g.addColorStop(1, "rgba(255,40,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(back, y - 1); ctx.lineTo(back - ship.face * L, y + 4); ctx.lineTo(back, y + 9); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    spr(ship.face > 0 ? "shipR" : "shipL", 0, sx, y);
  }
  function drawParticles() {
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      const sx = wdx(G.camX, p.x);
      if (sx < -10 || sx > W + 10) continue;
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(sx - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (const p of popups) {
      const sx = wdx(G.camX, p.x);
      if (sx < -200 || sx > W + 200) continue;
      ctx.globalAlpha = Math.max(0, 1 - p.t / (p.big ? 2 : 1.2));
      txt(p.text, sx, p.y, p.big ? 18 : 15, p.big ? "#ffe23d" : "#ffffff", "center", 8);
      ctx.globalAlpha = 1;
    }
    if (G.ring) {
      const r = G.ring.t * 1500;
      ctx.globalAlpha = Math.max(0, 1 - G.ring.t / 0.5);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(wdx(G.camX, G.ring.x), G.ring.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  function drawHUD() {
    const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, "#070a1e"); g.addColorStop(1, "#020309");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HUD_H);
    if (fxOn) { ctx.fillStyle = "rgba(60,90,255,0.22)"; ctx.fillRect(0, HUD_H - 6, W, 9); }
    ctx.fillStyle = "#3150ff"; ctx.fillRect(0, HUD_H - 2, W, 2);
    const { x: sx, y: sy, w: sw, h: sh } = SC;
    ctx.fillStyle = "rgba(10,14,40,0.9)"; ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = "#3a4bd8"; ctx.lineWidth = 1.5; ctx.strokeRect(sx, sy, sw, sh);
    const mid = sx + sw / 2, vw = (W * sw) / WORLD_W, center = G.camX + W / 2;
    ctx.strokeStyle = "#e8ecff"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mid - vw / 2, sy + 6); ctx.lineTo(mid - vw / 2, sy + 1); ctx.lineTo(mid + vw / 2, sy + 1); ctx.lineTo(mid + vw / 2, sy + 6);
    ctx.moveTo(mid - vw / 2, sy + sh - 6); ctx.lineTo(mid - vw / 2, sy + sh - 1); ctx.lineTo(mid + vw / 2, sy + sh - 1); ctx.lineTo(mid + vw / 2, sy + sh - 6);
    ctx.stroke();
    const mapY = (y) => sy + 3 + ((y - PLAY_TOP) / (GROUND_Y - PLAY_TOP)) * (sh - 6);
    const mapX = (x) => mid + (wdx(center, x) * sw) / WORLD_W;
    if (G.planet) {
      ctx.strokeStyle = "rgba(255,150,60,0.85)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= sw; i += 3) {
        const wx = center - WORLD_W / 2 + (i * WORLD_W) / sw;
        const y = mapY(terrainY(wx));
        if (i === 0) ctx.moveTo(sx + i, y); else ctx.lineTo(sx + i, y);
      }
      ctx.stroke();
    }
    if (G.state !== "attract") {
      ctx.fillStyle = "#c9a3ff";
      for (const h of humans) ctx.fillRect(mapX(h.x) - 1, mapY(h.y) - 1, 2, 2);
      for (const e of enemies) {
        if (e.warp > 0 && Math.floor(G.t * 10) % 2) continue;
        ctx.fillStyle = SCANNER_COLORS[e.type];
        ctx.fillRect(mapX(e.x) - 1.5, mapY(e.y) - 1.5, 3, 3);
      }
      if (ship.alive && ship.hyper <= 0) { ctx.fillStyle = "#ffffff"; ctx.fillRect(mapX(ship.x) - 2.5, mapY(ship.y) - 1.5, 5, 3); }
    }
    txt(String(G.score).padStart(6, "0"), 22, 24, 26, "#ffe23d", "left", 8);
    const reserve = G.state === "attract" ? 0 : Math.max(0, G.lives - 1);
    const narrow = W < 800, shipGap = narrow ? 26 : 34;
    const bombs = G.state === "attract" ? 0 : G.bombs;
    const bombX = narrow ? SC.x - 14 : 272, maxBombs = narrow ? 3 : 6;
    const maxShips = narrow ? Math.max(1, Math.floor((bombX - maxBombs * 10 - 40) / shipGap)) : 6;
    for (let i = 0; i < Math.min(reserve, maxShips); i++) spr("shipR", 0, (narrow ? 32 : 40) + i * shipGap, 54, narrow ? 0.5 : 0.6);
    for (let i = 0; i < Math.min(bombs, maxBombs); i++) {
      ctx.fillStyle = "#ff3fd4"; ctx.fillRect(bombX - i * 10, 46, 6, 14);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(bombX - i * 10, 46, 6, 3);
    }
    txt("HIGH " + String(G.hi).padStart(6, "0"), W - 22, 24, W < 800 ? 15 : 18, "#9fb6ff", "right", 6);
    if (G.state !== "attract") txt("WAVE " + G.wave, W - 22, 52, 16, "#ffffff", "right", 0, 700);
  }
  function drawLegend(y) {
    const items = [["lander", "LANDER", 150], ["mutant", "MUTANT", 150], ["bomber", "BOMBER", 250], ["pod", "POD", 1000], ["swarmer", "SWARMER", 150], ["baiter", "BAITER", 200]];
    const gap = Math.min(128, (W - 70) / (items.length - 1)), x0 = W / 2 - (gap * (items.length - 1)) / 2;
    items.forEach(([name, label, pts], i) => {
      const x = x0 + i * gap;
      spr(name, Math.floor(G.t * (name === "mutant" ? 12 : 5)), x, y);
      txt(label, x, y + 30, 13, "#e8ecff", "center", 0, 700);
      txt(String(pts), x, y + 47, 13, "#ffe23d", "center", 0, 700);
    });
  }
  function drawAttract() {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, HUD_H, W, H - HUD_H);
    const g = ctx.createLinearGradient(0, 120, 0, 205);
    g.addColorStop(0, "#fff6c2"); g.addColorStop(0.45, "#ff9a2a"); g.addColorStop(1, "#ff2d3a");
    ctx.save();
    ctx.font = "italic 900 92px " + TITLE_FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (fxOn) { ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 28 * scale; }
    ctx.fillStyle = g;
    ctx.fillText("DEFENDER", W / 2, 162);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.strokeText("DEFENDER", W / 2, 162);
    ctx.restore();
    txt(W < 800 ? "ARCADE TRIBUTE \u00B7 BUILT FROM SCRATCH" : "ARCADE TRIBUTE \u00B7 SHARPER GRAPHICS \u00B7 BUILT FROM SCRATCH", W / 2, 222, 15, "#5ce1ff", "center", 8, 700);
    txt("PROTECT THE HUMANOIDS FROM THE LANDERS", W / 2, 252, 14, "#c9a3ff", "center", 0, 700);
    drawLegend(300);
    if (Math.floor(G.t * 2) % 2 === 0) {
      txt(isTouchUI() ? "TAP TO START" : "PRESS " + keyOf("fire").toUpperCase() + " TO START", W / 2, 410, 24, "#ffffff", "center", 12);
    }
    const hint = isTouchUI()
      ? (W < 800 ? "STICK MOVES \u00B7 FIRE SHOOTS \u00B7 BOMB \u00B7 HYPER" : "STICK MOVES \u00B7 FIRE SHOOTS \u00B7 BOMB CLEARS THE SCREEN \u00B7 HYPER WARPS YOU")
      : keyOf("left") + " " + keyOf("right") + " THRUST/REVERSE \u00B7 " + keyOf("up") + " " + keyOf("down") + " CLIMB/DIVE \u00B7 " +
        keyOf("fire").toUpperCase() + " FIRE \u00B7 " + keyOf("bomb") + " SMART BOMB \u00B7 " + keyOf("hyper") + " HYPERSPACE \u00B7 " + keyOf("pause") + " PAUSE";
    ctx.fillStyle = "rgba(4,6,20,0.78)";
    const hb = Math.min(800, W - 24);
    ctx.fillRect(W / 2 - hb / 2, 436, hb, 50);
    ctx.strokeStyle = "rgba(80,100,255,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - hb / 2 + 0.5, 436.5, hb - 1, 49);
    txt(hint, W / 2, 452, 13, "#c3cbf2", "center", 0, 700);
    txt("REMAP ANY KEY WITH THE CONTROLS BUTTON BELOW", W / 2, 472, 12, "#8790c4", "center", 0, 600);
  }
  function drawOverlays() {
    if (G.state === "attract") drawAttract();
    if ((G.state === "playing" || G.state === "dying") && G.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, G.bannerT * 2);
      txt(G.banner, W / 2, 230, 34, "#ffffff", "center", 14);
      if (G.sub) txt(G.sub, W / 2, 272, 18, "#ffe23d", "center", 8);
      ctx.globalAlpha = 1;
    }
    if (G.state === "waveEnd") {
      txt("ATTACK WAVE " + G.wave, W / 2, 185, 30, "#ffffff", "center", 12);
      txt("COMPLETED", W / 2, 225, 30, "#ffffff", "center", 12);
      txt("BONUS X " + G.bonusMult, W / 2, 285, 22, "#ffe23d", "center", 8);
      const n = G.bonusHumans;
      const x0 = W / 2 - ((n - 1) * 24) / 2;
      for (let i = 0; i < G.bonusShown; i++) spr("human", 0, x0 + i * 24, 330);
      if (n === 0) txt("NO HUMANOIDS SURVIVED", W / 2, 330, 15, "#ff6b6b", "center", 0, 700);
    }
    if (G.state === "gameover") {
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, HUD_H, W, H - HUD_H);
      txt("GAME OVER", W / 2, 210, 64, "#ff3d3d", "center", 22, 900, TITLE_FONT);
      txt("SCORE " + G.score, W / 2, 275, 24, "#ffffff", "center", 8);
      if (G.newHi) txt("NEW HIGH SCORE!", W / 2, 312, 20, "#ffe23d", "center", 10);
      if (G.msgT > 1.2 && Math.floor(G.t * 2) % 2 === 0) {
        txt(isTouchUI() ? "TAP TO PLAY AGAIN" : "PRESS " + keyOf("fire").toUpperCase() + " TO PLAY AGAIN", W / 2, 370, 20, "#ffffff", "center", 8);
      }
    }
    if (G.paused) {
      ctx.fillStyle = "rgba(0,0,10,0.6)"; ctx.fillRect(0, HUD_H, W, H - HUD_H);
      txt("PAUSED", W / 2, 220, 48, "#ffffff", "center", 16, 900);
      txt(isTouchUI() ? "TAP THE SCREEN TO RESUME" : "PRESS " + keyOf("pause").toUpperCase() + " OR ESC TO RESUME", W / 2, 280, 18, "#9fb6ff", "center", 0, 700);
    }
    if (G.flash > 0 && fxOn) {
      ctx.fillStyle = "rgba(" + G.flashColor + "," + Math.min(0.85, G.flash * 0.7) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }
  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HUD_H, W, H - HUD_H); ctx.clip();
    if (G.shake > 0 && fxOn && !G.paused) ctx.translate(rand(-1, 1) * G.shake * 10, rand(-1, 1) * G.shake * 8);
    drawStars();
    drawBackRange();
    if (G.planet) drawTerrain();
    if (G.state !== "attract") drawWorld();
    drawParticles();
    ctx.restore();
    drawHUD();
    drawOverlays();
  }

  // ------------------------------------------------------------ input wiring
  const $ = (id) => document.getElementById(id);
  let settingsOpen = false;
  let capture = null;
  const PLAY_STATES = ["playing", "dying", "waveEnd"];

  function setPaused(p) {
    if (p && !PLAY_STATES.includes(G.state)) return;
    G.paused = p;
    if (p) Sfx.thrust(0);
    $("btn-pause").textContent = p ? "Resume" : "Pause";
  }
  function setMuted(m) {
    Sfx.setMuted(m);
    $("btn-sound").textContent = m ? "Sound off" : "Sound on";
    $("btn-sound").setAttribute("aria-pressed", m ? "false" : "true");
    $("opt-sound").checked = !m;
  }
  function handleGlobal() {
    if (pressed.has("mute")) { pressed.delete("mute"); setMuted(!Sfx.muted); }
    if (pressed.has("pause")) { pressed.delete("pause"); setPaused(!G.paused); }
  }
  function clearHeld() {
    heldCodes.clear();
    for (const k in touchHeld) touchHeld[k] = false;
  }

  window.addEventListener("keydown", (e) => {
    if (capture) { e.preventDefault(); e.stopPropagation(); finishCapture(e.code); return; }
    if (settingsOpen) { if (e.code === "Escape") { e.preventDefault(); closeSettings(); } return; }
    Sfx.unlock();
    const acts = codeMap[e.code];
    if (!acts) return;
    e.preventDefault();
    heldCodes.add(e.code);
    if (!e.repeat) for (const a of acts) pressed.add(a);
  }, { capture: true });
  window.addEventListener("keyup", (e) => {
    heldCodes.delete(e.code);
    if (codeMap[e.code] && !settingsOpen) e.preventDefault();
  });
  window.addEventListener("blur", clearHeld);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearHeld(); if (PLAY_STATES.includes(G.state)) setPaused(true); saveHi(); }
  });
  window.addEventListener("pagehide", saveHi);
  for (const ev of ["pointerdown", "pointerup", "touchend", "click"]) window.addEventListener(ev, () => Sfx.unlock(), { passive: true });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  $("stage").addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  function tapStage() {
    if (settingsOpen) return;
    if (G.paused) { setPaused(false); return; }
    if (G.state === "attract" || (G.state === "gameover" && G.msgT > 1.2)) pressed.add("fire");
  }
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (err) { canvas.focus(); }
    tapStage();
  });

  // touch controls
  const touchEl = $("touch"), zone = $("stick-zone"), base = $("stick-base"), knob = $("stick-knob");
  let stickId = null, stickCX = 0, stickCY = 0;
  const STICK_R = 52;
  function placeStickHome() {
    const r = zone.getBoundingClientRect();
    const portrait = touchEl.classList.contains("portrait");
    base.style.left = (portrait ? r.width * 0.45 : Math.min(100, r.width * 0.5)) + "px";
    base.style.top = (portrait ? r.height * 0.5 : r.height - 104) + "px";
  }
  function stickMove(e) {
    const r = zone.getBoundingClientRect();
    let dx = e.clientX - r.left - stickCX, dy = e.clientY - r.top - stickCY;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx = (dx / d) * STICK_R; dy = (dy / d) * STICK_R; }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    const nx = dx / STICK_R, ny = dy / STICK_R;
    touchHeld.left = nx < -0.35; touchHeld.right = nx > 0.35;
    touchHeld.up = ny < -0.4; touchHeld.down = ny > 0.4;
  }
  zone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    Sfx.unlock();
    if (G.paused || G.state === "attract" || G.state === "gameover") tapStage();
    if (stickId !== null) return;
    stickId = e.pointerId;
    try { zone.setPointerCapture(stickId); } catch (err) { /* ignore */ }
    const r = zone.getBoundingClientRect();
    stickCX = e.clientX - r.left; stickCY = e.clientY - r.top;
    base.style.left = stickCX + "px"; base.style.top = stickCY + "px";
    base.classList.add("active");
    stickMove(e);
  });
  zone.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) { e.preventDefault(); stickMove(e); } });
  const stickEnd = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    knob.style.transform = "";
    base.classList.remove("active");
    touchHeld.left = touchHeld.right = touchHeld.up = touchHeld.down = false;
    placeStickHome();
  };
  zone.addEventListener("pointerup", stickEnd);
  zone.addEventListener("pointercancel", stickEnd);
  zone.addEventListener("lostpointercapture", stickEnd);
  for (const btn of document.querySelectorAll(".tbtn")) {
    const a = btn.dataset.act;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      Sfx.unlock();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (G.paused) { setPaused(false); return; }
      touchHeld[a] = true;
      pressed.add(a);
      btn.classList.add("active");
    });
    const up = () => { touchHeld[a] = false; btn.classList.remove("active"); };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("lostpointercapture", up);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // gamepad (standard mapping)
  const padPrev = {};
  function pollPad() {
    if (!navigator.getGamepads) return;
    let p = null;
    const pads = navigator.getGamepads() || [];
    for (const gp of pads) if (gp && gp.connected) { p = gp; break; }
    const now = {};
    if (p) {
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      now.left = ax < -0.4 || b(14); now.right = ax > 0.4 || b(15);
      now.up = ay < -0.4 || b(12); now.down = ay > 0.4 || b(13);
      now.fire = b(0) || b(5) || b(7); now.bomb = b(1) || b(4); now.hyper = b(2) || b(3) || b(6); now.pause = b(9);
    }
    for (const a of ["left", "right", "up", "down", "fire", "bomb", "hyper", "pause"]) {
      const v = !!now[a];
      if (v && !padPrev[a]) { pressed.add(a); Sfx.unlock(); }
      padHeld[a] = v && a !== "pause";
      padPrev[a] = v;
    }
  }

  // ------------------------------------------------------------ settings panel
  const keysBody = $("keys-body"), keysMsg = $("keys-msg");
  let wasPausedBySettings = false;
  function renderKeyTable() {
    keysBody.textContent = "";
    for (const [a, label] of ACTIONS) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.textContent = label;
      tr.appendChild(td);
      for (let slot = 0; slot < 2; slot++) {
        const cell = document.createElement("td");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "keycap" + (bindings[a][slot] ? "" : " empty");
        b.dataset.action = a; b.dataset.slot = String(slot);
        b.textContent = keyLabel(bindings[a][slot]);
        b.setAttribute("aria-label", label + (slot ? " alt key: " : " key: ") + keyLabel(bindings[a][slot]) + ". Click to change.");
        b.addEventListener("click", () => {
          if (capture) capture.btn.classList.remove("listening");
          capture = { a, slot, btn: b };
          b.classList.add("listening");
          b.textContent = "Press a key\u2026";
          keysMsg.textContent = "Press the new key for " + label + ". Esc cancels.";
        });
        cell.appendChild(b);
        tr.appendChild(cell);
      }
      keysBody.appendChild(tr);
    }
  }
  function saveBindings() { lsSet(LS.keys, JSON.stringify(bindings)); rebuildCodeMap(); }
  function finishCapture(code) {
    const { a, slot } = capture;
    capture = null;
    const label = ACTIONS.find((x) => x[0] === a)[1];
    if (code === "Escape") { keysMsg.textContent = "Cancelled."; renderKeyTable(); return; }
    if (code === "Backspace" || code === "Delete") {
      if (slot === 1) { bindings[a][1] = ""; keysMsg.textContent = label + " alt key cleared."; }
      else keysMsg.textContent = "The main key can't be empty. Pick a key instead.";
      saveBindings(); renderKeyTable(); return;
    }
    const previous = bindings[a][slot];
    let moved = "";
    for (const [other, otherLabel] of ACTIONS) {
      for (let s = 0; s < 2; s++) {
        if (bindings[other][s] === code && !(other === a && s === slot)) {
          bindings[other][s] = s === 0 && previous ? previous : "";
          moved = " (swapped with " + otherLabel + ")";
        }
      }
    }
    bindings[a][slot] = code;
    for (const [other] of ACTIONS) {
      if (!bindings[other][0]) { bindings[other][0] = bindings[other][1] || ""; bindings[other][1] = ""; }
    }
    saveBindings();
    keysMsg.textContent = label + " set to " + keyLabel(code) + moved + ".";
    renderKeyTable();
  }
  function openSettings() {
    if (settingsOpen) return;
    settingsOpen = true;
    wasPausedBySettings = PLAY_STATES.includes(G.state) && !G.paused;
    if (wasPausedBySettings) setPaused(true);
    clearHeld();
    renderKeyTable();
    keysMsg.textContent = "";
    $("opt-sound").checked = !Sfx.muted;
    $("opt-fx").checked = fxOn;
    $("opt-touch").value = lsGet(LS.touch) || "auto";
    $("settings").hidden = false;
    $("settings-close").focus();
  }
  function closeSettings() {
    settingsOpen = false;
    capture = null;
    $("settings").hidden = true;
    if (wasPausedBySettings) setPaused(false);
    wasPausedBySettings = false;
    try { canvas.focus({ preventScroll: true }); } catch (err) { canvas.focus(); }
  }
  $("btn-settings").addEventListener("click", (e) => { e.currentTarget.blur(); openSettings(); });
  $("settings-close").addEventListener("click", closeSettings);
  $("settings").addEventListener("click", (e) => { if (e.target === $("settings")) closeSettings(); });
  $("keys-reset").addEventListener("click", () => {
    bindings = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    saveBindings(); renderKeyTable();
    keysMsg.textContent = "Controls reset to defaults.";
  });
  $("opt-sound").addEventListener("change", (e) => { Sfx.unlock(); setMuted(!e.target.checked); });
  $("opt-fx").addEventListener("change", (e) => { fxOn = e.target.checked; lsSet(LS.fx, fxOn ? "1" : "0"); buildSprites(scale); });
  $("opt-touch").addEventListener("change", (e) => { lsSet(LS.touch, e.target.value); layout(); });
  $("btn-sound").addEventListener("click", (e) => { Sfx.unlock(); setMuted(!Sfx.muted); e.currentTarget.blur(); });
  $("btn-pause").addEventListener("click", (e) => { setPaused(!G.paused); e.currentTarget.blur(); });
  const fsTarget = document.documentElement;
  const canFull = !!(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen);
  if (!canFull) $("btn-full").hidden = true;
  $("btn-full").addEventListener("click", (e) => {
    e.currentTarget.blur();
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    else {
      const req = fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen;
      const res = req.call(fsTarget);
      if (res && res.catch) res.catch(() => {});
    }
  });
  $("rotate-ok").addEventListener("click", () => { lsSet(LS.rotate, "1"); $("rotate").hidden = true; });

  // ------------------------------------------------------------ layout
  let touchSeen = false;
  window.addEventListener("touchstart", () => { if (!touchSeen) { touchSeen = true; layout(); } }, { passive: true, once: true });
  function wantTouch() {
    const opt = lsGet(LS.touch) || "auto";
    if (opt === "on") return true;
    if (opt === "off") return false;
    return touchSeen || !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  }
  function layout() {
    const r = $("stage").getBoundingClientRect();
    const vw = Math.max(1, r.width), vh = Math.max(1, r.height);
    const touch = wantTouch();
    document.body.classList.toggle("touch-ui", touch);
    const portrait = vh > vw;
    let cw, ch, left, top, box;
    W = touch && portrait ? VIEW_W_PORTRAIT : VIEW_W;
    fitHud();
    if (touch && portrait) {
      cw = vw; ch = (cw * H) / W;
      const minCtrl = 200;
      if (vh - ch < minCtrl) { ch = Math.max(100, vh - minCtrl); cw = (ch * W) / H; }
      const ctrlH = vh - ch;
      top = 0;
      left = (vw - cw) / 2;
      box = { left: 0, top: top + ch, width: vw, height: ctrlH };
    } else {
      const s = Math.min(vw / W, vh / H);
      cw = W * s; ch = H * s;
      left = (vw - cw) / 2; top = (vh - ch) / 2;
      box = { left: 0, top: 0, width: vw, height: vh };
    }
    canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
    canvas.style.left = left + "px"; canvas.style.top = top + "px";
    let dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (cw * dpr > 2880) dpr = 2880 / cw;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    scale = canvas.width / W;
    if (Math.abs(scale - spriteScale) > 0.001) buildSprites(scale);
    touchEl.hidden = !touch;
    touchEl.classList.toggle("portrait", touch && portrait);
    touchEl.classList.toggle("landscape", touch && !portrait);
    Object.assign(touchEl.style, { left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px" });
    if (touch) placeStickHome();
    $("rotate").hidden = !(touch && portrait && lsGet(LS.rotate) !== "1");
  }
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", () => setTimeout(layout, 150));
  window.addEventListener("jsp-banner-ready", layout);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
  document.addEventListener("fullscreenchange", layout);

  // ------------------------------------------------------------ main loop (fixed-timestep logic)
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    pollPad();
    handleGlobal();
    if (!G.paused && !settingsOpen) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 16) { step(STEP); pressed.clear(); acc -= STEP; n++; }
      if (n >= 16) acc = 0;
    } else {
      pressed.clear();
      acc = 0;
    }
    render();
  }

  // ------------------------------------------------------------ boot
  genTerrain();
  G.camX = rand(0, WORLD_W);
  setMuted(Sfx.muted);
  layout();
  requestAnimationFrame((t) => { last = t; frame(t); });

  // Read-only hook for automated tests. Cheats (debug) only exist with ?debug=1 in the URL.
  const DEBUG = /(?:^|[?&])debug=1(?:&|$)/.test(location.search);
  window.DefenderGame = {
    get state() { return G.state; },
    get score() { return G.score; },
    get wave() { return G.wave; },
    get lives() { return G.lives; },
    get bombs() { return G.bombs; },
    get paused() { return G.paused; },
    get hi() { return G.hi; },
    get ship() { return { x: ship.x, y: ship.y, vx: ship.vx, face: ship.face, alive: ship.alive }; },
    get counts() { return { enemies: enemies.length, humans: humans.length, beams: beams.length, bullets: bullets.length, particles: parts.length }; },
    get bindings() { return JSON.parse(JSON.stringify(bindings)); },
    get scale() { return scale; },
    get view() { return { w: W, h: H }; },
    get splash() { return !!(Splash && Splash.isOpen()); }
  };
  if (DEBUG) {
    window.DefenderGame.debug = {
      clearWave() { G.toSpawn = 0; for (const e of enemies.slice()) if (e.type === "lander" || e.type === "mutant") killEnemy(e); },
      loseShip() { if (G.state === "playing" && ship.alive) { ship.inv = 0; ship.hyper = 0; killShip(); } },
      // place the ship low, facing a walking humanoid, for laser/humanoid tests
      lineUpHuman() {
        const h = humans.find((q) => q.state === "walk");
        if (!h || !ship.alive) return false;
        enemies = enemies.filter((e) => e.type !== "lander" || e.state === "seek");
        ship.inv = 3; ship.x = wrapX(h.x - 160); ship.y = h.y - 3; ship.vx = 0; ship.face = 1; h.vx = 0;
        G.shipSX = W * 0.28; G.camX = wrapX(ship.x - G.shipSX);
        return true;
      },
      fire() { fire(); },
      sfx: Sfx,
      humans() { return humans.filter((h) => h.state !== "dead").length; },
      spawnCount() { return { toSpawn: G.toSpawn, bombers: countType("bomber"), pods: countType("pod"), baiterT: G.baiterT }; }
    };
  }
})();
