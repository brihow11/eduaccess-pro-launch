/* Battlezone: Operation Iron Dawn campaign layer. Campaign map with mission nodes across five regions,
   briefing, upgrade picks between missions, and one-time "new thing" tutorial cards. Crisp DOM/SVG so
   it is sharp at any pixel density. Written by: Howie */
(function () {
  'use strict';
  var root = null, open = false, tipQ = [], tipOpen = false, lastOpts = null;
  var REG_COL = { plains: '#46ff70', dunes: '#ffc040', glacier: '#5ad8ff', ash: '#e286ff', citadel: '#ffe196' };
  var ICON = { destroy: '\u2295', depots: '\u25A3', escort: '\u27A4', defend: '\u26E8', boss: '\u2620' };
  var TYPE = { destroy: 'Destroy', depots: 'Raid', escort: 'Escort', defend: 'Defend', boss: 'Boss' };
  function seen(k) { try { return localStorage.getItem('bz.tut.' + k) === '1'; } catch (e) { return false; } }
  function mark(k) { try { localStorage.setItem('bz.tut.' + k, '1'); } catch (e) { } }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function mount() {
    if (root) return root;
    root = el('div', 'bzc'); root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    (document.getElementById('wrap') || document.body).appendChild(root);
    document.addEventListener('keydown', onKey, true);
    return root;
  }
  // node positions on a 1000x420 map, a winding road west to east
  var NODES = [[70, 330], [150, 250], [235, 320], [320, 220], [395, 300], [470, 210], [560, 150], [640, 230], [720, 140], [790, 240], [845, 330], [870, 200], [945, 120]].map(function (p) { return [p[0], Math.round(p[1] * 0.62 + 22)]; });
  var REGIONS = [['plains', 0, 275], ['dunes', 275, 515], ['glacier', 515, 755], ['ash', 755, 895], ['citadel', 895, 1000]];
  var SHORT = { plains: 'EMERALD PLAINS', dunes: 'AMBER DUNES', glacier: 'GLACIER PASS', ash: 'ASH WASTES', citadel: 'CITADEL' };
  function mapSvg(o) {
    var s = '<svg class="bzc-map" viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>';
    REGIONS.forEach(function (r) { s += '<linearGradient id="g-' + r[0] + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + REG_COL[r[0]] + '" stop-opacity=".16"/><stop offset="1" stop-color="' + REG_COL[r[0]] + '" stop-opacity=".03"/></linearGradient>'; });
    s += '<filter id="bzglow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    REGIONS.forEach(function (r) {
      s += '<rect x="' + r[1] + '" y="0" width="' + (r[2] - r[1]) + '" height="250" fill="url(#g-' + r[0] + ')"/>';
      s += '<line x1="' + r[2] + '" y1="0" x2="' + r[2] + '" y2="250" stroke="' + REG_COL[r[0]] + '" stroke-opacity=".25" stroke-dasharray="4 6"/>';
      s += '<text x="' + ((r[1] + r[2]) / 2) + '" y="24" text-anchor="middle" class="bzc-reg" fill="' + REG_COL[r[0]] + '">' + SHORT[r[0]] + '</text>';
      // terrain marks per region
      for (var i = 0; i < 6; i++) { var x = r[1] + 20 + ((i * 53) % Math.max(30, r[2] - r[1] - 40)), y = 52 + ((i * 97) % 180);
        if (r[0] === 'plains') s += '<path d="M' + x + ' ' + y + 'q6 -8 12 0" stroke="' + REG_COL.plains + '" stroke-opacity=".35" fill="none"/>';
        else if (r[0] === 'dunes') s += '<path d="M' + (x - 10) + ' ' + y + 'q12 -10 24 0q8 -6 16 0" stroke="' + REG_COL.dunes + '" stroke-opacity=".35" fill="none"/>';
        else if (r[0] === 'glacier') s += '<path d="M' + x + ' ' + (y + 6) + 'l9 -16l9 16z" stroke="' + REG_COL.glacier + '" stroke-opacity=".4" fill="none"/>';
        else if (r[0] === 'ash') s += '<path d="M' + x + ' ' + (y + 6) + 'l7 -12l4 5l7 -9l6 16z" stroke="' + REG_COL.ash + '" stroke-opacity=".4" fill="none"/>'; }
    });
    s += '<path d="M935 215l10 -40l10 40M920 215h50v18h-50z M925 215v-14h8v14 M957 215v-14h8v14" stroke="' + REG_COL.citadel + '" fill="none" stroke-opacity=".6"/>';
    var d = 'M' + NODES.map(function (p) { return p.join(' '); }).join(' L');
    s += '<path d="' + d + '" stroke="#9fb" stroke-opacity=".25" stroke-width="3" fill="none" stroke-dasharray="2 7" stroke-linecap="round"/>';
    var dn = NODES.slice(0, o.next).map(function (p) { return p.join(' '); }); if (dn.length > 1) s += '<path d="M' + dn.join(' L') + '" stroke="#ffd36a" stroke-width="3.5" fill="none" filter="url(#bzglow)" stroke-linecap="round"/>';
    o.missions.forEach(function (m, i) {
      var p = NODES[i], st = i + 1 < o.next ? 'done' : i + 1 === o.next ? 'next' : 'locked', col = REG_COL[m.biome];
      s += '<g class="bzc-node ' + st + '" transform="translate(' + p[0] + ' ' + p[1] + ')">';
      if (st === 'next') s += '<circle r="22" class="bzc-pulse" stroke="' + col + '" fill="none"/>';
      s += '<circle r="' + (m.type === 'boss' ? 16 : 13) + '" fill="#020a05" stroke="' + (st === 'locked' ? '#3c5a46' : col) + '" stroke-width="2.5"/>';
      s += '<text y="5" text-anchor="middle" class="bzc-ico" fill="' + (st === 'done' ? '#ffd36a' : st === 'locked' ? '#4f7a5c' : col) + '">' + (st === 'done' ? '\u2713' : ICON[m.type]) + '</text>';
      s += '<text y="' + (m.type === 'boss' ? 34 : 30) + '" text-anchor="middle" class="bzc-num" fill="' + (st === 'locked' ? '#4f7a5c' : '#dfffe6') + '">' + (i + 1) + '</text></g>';
    });
    var tp = NODES[o.next - 1]; s += '<g transform="translate(' + tp[0] + ' ' + (tp[1] - 34) + ')" class="bzc-you"><path d="M-9 4h18l-3 -5h-12z M-4 -1l2 -4h5l1 4 M2 -3h9" stroke="#ffd36a" stroke-width="1.6" fill="none"/></g>';
    return s + '</svg>';
  }
  function render() {
    var o = lastOpts, m = o.missions[o.next - 1], b = o.biomes[m.biome], r = mount();
    var picks = [];
    if (o.pick) { var pool = Object.keys(o.upgrades).filter(function (k) { return (o.up[k] || 0) < o.upgrades[k].max; }); var seed = o.next * 7; pool.sort(function (a, c) { return ((a.charCodeAt(0) * seed) % 11) - ((c.charCodeAt(0) * seed) % 11); }); picks = pool.slice(0, 3); }
    var h = '<div class="bzc-inner"><div class="bzc-head"><div><div class="bzc-op">OPERATION IRON DAWN</div><div class="bzc-sub">Mission ' + o.next + ' of ' + o.missions.length + ' \u2022 ' + b.name + '</div></div>' +
      '<div class="bzc-stat">Score ' + (o.score || 0).toLocaleString() + ' \u2022 Tanks ' + o.lives + '</div></div>' + mapSvg(o) +
      '<div class="bzc-low"><div class="bzc-brief"><div class="bzc-type" style="color:' + REG_COL[m.biome] + '">' + ICON[m.type] + ' ' + TYPE[m.type] + ' mission</div><h3>' + m.name + '</h3><p>' + m.brief + '</p>';
    var ups = Object.keys(o.up).filter(function (k) { return o.up[k]; }).map(function (k) { return o.upgrades[k].name + (o.upgrades[k].max > 1 ? ' ' + o.up[k] : ''); });
    if (ups.length) h += '<p class="bzc-ups">Fitted: ' + ups.join(', ') + '</p>';
    h += '</div><div class="bzc-act">';
    if (picks.length) { h += '<div class="bzc-pickh">Choose an upgrade (1, 2 or 3)</div><div class="bzc-picks">'; picks.forEach(function (k, i) { var u = o.upgrades[k]; h += '<button type="button" class="bzc-pick" data-k="' + k + '"><b>' + (i + 1) + '. ' + u.name + '</b><span>' + u.desc + '</span></button>'; }); h += '</div>'; }
    h += '<div class="bzc-btns"><button type="button" class="bzc-go"' + (picks.length ? ' disabled' : '') + '>Deploy \u25B6</button>';
    if (o.resumed) h += '<button type="button" class="bzc-alt bzc-restart">New campaign</button>';
    h += '<a class="bzc-alt" href="/games/">Main menu</a></div></div></div></div>';
    r.innerHTML = h; r.hidden = false; open = true;
    r.querySelectorAll('.bzc-pick').forEach(function (btn) { btn.addEventListener('click', function () { choose(btn.getAttribute('data-k')); }); });
    r.querySelector('.bzc-go').addEventListener('click', deploy);
    var rs = r.querySelector('.bzc-restart'); if (rs) rs.addEventListener('click', function () { close(); o.onRestart(); });
    setTimeout(function () { var f = r.querySelector('.bzc-pick') || r.querySelector('.bzc-go'); if (f) f.focus(); }, 30);
    if (!seen('map')) queue([['map', 'CAMPAIGN MAP', 'Your road runs west to east through five regions to the Iron Citadel. Read the briefing, then press Deploy.']]);
    if (picks.length && !seen('upgrade')) queue([['upgrade', 'UPGRADES', 'Each finished mission earns one upgrade for your tank. Pick one card. Upgrades stay for the whole campaign.']]);
  }
  function choose(k) { if (!lastOpts.pick) return; lastOpts.onPick(k); lastOpts.pick = false; render(); var g = root.querySelector('.bzc-go'); if (g) g.focus(); }
  function deploy() { if (lastOpts.pick || tipOpen) return; close(); lastOpts.onDeploy(); }
  function close() { if (root) { root.hidden = true; root.innerHTML = ''; } open = false; }
  function onKey(e) {
    if (tipOpen) { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); nextTip(); } return; }
    if (!open) return;
    var picks = root.querySelectorAll('.bzc-pick');
    if (/^Digit[1-3]$/.test(e.code) && picks.length) { var b = picks[+e.code.slice(5) - 1]; if (b) { e.preventDefault(); e.stopPropagation(); choose(b.getAttribute('data-k')); } return; }
    if (e.code === 'Enter' && !(document.activeElement && /bzc-pick|bzc-alt/.test(document.activeElement.className))) { e.preventDefault(); e.stopPropagation(); deploy(); return; }
    e.stopPropagation();
  }
  // tutorial cards: one at a time, only the first time each new thing appears
  var tipEl = null;
  function queue(list) { list.forEach(function (t) { if (!seen(t[0]) && !tipQ.some(function (q) { return q[0] === t[0]; })) tipQ.push(t); }); if (!tipOpen) nextTip(); }
  function nextTip() {
    if (!tipEl) { tipEl = el('div', 'bzc-tip'); tipEl.setAttribute('role', 'alertdialog'); (document.getElementById('wrap') || document.body).appendChild(tipEl); }
    var t = tipQ.shift();
    if (!t) { tipEl.hidden = true; tipOpen = false; return; }
    mark(t[0]); tipOpen = true; tipEl.hidden = false;
    tipEl.innerHTML = '<div class="bzc-tipc"><div class="bzc-tipk">NEW</div><h4>' + t[1] + '</h4><p>' + t[2] + '</p><button type="button">Got it' + (tipQ.length ? ' (' + tipQ.length + ' more)' : '') + '</button></div>';
    var b = tipEl.querySelector('button'); b.addEventListener('click', nextTip); setTimeout(function () { b.focus(); }, 20);
  }
  window.BZCamp = {
    open: function (o) { lastOpts = o; render(); },
    close: close,
    isOpen: function () { return open || tipOpen; },
    tips: function (list) { queue(list || []); },
    resetTips: function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('bz.tut.') === 0) localStorage.removeItem(k); }); } catch (e) { } }
  };
})();
