"use strict";

/* Word on the Street -- the shared hero line chart, used by both the front page and the construct
   detail pages so the two can never visually diverge. Depends on util.js (PCT, escapeHtml, trimLabel,
   reduceMotion). Call with an explicit options object:
     lineChart({ hostId, points:[{date:"YYYY-12-31", share, count}], dates:["YYYY-12-31", ...], dir:"up"|"down", label }) */

let _chartCtx = null;

function lineChart(opts) {
  const host = document.getElementById(opts.hostId || "hero-chart");
  if (!host) return;
  const dates = opts.dates || [];
  const pts = opts.points;
  if (!pts || pts.length < 2) { host.innerHTML = ""; return; }
  const cssVar = opts.dir === "down" ? "--down" : "--up";
  const label = opts.label || "";
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

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(label)} over time">`;
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
  _chartCtx = { host, dates, W, H, padL, padR, xAt, yAt, cssVar, label, byDate: Object.fromEntries(pts.map(p => [p.date, p.share])) };
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
