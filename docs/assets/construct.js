"use strict";

/* Word on the Street -- construct detail. Reads ?id= and renders one construct from
   data/constructs.json: its share trajectory (shared chart.js), the firm numbers, and a path to the
   works on OpenAlex. Depends on util.js + chart.js + i18n.js. Honest about the provisional current year.
   Fetches once into _ctx; render() repaints in the current language and re-runs on a language switch. */

let _ctx = null;

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// Rank as an English ordinal (1st, 2nd) or, in Arabic, the plain number (المرتبة 5).
function rankStr(n) { return curLang() === "ar" ? String(n) : ordinal(n); }

function renderNotFound() {
  setText("c-label", T("c_not_found"));
  setText("kicker", "");
  setText("c-standfirst", "");
  document.title = T("c_not_found_title");
  const main = document.getElementById("detail");
  if (main) main.innerHTML = `<section class="feature" style="border-bottom:none"><p class="cov">${T("c_not_found_body_html")}</p></section>`;
}

function render() {
  applyI18n();
  const ctx = _ctx, data = ctx.data, c = ctx.c;
  if (!c || !data || !data.constructs) { renderNotFound(); return; }

  const refYear = data.reference_year || "";
  const priorYear = refYear ? String(Number(refYear) - 1) : "";
  const total = data.count || data.constructs.length;
  const dir = pctDir(c.growth); // "up" | "down" | "flat" | "none"
  const prov = c.source === "curated" ? T("prov_curated") : T("prov_openalex");
  const label = cLabelBoth(c.id, c.label);     // Arabic name with the English original in parentheses

  document.title = T("c_doc_title", { label: cLabel(c.id, c.label) });
  setText("c-label", label);
  setText("kicker", T("c_kicker", { prov: prov, rank: rankStr(c.rank), total: total, refYear: refYear }));
  setText("c-standfirst",
    dir === "none" ? T("c_sf_none")
    : dir === "flat" ? T("c_sf_flat", { refYear })
    : dir === "down" ? T("c_sf_down", { refYear })
    : T("c_sf_up", { refYear }));

  let lede;
  if (dir === "none") lede = T("c_lede_none", { label, share: PCT(c.latest_share), refYear });
  else if (dir === "flat") lede = T("c_lede_flat", { label, share: PCT(c.latest_share), refYear });
  else {
    const moved = `${Math.abs(Math.round(c.growth * 100))}%`;
    lede = T("c_lede_move", { label, share: PCT(c.latest_share), refYear, updown: dir === "down" ? T("c_down") : T("c_up"), moved });
  }
  // Arabic joins, so skip the floated single-letter drop cap there.
  if (curLang() === "ar") { setText("dropcap", ""); setText("lede-rest", lede); }
  else { setText("dropcap", lede.slice(0, 1)); setText("lede-rest", lede.slice(1)); }

  const num = document.getElementById("s-chg");
  if (dir === "none") {
    if (num) { num.textContent = PCT(c.latest_share); num.className = "ps-num"; }
    setText("s-chg-lab", T("c_chglab_none", { refYear }));
  } else {
    if (num) { num.textContent = deltaText({ growth: c.growth }); num.className = "ps-num " + dir; }
    setText("s-chg-lab", T("ctx_change_through", { year: refYear }));
  }

  const years = data.complete_years || c.series.map(p => p.year);
  lineChart({
    hostId: "hero-chart",
    points: c.series.map(p => ({ date: p.year + "-12-31", share: p.share, count: p.papers })),
    dates: years.map(y => y + "-12-31"),
    dir,
    label: cLabel(c.id, c.label),
  });

  const chgVal = c.growth == null
    ? `<span class="flat" title="${escapeHtml(T("no_firm_change"))}">&#8211;</span>`
    : deltaText({ growth: c.growth });
  const chgCls = c.growth == null ? "" : dir;
  const gaps = ctx.gaps;
  const gap = gaps && (gaps.all || gaps.gaps || []).find(x => x.id === c.id);
  const facts = [
    [T("c_fact_share", { refYear }), `<dd class="mono">${PCT(c.latest_share)}</dd>`],
    [T("c_fact_change", { priorYear }), `<dd class="mono ${chgCls}">${chgVal}</dd>`],
    [T("c_fact_rank"), `<dd class="mono"><a href="explore.html?sort=share_desc#row-${escapeHtml(c.id)}">${rankStr(c.rank)}</a> ${T("c_fact_rank_suffix", { total, refYear })}</dd>`],
    [T("c_fact_matched", { refYear }), `<dd class="mono">${INT(c.latest_papers)}</dd>`],
    [T("c_fact_source"), `<dd>${prov}</dd>`],
  ];
  if (gap) {
    const cy = gaps.cohort_years || [];
    const span = cy.length ? `${cy[0]}${curLang() === "ar" ? " إلى " : " to "}${cy[cy.length - 1]}` : T("gaps_cohort_fallback");
    facts.splice(3, 0, [T("c_fact_earlycite"), `<dd class="mono up">${T("c_earlycite_dd", { lift: gap.lift.toFixed(1), span })}</dd>`]);
  }
  setHTML("facts", facts.map(([dt, dd]) => `<div class="fact"><dt>${dt}</dt>${dd}</div>`).join(""));

  const note = document.getElementById("provisional-note");
  if (data.current_year && note) {
    let txt = T("c_provisional", { year: data.current_year });
    const leaders = (ctx.latest && ctx.latest.current_year && ctx.latest.current_year.leaders) || [];
    if (leaders.some(l => l.id === c.id)) txt += T("c_provisional_leader", { year: data.current_year });
    note.textContent = txt; note.classList.remove("hidden");
  } else if (note) { note.classList.add("hidden"); }

  setText("papers-note", T("c_papers_note", { label, n: INT(c.latest_papers), refYear }));
  const ids = (ctx.meta && ctx.meta.subfields && ctx.meta.subfields.map(s => s.id).join("|")) || "1203|3310";
  const link = document.getElementById("oa-link");
  if (link) link.setAttribute("href",
    `https://openalex.org/works?filter=title_and_abstract.search:${encodeURIComponent(c.label)},primary_topic.subfield.id:${ids}&sort=cited_by_count:desc`);
}

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  const ret = new URLSearchParams(location.search).get("return");
  if (ret) { const bi = document.getElementById("back-index"); if (bi) bi.setAttribute("href", "explore.html?" + ret); }

  const data = await getJSON("data/constructs.json");
  const c = data && data.constructs ? data.constructs.find(x => x.id === id) : null;
  const [gaps, latest, meta] = await Promise.all([getJSON("data/gaps.json"), getJSON("data/latest.json"), getJSON("data/meta.json")]);
  await loadGlossary();

  _ctx = { id, data, c, gaps, latest, meta };
  window.renderI18n = render;
  render();
}

main();
