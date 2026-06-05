"use strict";
/* About page -- shows the matching language block and fills the live figures from the data files.
   Externalised from an inline <script> so the page can run under a strict CSP (script-src 'self',
   no unsafe-inline). Loaded after i18n.js, so curLang is available. */
(function () {
  function showProse() {
    var ar = (typeof curLang === "function") ? curLang() === "ar" : (localStorage.getItem("lang") === "ar");
    var en = document.getElementById("prose-en"), arEl = document.getElementById("prose-ar");
    if (en) en.hidden = ar;
    if (arEl) arEl.hidden = !ar;
  }
  window.renderI18n = showProse;   // the language button (i18n.js) calls this after switching
  showProse();

  var get = async function (p) { try { var r = await fetch(p, { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  var set = function (id, v) { var el = document.getElementById(id); if (el && v != null && v !== "") el.textContent = v; };
  (async function () {
    var res = await Promise.all([get("data/meta.json"), get("data/latest.json"), get("data/gaps.json")]);
    var meta = res[0], latest = res[1], gaps = res[2];
    if (meta) {
      if (meta.construct_count) { set("n-constructs", meta.construct_count); set("n-constructs-ar", meta.construct_count); }
      if (meta.reference_year) { set("ref-year", meta.reference_year); set("ref-year-ar", meta.reference_year); }
      if (meta.current_year) { set("cur-year", meta.current_year); set("cur-year-ar", meta.current_year); }
      if (meta.subfields && meta.subfields.length) {
        var esc = function (s) { return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
        var parts = meta.subfields.map(function (s) { return "<em>" + esc(s.label) + "</em> (" + esc(s.field) + ")"; });
        var el = document.getElementById("subfields"); if (el) el.innerHTML = parts.join(" and ");
      }
    }
    if (latest) { var works = (latest.totals || {}).count_recent; if (works) { set("corpus-size", works.toLocaleString("en-US")); set("corpus-size-ar", works.toLocaleString("en-US")); } }
    if (gaps && Array.isArray(gaps.cohort_years) && gaps.cohort_years.length) {
      var cy = gaps.cohort_years;
      set("gaps-cohort", cy[0] + " to " + cy[cy.length - 1]);
      set("gaps-cohort-ar", cy[0] + " إلى " + cy[cy.length - 1]);
    }
  })();
})();
