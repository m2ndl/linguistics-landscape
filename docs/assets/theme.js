"use strict";

/* Light/dark toggle, shared by every page. Light is the default; dark is opt-in and remembered
   in localStorage. The no-flash initial set happens in a tiny inline <head> script on each page;
   this file only wires the button and persists the choice. The sun/moon icon swap is pure CSS. */
(function () {
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function apply(theme) {
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  function init() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    apply(currentTheme());
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem("theme", next); } catch (e) { /* storage may be blocked */ }
      apply(next);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
