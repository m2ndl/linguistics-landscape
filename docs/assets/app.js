"use strict";

const PCT = x => (x * 100).toFixed(2) + "%";
const PTS = x => ((x * 100 >= 0 ? "+" : "") + (x * 100).toFixed(2) + " pts");
const INT = x => (x || 0).toLocaleString();

async function getJSON(path) {
  try {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

function escapeHtml(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sparkline(points, w = 120, h = 28) {
  if (!points || points.length < 2) return "";
  const xs = points.map(p => p.share);
  const min = Math.min(...xs), max = Math.max(...xs), span = (max - min) || 1;
  const stepX = w / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX, y = h - ((p.share - min) / span) * (h - 4) - 2;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const lx = (points.length - 1) * stepX;
  const ly = h - ((points[points.length - 1].share - min) / span) * (h - 4) - 2;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">`
    + `<polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="1.5"/>`
    + `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2" fill="currentColor"/></svg>`;
}

function topicRow(entry, series) {
  const pts = series && series[entry.id] ? series[entry.id].points : null;
  const badge = entry.confirmed
    ? '<span class="badge ok">confirmed</span>'
    : '<span class="badge tentative">early</span>';
  const dirClass = entry.yoy_share_change >= 0 ? "pos" : "neg";
  return `<li>
    <div class="topic-main"><span class="topic-label">${escapeHtml(entry.label)}</span>${badge}</div>
    <div class="topic-meta">
      <span class="share">${PCT(entry.share_recent)}</span>
      <span class="delta ${dirClass}">${PTS(entry.yoy_share_change)}</span>
      <span class="spark-wrap">${sparkline(pts)}</span>
    </div>
  </li>`;
}

function paperRow(p) {
  const url = p.oa_url || p.doi || p.id || "#";
  const authors = (p.authors || []).join(", ");
  const cites = p.cited_by_count ? ` · ${INT(p.cited_by_count)} citations` : "";
  const venue = p.venue ? `${escapeHtml(p.venue)}` : "";
  const bits = [authors && escapeHtml(authors), venue, p.year, cites].filter(Boolean).join(" · ");
  return `<li>
    <a class="paper-title" href="${escapeHtml(url)}" rel="noopener" target="_blank">${escapeHtml(p.title)}</a>
    <div class="paper-meta">${bits}</div>
  </li>`;
}

function biggestAreas(trends) {
  const topics = (trends && trends.topics) || {};
  const rows = Object.keys(topics).map(id => {
    const pts = topics[id].points || [];
    const last = pts.length ? pts[pts.length - 1] : { share: 0 };
    return { id, label: topics[id].label, share: last.share || 0 };
  }).sort((a, b) => b.share - a.share).slice(0, 12);
  const max = rows.length ? rows[0].share : 1;
  return rows.map(r => `<li>
    <span class="bar-label">${escapeHtml(r.label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${(r.share / max * 100).toFixed(1)}%"></span></span>
    <span class="bar-val">${PCT(r.share)}</span>
  </li>`).join("");
}

function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function setHTML(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }
function emptyLi(msg) { return `<li class="empty">${msg || "Not enough data yet."}</li>`; }

async function main() {
  const [latest, trends] = await Promise.all([getJSON("data/latest.json"), getJSON("data/trends.json")]);
  if (!latest) {
    setText("narrative",
      "The observatory has not produced its first snapshot yet. Once the weekly job runs, this page fills with the latest state of the field.");
    return;
  }
  setText("site-name", latest.site_name);
  setText("tagline", latest.tagline);
  setText("asof", latest.as_of ? `As of ${latest.as_of}` : "No data yet");
  setText("snapcount", `${INT(latest.snapshot_count)} weekly snapshots on record`);
  setText("generated", latest.generated_on || "—");
  setText("narrative", latest.narrative || "");
  setText("coverage-note", latest.coverage_note || "");
  if (latest.baseline_building) document.getElementById("baseline-banner").classList.remove("hidden");

  const series = trends ? trends.topics : {};
  setHTML("rising", (latest.rising || []).map(e => topicRow(e, series)).join("") || emptyLi("No rising topics cleared the thresholds."));
  setHTML("cooling", (latest.cooling || []).map(e => topicRow(e, series)).join("") || emptyLi("No cooling topics cleared the thresholds."));
  setHTML("biggest", trends ? biggestAreas(trends) : emptyLi());

  const papers = latest.papers || {};
  setHTML("newest", (papers.newest || []).map(paperRow).join("") || emptyLi("No recent papers found."));
  setHTML("most-cited", (papers.most_cited_recent || []).map(paperRow).join("") || emptyLi());
}

main();
