/* Shared virtual analog joystick for the /games arcade touch controls. Written by: Howie
   ArcadeStick.mount(zone, opts) turns an element (the left control zone) into a thumb stick:
   - a round base with a thumb knob that follows the finger and is clamped to the base;
   - the base rests in the bottom-left of the zone and jumps to wherever the thumb lands ("float");
   - reports raw x/y (-1..1), a radial dead-zone analog vector (ax/ay, mag, angle) and 8-way dirs;
   - tracks one pointer id only, so the other thumb can hold FIRE (or any button) at the same time.
   opts: theme ('defender' | 'battlezone'), deadZone (0..1, default 0.2), float (default true),
         home(zoneRect) -> { x, y } rest position inside the zone, onChange(state), onDown(event).
   No flashing: only gentle opacity and position transitions. */
(function () {
  'use strict';
  var DIRS = [ // 8 sectors, 45 degrees each, starting at "right" and going clockwise (screen y points down)
    { right: 1 }, { right: 1, down: 1 }, { down: 1 }, { left: 1, down: 1 },
    { left: 1 }, { left: 1, up: 1 }, { up: 1 }, { right: 1, up: 1 }
  ];
  function blank() { return { active: false, x: 0, y: 0, ax: 0, ay: 0, mag: 0, angle: 0, dir: 'none', left: false, right: false, up: false, down: false }; }
  function compute(dx, dy, dz) {
    var s = blank(), m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; m = 1; }
    s.active = true; s.x = dx; s.y = dy; s.angle = Math.atan2(dy, dx);
    if (m > dz) {
      var k = (m - dz) / (1 - dz);
      s.mag = k; s.ax = (dx / m) * k; s.ay = (dy / m) * k;
      var sec = Math.round(s.angle / (Math.PI / 4)); sec = ((sec % 8) + 8) % 8;
      var d = DIRS[sec];
      s.left = !!d.left; s.right = !!d.right; s.up = !!d.up; s.down = !!d.down;
      s.dir = (s.up ? 'up' : s.down ? 'down' : '') + (s.left ? 'left' : s.right ? 'right' : '');
    }
    return s;
  }
  function mount(zone, opts) {
    opts = opts || {};
    var dz = opts.deadZone == null ? 0.2 : opts.deadZone, float = opts.float !== false;
    var base = document.createElement('div');
    base.className = 'astick astick--' + (opts.theme || 'defender');
    base.setAttribute('aria-hidden', 'true');
    base.innerHTML = '<div class="astick-ring"></div><div class="astick-ticks"></div>' +
      '<i class="astick-chev n"></i><i class="astick-chev e"></i><i class="astick-chev s"></i><i class="astick-chev w"></i>' +
      '<div class="astick-glow"></div><div class="astick-knob"><div class="astick-cap"></div></div>';
    zone.appendChild(base);
    zone.classList.add('astick-zone');
    var knob = base.querySelector('.astick-knob'), glow = base.querySelector('.astick-glow');
    var id = null, cx = 0, cy = 0, travel = 40, state = blank();
    function size() { var b = base.offsetWidth || 128, k = knob.offsetWidth || 58; travel = Math.max(20, b / 2 - k * 0.22); return b; }
    function clampCenter(x, y, r) {
      var half = size() / 2, pad = 4;
      return { x: Math.max(half + pad, Math.min(r.width - half - pad, x)), y: Math.max(half + pad, Math.min(r.height - half - pad, y)) };
    }
    function home() {
      var r = zone.getBoundingClientRect(); if (!r.width) return;
      var h = opts.home ? opts.home(r) : { x: size() / 2 + 22, y: r.height - size() / 2 - 20 };
      var p = clampCenter(h.x, h.y, r); cx = p.x; cy = p.y;
      base.style.left = cx + 'px'; base.style.top = cy + 'px';
    }
    function emit(s) {
      var was = state; state = s;
      if (opts.onChange && (was.active !== s.active || was.x !== s.x || was.y !== s.y)) opts.onChange(s);
    }
    function move(e) {
      var r = zone.getBoundingClientRect();
      var dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy, d = Math.hypot(dx, dy);
      if (d > travel) { dx = dx / d * travel; dy = dy / d * travel; }
      knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      var s = compute(dx / travel, dy / travel, dz);
      glow.style.opacity = (s.mag * 0.9).toFixed(2);
      glow.style.transform = 'rotate(' + (s.angle * 180 / Math.PI).toFixed(1) + 'deg)';
      base.setAttribute('data-dir', s.dir);
      emit(s);
    }
    function down(e) {
      if (id !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (opts.onDown) opts.onDown(e);
      id = e.pointerId;
      try { zone.setPointerCapture(id); } catch (x) { /* ignore */ }
      var r = zone.getBoundingClientRect();
      if (float) {
        var p = clampCenter(e.clientX - r.left, e.clientY - r.top, r); cx = p.x; cy = p.y;
        base.style.left = cx + 'px'; base.style.top = cy + 'px';
      }
      base.classList.add('is-active');
      move(e);
    }
    function end(e) {
      if (e && e.pointerId !== id) return;
      id = null;
      knob.style.transform = ''; glow.style.opacity = '0'; base.removeAttribute('data-dir');
      base.classList.remove('is-active');
      home();
      emit(blank());
    }
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', function (e) { if (e.pointerId === id) { e.preventDefault(); move(e); } });
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
    zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('blur', function () { if (id !== null) end({ pointerId: id }); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && id !== null) end({ pointerId: id }); });
    window.addEventListener('resize', function () { if (id === null) home(); });
    requestAnimationFrame(home);
    return {
      el: base,
      get state() { return state; },
      relayout: function () { if (id === null) home(); },
      reset: function () { if (id !== null) { try { zone.releasePointerCapture(id); } catch (x) { /* ignore */ } end({ pointerId: id }); } }
    };
  }
  window.ArcadeStick = { mount: mount, compute: compute };
})();
