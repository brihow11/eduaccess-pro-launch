/*
 * Job Seeker Pro promo banner for /games pages.
 * Include games/shared/banner.css in <head> and this script anywhere.
 * It fills <div data-jsp-banner></div> if present, otherwise prepends to <body>.
 * It keeps --jsp-banner-h on <html> in sync with the real banner height.
 */
(function () {
  "use strict";
  var URL = "https://jspro.ai";

  function build() {
    var a = document.createElement("a");
    a.className = "jsp-banner";
    a.href = URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Job Seeker Pro Scout AI: your AI-powered job search. Opens jspro.ai in a new tab.");
    a.innerHTML =
      '<span class="jsp-banner__logo" aria-hidden="true">J</span>' +
      '<span class="jsp-banner__name">Job Seeker Pro</span>' +
      '<span class="jsp-banner__pill">Scout AI</span>' +
      '<span class="jsp-banner__tag">Jobs matched to you, scored by AI and delivered every morning.</span>' +
      '<span class="jsp-banner__cta">Try it free &rarr;</span>';
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
