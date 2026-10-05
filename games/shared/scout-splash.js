/* Job Seeker Pro Scout AI splash shown between arcade waves and on game over. Written by: Howie */
/* ---------- Job Seeker Pro Scout splash (shown between waves and on game over) ----------
   Feature names and descriptions are quoted from the published www.jspro.ai home page. */
(function () {
  'use strict';
  // Standalone: works with or without arcade.js. Exposes window.ScoutSplash (and Arcade.splash when present).
  var A = window.ScoutSplash = window.ScoutSplash || {};
  A.store = A.store || {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  var FEATURES = [
    { name: 'Pick Jobs', text: 'Scout AI searches beyond the obvious boards, filters noise, and gives you a focused list of jobs worth your time.', icon: 'radar' },
    { name: 'Job Follow-Ups', text: 'Track applied jobs, interviews, notes, people, next steps, and items owed without losing the thread.', icon: 'track' },
    { name: 'Live AI Practice Interview', text: 'Practice out loud with role-specific questions, then turn real answers into reusable story material.', icon: 'mic' },
    { name: 'Interview Prep Packet', text: 'Get a skimmable prep brief that uses your resume, notes, job details, stories, and interview context.', icon: 'packet' },
    { name: 'Hidden-job scanning', text: 'Across ATS and company sites. Scout AI searches overlooked job sources, organizes your pipeline, and turns your resume, notes, interviews, and practice stories into smarter next moves.', icon: 'scan' },
    { name: 'Follow-up support', text: 'For every real opportunity. Scout helps you turn the role, company, interviewer notes, practice answers, and your resume into useful messages and prep.', icon: 'mail' }
  ];
  A.SCOUT_FEATURES = FEATURES;
  A.scoutUrl = function (campaign, content) {
    return 'https://www.jspro.ai/?utm_source=eduaccess&utm_medium=game&utm_campaign=' + encodeURIComponent(campaign) + '&utm_content=' + encodeURIComponent(content || 'splash');
  };
  // animated SVG icons (SMIL + CSS free; SMIL works in all modern browsers)
  function icon(kind, col) {
    var a = col || '#7fd8ff', g = '#ffcf5a';
    var s = '<svg class="sp-ico" viewBox="0 0 160 80" aria-hidden="true">';
    if (kind === 'radar' || kind === 'scan') {
      s += '<circle cx="80" cy="40" r="34" fill="none" stroke="' + a + '" stroke-opacity=".35"/><circle cx="80" cy="40" r="22" fill="none" stroke="' + a + '" stroke-opacity=".3"/><circle cx="80" cy="40" r="10" fill="none" stroke="' + a + '" stroke-opacity=".3"/>' +
        '<g><path d="M80 40 L80 6 A34 34 0 0 1 108 21 Z" fill="' + a + '" fill-opacity=".35"/><animateTransform attributeName="transform" type="rotate" from="0 80 40" to="360 80 40" dur="2.4s" repeatCount="indefinite"/></g>';
      var pts = kind === 'radar' ? [[98, 26], [62, 52], [92, 58]] : [[66, 22], [104, 44], [74, 60]];
      pts.forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="' + g + '"><animate attributeName="opacity" values="0;1;0.2;0" dur="2.4s" begin="' + (i * 0.7) + 's" repeatCount="indefinite"/></circle>'; });
      if (kind === 'scan') s += '<rect x="20" y="10" width="14" height="60" rx="2" fill="none" stroke="' + a + '" stroke-opacity=".5"/><rect x="126" y="10" width="14" height="60" rx="2" fill="none" stroke="' + a + '" stroke-opacity=".5"/><rect x="20" y="10" width="120" height="2" fill="' + g + '"><animate attributeName="y" values="10;68;10" dur="2s" repeatCount="indefinite"/></rect>';
    } else if (kind === 'track') {
      [0, 1, 2].forEach(function (i) {
        var y = 14 + i * 22;
        s += '<rect x="34" y="' + y + '" width="92" height="14" rx="4" fill="' + a + '" fill-opacity=".14" stroke="' + a + '" stroke-opacity=".4"/>' +
          '<rect x="58" y="' + (y + 5) + '" width="0" height="4" rx="2" fill="' + a + '"><animate attributeName="width" values="0;58;58" keyTimes="0;.6;1" dur="2.6s" begin="' + (i * 0.5) + 's" repeatCount="indefinite"/></rect>' +
          '<path d="M40 ' + (y + 7) + ' l4 4 l7 -8" fill="none" stroke="' + g + '" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="20" stroke-dashoffset="20"><animate attributeName="stroke-dashoffset" values="20;0;0" keyTimes="0;.3;1" dur="2.6s" begin="' + (i * 0.5 + 0.9) + 's" repeatCount="indefinite"/></path>';
      });
    } else if (kind === 'mic') {
      s += '<rect x="72" y="12" width="16" height="32" rx="8" fill="none" stroke="' + g + '" stroke-width="3"/><path d="M64 36 a16 16 0 0 0 32 0 M80 52 v10 M70 64 h20" fill="none" stroke="' + g + '" stroke-width="3" stroke-linecap="round"/>';
      for (var i = 0; i < 7; i++) {
        var x1 = 14 + i * 7, x2 = 104 + i * 7, d = (0.12 * i).toFixed(2);
        [x1, x2].forEach(function (x) { s += '<rect x="' + x + '" y="30" width="4" height="20" rx="2" fill="' + a + '"><animate attributeName="height" values="4;26;8;18;4" dur="1.1s" begin="' + d + 's" repeatCount="indefinite"/><animate attributeName="y" values="38;27;36;31;38" dur="1.1s" begin="' + d + 's" repeatCount="indefinite"/></rect>'; });
      }
    } else if (kind === 'packet') {
      s += '<g><rect x="54" y="8" width="52" height="64" rx="5" fill="' + a + '" fill-opacity=".12" stroke="' + a + '"/>';
      [20, 30, 40, 50, 60].forEach(function (y, i) { s += '<rect x="62" y="' + y + '" width="0" height="4" rx="2" fill="' + (i === 0 ? g : a) + '"><animate attributeName="width" values="0;' + (i === 0 ? 24 : 36) + ';' + (i === 0 ? 24 : 36) + '" keyTimes="0;.4;1" dur="2.4s" begin="' + (i * 0.2) + 's" repeatCount="indefinite"/></rect>'; });
      s += '<animateTransform attributeName="transform" type="translate" values="0 2;0 -2;0 2" dur="2.4s" repeatCount="indefinite"/></g>';
    } else { // mail
      s += '<g><rect x="50" y="20" width="60" height="40" rx="4" fill="none" stroke="' + a + '" stroke-width="2.5"/><path d="M50 22 L80 44 L110 22" fill="none" stroke="' + a + '" stroke-width="2.5"/><animateTransform attributeName="transform" type="translate" values="-30 0;0 0;30 -4;60 -10" keyTimes="0;.4;.8;1" dur="2.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.2;.8;1" dur="2.6s" repeatCount="indefinite"/></g>' +
        '<path d="M20 60 h20 M24 52 h14 M18 44 h18" stroke="' + g + '" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
    }
    return s + '</svg>';
  }

  var el = null, bg = null, bgc = null, raf = 0, openAt = 0, cb = null, theme = null, parts = [];
  function build() {
    el = document.createElement('div');
    el.className = 'splash'; el.id = 'scout-splash';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Job Seeker Pro Scout AI');
    document.body.appendChild(el);
  }
  function animBg() {
    if (!el.classList.contains('open')) return;
    var w = bg.width = Math.round(innerWidth * Math.min(devicePixelRatio || 1, 1.5)), h = bg.height = Math.round(innerHeight * Math.min(devicePixelRatio || 1, 1.5));
    var c = bgc, t = performance.now() / 1000;
    var grd = c.createLinearGradient(0, 0, 0, h);
    if (theme.kind === 'joust') { grd.addColorStop(0, '#0b0508'); grd.addColorStop(0.7, '#2a0a06'); grd.addColorStop(1, '#7a1f05'); }
    else { grd.addColorStop(0, '#02030a'); grd.addColorStop(0.75, '#0a0d2a'); grd.addColorStop(1, '#1d0b33'); }
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (theme.kind === 'joust') {
        p.y -= p.v; p.x += Math.sin(t * 1.3 + p.s * 9) * 0.6;
        if (p.y < -10) { p.y = 1.05; p.x = Math.random(); }
        var px = p.x * w + Math.sin(t + p.s * 20) * 20, py = p.y * h;
        c.fillStyle = 'rgba(255,' + (90 + (p.s * 120 | 0)) + ',30,' + (0.35 + p.s * 0.6) + ')';
        c.beginPath(); c.arc(px, py, 1 + p.s * 3, 0, 6.283); c.fill();
        p.y -= 0.0015 + p.s * 0.002;
      } else {
        // warp-speed starfield
        p.z -= 0.006 + p.s * 0.004; if (p.z < 0.02) { p.z = 1; p.x = Math.random() * 2 - 1; p.y = Math.random() * 2 - 1; }
        var sx = w / 2 + p.x / p.z * w * 0.3, sy = h / 2 + p.y / p.z * h * 0.3;
        var sx2 = w / 2 + p.x / (p.z + 0.03) * w * 0.3, sy2 = h / 2 + p.y / (p.z + 0.03) * h * 0.3;
        c.strokeStyle = p.s > 0.8 ? 'rgba(255,120,240,.9)' : 'rgba(150,210,255,' + (1 - p.z) + ')';
        c.lineWidth = (1 - p.z) * 3; c.beginPath(); c.moveTo(sx2, sy2); c.lineTo(sx, sy); c.stroke();
      }
    }
    if (theme.kind === 'joust') {
      // lava glow pulse at bottom
      var lg = c.createRadialGradient(w / 2, h * 1.1, 10, w / 2, h * 1.1, h * 0.8);
      lg.addColorStop(0, 'rgba(255,110,20,' + (0.35 + 0.1 * Math.sin(t * 2)) + ')'); lg.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = lg; c.fillRect(0, 0, w, h);
    }
    c.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(animBg);
  }
  function onKey(e) {
    if (!el || !el.classList.contains('open')) return;
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyC' || e.code === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      if (document.activeElement && document.activeElement.classList.contains('sp-cta') && e.code === 'Enter') { window.open(document.activeElement.href, '_blank', 'noopener'); return; }
      cont();
    }
  }
  function cont() {
    if (performance.now() - openAt < 900) return;
    el.classList.remove('open'); cancelAnimationFrame(raf);
    var f = cb; cb = null; if (f) f();
  }
  // opts: {kind:'defender'|'joust', campaign, title, sub, accent, onContinue}
  A.show = A.splash = function (opts) {
    if (!el) { build(); window.addEventListener('keydown', onKey, true); }
    theme = opts;
    var n = A.store.get('arcade.scoutRot', 0) | 0;
    A.store.set('arcade.scoutRot', n + 1);
    var start = (n * 3) % FEATURES.length;
    var picks = [FEATURES[start], FEATURES[(start + 1) % FEATURES.length], FEATURES[(start + 2) % FEATURES.length]];
    var acc = opts.accent || '#7fd8ff';
    el.style.setProperty('--sp-accent', acc);
    el.style.setProperty('--sp-glow', opts.glow || 'rgba(80,160,255,.28)');
    el.innerHTML = '<canvas class="sp-bg" aria-hidden="true"></canvas><div class="sp-card">' +
      '<p class="sp-result">' + opts.title + '</p><p class="sp-sub">' + (opts.sub || '') + '</p>' +
      '<div class="sp-brand"><span class="sp-mark" aria-hidden="true">JSP</span><b>Job Seeker Pro Scout AI</b></div>' +
      '<p class="sp-lede">Find hidden jobs, pick the right ones, and follow up like the candidate they remember.</p>' +
      '<div class="sp-feats">' + picks.map(function (f) { return '<div class="sp-feat">' + icon(f.icon, acc) + '<div><h3>' + f.name + '</h3><p>' + f.text + '</p></div></div>'; }).join('') + '</div>' +
      '<div class="sp-actions"><a class="sp-cta" target="_blank" rel="noopener" href="' + A.scoutUrl(opts.campaign, 'splash-' + (opts.tag || 'wave')) + '">Try Scout free &rarr;</a>' +
      '<button type="button" class="sp-cont">' + (opts.contLabel || 'Continue') + ' <small>(Enter)</small></button></div>' +
      '<div class="sp-hint">Press Enter, Space or C to continue \u2022 tap Continue on mobile</div>' +
      '<div class="sp-fine">Opens www.jspro.ai in a new tab; your game stays right here.</div></div>';
    bg = el.querySelector('.sp-bg'); bgc = bg.getContext('2d');
    parts = [];
    for (var i = 0; i < 160; i++) parts.push({ x: Math.random() * (opts.kind === 'joust' ? 1 : 2) - (opts.kind === 'joust' ? 0 : 1), y: Math.random() * (opts.kind === 'joust' ? 1 : 2) - (opts.kind === 'joust' ? 0 : 1), z: Math.random(), s: Math.random(), v: 0 });
    el.querySelector('.sp-cont').addEventListener('click', function (e) { e.preventDefault(); cont(); });
    cb = opts.onContinue; openAt = performance.now();
    el.classList.add('open');
    cancelAnimationFrame(raf); raf = requestAnimationFrame(animBg);
    setTimeout(function () { var c = el.querySelector('.sp-cont'); if (c) c.focus({ preventScroll: true }); }, 50);
    if (A.onSplash) A.onSplash(picks.map(function (p) { return p.name; }));
    return picks;
  };
  A.isOpen = A.splashOpen = function () { return !!(el && el.classList.contains('open')); };
  if (window.Arcade) { window.Arcade.splash = A.show; window.Arcade.splashOpen = A.isOpen; window.Arcade.SCOUT_FEATURES = FEATURES; window.Arcade.scoutUrl = A.scoutUrl; }
})();
