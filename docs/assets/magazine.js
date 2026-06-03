"use strict";

/* Word on the Street -- front page. Shared helpers live in util.js; the hero line chart in chart.js. */

let _data = null, _selected = null;

function seriesPts(id) { const t = _data.trends && _data.trends.topics && _data.trends.topics[id]; return t ? t.points : null; }

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
    else { ld.textContent = "n/a"; ld.className = "ps-num"; }   // never quote the inflated partial-year share as a %
  }
  setText("lead-context", f ? `change through ${_data.refYear}` : `rising in ${cur.year} so far`);
  lineChart({
    hostId: "hero-chart",
    points: seriesPts(e.id),
    dates: (_data.trends && _data.trends.snapshots) || [],
    dir: f ? dirOf(f) : "up",
    label: e.label,
  });
  document.querySelectorAll(".lb-row").forEach(m => m.classList.toggle("active", m.getAttribute("data-id") === e.id));
}

function moverRow(e, i) {
  const dir = dirOf(e);
  return `<li class="lb-row" data-id="${escapeHtml(e.id)}">
    <span class="lb-rank">${i + 1}</span>
    <span class="lb-name"><a href="construct.html?id=${encodeURIComponent(e.id)}">${escapeHtml(e.label)}</a></span>
    <span class="lb-delta ${dir}">${deltaText(e)}</span>
  </li>`;
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
  setHTML("most-cited", ((latest.papers || {}).most_cited_recent || []).slice(0, 8).map(citedRow).join("") || emptyLi("No citation data yet."));
  setHTML("newest", ((latest.papers || {}).newest || []).slice(0, 8).map(paperRow).join("") || emptyLi("No recent papers found."));

  wire();
  selectTerm(null);
}

main();
