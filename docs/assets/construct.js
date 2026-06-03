"use strict";

/* Word on the Street -- construct detail. Reads ?id= and renders one construct from
   data/constructs.json: its share trajectory (shared chart.js), the firm numbers, and a path to the
   works on OpenAlex. Depends on util.js + chart.js. Honest about the provisional current year. */

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function notFound() {
  const main = document.getElementById("detail");
  setText("c-label", "Construct not found");
  setText("kicker", "");
  setText("c-standfirst", "");
  document.title = "Not found · Word on the Street";
  if (main) main.innerHTML = `<section class="feature" style="border-bottom:none"><p class="cov">That construct is not in the index. <a href="explore.html">Browse all constructs</a>.</p></section>`;
}

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  const ret = new URLSearchParams(location.search).get("return");
  if (ret) { const bi = document.getElementById("back-index"); if (bi) bi.setAttribute("href", "explore.html?" + ret); }

  const data = await getJSON("data/constructs.json");
  if (!data || !data.constructs) { notFound(); return; }
  const c = data.constructs.find(x => x.id === id);
  if (!c) { notFound(); return; }

  const refYear = data.reference_year || "";
  const priorYear = refYear ? String(Number(refYear) - 1) : "";
  const total = data.count || data.constructs.length;
  const dir = pctDir(c.growth); // "up" | "down" | "flat" | "none"
  const isCurated = c.source === "curated";
  const provenance = isCurated ? "Curated coinage" : "OpenAlex topic keyphrase";

  document.title = `${c.label} · Word on the Street`;
  setText("c-label", c.label);

  // Kicker: provenance + rank by share (complete-year, unambiguous).
  setText("kicker", `${provenance} · ranked ${ordinal(c.rank)} of ${total} by ${refYear} share`);

  // Standfirst: one honest sentence, at the displayed (whole-percent) resolution.
  setText("c-standfirst",
    dir === "none" ? "Tracked across the field; no firm year-over-year change yet."
    : dir === "flat" ? `Little changed through ${refYear}, the last fully indexed year.`
    : dir === "down" ? `Fading through ${refYear}, the last fully indexed year.`
    : `Rising through ${refYear}, the last fully indexed year.`);

  // Lede built from the numbers.
  let lede;
  if (dir === "none") {
    lede = `${c.label} accounted for ${PCT(c.latest_share)} of the field's output in ${refYear}.`;
  } else if (dir === "flat") {
    lede = `${c.label} accounted for ${PCT(c.latest_share)} of the field's output in ${refYear}, little changed on the year before.`;
  } else {
    const moved = `${Math.abs(Math.round(c.growth * 100))}%`;
    lede = `${c.label} accounted for ${PCT(c.latest_share)} of the field's output in ${refYear}, ${dir === "down" ? "down" : "up"} ${moved} on the year before.`;
  }
  setText("dropcap", lede.slice(0, 1));
  setText("lede-rest", lede.slice(1));

  // Pullstat.
  const num = document.getElementById("s-chg");
  if (dir === "none") {
    if (num) { num.textContent = PCT(c.latest_share); num.className = "ps-num"; }
    setText("s-chg-lab", `share in ${refYear}, no firm year-over-year yet`);
  } else {
    if (num) { num.textContent = deltaText({ growth: c.growth }); num.className = "ps-num " + dir; }
    setText("s-chg-lab", `change through ${refYear}`);
  }

  // Chart: feed the construct's complete-year series to the shared hero chart.
  const years = data.complete_years || c.series.map(p => p.year);
  lineChart({
    hostId: "hero-chart",
    points: c.series.map(p => ({ date: p.year + "-12-31", share: p.share, count: p.papers })),
    dates: years.map(y => y + "-12-31"),
    dir,
    label: c.label,
  });

  // The numbers.
  const chgVal = c.growth == null
    ? `<span class="flat" title="No firm change; too few papers">&#8211;</span>`
    : deltaText({ growth: c.growth });
  const chgCls = c.growth == null ? "" : dir;
  const gapsData = await getJSON("data/gaps.json");
  const gap = gapsData && (gapsData.all || gapsData.gaps || []).find(x => x.id === c.id);
  const facts = [
    [`Share in ${refYear}`, `<dd class="mono">${PCT(c.latest_share)}</dd>`],
    [`Change vs ${priorYear}`, `<dd class="mono ${chgCls}">${chgVal}</dd>`],
    ["Rank", `<dd class="mono"><a href="explore.html?sort=share_desc#row-${escapeHtml(c.id)}">${ordinal(c.rank)}</a> of ${total} by ${refYear} share</dd>`],
    [`Matched works, ${refYear}`, `<dd class="mono">${INT(c.latest_papers)}</dd>`],
    ["Source", `<dd>${provenance}</dd>`],
  ];
  if (gap) {
    const cy = gapsData.cohort_years || [];
    const span = cy.length ? `${cy[0]} to ${cy[cy.length - 1]}` : "recent years";
    facts.splice(3, 0, ["Early-citation rate", `<dd class="mono up">&times;${gap.lift.toFixed(1)} the field (${span})</dd>`]);
  }
  setHTML("facts", facts.map(([dt, dd]) => `<div class="fact"><dt>${dt}</dt>${dd}</div>`).join(""));

  // Provisional current-year note (guarded; optional rank-only standing from latest.json).
  if (data.current_year) {
    const note = document.getElementById("provisional-note");
    let txt = `${data.current_year} is still indexing, so its share is inflated; it is left off the chart and these figures.`;
    const latest = await getJSON("data/latest.json");
    const leaders = latest && latest.current_year && latest.current_year.leaders || [];
    if (leaders.some(l => l.id === c.id)) txt += ` It is among the fastest risers so far in ${data.current_year}, by rank; the size of that move is not yet firm.`;
    if (note) { note.textContent = txt; note.classList.remove("hidden"); }
  }

  // Read the papers: count behind the share + a scoped OpenAlex link.
  setText("papers-note", `${c.label} matched about ${INT(c.latest_papers)} works in ${refYear}. The full list lives on OpenAlex, scoped exactly as the counts here are built.`);
  const meta = await getJSON("data/meta.json");
  const ids = (meta && meta.subfields && meta.subfields.map(s => s.id).join("|")) || "1203|3310";
  const link = document.getElementById("oa-link");
  if (link) link.setAttribute("href",
    `https://openalex.org/works?filter=title_and_abstract.search:${encodeURIComponent(c.label)},primary_topic.subfield.id:${ids}&sort=cited_by_count:desc`);
}

main();
