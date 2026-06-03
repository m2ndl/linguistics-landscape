"use strict";

/* Word on the Street -- Explore ("The Index"). Loads data/constructs.json once, renders all ~209
   constructs as a semantic table, then filters/sorts entirely in memory. Depends on util.js. */

let CONSTRUCTS = [];
const nodeById = new Map();
let qInput, sortSel, rowsTbody, emptyP, resetBtn, form;
let curSrc = "all", curDir = "all";

function normKey(s) {
  return (s || "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sparkSVG(series, dir, label) {
  const W = 92, H = 26, p = 2, v = series.map(d => d.share);
  let lo = Math.min(...v), hi = Math.max(...v); if (hi === lo) hi = lo + 1e-9;
  const x = i => p + (i / (series.length - 1)) * (W - 2 * p);
  const y = s => (H - p) - ((s - lo) / (hi - lo)) * (H - 2 * p);
  const d = series.map((dp, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(dp.share).toFixed(1)).join(" ");
  const c = dir === "down" ? "--down" : dir === "up" ? "--up" : "--faint";
  const lx = x(series.length - 1).toFixed(1), ly = y(series[series.length - 1].share).toFixed(1);
  const word = dir === "down" ? "falling" : dir === "up" ? "rising" : dir === "flat" ? "roughly flat" : "change not firm";
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="spark" role="img" aria-label="${escapeHtml(label)}, share ${word} over the complete years">`
    + `<path d="${d}" fill="none" style="stroke:var(${c})" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${lx}" cy="${ly}" r="2" style="fill:var(${c})"/></svg>`;
}

function rowHTML(c) {
  const src = c.source === "curated" ? `<span class="c-src">curated</span>` : "";
  let chg, chgCls;
  if (c.growth == null) { chg = `<span class="flat" title="No firm change; too few papers">&#8211;</span>`; chgCls = ""; }
  else { chg = deltaText({ growth: c.growth }); chgCls = pctDir(c.growth); }
  return `<tr class="crow" id="row-${escapeHtml(c.id)}">
    <td class="c-name"><a href="construct.html?id=${encodeURIComponent(c.id)}">${escapeHtml(c.label)}</a>${src}</td>
    <td class="c-share">${PCT(c.latest_share)}</td>
    <td class="c-spark">${c._spark}</td>
    <td class="c-chg ${chgCls}">${chg}</td>
  </tr>`;
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
  const q = normKey(qInput.value);
  const sort = sortSel.value;
  let list = CONSTRUCTS.filter(c => {
    if (q && !c._key.includes(q)) return false;
    if (curSrc !== "all" && c.source !== curSrc) return false;
    if (curDir === "up" && c._dir !== "up") return false;
    if (curDir === "down" && c._dir !== "down") return false;
    return true;
  });
  const cmp = {
    share_desc: (a, b) => b.latest_share - a.latest_share,
    growth_desc: (a, b) => (b.growth == null ? -Infinity : b.growth) - (a.growth == null ? -Infinity : a.growth),
    growth_asc: (a, b) => (a.growth == null ? Infinity : a.growth) - (b.growth == null ? Infinity : b.growth),
    name_asc: (a, b) => a.label.localeCompare(b.label),
    name_desc: (a, b) => b.label.localeCompare(a.label),
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
  setSeg(document.querySelector('.seg[aria-label="Source"]'), curSrc, "src");
  setSeg(document.querySelector('.seg[aria-label="Direction"]'), curDir, "dir");
}

function scrollToHash() {
  const m = /^#row-(.+)$/.exec(location.hash);
  if (!m) return;
  const n = document.getElementById("row-" + m[1]);
  if (n && !n.classList.contains("is-hidden")) n.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
}

async function main() {
  qInput = document.getElementById("q");
  sortSel = document.getElementById("sort");
  rowsTbody = document.getElementById("rows");
  emptyP = document.getElementById("empty");
  resetBtn = document.querySelector(".ex-reset");
  form = document.querySelector(".ex-controls");

  const data = await getJSON("data/constructs.json");
  if (!data || !data.constructs) { emptyP.textContent = "Warming up. The first snapshot appears here soon."; emptyP.classList.remove("hidden"); return; }

  CONSTRUCTS = data.constructs.map(c => ({
    ...c,
    _key: normKey(c.label),
    _dir: pctDir(c.growth),
  }));
  CONSTRUCTS.forEach(c => { c._spark = sparkSVG(c.series, c._dir, c.label); });

  setText("total", data.count || CONSTRUCTS.length);
  if (data.reference_year) setText("h-share", `Share ’${String(data.reference_year).slice(2)}`);
  qInput.setAttribute("placeholder", `Search ${data.count || CONSTRUCTS.length} constructs`);

  rowsTbody.innerHTML = CONSTRUCTS.map(rowHTML).join("");
  CONSTRUCTS.forEach(c => nodeById.set(c.id, document.getElementById("row-" + c.id)));

  readURL();
  applyView();
  scrollToHash();

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
    setSeg(document.querySelector('.seg[aria-label="Source"]'), "all", "src");
    setSeg(document.querySelector('.seg[aria-label="Direction"]'), "all", "dir");
    applyView();
  }, 0));
}

function cmp_share(a, b) { return b.latest_share - a.latest_share; }
main();
