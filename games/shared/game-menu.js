/*
 * Shared in-game overlay: Resume / Play again + Main menu buttons for pause,
 * game-over and victory screens. Written by: Howie
 *
 *   var ov = ArcadeOverlay.mount(containerEl);
 *   ov.show({ primary: { label: 'Resume', onClick: fn } });   // Main menu (to /games/) is always added
 *   ov.hide();  ov.visible
 */
(function () {
  "use strict";
  if (window.ArcadeOverlay) return;
  window.ArcadeOverlay = {
    mount: function (container) {
      var el = document.createElement("div");
      el.className = "arcade-ov"; el.hidden = true; el.setAttribute("role", "group"); el.setAttribute("aria-label", "Game menu");
      container.appendChild(el);
      ["pointerdown", "touchstart", "mousedown"].forEach(function (ev) { el.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
      var key = "";
      return {
        el: el,
        get visible() { return !el.hidden; },
        show: function (o) {
          o = o || {};
          var k = (o.primary ? o.primary.label : "") + "|" + (o.secondary ? o.secondary.label : "");
          if (!el.hidden && k === key) return;
          key = k; el.innerHTML = "";
          [o.primary, o.secondary].forEach(function (b, i) {
            if (!b) return;
            var x = document.createElement("button"); x.type = "button"; x.textContent = b.label; if (i === 0) x.className = "primary";
            x.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); x.blur(); b.onClick(); });
            el.appendChild(x);
          });
          var a = document.createElement("a"); a.href = "/games/"; a.className = "menu"; a.setAttribute("data-main-menu", "");
          a.innerHTML = '<span aria-hidden="true">&#9776;</span> Main menu';
          el.appendChild(a);
          el.hidden = false;
        },
        hide: function () { if (!el.hidden) { el.hidden = true; key = ""; } }
      };
    }
  };
})();
