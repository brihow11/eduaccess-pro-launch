/*
 * Job Seeker Pro promo banner for /games pages.
 * Include games/shared/banner.css in <head> and this script anywhere.
 * It fills <div data-jsp-banner></div> if present, otherwise prepends to <body>.
 * It keeps --jsp-banner-h on <html> in sync with the real banner height.
 * Tagline is quoted from the published www.jspro.ai home page. Written by: Howie
 */
(function () {
  "use strict";
  // utm_content comes from the page path: /games/ -> hub, /games/joust/ -> joust, and so on.
  var m = /\/games\/([a-z0-9-]+)/i.exec(location.pathname);
  var PAGE = m ? m[1].toLowerCase() : "hub";
  var URL = "https://www.jspro.ai/?utm_source=eduaccess&utm_medium=game&utm_campaign=games-banner&utm_content=" + encodeURIComponent(PAGE);

  function build() {
    var a = document.createElement("a");
    a.className = "jsp-banner";
    a.href = URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Job Seeker Pro Scout AI: your AI-powered job search. Opens www.jspro.ai in a new tab.");
    a.innerHTML =
      '<span class="jsp-banner__logo" aria-hidden="true">J</span>' +
      '<span class="jsp-banner__name">Job Seeker Pro</span>' +
      '<span class="jsp-banner__pill">Scout AI</span>' +
      '<span class="jsp-banner__tag">Find hidden jobs, pick the right ones, and follow up like the candidate they remember.</span>' +
      '<span class="jsp-banner__cta">Try Scout free &rarr;</span>';
    return a;
  }

  function syncHeight(el) {
    var h = el.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--jsp-banner-real-h", h + "px");
  }

  function mount() {
    if (document.querySelector(".jsp-banner")) return;
    var host = document.querySelector("[data-jsp-banner]");
    var banner = build();
    if (host) host.appendChild(banner);
    else document.body.insertBefore(banner, document.body.firstChild);
    syncHeight(banner);
    window.addEventListener("resize", function () { syncHeight(banner); });
    try { window.dispatchEvent(new Event("jsp-banner-ready")); } catch (e) {}
  }

  // ---------- phone landscape support for every game page ----------
  var isGame = PAGE !== "hub";
  var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  if (isGame) document.documentElement.classList.add("jsp-game");
  function relayout() {
    // let each game's own resize handler re-fit its canvas to the new viewport
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}
  }
  function soon() { relayout(); setTimeout(relayout, 120); setTimeout(relayout, 450); }
  window.addEventListener("orientationchange", soon);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { clearTimeout(soon.t); soon.t = setTimeout(relayout, 80); });
  if (isGame && coarse) {
    // first tap: go fullscreen (hides browser chrome where allowed) and try to hold landscape
    var asked = false;
    document.addEventListener("pointerdown", function first(e) {
      if (asked) return; if (e.target && e.target.closest && e.target.closest("a,#btn-full,.jsp-rotate-hint")) return;
      asked = true; document.removeEventListener("pointerdown", first, true);
      var el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq && !(document.fullscreenElement || document.webkitFullscreenElement)) {
        try { var pr = rq.call(el, { navigationUI: "hide" }); if (pr && pr.then) pr.then(function () { try { screen.orientation.lock("landscape").catch(function () {}); } catch (x) {} soon(); }).catch(function () {}); } catch (x) {}
      }
    }, true);
    // gentle hint when the phone is upright (skip if the game has its own)
    var hint = null;
    function checkHint() {
      var portrait = window.innerHeight > window.innerWidth;
      if (document.getElementById("rotate-hint") || document.getElementById("rotate")) return;
      try { if (sessionStorage.getItem("jsp-rot-x")) return; } catch (x) {}
      if (portrait && !hint) {
        hint = document.createElement("div"); hint.className = "jsp-rotate-hint"; hint.setAttribute("role", "status");
        hint.innerHTML = '<span class="ico" aria-hidden="true">&#128241;</span><span>Turn your phone sideways for a bigger game</span><button type="button" aria-label="Dismiss">&times;</button>';
        hint.querySelector("button").addEventListener("click", function () { try { sessionStorage.setItem("jsp-rot-x", "1"); } catch (x) {} hint.remove(); hint = null; });
        document.body.appendChild(hint);
        setTimeout(function () { if (hint) { hint.style.opacity = "0"; setTimeout(function () { if (hint) { hint.remove(); hint = null; } }, 450); } }, 6000);
      } else if (!portrait && hint) { hint.remove(); hint = null; }
    }
    window.addEventListener("resize", checkHint);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkHint); else checkHint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  window.addEventListener("load", soon);
})();
