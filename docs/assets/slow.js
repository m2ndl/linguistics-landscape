"use strict";

/* Word on the Street -- The Slow Table. A decade of RANK movement, computed entirely client-side from
   docs/data/constructs.json (no new network calls). The site's raw shares carry an indexing tailwind
   (the sum of all construct shares drifts up ~2.2x from 2014 to 2025), so raw growth reads positive for
   almost everyone. RANK is immune to that: a uniform multiplier applied to every share in a year cannot
   change their within-year order. So we rank constructs within each year and track how positions move.
     - Section A: the 53 curated constructs ranked against each OTHER (within-cohort) -- the headline cut.
     - Section B: the full ladder, all constructs ranked among ALL of them (global rank), sortable.
     - Section C: constructs with no 2014 papers (ChatGPT, Generative AI, ...) -- quarantined, never given
       a fake "climb from the bottom".
   A small detrended-share "real terms" word (share / yearly-share-sum) rides alongside as a magnitude
   companion; we never print a raw growth %. Depends on util.js + i18n.js. */

let SH = {}, LABEL = {}, SRC = {}, S = {};
let RANK_ALL = {}, RANK_CUR = {};
let LADDER = [];                  // constructs with a real 2014 position (global), the sortable table
const ladderById = new Map();
let years = [], y0 = 0, y1 = 0, CUR_N = 0;
let effN0 = 0, effN1 = 0, DIV = { n: 0, total: 0 };
let qInput, sortSel, rowsTbody, emptyP, resetBtn, form;
let curSrc = "all", curMv = "all";
const TOPN = 8;

function normKey(s) {
  return (s || "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normKeyAr(s) {
  return (s || "")
    .replace(/[ً-ْـ]/g, "").replace(/[آأإ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .toLowerCase().replace(/[^؀-ۿ0-9a-z]/g, "");
}

/* ---- maths (ports the project/_slow_verify.py reference exactly) ---- */
function rankWithin(ids, year) {                       // ordinal rank by (share desc, label asc); 1 = largest
  const ordered = ids.slice().sort((a, b) => {
    const sa = SH[a][year] || 0, sb = SH[b][year] || 0;
    if (sb !== sa) return sb - sa;
    return LABEL[a].toLowerCase() < LABEL[b].toLowerCase() ? -1 : 1;
  });
  const r = {};
  ordered.forEach((id, i) => { r[id] = i + 1; });
  return r;
}
function ranksByYear(ids) { const out = {}; years.forEach(y => { out[y] = rankWithin(ids, y); }); return out; }
function pathOf(rankByYear, id) { return years.map(y => rankByYear[y][id]); }
function kendall(seq) {                                 // +1 = monotonic climb (rank falls every step)
  let c = 0, d = 0; const n = seq.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const s = seq[b] - seq[a]; if (s < 0) c++; else if (s > 0) d++; }
  const t = c + d; return t ? (c - d) / t : 0;
}
function detrendRatio(id) {                             // p2025 / p2014, p = share / yearly-share-sum
  const p0 = (SH[id][y0] || 0) / S[y0], p1 = (SH[id][y1] || 0) / S[y1];
  return p0 > 0 ? p1 / p0 : null;
}
function realWord(id) {
  const r = detrendRatio(id);
  if (r == null) return { cls: "flat", txt: T("na") };
  if (r >= 1.5) return { cls: "up", txt: T("slow_real_up") };
  if (r <= 1 / 1.5) return { cls: "down", txt: T("slow_real_down") };
  return { cls: "flat", txt: T("slow_real_flat") };
}
function effN(ids, year) {                              // 1 / HHI on within-year-normalised shares
  let tot = 0; ids.forEach(id => { tot += SH[id][year] || 0; });
  if (tot <= 0) return 0;
  let hhi = 0; ids.forEach(id => { const q = (SH[id][year] || 0) / tot; hhi += q * q; });
  return hhi ? 1 / hhi : 0;
}

/* ---- rank sparkline: explore.js's sparkSVG, but plotting RANK with the axis inverted (rank 1 = top) ---- */
function rankSpark(path, dir, label, word) {
  const W = 92, H = 26, p = 2;
  let lo = Math.min(...path), hi = Math.max(...path); if (hi === lo) hi = lo + 1;
  const x = i => p + (i / (path.length - 1)) * (W - 2 * p);
  const y = r => p + ((r - lo) / (hi - lo)) * (H - 2 * p);     // smaller rank (better) -> smaller y -> higher
  const d = path.map((r, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(r).toFixed(1)).join(" ");
  const v = dir === "down" ? "--down" : dir === "up" ? "--up" : "--faint";
  const lx = x(path.length - 1).toFixed(1), ly = y(path[path.length - 1]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="spark" role="img" aria-label="${escapeHtml(T("slow_spark_aria", { label: label, word: word, y0: y0, y1: y1 }))}">`
    + `<path d="${d}" fill="none" style="stroke:var(${v})" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${lx}" cy="${ly}" r="2" style="fill:var(${v})"/></svg>`;
}
function dirOfDelta(delta) { return delta > 0 ? "up" : delta < 0 ? "down" : "flat"; }
function dirWord(dir) { return dir === "up" ? T("slow_w_up") : dir === "down" ? T("slow_w_down") : T("slow_w_flat"); }

/* ---- Section A: curated reshuffle rows ---- */
function reshuffleRow(c) {
  const dir = dirOfDelta(c.dCur);
  const steady = Math.abs(c.tauCur) >= 0.6
    ? ` <span class="sr-steady" title="${escapeHtml(T("slow_steady_title"))}">${escapeHtml(T("slow_steady"))}</span>` : "";
  const w = realWord(c.id);
  const sign = c.dCur > 0 ? "+" : "";
  return `<div class="slow-row">
    <div class="sr-main">
      <a href="construct.html?id=${encodeURIComponent(c.id)}">${escapeHtml(cLabelBoth(c.id, c.label))}</a>
      <span class="sr-sub"><span class="sr-ranks mono">${c.r0Cur} &rarr; ${c.r1Cur}</span>${steady} <span class="real ${w.cls}">&middot; ${escapeHtml(w.txt)}</span></span>
    </div>
    <span class="sr-spark">${rankSpark(c.pathCur, dir, cLabel(c.id, c.label), dirWord(dir))}</span>
    <span class="sr-delta ${dir} mono">${sign}${c.dCur}</span>
  </div>`;
}
function renderReshuffle() {
  const cur = LADDER.filter(c => c.source === "curated" && c.r0Cur != null);
  const climbers = cur.filter(c => c.dCur > 0).sort((a, b) => b.dCur - a.dCur).slice(0, TOPN);
  const slippers = cur.filter(c => c.dCur < 0).sort((a, b) => a.dCur - b.dCur).slice(0, TOPN);
  setHTML("climbed-list", climbers.map(reshuffleRow).join("") || emptyLi(T("no_risers")));
  setHTML("slipped-list", slippers.map(reshuffleRow).join("") || emptyLi(T("no_decliners")));
}

/* ---- Section B: the full ladder (global rank), explore.js-style sortable table ---- */
function ladderRow(c) {
  const dir = dirOfDelta(c.dAll), sign = c.dAll > 0 ? "+" : "";
  const src = c.source === "curated" ? `<span class="c-src">${escapeHtml(T("ex_src_curated_badge"))}</span>` : "";
  const w = realWord(c.id);
  return `<tr class="crow" id="row-${escapeHtml(c.id)}">
    <td class="c-name"><a href="construct.html?id=${encodeURIComponent(c.id)}">${escapeHtml(cLabelBoth(c.id, c.label))}</a>${src}</td>
    <td class="s-rank mono">${c.r0All} &rarr; ${c.r1All}</td>
    <td class="s-move mono ${dir}">${sign}${c.dAll}</td>
    <td class="s-path">${rankSpark(c.pathAll, dir, cLabel(c.id, c.label), dirWord(dir))}</td>
    <td class="s-real"><span class="real ${w.cls}">${escapeHtml(w.txt)}</span></td>
  </tr>`;
}
function buildLadder() {
  rowsTbody.innerHTML = LADDER.map(ladderRow).join("");
  ladderById.clear();
  LADDER.forEach(c => ladderById.set(c.id, document.getElementById("row-" + c.id)));
}
function currentQuery() {
  const p = new URLSearchParams();
  if (qInput.value.trim()) p.set("q", qInput.value.trim());
  if (sortSel.value !== "move_desc") p.set("sort", sortSel.value);
  if (curSrc !== "all") p.set("src", curSrc);
  if (curMv !== "all") p.set("mv", curMv);
  return p.toString();
}
function offDefault() { return Boolean(qInput.value.trim()) || sortSel.value !== "move_desc" || curSrc !== "all" || curMv !== "all"; }
function applyView() {
  const qRaw = qInput.value.trim(), qLat = normKey(qRaw), qAr = normKeyAr(qRaw);
  const lang = curLang() === "ar" ? "ar" : "en";
  let list = LADDER.filter(c => {
    if (qRaw && !((qLat && c._key.includes(qLat)) || (qAr && c._keyAr && c._keyAr.includes(qAr)))) return false;
    if (curSrc !== "all" && c.source !== curSrc) return false;
    if (curMv === "up" && c.dAll <= 0) return false;
    if (curMv === "down" && c.dAll >= 0) return false;
    return true;
  });
  const cmp = {
    move_desc: (a, b) => b.dAll - a.dAll,
    move_asc: (a, b) => a.dAll - b.dAll,
    rank_asc: (a, b) => a.r1All - b.r1All,
    name_asc: (a, b) => cLabel(a.id, a.label).localeCompare(cLabel(b.id, b.label), lang),
  }[sortSel.value] || ((a, b) => b.dAll - a.dAll);
  list.sort(cmp);

  const visible = new Set(list.map(c => c.id));
  LADDER.forEach(c => { const n = ladderById.get(c.id); if (n) n.classList.toggle("is-hidden", !visible.has(c.id)); });
  const frag = document.createDocumentFragment();
  list.forEach(c => frag.appendChild(ladderById.get(c.id)));
  rowsTbody.appendChild(frag);

  setText("shown", list.length);
  emptyP.classList.toggle("hidden", list.length !== 0);
  resetBtn.classList.toggle("hidden", !offDefault());
  const qs = currentQuery();
  history.replaceState(null, "", qs ? "slow.html?" + qs : "slow.html");
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
  curMv = ["up", "down"].includes(p.get("mv")) ? p.get("mv") : "all";
  setSeg(document.querySelector('.seg[data-seg="src"]'), curSrc, "src");
  setSeg(document.querySelector('.seg[data-seg="mv"]'), curMv, "mv");
}

/* ---- Section C: arrived mid-decade (no 2014 position) ---- */
function renderArrived(newcomers) {
  const sec = document.getElementById("arrived-section");
  const show = newcomers.filter(c => (c.papers || 0) > 0);   // still active in the latest year
  if (!show.length) { if (sec) sec.classList.add("hidden"); return; }
  if (sec) sec.classList.remove("hidden");
  setHTML("arrived-list", show
    .sort((a, b) => a.r1All - b.r1All)
    .map(c => `<li class="arrived"><a href="construct.html?id=${encodeURIComponent(c.id)}">${escapeHtml(cLabelBoth(c.id, c.label))}</a>
      <span class="mono faint">${escapeHtml(T("slow_arrived_at", { r: c.r1All, y1: y1, n: INT(c.papers) }))}</span></li>`).join(""));
}

function renderChrome() {
  applyI18n();
  const yy0 = String(y0).slice(2), yy1 = String(y1).slice(2);
  setHTML("slow-insight", T("slow_insight_html", { n: DIV.n, total: DIV.total, y0: y0, y1: y1 }));
  setHTML("slow-effn", T("slow_effn", { k: CUR_N, a: Math.round(effN0), b: Math.round(effN1) }));
  setText("reshuffle-sub", T("slow_reshuffle_sub", { k: CUR_N, y0: y0, y1: y1 }));
  setText("ladder-sub", T("slow_ladder_sub", { n: LADDER.length, y0: y0, y1: y1 }));
  setText("arrived-sub", T("slow_arrived_sub", { y0: y0, y1: y1 }));
  setText("th-rank", T("slow_th_r0", { yy0: yy0 }) + " → ’" + yy1);
  setText("slow-note", T("slow_note", { y1: y1 }));
  const oRank = document.getElementById("opt-rank"); if (oRank) oRank.textContent = T("slow_sort_rank", { yy1: yy1 });
  setText("total", LADDER.length);
  qInput.setAttribute("placeholder", T("ex_search_ph", { n: LADDER.length }));
}

function onLangChange() { renderReshuffle(); buildLadder(); renderChrome(); applyView(); }

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
  const cs = data.constructs;
  cs.forEach(c => {
    SH[c.id] = {}; c.series.forEach(p => { SH[c.id][p.year] = p.share; });
    LABEL[c.id] = c.label; SRC[c.id] = c.source;
  });
  const allIds = cs.map(c => c.id);
  years.forEach(y => { let t = 0; allIds.forEach(id => { t += SH[id][y] || 0; }); S[y] = t; });
  const curatedIds = allIds.filter(id => SRC[id] === "curated");
  CUR_N = curatedIds.length;

  RANK_ALL = ranksByYear(allIds);
  RANK_CUR = ranksByYear(curatedIds);
  effN0 = effN(curatedIds, y0); effN1 = effN(curatedIds, y1);

  await loadGlossary();

  const newcomers = [];
  let divN = 0, divTot = 0;
  cs.forEach(c => {
    const isNew = (SH[c.id][y0] || 0) === 0;
    const pathAll = pathOf(RANK_ALL, c.id);
    const r0All = RANK_ALL[y0][c.id], r1All = RANK_ALL[y1][c.id];
    const rec = {
      id: c.id, label: c.label, source: c.source,
      r0All: r0All, r1All: r1All, dAll: r0All - r1All, pathAll: pathAll, tauAll: kendall(pathAll),
      _key: normKey(c.label), _keyAr: normKeyAr((_glossary && _glossary[c.id]) || ""),
    };
    if (c.source === "curated") {
      rec.pathCur = pathOf(RANK_CUR, c.id);
      rec.r0Cur = isNew ? null : RANK_CUR[y0][c.id];
      rec.r1Cur = RANK_CUR[y1][c.id];
      rec.dCur = isNew ? null : (rec.r0Cur - rec.r1Cur);
      rec.tauCur = kendall(rec.pathCur);
    }
    if (isNew) {
      rec.papers = c.latest_papers || 0;
      newcomers.push(rec);
    } else {
      divTot++;
      if ((SH[c.id][y1] || 0) > (SH[c.id][y0] || 0) && rec.dAll < 0) divN++;
      LADDER.push(rec);
    }
  });
  DIV = { n: divN, total: divTot };

  renderReshuffle();
  buildLadder();
  readURL();
  renderChrome();
  applyView();
  renderArrived(newcomers);

  window.renderI18n = onLangChange;

  let searchTimer;
  qInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(applyView, 120); });
  sortSel.addEventListener("change", applyView);
  document.querySelectorAll(".seg").forEach(group => {
    group.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) return;
      if ("src" in b.dataset) { curSrc = b.dataset.src; setSeg(group, curSrc, "src"); }
      else if ("mv" in b.dataset) { curMv = b.dataset.mv; setSeg(group, curMv, "mv"); }
      applyView();
    });
  });
  form.addEventListener("reset", () => setTimeout(() => {
    curSrc = "all"; curMv = "all";
    setSeg(document.querySelector('.seg[data-seg="src"]'), "all", "src");
    setSeg(document.querySelector('.seg[data-seg="mv"]'), "all", "mv");
    applyView();
  }, 0));
}

main();
