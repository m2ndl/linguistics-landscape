"use strict";

/* Word on the Street -- front-end rendering. No framework, no libraries. */

const PCT = x => (x * 100).toFixed(2) + "%";
const INT = x => (x || 0).toLocaleString("en-US");
const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let _data = null, _selected = null, _chartCtx = null;

async function getJSON(path) {
  try { const r = await fetch(path, { cache: "no-store" }); return r.ok ? await r.json() : null; }
  catch (e) { return null; }
}
function escapeHtml(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function trimLabel(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function setHTML(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }
function emptyLi(msg) { return `<li class="empty">${msg || "Not enough data yet."}</li>`; }

function metricValue(e) { return typeof e.growth === "number" ? e.growth : (e.yoy_share_change || 0); }
function dirOf(e) { return metricValue(e) >= 0 ? "up" : "down"; }
function deltaText(e) {
  if (typeof e.growth === "number") { const g = Math.round(e.growth * 100); return (g >= 0 ? "+" : "") + g + "%"; }
  const v = (e.yoy_share_change || 0) * 100; return (v >= 0 ? "+" : "") + v.toFixed(1) + " pts";
}
function seriesPts(id) { const t = _data.trends && _data.trends.topics && _data.trends.topics[id]; return t ? t.points : null; }

function lineChart(e) {
  const host = document.getElementById("hero-chart");
  if (!host) return;
  const dates = (_data.trends && _data.trends.snapshots) || [];
  const pts = seriesPts(e.id);
  if (!pts || pts.length < 2) { host.innerHTML = ""; return; }
  const cssVar = dirOf(e) === "up" ? "--up" : "--down";
  const W = 760, H = 230, padL = 8, padR = 12, padT = 18, padB = 24;
  const n = Math.max(1, dates.length - 1);
  const xAt = i => padL + (i / n) * (W - padL - padR);
  let maxS = 0; pts.forEach(p => { if (p.share > maxS) maxS = p.share; });
  maxS = Math.max(maxS, 0.0004);
  const yBot = H - padB, yTop = padT;
  const yAt = s => yBot - (s / maxS) * (yBot - yTop);
  const gi = d => dates.indexOf(d);
  const d = pts.map((p, i) => (i ? "L" : "M") + xAt(gi(p.date) < 0 ? i : gi(p.date)).toFixed(1) + " " + yAt(p.share).toFixed(1)).join(" ");
  const x0 = xAt(Math.max(0, gi(pts[0].date))), xN = xAt(Math.max(0, gi(pts[pts.length - 1].date)));
  const anim = reduceMotion() ? "" : ' class="draw" pathLength="1"';

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(e.label)} over time">`;
  svg += `<path d="${d} L ${xN.toFixed(1)} ${yBot} L ${x0.toFixed(1)} ${yBot} Z" style="fill:var(${cssVar});opacity:.08"/>`;
  svg += `<line x1="${padL}" y1="${yBot}" x2="${W - padR}" y2="${yBot}" style="stroke:var(--line)" stroke-width="1"/>`;
  svg += `<text x="${padL}" y="${yTop - 6}" font-size="11" style="fill:var(--faint);font-family:var(--mono)">${PCT(maxS)}</text>`;
  if (dates.length) {
    svg += `<text x="${padL}" y="${H - 6}" font-size="11" style="fill:var(--faint);font-family:var(--mono)">${dates[0].slice(0, 4)}</text>`;
    svg += `<text x="${W - padR}" y="${H - 6}" font-size="11" text-anchor="end" style="fill:var(--faint);font-family:var(--mono)">${dates[dates.length - 1].slice(0, 4)}</text>`;
  }
  svg += `<path d="${d}" fill="none" style="stroke:var(${cssVar})" stroke-width="2.5"${anim}/>`;
  const last = pts[pts.length - 1], lx = xAt(gi(last.date) < 0 ? pts.length - 1 : gi(last.date)), ly = yAt(last.share);
  svg += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" style="fill:var(${cssVar})"/></svg>`;

  host.innerHTML = svg + `<div class="chart-guide" style="height:${(yBot / H * 100).toFixed(2)}%"></div><div class="chart-dot"></div><div class="chart-tip"></div>`;
  _chartCtx = { host, dates, W, H, padL, padR, xAt, yAt, cssVar, label: e.label, byDate: Object.fromEntries(pts.map(p => [p.date, p.share])) };
  attachChartHover();
}

function attachChartHover() {
  const c = _chartCtx;
  if (!c || c.dates.length < 2) return;
  const host = c.host, guide = host.querySelector(".chart-guide"), tip = host.querySelector(".chart-tip"), dot = host.querySelector(".chart-dot");
  const n = c.dates.length;
  function onMove(ev) {
    const rect = host.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const vbx = (clientX - rect.left) / rect.width * c.W;
    let i = Math.round((vbx - c.padL) / (c.W - c.padL - c.padR) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const date = c.dates[i], share = c.byDate[date], gx = c.xAt(i) / c.W * 100;
    host.classList.add("active");
    guide.style.left = gx.toFixed(2) + "%";
    if (share == null) dot.style.opacity = "0";
    else { dot.style.opacity = "1"; dot.style.left = gx.toFixed(2) + "%"; dot.style.top = (c.yAt(share) / c.H * 100).toFixed(2) + "%"; dot.style.background = `var(${c.cssVar})`; }
    tip.innerHTML = `<div class="tip-date">${date}</div><div class="tip-row"><span>${escapeHtml(trimLabel(c.label, 22))}</span><span class="tip-val">${share == null ? "n/a" : PCT(share)}</span></div>`;
    const tw = tip.offsetWidth, cw = rect.width, px = gx / 100 * cw;
    let leftPct = gx;
    if (px + tw / 2 > cw) leftPct = (cw - tw / 2) / cw * 100;
    if (px - tw / 2 < 0) leftPct = (tw / 2) / cw * 100;
    tip.style.left = leftPct.toFixed(2) + "%";
  }
  host.addEventListener("mousemove", onMove);
  host.addEventListener("mouseleave", () => host.classList.remove("active"));
  host.addEventListener("touchmove", onMove, { passive: true });
  host.addEventListener("touchend", () => host.classList.remove("active"));
}

// firm[id] = the last-complete-year movement for a construct (trustworthy %); the headline
// names the current year's fastest risers by rank, but quotes the firm complete-year number.
function firmOf(id) { return (_data.firm && _data.firm[id]) || null; }

function ledeText(e, isHeadline, curRec) {
  const refYear = _data.refYear, curYear = (_data.current || {}).year;
  if (isHeadline) {
    const sofar = curRec ? `already in about ${INT(curRec)} papers so far` : "still gaining ground";
    return `This is the fastest-rising construct in language research in ${curYear}, ${sofar}. `
      + `The figure below is its firm change through ${refYear}, the last fully indexed year. `
      + `Tap any name to trace its full path.`;
  }
  const f = firmOf(e.id);
  const dir = f && dirOf(f) === "down" ? "fading" : "rising";
  const papers = e.count_recent ? `about ${INT(e.count_recent)} papers` : null;
  return `This construct was ${dir} through ${refYear}`
    + (papers ? `, in ${papers} that year. ` : `. `) + `Tap another name to compare.`;
}

function selectTerm(id) {
  const leaders = (_data.current && _data.current.leaders) || [];
  const headlineId = (leaders[0] || (_data.latest.rising || [])[0] || {}).id;
  const useId = id || headlineId;
  const isHeadline = useId === headlineId;
  // Prefer the firm entry (has growth %); fall back to the current-year leader record.
  let e = firmOf(useId) || leaders.find(x => x.id === useId)
        || (_data.latest.rising || [])[0] || (_data.latest.cooling || [])[0];
  if (!e) { setText("lead-term", "No clear movers yet."); return; }
  _selected = e.id;

  const cur = _data.current || {};
  const kicker = document.getElementById("kicker");
  if (kicker) {
    if (isHeadline) kicker.textContent = cur.provisional ? `Fastest rising so far in ${cur.year}` : `Fastest rising in ${cur.year}`;
    else kicker.innerHTML = `<span class="reset-link">&larr; Back to the fastest riser</span>`;
  }
  setText("lead-term", e.label);
  const curLeader = leaders.find(x => x.id === e.id);
  const sentence = ledeText(e, isHeadline, curLeader && curLeader.count_recent);
  setText("dropcap", sentence.slice(0, 1));
  setText("lede-rest", sentence.slice(1));

  // Prefer the firm, last-complete-year change. With no trustworthy complete-year number, show the
  // provisional current-year share rather than invent a delta (never quote the partial-year growth %).
  const f = firmOf(e.id);
  const ld = document.getElementById("lead-delta");
  if (ld) {
    if (f) { ld.textContent = deltaText(f); ld.className = "ps-num " + dirOf(f); }
    else { ld.textContent = (typeof e.share_recent === "number") ? PCT(e.share_recent) : "n/a"; ld.className = "ps-num up"; }
  }
  setText("lead-context", f ? `change through ${_data.refYear}` : `share so far in ${cur.year}, provisional`);
  lineChart(f || { id: e.id, label: e.label, growth: 1, yoy_share_change: 1 });
  document.querySelectorAll(".lb-row").forEach(m => m.classList.toggle("active", m.getAttribute("data-id") === e.id));
}

function moverRow(e, i) {
  const dir = dirOf(e);
  return `<li class="lb-row" data-id="${escapeHtml(e.id)}">
    <span class="lb-rank">${i + 1}</span>
    <span class="lb-name">${escapeHtml(e.label)}</span>
    <span class="lb-delta ${dir}">${deltaText(e)}</span>
  </li>`;
}

function paperRow(p) {
  const url = p.oa_url || p.doi || p.id || "#";
  const meta = [p.authors && p.authors.length ? escapeHtml(p.authors.slice(0, 3).join(", ")) : "", p.venue ? escapeHtml(p.venue) : "", p.year || ""].filter(Boolean).join(" · ");
  return `<li class="brief">
    <a class="brief-title" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
    <div class="brief-meta">${meta}</div>
  </li>`;
}

function wire() {
  ["rising", "cooling"].forEach(id => {
    const ol = document.getElementById(id);
    if (ol) ol.addEventListener("click", ev => { const li = ev.target.closest(".lb-row"); if (li) selectTerm(li.getAttribute("data-id")); });
  });
  const k = document.getElementById("kicker");
  if (k) k.addEventListener("click", ev => { if (ev.target.closest(".reset-link")) selectTerm(null); });
}

async function main() {
  const [latest, trends] = await Promise.all([getJSON("data/latest.json"), getJSON("data/trends.json")]);
  if (!latest) { setText("lead-term", "Warming up. The first weekly snapshot appears here soon."); return; }
  _data = { latest, trends, current: latest.current_year || { leaders: [], year: "", provisional: false } };
  _data.refYear = latest.reference_year || "";
  const firm = {};
  (latest.rising || []).forEach(e => { firm[e.id] = e; });
  (latest.cooling || []).forEach(e => { firm[e.id] = e; });
  _data.firm = firm;

  setText("site-name", latest.site_name);
  const cur = _data.current;
  setText("np-date", cur.year
    ? (cur.provisional ? `Updated weekly. ${cur.year} so far, provisional.` : `Updated weekly. Through ${cur.year}.`)
    : "Updated weekly.");
  setText("generated", latest.generated_on || "-");
  setText("coverage-note", latest.coverage_note || "");
  if (latest.baseline_building) document.getElementById("baseline-banner").classList.remove("hidden");

  const dates = (trends && trends.snapshots) || [];
  const span = dates.length ? `${dates[0].slice(0, 4)} to ${dates[dates.length - 1].slice(0, 4)}` : "";
  const works = INT((latest.totals || {}).count_recent);
  setText("stats-inline", span ? `Tracking ${works} works a year across ${span}.` : "");

  const moverHead = _data.refYear ? `Movers in ${_data.refYear}` : "Movers this year";
  document.querySelectorAll(".rule-head .movers-year").forEach(el => el.textContent = moverHead);

  setHTML("rising", (latest.rising || []).slice(0, 7).map(moverRow).join("") || emptyLi("No clear risers yet."));
  setHTML("cooling", (latest.cooling || []).slice(0, 7).map(moverRow).join("") || emptyLi("No clear decliners yet."));
  setHTML("newest", ((latest.papers || {}).newest || []).slice(0, 8).map(paperRow).join("") || emptyLi("No recent papers found."));

  wire();
  selectTerm(null);
}

main();
