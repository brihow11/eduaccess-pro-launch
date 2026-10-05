/*
 * EduAccess Arcade menu: detects which games are live, fills the Scout AI
 * block and runs the menu music with a remembered mute.
 * Written by: Howie
 *
 * A game turns on automatically once /games/<slug>/index.html returns 200.
 * Optional: a game page can carry <meta name="arcade-controls" content="...">
 * and the menu card will show that controls line instead of the default.
 * Poster art is static WebP under /games/menu-assets/covers/.
 */
(function () {
  "use strict";
  var MUTE_KEY = "eduaccess.games.menu.mute.v1";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-slug]"));

  // ---- live detection
  function setState(card, live) {
    card.classList.remove("is-checking", "is-live", "is-soon");
    card.classList.add(live ? "is-live" : "is-soon");
    var name = card.querySelector("h2").textContent;
    if (live) { card.setAttribute("href", "/games/" + card.dataset.slug + "/"); card.removeAttribute("aria-disabled"); card.removeAttribute("tabindex"); card.setAttribute("aria-label", "Play " + name); }
    else { card.removeAttribute("href"); card.setAttribute("aria-disabled", "true"); card.setAttribute("aria-label", name + ", coming soon"); }
  }
  cards.forEach(function (card) {
    var slug = card.dataset.slug;
    fetch("/games/" + slug + "/index.html", { cache: "no-cache", credentials: "same-origin" }).then(function (r) {
      if (r.status !== 200) { setState(card, false); return; }
      setState(card, true);
      return r.text().then(function (html) {
        var m = /<meta\s+name="arcade-controls"\s+content="([^"]{3,160})"/i.exec(html);
        if (m) { var el = card.querySelector(".ctrl"); el.innerHTML = "<span>Controls</span> "; el.appendChild(document.createTextNode(m[1].replace(/&amp;/g, "&").replace(/&middot;/g, "\u00b7"))); }
      });
    }).catch(function () { setState(card, false); });
    card.addEventListener("click", function (e) { if (!card.classList.contains("is-live")) e.preventDefault(); });
  });

  // ---- Scout AI block, using the published feature text from scout-splash.js
  var feats = (window.ScoutSplash && window.ScoutSplash.SCOUT_FEATURES) || [];
  var box = document.getElementById("scout-feats");
  if (box) feats.forEach(function (f) {
    var d = document.createElement("div"); d.className = "feat";
    var h = document.createElement("h3"); h.textContent = f.name;
    var p = document.createElement("p"); p.textContent = f.text;
    d.appendChild(h); d.appendChild(p); box.appendChild(d);
  });

  // ---- menu music: dark synthwave loop, starts after the first tap or key press
  var SONG = {
    name: "menu-theme", bpm: 96, steps: 16, swing: 0.06,
    chords: ["A2m", "F2", "C3", "G2", "A2m", "F2", "D3m", "E2"],
    tracks: [
      { inst: "pad", gen: "pad", vol: 0.8, oct: 1 },
      { inst: "bass", gen: "bass8", vol: 0.8, oct: 1 },
      { inst: "pluck", gen: "arp16", vol: 0.55, oct: 2 },
      { inst: "kick", notes: "x . . . . . x . x . . . . . . .", vol: 0.8 },
      { inst: "snare", notes: ". . . . x . . . . . . . x . . o", vol: 0.6 },
      { inst: "hat", notes: ". . x . . . x . . . x . . . x x", vol: 0.7 },
      { inst: "lead", vol: 0.55, notes: [
        "A4 - - - C5 - B4 - A4 - - - E4 - - -", "F4 - - - A4 - G4 - F4 - E4 - C4 - - -",
        "E4 - G4 - C5 - - - B4 - G4 - E4 - - -", "D4 - - - G4 - - - B4 - A4 - G4 - - -",
        "A4 - - - C5 - E5 - D5 - C5 - B4 - - -", "A4 - - - F4 - - - A4 - C5 - - - - -",
        "D5 - - - F5 - E5 - D5 - C5 - A4 - - -", "E5 - - - D5 - - - B4 - - - G#4 - - -"] }
    ]
  };
  var M = window.ArcadeMusic, btn = document.getElementById("menu-mute");
  var muted = lsGet(MUTE_KEY) === "1";
  function render() {
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
    btn.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    btn.querySelector(".lbl").textContent = muted ? "Music off" : "Music on";
  }
  function setMuted(m) { muted = m; lsSet(MUTE_KEY, m ? "1" : "0"); if (M) M.setMuted(m); render(); }
  if (btn) {
    btn.addEventListener("click", function () { setMuted(!muted); });
    window.addEventListener("keydown", function (e) { if (e.code === "KeyM" && !e.repeat && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || "")) setMuted(!muted); });
    render();
  }
  if (M) { M.setMuted(muted); M.play(SONG); }
  window.__arcadeMenu = { song: SONG, get muted() { return muted; }, state: function () { return cards.map(function (c) { return c.dataset.slug + ":" + (c.classList.contains("is-live") ? "live" : c.classList.contains("is-soon") ? "soon" : "checking"); }); } };
})();
