"use strict";

/* Word on the Street -- shared helpers used by every page script (front page, Explore, construct
   detail). Loaded before chart.js and the per-page script; classic scripts share one global lexical
   scope, so these names are visible to the scripts loaded after this one. No framework, no libraries. */

const PCT = x => (x * 100).toFixed(2) + "%";
const INT = x => (x || 0).toLocaleString("en-US");
const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
// Direction at the DISPLAYED (whole-percent) resolution, so a move that rounds to 0% reads as flat
// everywhere (badge, colour, sparkline, filter) rather than as a contradictory signed "0%".
function pctDir(growth) {
  if (growth == null) return "none";
  const g = Math.round(growth * 100);
  return g > 0 ? "up" : g < 0 ? "down" : "flat";
}
function deltaText(e) {
  if (typeof e.growth === "number") { const g = Math.round(e.growth * 100); return (g > 0 ? "+" : "") + g + "%"; }
  const v = Math.round((e.yoy_share_change || 0) * 1000) / 10; return (v > 0 ? "+" : "") + v.toFixed(1) + " pts";
}

// The title links to the paper's DOI: the canonical identifier that always resolves to the
// version of record. A separate open-access copy (when OpenAlex has one that isn't just the
// DOI again) is offered as a small labelled extra, so a fragile publisher PDF deep-link is
// never the primary link. Falls back to the OA copy, then the OpenAlex record, when no DOI.
function paperLinks(p) {
  const url = p.doi || p.oa_url || p.id || "#";
  const oa = (p.oa_url && p.oa_url !== url) ? p.oa_url : null;
  return { url, oa };
}

// Paper-feed row renderers, shared by the front page and the Papers page.
function paperRow(p) {
  const { url, oa } = paperLinks(p);
  const meta = [p.authors && p.authors.length ? escapeHtml(p.authors.slice(0, 3).join(", ")) : "", p.venue ? escapeHtml(p.venue) : "", p.year || ""].filter(Boolean).join(" · ");
  const oaLink = oa ? `${meta ? " · " : ""}<a class="brief-oa" href="${escapeHtml(oa)}" target="_blank" rel="noopener">open access</a>` : "";
  return `<li class="brief">
    <a class="brief-title" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
    <div class="brief-meta">${meta}${oaLink}</div>
  </li>`;
}
function citedRow(p) {
  const { url, oa } = paperLinks(p);
  const meta = [p.authors && p.authors.length ? escapeHtml(p.authors.slice(0, 3).join(", ")) : "", p.venue ? escapeHtml(p.venue) : "", p.year || ""].filter(Boolean).join(" · ");
  const oaLink = oa ? `${meta ? " · " : ""}<a class="brief-oa" href="${escapeHtml(oa)}" target="_blank" rel="noopener">open access</a>` : "";
  const cites = (p.cited_by_count || 0).toLocaleString("en-US");
  return `<li class="brief">
    <a class="brief-title" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
    <div class="brief-meta">${meta}${oaLink}</div>
    <div class="brief-cites">${cites} citations</div>
  </li>`;
}
