"use strict";

/* Word on the Street -- Against their best year. For each construct, its 2025 share of the field as a
   percentage of its OWN best (highest-share) year over 2014-2024, with that year named. A within-construct
   view: every other page compares constructs to each other (rank, share-of-field) or to last year; this one
   compares each construct only to itself. The series is detrended by the yearly share-sum S(y) first, so the
   OpenAlex back-indexing drift (which would otherwise push almost everything to peak in the latest year) is
   removed: on raw share 46 of 53 curated constructs peak in 2025, on detrended share only 23 do. Computed
   client-side from docs/data/constructs.json, no new network calls. Depends on util.js + i18n.js. */

let SH = {}, PAP = {}, LABEL = {}, SRC = {}, S = {};
let ROWS = [];                       // eligible constructs (present in 2014), the sortable table
const byId = new Map();
let years = [], y0 = 0, y1 = 0;
let LEAD = { total: 0, below: 0, above: 0 };
let qInput, sortSel, rowsTbody, emptyP, resetBtn, form;
let curSrc = "all", curDir = "all";
const TOPN = 8, THIN = 40;

function normKey(s) {
  return (s || "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normKeyAr(s) {
  return (s || "")
    .replace(/[ً-ْـ]/g, "").replace(/[آأإ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .toLowerCase().replace(/[^؀-ۿ0-9a-z]/g, "");
}
function dirOf(ratio) { return ratio >= 110 ? "up" : ratio < 85 ? "down" : "flat"; }

/* detrended-share sparkline over the complete years, with the best year ringed and the latest point dotted */
function shareSpark(series, peakIdx, dir, label) {
  const W = 92, H = 26, p = 2;
  let lo = Math.min(...series), hi = Math.max(...series); if (hi === lo) hi = lo + 1e-12;
  const x = i => p + (i / (series.length - 1)) * (W - 2 * p);
  const y = s => (H - p) - ((s - lo) / (hi - lo)) * (H - 2 * p);
  const d = series.map((s, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(s).toFixed(1)).join(" ");
  const v = dir === "down" ? "--down" : dir === "up" ? "--up" : "--faint";
  const lx = x(series.length - 1).toFixed(1), ly = y(series[series.length - 1]).toFixed(1);
  const px = x(peakIdx).toFixed(1), py = y(series[peakIdx]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="spark" role="img" aria-label="${escapeHtml(T("by_spark_aria", { label: label }))}">`
    + `<path d="${d}" fill="none" style="stroke:var(${v})" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${px}" cy="${py}" r="2.6" fill="none" style="stroke:var(--faint)" stroke-width="1"/>`
    + `<circle cx="${lx}" cy="${ly}" r="2" style="fill:var(${v})"/></svg>`;
}

function pctText(r) { return Math.round(r.ratio) + "%"; }
function thinFlag(r) {
  return r.thin ? ` <span class="by-thin" title="${escapeHtml(T("by_thin_title"))}">${escapeHtml(T("by_thin"))}</span>` : "";
}

/* headline rows (curated, furthest below / at-or-above their own best year) */
function headlineRow(r) {
  const dir = dirOf(r.ratio);
  return `<div class="slow-row">
    <div class="sr-main">
      <a href="construct.html?id=${encodeURIComponent(r.id)}">${escapeHtml(cLabelBoth(r.id, r.label))}</a>
      <span class="sr-sub">${escapeHtml(T("by_rowsub", { y: r.peakYear, a: INT(r.papPeak), b: INT(r.papNow) }))}${thinFlag(r)}</span>
    </div>
    <span class="sr-spark">${shareSpark(r.series, r.peakIdx, dir, cLabel(r.id, r.label))}</span>
    <span class="sr-delta ${dir} mono">${pctText(r)}</span>
  </div>`;
}
function renderHeadline() {
  const cur = ROWS.filter(r => r.source === "curated");
  const below = cur.slice().sort((a, b) => a.ratio - b.ratio).slice(0, TOPN);
  const above = cur.slice().sort((a, b) => b.ratio - a.ratio).slice(0, TOPN);
  setHTML("below-list", below.map(headlineRow).join("") || emptyLi(T("na")));
  setHTML("above-list", above.map(headlineRow).join("") || emptyLi(T("na")));
}

/* full sortable table (all eligible constructs) */
function tableRow(r) {
  const dir = dirOf(r.ratio);
  const src = r.source === "curated" ? `<span class="c-src">${escapeHtml(T("ex_src_curated_badge"))}</span>` : "";
  return `<tr class="crow" id="row-${escapeHtml(r.id)}">
    <td class="c-name"><a href="construct.html?id=${encodeURIComponent(r.id)}">${escapeHtml(cLabelBoth(r.id, r.label))}</a>${src}</td>
    <td class="by-pct mono ${dir}">${pctText(r)}</td>
    <td class="by-peak mono">${r.peakYear}</td>
    <td class="by-papers mono">${INT(r.papPeak)} &rarr; ${INT(r.papNow)}${thinFlag(r)}</td>
    <td class="by-path">${shareSpark(r.series, r.peakIdx, dir, cLabel(r.id, r.label))}</td>
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
  if (sortSel.value !== "pct_asc") p.set("sort", sortSel.value);
  if (curSrc !== "all") p.set("src", curSrc);
  if (curDir !== "all") p.set("dir", curDir);
  return p.toString();
}
function offDefault() { return Boolean(qInput.value.trim()) || sortSel.value !== "pct_asc" || curSrc !== "all" || curDir !== "all"; }
function applyView() {
  const qRaw = qInput.value.trim(), qLat = normKey(qRaw), qAr = normKeyAr(qRaw);
  const lang = curLang() === "ar" ? "ar" : "en";
  let list = ROWS.filter(r => {
    if (qRaw && !((qLat && r._key.includes(qLat)) || (qAr && r._keyAr && r._keyAr.includes(qAr)))) return false;
    if (curSrc !== "all" && r.source !== curSrc) return false;
    if (curDir !== "all" && dirOf(r.ratio) !== curDir) return false;
    return true;
  });
  const cmp = {
    pct_asc: (a, b) => a.ratio - b.ratio,
    pct_desc: (a, b) => b.ratio - a.ratio,
    peak_desc: (a, b) => b.peakYear - a.peakYear || a.ratio - b.ratio,
    name_asc: (a, b) => cLabel(a.id, a.label).localeCompare(cLabel(b.id, b.label), lang),
  }[sortSel.value] || ((a, b) => a.ratio - b.ratio);
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
  history.replaceState(null, "", qs ? "bestyear.html?" + qs : "bestyear.html");
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
  curDir = ["up", "down", "flat"].includes(p.get("dir")) ? p.get("dir") : "all";
  setSeg(document.querySelector('.seg[data-seg="src"]'), curSrc, "src");
  setSeg(document.querySelector('.seg[data-seg="dir"]'), curDir, "dir");
}

/* constructs with no papers before 2015: no earlier year to compare against */
function renderNew(newcomers) {
  const sec = document.getElementById("new-section");
  const show = newcomers.filter(r => (r.papNow || 0) > 0);
  if (!show.length) { if (sec) sec.classList.add("hidden"); return; }
  if (sec) sec.classList.remove("hidden");
  setHTML("new-list", show.sort((a, b) => b.papNow - a.papNow).map(r =>
    `<li class="arrived"><a href="construct.html?id=${encodeURIComponent(r.id)}">${escapeHtml(cLabelBoth(r.id, r.label))}</a>
      <span class="mono faint">${escapeHtml(T("by_new_at", { n: INT(r.papNow), y1: y1 }))}</span></li>`).join(""));
}

function renderChrome() {
  applyI18n();
  setHTML("by-lead", T("by_lead", { total: LEAD.total, below: LEAD.below, above: LEAD.above }));
  setText("table-sub", T("by_table_sub", { n: ROWS.length }));
  setText("total", ROWS.length);
  qInput.setAttribute("placeholder", T("ex_search_ph", { n: ROWS.length }));
}
function onLangChange() { renderHeadline(); buildRows(); renderChrome(); applyView(); }

async function main() {
  qInput = document.getElementById("q");
  sortSel = document.getElementById("sort");
  rowsTbody = document.getElementById("rows");
  emptyP = document.getElementById("empty");
  resetBtn = document.querySelector(".ex-reset");
  form = document.querySelector(".ex-controls");

  const data = await getJSON("data/constructs.json");
  if (!data || !data.constructs || !data.complete_years) {
    applyI18n(); emptyP.textContent = T("ex_warming"); emptyP.classList.remove("hidden");
    window.renderI18n = applyI18n; return;
  }
  years = data.complete_years.slice().sort((a, b) => a - b);
  y0 = years[0]; y1 = years[years.length - 1];
  const prior = years.filter(y => y < y1);
  const cs = data.constructs;
  cs.forEach(c => {
    SH[c.id] = {}; PAP[c.id] = {};
    c.series.forEach(p => { SH[c.id][p.year] = p.share; PAP[c.id][p.year] = p.papers; });
    LABEL[c.id] = c.label; SRC[c.id] = c.source;
  });
  years.forEach(y => { let t = 0; cs.forEach(c => { t += SH[c.id][y] || 0; }); S[y] = t; });
  const P = id => years.map(y => (SH[id][y] || 0) / S[y]);   // detrended series, indexed by year position

  await loadGlossary();

  const newcomers = [];
  cs.forEach(c => {
    const id = c.id;
    const series = P(id);
    const idxBy = Object.fromEntries(years.map((y, i) => [y, i]));
    if ((SH[id][y0] || 0) === 0) {                            // no 2014 presence: no prior peak to compare
      newcomers.push({ id, label: c.label, source: c.source, papNow: PAP[id][y1] || 0 });
      return;
    }
    let peakYear = prior[0];
    prior.forEach(y => { if (series[idxBy[y]] > series[idxBy[peakYear]]) peakYear = y; });
    const ratio = series[idxBy[y1]] / series[idxBy[peakYear]] * 100;
    ROWS.push({
      id, label: c.label, source: c.source,
      peakYear, peakIdx: idxBy[peakYear], ratio, series,
      papPeak: PAP[id][peakYear] || 0, papNow: PAP[id][y1] || 0,
      thin: (PAP[id][peakYear] || 0) < THIN,
      _key: normKey(c.label), _keyAr: normKeyAr((_glossary && _glossary[id]) || ""),
    });
  });
  const cur = ROWS.filter(r => r.source === "curated");
  LEAD = { total: cur.length, below: cur.filter(r => r.ratio < 60).length, above: cur.filter(r => r.ratio >= 100).length };

  renderHeadline();
  buildRows();
  readURL();
  renderChrome();
  applyView();
  renderNew(newcomers);

  window.renderI18n = onLangChange;

  let searchTimer;
  qInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(applyView, 120); });
  sortSel.addEventListener("change", applyView);
  document.querySelectorAll(".seg").forEach(group => {
    group.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) return;
      if ("src" in b.dataset) { curSrc = b.dataset.src; setSeg(group, curSrc, "src"); }
      else if ("dir" in b.dataset) { curDir = b.dataset.dir; setSeg(group, curDir, "dir"); }
      applyView();
    });
  });
  form.addEventListener("reset", () => setTimeout(() => {
    curSrc = "all"; curDir = "all";
    setSeg(document.querySelector('.seg[data-seg="src"]'), "all", "src");
    setSeg(document.querySelector('.seg[data-seg="dir"]'), "all", "dir");
    applyView();
  }, 0));
}

main();
