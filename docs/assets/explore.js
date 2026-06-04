"use strict";

/* Word on the Street -- Explore ("The Index"). Loads data/constructs.json once, renders all ~209
   constructs as a semantic table, then filters/sorts entirely in memory. Bilingual: construct names
   come from the glossary (Arabic name with the English original in parentheses), search matches either
   script, and name-sort follows the displayed language. Depends on util.js + i18n.js. */

let CONSTRUCTS = [];
const nodeById = new Map();
let qInput, sortSel, rowsTbody, emptyP, resetBtn, form;
let curSrc = "all", curDir = "all";
let META = { count: 0, refYear: "" };

function normKey(s) {
  return (s || "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
// Arabic search key: strip tashkeel + tatweel, fold alef/ya/ta-marbuta variants, keep Arabic + digits + latin.
function normKeyAr(s) {
  return (s || "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase().replace(/[^؀-ۿ0-9a-z]/g, "");
}

function sparkSVG(series, dir, label) {
  const W = 92, H = 26, p = 2, v = series.map(d => d.share);
  let lo = Math.min(...v), hi = Math.max(...v); if (hi === lo) hi = lo + 1e-9;
  const x = i => p + (i / (series.length - 1)) * (W - 2 * p);
  const y = s => (H - p) - ((s - lo) / (hi - lo)) * (H - 2 * p);
  const d = series.map((dp, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(dp.share).toFixed(1)).join(" ");
  const c = dir === "down" ? "--down" : dir === "up" ? "--up" : "--faint";
  const lx = x(series.length - 1).toFixed(1), ly = y(series[series.length - 1].share).toFixed(1);
  const word = dir === "down" ? T("spark_down") : dir === "up" ? T("spark_up") : dir === "flat" ? T("spark_flat") : T("spark_none");
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="spark" role="img" aria-label="${escapeHtml(T("spark_aria", { label: label, word: word }))}">`
    + `<path d="${d}" fill="none" style="stroke:var(${c})" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${lx}" cy="${ly}" r="2" style="fill:var(${c})"/></svg>`;
}

function rowHTML(c) {
  const src = c.source === "curated" ? `<span class="c-src">${escapeHtml(T("ex_src_curated_badge"))}</span>` : "";
  let chg, chgCls;
  if (c.growth == null) { chg = `<span class="flat" title="${escapeHtml(T("no_firm_change"))}">&#8211;</span>`; chgCls = ""; }
  else { chg = deltaText({ growth: c.growth }); chgCls = pctDir(c.growth); }
  return `<tr class="crow" id="row-${escapeHtml(c.id)}">
    <td class="c-name"><a href="construct.html?id=${encodeURIComponent(c.id)}">${escapeHtml(cLabelBoth(c.id, c.label))}</a>${src}</td>
    <td class="c-share">${PCT(c.latest_share)}</td>
    <td class="c-spark">${sparkSVG(c.series, c._dir, cLabel(c.id, c.label))}</td>
    <td class="c-chg ${chgCls}">${chg}</td>
  </tr>`;
}

function buildRows() {
  rowsTbody.innerHTML = CONSTRUCTS.map(rowHTML).join("");
  nodeById.clear();
  CONSTRUCTS.forEach(c => nodeById.set(c.id, document.getElementById("row-" + c.id)));
}

function currentQuery() {
  const params = new URLSearchParams();
  if (qInput.value.trim()) params.set("q", qInput.value.trim());
  if (sortSel.value !== "share_desc") params.set("sort", sortSel.value);
  if (curSrc !== "all") params.set("src", curSrc);
  if (curDir !== "all") params.set("dir", curDir);
  return params.toString();
}

function offDefault() {
  return Boolean(qInput.value.trim()) || sortSel.value !== "share_desc" || curSrc !== "all" || curDir !== "all";
}

function applyView() {
  const qRaw = qInput.value.trim();
  const qLat = normKey(qRaw), qAr = normKeyAr(qRaw);
  const sort = sortSel.value;
  const lang = curLang() === "ar" ? "ar" : "en";
  let list = CONSTRUCTS.filter(c => {
    if (qRaw) {
      const hit = (qLat && c._key.includes(qLat)) || (qAr && c._keyAr && c._keyAr.includes(qAr));
      if (!hit) return false;
    }
    if (curSrc !== "all" && c.source !== curSrc) return false;
    if (curDir === "up" && c._dir !== "up") return false;
    if (curDir === "down" && c._dir !== "down") return false;
    return true;
  });
  const cmp = {
    share_desc: (a, b) => b.latest_share - a.latest_share,
    growth_desc: (a, b) => (b.growth == null ? -Infinity : b.growth) - (a.growth == null ? -Infinity : a.growth),
    growth_asc: (a, b) => (a.growth == null ? Infinity : a.growth) - (b.growth == null ? Infinity : b.growth),
    name_asc: (a, b) => cLabel(a.id, a.label).localeCompare(cLabel(b.id, b.label), lang),
    name_desc: (a, b) => cLabel(b.id, b.label).localeCompare(cLabel(a.id, a.label), lang),
  }[sort] || cmp_share;
  list.sort(cmp);

  const visible = new Set(list.map(c => c.id));
  CONSTRUCTS.forEach(c => { const n = nodeById.get(c.id); if (n) n.classList.toggle("is-hidden", !visible.has(c.id)); });
  const frag = document.createDocumentFragment();
  const qs = currentQuery();
  list.forEach(c => {
    const n = nodeById.get(c.id);
    const a = n.querySelector("a");
    if (a) a.setAttribute("href", `construct.html?id=${encodeURIComponent(c.id)}${qs ? "&return=" + encodeURIComponent(qs) : ""}`);
    frag.appendChild(n);
  });
  rowsTbody.appendChild(frag);

  setText("shown", list.length);
  emptyP.classList.toggle("hidden", list.length !== 0);
  resetBtn.classList.toggle("hidden", !offDefault());
  // Keep any #row-id fragment so a deep link from a construct page can still scroll to its row.
  history.replaceState(null, "", (qs ? "explore.html?" + qs : "explore.html") + (location.hash || ""));
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
  curDir = ["up", "down"].includes(p.get("dir")) ? p.get("dir") : "all";
  setSeg(document.querySelector('.seg[data-seg="src"]'), curSrc, "src");
  setSeg(document.querySelector('.seg[data-seg="dir"]'), curDir, "dir");
}

function scrollToHash() {
  const m = /^#row-(.+)$/.exec(location.hash);
  if (!m) return;
  const n = document.getElementById("row-" + m[1]);
  if (n && !n.classList.contains("is-hidden")) n.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
}

function renderChrome() {
  applyI18n();
  setText("total", META.count);
  if (META.refYear) setText("h-share", T("ex_share_year", { yy: String(META.refYear).slice(2) }));
  qInput.setAttribute("placeholder", T("ex_search_ph", { n: META.count }));
}

// Language switch: rebuild the rows in the new language, refresh the chrome, re-apply the view.
function onLangChange() {
  buildRows();
  renderChrome();
  applyView();
}

async function main() {
  qInput = document.getElementById("q");
  sortSel = document.getElementById("sort");
  rowsTbody = document.getElementById("rows");
  emptyP = document.getElementById("empty");
  resetBtn = document.querySelector(".ex-reset");
  form = document.querySelector(".ex-controls");

  const data = await getJSON("data/constructs.json");
  if (!data || !data.constructs) { applyI18n(); emptyP.textContent = T("ex_warming"); emptyP.classList.remove("hidden"); return; }

  CONSTRUCTS = data.constructs.map(c => ({ ...c, _key: normKey(c.label), _dir: pctDir(c.growth) }));
  await loadGlossary();
  CONSTRUCTS.forEach(c => { c._keyAr = normKeyAr((_glossary && _glossary[c.id]) || ""); });
  META = { count: data.count || CONSTRUCTS.length, refYear: data.reference_year || "" };

  buildRows();
  readURL();
  renderChrome();
  applyView();
  scrollToHash();

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

function cmp_share(a, b) { return b.latest_share - a.latest_share; }
main();
