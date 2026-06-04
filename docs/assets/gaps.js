"use strict";

/* Word on the Street -- Research gaps. Joins the gap finder (docs/data/gaps.json: each underserved
   niche's early-citation lift, cohort papers, and the field rate) to the construct series
   (docs/data/constructs.json: yearly paper counts) by id, and sets each niche's citation pull against the
   DIRECTION of its output. Output trend compares the settled cohort window (e.g. 2022-2024) with the three
   years before it (2019-2021); the current, still-indexing year is shown in the trajectory but kept out of
   the trend figure, so the OpenAlex back-indexing spike (which inflates every count in the latest year)
   cannot drive the reading. A Wilson lower bound on the early-citation rate gives a "cautious floor" so a
   thin-cohort fluke cannot headline beside a well-sampled finding. Two constructs that began only mid-decade
   (no settled earlier window) are shown apart. Bilingual; depends on util.js + i18n.js. No new network calls. */

const FLOOR_GATE = 2.0;              // headline trustworthiness gate: cautious floor must clear this ×field
const RISE = 1.20, FALL = 0.95;      // settled-output trend bands (late mean / early mean)
const NEW_MIN = 5;                   // < this many papers across the early window => began mid-decade
const TOPN = 8;
const METHODS = new Set(["meta_analysis", "eye_tracking", "replication_study", "narrative_inquiry"]);

let ROWS = [];
const byId = new Map();
let years = [], y1 = 0, cohort = [], early = [];
let LEAD = { total: 0, rising: 0, falling: 0, steady: 0, newn: 0 };
let qInput, sortSel, rowsTbody, emptyP, resetBtn, form;
let curSrc = "all", curTrend = "all", curType = "all";

function normKey(s) {
  return (s || "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normKeyAr(s) {
  return (s || "")
    .replace(/[ً-ْـ]/g, "").replace(/[آأإ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .toLowerCase().replace(/[^؀-ۿ0-9a-z]/g, "");
}

/* Wilson 95% lower bound on a binomial rate k/n, expressed as a multiple of the field rate. */
function wilsonFloor(k, n, fieldRate) {
  if (!n || !fieldRate) return null;
  const z = 1.96, p = k / n, den = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / den;
  const half = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / den;
  return (centre - half) / fieldRate;
}

function dirOf(r) {
  if (r.isNew || r.trend == null) return "new";
  return r.trend >= RISE ? "up" : r.trend <= FALL ? "down" : "flat";
}
function fmtLift(x) { return x == null ? T("na") : T("ni_lift_val", { x: Number(x).toFixed(1) }); }
function trendText(r) {
  if (r.trend == null) return "";
  const pct = Math.round((r.trend - 1) * 100);
  return (pct >= 0 ? "+" : "") + pct + "%";
}
function trendLabel(r) {
  const d = dirOf(r);
  return d === "up" ? T("op_dir_rising") : d === "down" ? T("op_dir_falling") : d === "new" ? T("op_dir_new") : T("op_dir_steady");
}
function methodChip(r) {
  return r.isMethod ? ` <span class="by-thin" title="${escapeHtml(T("op_method_title"))}">${escapeHtml(T("op_method"))}</span>` : "";
}

/* papers-per-year sparkline over the tracked years, coloured by output direction, latest point dotted */
function outSpark(series, dir, label) {
  const W = 92, H = 26, p = 2;
  let lo = Math.min(...series), hi = Math.max(...series); if (hi === lo) hi = lo + 1e-9;
  const x = i => p + (i / (series.length - 1)) * (W - 2 * p);
  const y = v => (H - p) - ((v - lo) / (hi - lo)) * (H - 2 * p);
  const d = series.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const v = dir === "down" ? "--down" : dir === "up" ? "--up" : "--faint";
  const lx = x(series.length - 1).toFixed(1), ly = y(series[series.length - 1]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="spark" role="img" aria-label="${escapeHtml(T("op_spark_aria", { label: label }))}">`
    + `<path d="${d}" fill="none" style="stroke:var(${v})" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${lx}" cy="${ly}" r="2" style="fill:var(${v})"/></svg>`;
}

/* headline rows (curated + auto, gated by the cautious floor; furthest by lift within each direction) */
function headlineRow(r) {
  const dir = dirOf(r);
  return `<div class="slow-row">
    <div class="sr-main">
      <a href="construct.html?id=${encodeURIComponent(r.id)}">${escapeHtml(cLabelBoth(r.id, r.label))}</a>${methodChip(r)}
      <span class="sr-sub">${escapeHtml(T("op_rowsub", { lift: fmtLift(r.lift), floor: fmtLift(r.floor), n: INT(r.cohort) }))}</span>
    </div>
    <span class="sr-spark">${outSpark(r.series, dir, cLabel(r.id, r.label))}</span>
    <span class="sr-delta ${dir} mono">${trendText(r)}</span>
  </div>`;
}
function renderHeadline() {
  const gated = ROWS.filter(r => r.floor != null && r.floor >= FLOOR_GATE && !r.isNew);
  const rising = gated.filter(r => dirOf(r) === "up").sort((a, b) => b.lift - a.lift).slice(0, TOPN);
  const falling = gated.filter(r => dirOf(r) === "down").sort((a, b) => b.lift - a.lift).slice(0, TOPN);
  setHTML("rising-list", rising.map(headlineRow).join("") || emptyLi(T("na")));
  setHTML("falling-list", falling.map(headlineRow).join("") || emptyLi(T("na")));
}

/* full sortable/searchable/filterable table over every niche */
function tableRow(r) {
  const dir = dirOf(r);
  const src = r.source === "curated" ? `<span class="c-src">${escapeHtml(T("ex_src_curated_badge"))}</span>` : "";
  const tcls = dir === "new" ? "faint" : dir;
  return `<tr class="crow" id="row-${escapeHtml(r.id)}">
    <td class="c-name"><a href="construct.html?id=${encodeURIComponent(r.id)}">${escapeHtml(cLabelBoth(r.id, r.label))}</a>${src}${methodChip(r)}</td>
    <td class="c-lift mono">${escapeHtml(fmtLift(r.lift))}</td>
    <td class="op-floor mono">${escapeHtml(fmtLift(r.floor))}</td>
    <td class="op-trend"><span class="op-dir ${dir}">${escapeHtml(trendLabel(r))}</span><span class="op-pct mono ${tcls}">${escapeHtml(trendText(r))}</span></td>
    <td class="c-vol mono">${INT(r.cohort)}</td>
    <td class="op-path">${outSpark(r.series, dir, cLabel(r.id, r.label))}</td>
  </tr>`;
}
function buildRows() {
  rowsTbody.innerHTML = ROWS.map(tableRow).join("");
  byId.clear();
  ROWS.forEach(r => byId.set(r.id, document.getElementById("row-" + r.id)));
}
function currentQuery() {
  const p = new URLSearchParams();
  if (qInput.value.trim()) p.set("q", qInput.value.trim());
  if (sortSel.value !== "lift_desc") p.set("sort", sortSel.value);
  if (curSrc !== "all") p.set("src", curSrc);
  if (curTrend !== "all") p.set("dir", curTrend);
  if (curType !== "all") p.set("type", curType);
  return p.toString();
}
function offDefault() {
  return Boolean(qInput.value.trim()) || sortSel.value !== "lift_desc" || curSrc !== "all" || curTrend !== "all" || curType !== "all";
}
function tnum(r) { return r.trend == null ? 1 : r.trend; }   // niches with no settled trend sort neutrally
function applyView() {
  const qRaw = qInput.value.trim(), qLat = normKey(qRaw), qAr = normKeyAr(qRaw);
  const lang = curLang() === "ar" ? "ar" : "en";
  let list = ROWS.filter(r => {
    if (qRaw && !((qLat && r._key.includes(qLat)) || (qAr && r._keyAr && r._keyAr.includes(qAr)))) return false;
    if (curSrc !== "all" && r.source !== curSrc) return false;
    if (curTrend !== "all" && dirOf(r) !== curTrend) return false;
    if (curType === "topics" && r.isMethod) return false;
    if (curType === "methods" && !r.isMethod) return false;
    return true;
  });
  const cmp = {
    lift_desc: (a, b) => b.lift - a.lift,
    floor_desc: (a, b) => (b.floor || 0) - (a.floor || 0),
    trend_desc: (a, b) => tnum(b) - tnum(a),
    trend_asc: (a, b) => tnum(a) - tnum(b),
    vol_asc: (a, b) => a.cohort - b.cohort,
    vol_desc: (a, b) => b.cohort - a.cohort,
    name_asc: (a, b) => cLabel(a.id, a.label).localeCompare(cLabel(b.id, b.label), lang),
  }[sortSel.value] || ((a, b) => b.lift - a.lift);
  list.sort(cmp);

  const visible = new Set(list.map(r => r.id));
  ROWS.forEach(r => { const n = byId.get(r.id); if (n) n.classList.toggle("is-hidden", !visible.has(r.id)); });
  const frag = document.createDocumentFragment();
  list.forEach(r => frag.appendChild(byId.get(r.id)));
  rowsTbody.appendChild(frag);

  setText("shown", list.length);
  emptyP.classList.toggle("hidden", list.length !== 0);
  resetBtn.classList.toggle("hidden", !offDefault());
  const qs = currentQuery();
  history.replaceState(null, "", qs ? "gaps.html?" + qs : "gaps.html");
}
function setSeg(group, value, attr) {
  group.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
}
function readURL() {
  const p = new URLSearchParams(location.search);
  if (p.get("q")) qInput.value = p.get("q");
  const sort = p.get("sort");
  if (sort && [...sortSel.options].some(o => o.value === sort)) sortSel.value = sort;
  curSrc = ["openalex", "curated"].includes(p.get("src")) ? p.get("src") : "all";
  curTrend = ["up", "down", "flat"].includes(p.get("dir")) ? p.get("dir") : "all";
  curType = ["topics", "methods"].includes(p.get("type")) ? p.get("type") : "all";
  setSeg(document.querySelector('.seg[data-seg="src"]'), curSrc, "src");
  setSeg(document.querySelector('.seg[data-seg="dir"]'), curTrend, "dir");
  setSeg(document.querySelector('.seg[data-seg="type"]'), curType, "type");
}

/* constructs that began only mid-decade: no settled earlier window to compare output against */
function renderNew() {
  const sec = document.getElementById("new-section");
  const show = ROWS.filter(r => r.isNew).sort((a, b) => b.lift - a.lift);
  if (!show.length) { if (sec) sec.classList.add("hidden"); return; }
  if (sec) sec.classList.remove("hidden");
  setHTML("new-list", show.map(r =>
    `<li class="arrived"><a href="construct.html?id=${encodeURIComponent(r.id)}">${escapeHtml(cLabelBoth(r.id, r.label))}</a>
      <span class="mono faint">${escapeHtml(T("op_new_at", { lift: fmtLift(r.lift), n: INT(r.series[r.series.length - 1]), y: y1 }))}</span></li>`).join(""));
}

function renderChrome() {
  applyI18n();
  setHTML("op-lead", T("op_lead", { total: LEAD.total, rising: LEAD.rising, falling: LEAD.falling, steady: LEAD.steady, newn: LEAD.newn, e0: early[0], e1: early[early.length - 1] }));
  setText("op-note-trend", T("op_note_trend", { l0: cohort[0], l1: cohort[cohort.length - 1], e0: early[0], e1: early[early.length - 1], y: y1 }));
  setText("total", ROWS.length);
  qInput.setAttribute("placeholder", T("ni_search_ph", { n: ROWS.length }));
}
function onLangChange() { renderHeadline(); buildRows(); renderChrome(); renderNew(); applyView(); }

async function main() {
  qInput = document.getElementById("q");
  sortSel = document.getElementById("sort");
  rowsTbody = document.getElementById("rows");
  emptyP = document.getElementById("empty");
  resetBtn = document.querySelector(".ex-reset");
  form = document.querySelector(".ex-controls");

  const [gapsData, cData] = await Promise.all([getJSON("data/gaps.json"), getJSON("data/constructs.json")]);
  const niches = (gapsData && (gapsData.all || gapsData.gaps)) || [];
  if (!niches.length || !cData || !cData.constructs || !cData.complete_years || !gapsData.cohort_years || !gapsData.cohort_years.length) {
    applyI18n(); emptyP.textContent = T("ex_warming"); emptyP.classList.remove("hidden");
    window.renderI18n = applyI18n; return;
  }

  years = cData.complete_years.slice().sort((a, b) => a - b);
  y1 = years[years.length - 1];
  cohort = (gapsData.cohort_years || []).slice().sort((a, b) => a - b);
  const cStart = cohort[0];
  early = [cStart - 3, cStart - 2, cStart - 1];
  const fieldRate = gapsData.field_rate || 0;

  const PAP = {}, LABEL = {}, SRC = {};
  cData.constructs.forEach(c => {
    PAP[c.id] = {}; c.series.forEach(p => { PAP[c.id][p.year] = p.papers; });
    LABEL[c.id] = c.label; SRC[c.id] = c.source;
  });

  await loadGlossary();

  niches.forEach(g => {
    const id = g.id, pap = PAP[id];
    const series = years.map(y => (pap && pap[y]) || 0);                 // raw papers per year, for the sparkline
    const earlySum = early.reduce((s, y) => s + ((pap && pap[y]) || 0), 0);
    const earlyMean = earlySum / early.length;
    const lateMean = cohort.reduce((s, y) => s + ((pap && pap[y]) || 0), 0) / cohort.length;
    const isNew = !pap || earlySum < NEW_MIN;                            // began mid-decade: no settled baseline
    const trend = (!isNew && earlyMean > 0) ? lateMean / earlyMean : null;
    ROWS.push({
      id, label: LABEL[id] || g.label, source: SRC[id] || "openalex",
      lift: g.lift, cohort: g.cohort_volume, cited: g.cited,
      floor: wilsonFloor(g.cited, g.cohort_volume, fieldRate),
      series, trend, isNew, isMethod: METHODS.has(id),
      _key: normKey(LABEL[id] || g.label), _keyAr: normKeyAr((_glossary && _glossary[id]) || ""),
    });
  });
  const settled = ROWS.filter(r => !r.isNew);
  LEAD = {
    total: ROWS.length,
    rising: settled.filter(r => dirOf(r) === "up").length,
    falling: settled.filter(r => dirOf(r) === "down").length,
    steady: settled.filter(r => dirOf(r) === "flat").length,
    newn: ROWS.filter(r => r.isNew).length,
  };

  renderHeadline();
  buildRows();
  readURL();
  renderChrome();
  applyView();
  renderNew();

  window.renderI18n = onLangChange;
  // i18n.js runs a load-time applyI18n on DOMContentLoaded, which repaints the count template (0 of 0).
  // If that pass lands after this async render it would clobber the live count, so re-assert after it.
  document.addEventListener("DOMContentLoaded", () => { renderChrome(); applyView(); }, { once: true });

  let searchTimer;
  qInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(applyView, 120); });
  sortSel.addEventListener("change", applyView);
  document.querySelectorAll(".seg").forEach(group => {
    group.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) return;
      if ("src" in b.dataset) { curSrc = b.dataset.src; setSeg(group, curSrc, "src"); }
      else if ("dir" in b.dataset) { curTrend = b.dataset.dir; setSeg(group, curTrend, "dir"); }
      else if ("type" in b.dataset) { curType = b.dataset.type; setSeg(group, curType, "type"); }
      applyView();
    });
  });
  form.addEventListener("reset", () => setTimeout(() => {
    curSrc = "all"; curTrend = "all"; curType = "all";
    setSeg(document.querySelector('.seg[data-seg="src"]'), "all", "src");
    setSeg(document.querySelector('.seg[data-seg="dir"]'), "all", "dir");
    setSeg(document.querySelector('.seg[data-seg="type"]'), "all", "type");
    applyView();
  }, 0));
}

main();
