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

/* Shared F-key fullscreen for every arcade game (desktop monitors). Ignored while typing or while a
   settings/remap dialog is open. Uses the game's own fullscreen button when present. Written by: Howie */
(function () {
  "use strict";
  if (window.__arcadeFKey) return; window.__arcadeFKey = true;
  // Games with their own F-key handler opt out (avoid a double toggle). Add a game here, or set
  // window.ARCADE_OWN_FKEY = true / <html data-own-fkey> in that game.
  var OWN = /\/games\/(joust|galaga)\//;
  window.addEventListener("keydown", function (e) {
    if (window.ARCADE_OWN_FKEY || document.documentElement.hasAttribute("data-own-fkey") || OWN.test(location.pathname)) return;
    if (e.code !== "KeyF" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    var dlg = document.querySelector('[role="dialog"]:not([hidden])');
    if (dlg && dlg.offsetParent !== null) return;
    var b = document.getElementById("btn-full");
    if (b) { b.click(); return; }
    var d = document;
    if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () {});
  }, true);
})();
