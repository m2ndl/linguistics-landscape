"use strict";

/* Word on the Street -- front page. Shared helpers live in util.js; the hero line chart in chart.js;
   the bilingual string table + construct glossary in i18n.js. main() fetches once and stores _data;
   render() paints from _data in the current language and is re-run (window.renderI18n) on a language
   switch, so toggling language never refetches. */

let _data = null, _selected = null;

function seriesPts(id) { const t = _data.trends && _data.trends.topics && _data.trends.topics[id]; return t ? t.points : null; }

// firm[id] = the last-complete-year movement for a construct (trustworthy %); the headline
// names the current year's fastest risers by rank, but quotes the firm complete-year number.
function firmOf(id) { return (_data.firm && _data.firm[id]) || null; }

function ledeText(e, isHeadline, curRec) {
  const refYear = _data.refYear, curYear = (_data.current || {}).year;
  if (isHeadline) {
    const sofar = curRec ? T("lede_sofar_yes", { n: INT(curRec) }) : T("lede_sofar_no");
    return T("lede_headline", { curYear: curYear, sofar: sofar, refYear: refYear });
  }
  const f = firmOf(e.id);
  const dir = f && dirOf(f) === "down" ? T("dir_fading") : T("dir_rising");
  if (e.count_recent) return T("lede_other_papers", { dir: dir, refYear: refYear, n: INT(e.count_recent) });
  return T("lede_other_nopapers", { dir: dir, refYear: refYear });
}

function selectTerm(id) {
  const leaders = (_data.current && _data.current.leaders) || [];
  const headlineId = (leaders[0] || (_data.latest.rising || [])[0] || {}).id;
  const useId = id || headlineId;
  const isHeadline = useId === headlineId;
  // Prefer the firm entry (has growth %); fall back to the current-year leader record.
  let e = firmOf(useId) || leaders.find(x => x.id === useId)
        || (_data.latest.rising || [])[0] || (_data.latest.cooling || [])[0];
  if (!e) { setText("lead-term", T("no_movers")); return; }
  _selected = e.id;

  const cur = _data.current || {};
  const kicker = document.getElementById("kicker");
  if (kicker) {
    if (isHeadline) kicker.textContent = cur.provisional ? T("kicker_so_far", { year: cur.year }) : T("kicker_in", { year: cur.year });
    else kicker.innerHTML = `<span class="reset-link">${escapeHtml(T("kicker_back"))}</span>`;
  }
  setText("lead-term", cLabel(e.id, e.label));
  const curLeader = leaders.find(x => x.id === e.id);
  const sentence = ledeText(e, isHeadline, curLeader && curLeader.count_recent);
  // Arabic letters join, so a single floated drop cap would sit detached and wrong; skip it in Arabic.
  if (curLang() === "ar") { setText("dropcap", ""); setText("lede-rest", sentence); }
  else { setText("dropcap", sentence.slice(0, 1)); setText("lede-rest", sentence.slice(1)); }

  // Prefer the firm, last-complete-year change. With no trustworthy complete-year number, show the
  // provisional current-year share rather than invent a delta (never quote the partial-year growth %).
  const f = firmOf(e.id);
  const ld = document.getElementById("lead-delta");
  if (ld) {
    if (f) { ld.textContent = deltaText(f); ld.className = "ps-num " + dirOf(f); }
    else { ld.textContent = T("na"); ld.className = "ps-num"; }   // never quote the inflated partial-year share as a %
  }
  setText("lead-context", f ? T("ctx_change_through", { year: _data.refYear }) : T("ctx_rising_sofar", { year: cur.year }));
  lineChart({
    hostId: "hero-chart",
    points: seriesPts(e.id),
    dates: (_data.trends && _data.trends.snapshots) || [],
    dir: f ? dirOf(f) : "up",
    label: cLabel(e.id, e.label),
  });
  document.querySelectorAll(".lb-row").forEach(m => m.classList.toggle("active", m.getAttribute("data-id") === e.id));
}

function moverRow(e, i) {
  const dir = dirOf(e);
  return `<li class="lb-row" data-id="${escapeHtml(e.id)}">
    <span class="lb-rank">${i + 1}</span>
    <span class="lb-name"><a href="construct.html?id=${encodeURIComponent(e.id)}">${escapeHtml(cLabel(e.id, e.label))}</a></span>
    <span class="lb-delta ${dir}">${deltaText(e)}</span>
  </li>`;
}

function renderGaps() {
  const gapsData = _data.gaps;
  const gapList = (gapsData && gapsData.gaps) || [];
  // The section is visible by default (so its reserved space exists at first paint); hide it only
  // if there is genuinely no gap data, which preserves the original show-only-when-populated behaviour.
  if (!gapList.length) { const s = document.getElementById("gaps-section"); if (s) s.classList.add("hidden"); return; }
  const cy = gapsData.cohort_years || [];
  const cohort = cy.length ? `${cy[0]} ${curLang() === "ar" ? "إلى" : "to"} ${cy[cy.length - 1]}` : T("gaps_cohort_fallback");
  setHTML("gaps", gapList.slice(0, 6).map(g => `<li class="gap-row">
    <span><a href="construct.html?id=${encodeURIComponent(g.id)}">${escapeHtml(cLabel(g.id, g.label))}</a><span class="gap-vol">${T("gaps_vol", { n: INT(g.cohort_volume), cohort: cohort })}</span></span>
    <span class="gap-lift">${T("gaps_lift", { x: g.lift.toFixed(1) })}</span>
  </li>`).join(""));
  const win = document.getElementById("gaps-window");   // keep the stated window in sync with the data
  if (win) win.textContent = cohort;
  const allCount = (gapsData.all && gapsData.all.length) || gapList.length;
  const more = document.getElementById("gaps-see-all");  // link to the full niches page when there are more than shown
  if (more) {
    more.textContent = T("ni_see_all", { n: allCount });
    more.classList.toggle("hidden", allCount <= 6);
  }
  const sec = document.getElementById("gaps-section");
  if (sec) sec.classList.remove("hidden");
}

function render() {
  applyI18n();                                            // static markup (nav, headings, footer, captions)
  const latest = _data.latest, trends = _data.trends, cur = _data.current;

  setText("site-name", T("brand"));
  setText("np-date", T("updated_weekly"));   // the provisional-year note now lives in the chart caption (cover_cap)
  setText("generated", latest.generated_on || "-");
  setText("coverage-note", curLang() === "ar" ? T("coverage_note") : (latest.coverage_note || ""));
  if (latest.baseline_building) document.getElementById("baseline-banner").classList.remove("hidden");

  const dates = (trends && trends.snapshots) || [];
  const span = dates.length ? `${dates[0].slice(0, 4)}${curLang() === "ar" ? " إلى " : " to "}${dates[dates.length - 1].slice(0, 4)}` : "";
  const works = INT((latest.totals || {}).count_recent);
  setText("stats-inline", span ? T("stats_inline", { works: works, span: span }) : "");

  const moverHead = _data.refYear ? T("movers_in", { year: _data.refYear }) : T("movers_this_year");
  document.querySelectorAll(".rule-head .movers-year").forEach(el => el.textContent = moverHead);

  setHTML("rising", (latest.rising || []).slice(0, 7).map(moverRow).join("") || emptyLi(T("no_risers")));
  setHTML("cooling", (latest.cooling || []).slice(0, 7).map(moverRow).join("") || emptyLi(T("no_decliners")));
  setHTML("most-cited", ((latest.papers || {}).most_cited_recent || []).slice(0, 8).map(citedRow).join("") || emptyLi(T("no_citations")));
  setHTML("newest", ((latest.papers || {}).newest || []).slice(0, 8).map(paperRow).join("") || emptyLi(T("no_papers")));

  renderGaps();
  selectTerm(_selected);                                  // re-paint the cover for the current selection
}

function wire() {
  ["rising", "cooling"].forEach(id => {
    const ol = document.getElementById(id);
    if (ol) ol.addEventListener("click", ev => {
      if (ev.target.closest("a")) return;            // let the construct-name link navigate to the detail page
      const li = ev.target.closest(".lb-row"); if (li) selectTerm(li.getAttribute("data-id"));
    });
  });
  const k = document.getElementById("kicker");
  if (k) k.addEventListener("click", ev => { if (ev.target.closest(".reset-link")) selectTerm(null); });
}

async function main() {
  const [latest, trends, gaps] = await Promise.all([getJSON("data/latest.json"), getJSON("data/trends.json"), getJSON("data/gaps.json")]);
  if (!latest) { setText("lead-term", T("warming")); return; }
  _data = { latest, trends, gaps, current: latest.current_year || { leaders: [], year: "", provisional: false } };
  _data.refYear = latest.reference_year || "";
  const firm = {};
  (latest.rising || []).forEach(e => { firm[e.id] = e; });
  (latest.cooling || []).forEach(e => { firm[e.id] = e; });
  _data.firm = firm;

  await loadGlossary();              // construct names; English fallback for anything unmapped
  wire();                            // listeners attach once; render() can run many times
  window.renderI18n = render;        // the language button re-runs render() after switching
  render();
}

main();
