"use strict";

/* Word on the Street -- bilingual layer (English / العربية). Zero dependency, same shape as theme.js:
   the chosen language is remembered in localStorage and applied to <html> before paint by a tiny inline
   <head> script on each page (sets lang + dir, so there is no left-to-right flash on an Arabic load).
   This file holds the string table, wires the language button, maps construct names, and re-renders.
     - T(key, vars)      look up a UI string for the current language; falls back to English, then the key.
     - cLabel(id, en)    the Arabic name for a construct from the glossary, else its English label.
     - cLabelBoth(id,en) Arabic name with the English original in parentheses (for the Index + detail).
     - applyI18n()       fill [data-i18n] / [data-i18n-html] / [data-i18n-aria] elements + <title>/<meta>.
   Pages with data-driven content set window.renderI18n; the button calls it after switching language. */

const STR = {
  en: {
    /* shared chrome */
    brand: "Word on the Street",
    standfirst: "Research trends across linguistics, applied linguistics, and language education, tracked weekly.",
    nav_front: "Front page", nav_index: "The Index", nav_slow: "Rankings", nav_bestyear: "Best year", nav_niches: "Niches", nav_papers: "Papers", nav_methods: "About",
    switch_to_ar: "Switch to Arabic", switch_to_en: "Switch to English",
    theme_to_dark: "Switch to dark theme", theme_to_light: "Switch to light theme",
    updated_weekly: "Updated weekly.",
    dateline_provisional: "Updated weekly. {year} so far, provisional.",
    dateline_through: "Updated weekly. Through {year}.",
    footer_data: "Data from <a href=\"https://openalex.org\" rel=\"noopener\">OpenAlex</a>, CC0 metadata.",
    footer_nav: "<a href=\"index.html\">Front page</a> · <a href=\"explore.html\">The Index</a> · <a href=\"slow.html\">Rankings</a> · <a href=\"bestyear.html\">Best year</a> · <a href=\"gaps.html\">Niches</a> · <a href=\"papers.html\">Papers</a> · <a href=\"about.html\">About</a>",
    mt_note: "",
    doc_title_about: "About · Word on the Street",
    doc_desc_about: "How Word on the Street builds its numbers on research trends across linguistics, applied linguistics, and language education, what they can and cannot tell you, and how to download the dataset.",
    about_title: "About",
    about_standfirst: "How these numbers are built, and how to read them.",
    baseline: "Still building a baseline, so these are early signals.",
    doc_title_index: "Word on the Street · Research trends in linguistics",
    doc_desc_index: "What is rising and fading across linguistics, applied linguistics, sociolinguistics, psycholinguistics, translation, and language education. Research trends tracked every week, built from OpenAlex.",

    /* front page */
    kicker_default: "The fastest riser this year",
    kicker_so_far: "Fastest rising so far in {year}",
    kicker_in: "Fastest rising in {year}",
    kicker_back: "← Back to the fastest riser",
    loading: "Loading…",
    no_movers: "No clear movers yet.",
    warming: "Warming up. The first weekly snapshot appears here soon.",
    lede_headline: "This is the fastest-rising construct in language research in {curYear}, {sofar}. The figure below is its firm change through {refYear}, the last fully indexed year. Tap any name to trace its full path.",
    lede_sofar_yes: "already in about {n} papers so far",
    lede_sofar_no: "still gaining ground",
    lede_other_papers: "This construct was {dir} through {refYear}, in about {n} papers that year. Tap another name to compare.",
    lede_other_nopapers: "This construct was {dir} through {refYear}. Tap another name to compare.",
    dir_rising: "rising", dir_fading: "fading",
    ctx_change_through: "change through {year}",
    ctx_rising_sofar: "rising in {year} so far",
    na: "n/a",
    cover_cap: "Share of the field's output across the fully indexed years. Hover to read any year.",
    movers_in: "Movers in {year}", movers_this_year: "Movers this year",
    rising_col: "Rising", fading_col: "Fading",
    no_risers: "No clear risers yet.", no_decliners: "No clear decliners yet.",
    no_citations: "No citation data yet.", no_papers: "No recent papers found.",
    gaps_head: "Underserved niches",
    gaps_intro: "Constructs whose <span id=\"gaps-window\">2022 to 2024</span> papers were cited well above the field's rate, while the literature on them is still thin. That window ends two years back, so citations have had time to land.",
    gaps_vol: "{n} papers, {cohort}",
    gaps_lift: "×{x} the field",
    gaps_cohort_fallback: "recent years",
    most_cited_head: "Most cited in the last two years",
    most_cited_by: "By OpenAlex citation count.",
    newest_head: "New this week",
    about_nums_head: "About these numbers",
    about_nums_links: "<a href=\"explore.html\">Browse all constructs</a> · Read the full <a href=\"about.html\">methodology and limits</a>. <span id=\"stats-inline\"></span>",
    stats_inline: "Tracking {works} works a year across {span}.",
    citations: "{n} citations", open_access: "open access",
    chart_over_time: "{label} over time",

    /* Papers page */
    doc_title_papers: "Papers · Word on the Street",
    doc_desc_papers: "The latest and most-cited work across linguistics, applied linguistics, and language education, from OpenAlex.",
    pp_title: "Papers",
    pp_standfirst: "The latest and most-cited work across the field's journals.",
    pp_newest_head: "Newest",
    pp_note_html: "Most-cited work of roughly the last two years, by OpenAlex citation count. <span id=\"as-of\"></span> Titles, authors, venues, and links only; full text lives at the source.",
    pp_as_of: "As of {date}.",

    /* Explore (the Index) */
    doc_title_explore: "Explore all constructs · Word on the Street",
    doc_desc_explore: "Browse and search every construct tracked by Word on the Street, by share of the field and recent direction, across linguistics, applied linguistics, and language education.",
    ex_title: "The Index",
    ex_standfirst: "Every construct we track, by share of the field and its recent direction.",
    ex_form_aria: "Filter and sort constructs",
    ex_search_aria: "Search construct names",
    ex_search_ph: "Search {n} constructs",
    ex_sort_label: "Sort",
    ex_sort_share_desc: "Share, high to low",
    ex_sort_growth_desc: "Change, biggest gain",
    ex_sort_growth_asc: "Change, biggest drop",
    ex_sort_name_asc: "Name, A to Z",
    ex_sort_name_desc: "Name, Z to A",
    ex_src_label: "Source",
    ex_src_all: "All", ex_src_openalex: "OpenAlex", ex_src_curated: "Curated",
    ex_dir_label: "Direction",
    ex_dir_all: "All", ex_dir_up: "Rising", ex_dir_down: "Fading",
    ex_reset: "Reset",
    ex_count_html: "<span id=\"shown\">0</span> of <span id=\"total\">0</span> constructs",
    ex_caption: "All constructs, by share of the field and recent change",
    ex_th_construct: "Construct", ex_th_share: "Share", ex_th_trend: "Trend", ex_th_change: "Change",
    ex_share_year: "Share ’{yy}",
    ex_empty_html: "No constructs match. <button type=\"reset\" form=\"ex-form\" class=\"linklike\">Reset filters.</button>",
    ex_note: "Change is the firm move from the prior year to the last complete year. Trend lines plot complete years only; the partly indexed current year is left out of every percentage.",
    ex_warming: "Warming up. The first snapshot appears here soon.",
    ex_src_curated_badge: "curated",
    spark_aria: "{label}, share {word} over the complete years",
    spark_down: "falling", spark_up: "rising", spark_flat: "roughly flat", spark_none: "change not firm",
    no_firm_change: "No firm change; too few papers",

    /* Niches (Underserved niches) */
    doc_title_niches: "Underserved niches · Word on the Street",
    doc_desc_niches: "Constructs cited well above the field's rate while the literature on them is still thin, ranked by early-citation lift, across linguistics, applied linguistics, and language education.",
    ni_standfirst: "Constructs cited well above the field's rate, while the literature on them is still thin.",
    ni_form_aria: "Filter and sort niches",
    ni_search_ph: "Search {n} niches",
    ni_sort_lift_desc: "Lift, high to low",
    ni_sort_vol_asc: "Papers, fewest first",
    ni_sort_vol_desc: "Papers, most first",
    ni_count_html: "<span id=\"shown\">0</span> of <span id=\"total\">0</span> niches",
    ni_caption: "Underserved niches, by early-citation lift versus the field",
    ni_th_lift: "vs field",
    ni_th_vol: "Cohort papers",
    ni_lift_val: "×{x}",
    ni_empty_html: "No niches match. <button type=\"reset\" form=\"ni-form\" class=\"linklike\">Reset.</button>",
    ni_see_all: "See all {n} niches →",

    /* The Slow Table (a decade of rank movement) */
    doc_title_slow: "Rankings over the decade · Word on the Street",
    doc_desc_slow: "A decade of rank movement across linguistics, applied linguistics, and language education: which constructs rose and which fell in the field's ranking from 2014 to 2025, measured by each construct's yearly share of the literature.",
    slow_title: "Rankings over the decade",
    slow_standfirst: "The research topics that rose, and those that slipped, among the most-studied in the field from 2014 to 2025.",
    slow_insight_html: "<strong>{n} of {total}</strong> constructs published a larger share of papers in {y1} than in {y0}, yet fell in the ranking, because others grew faster.",
    slow_effn: "Research is more evenly distributed across the {k} named constructs than a decade ago: the effective number (a standard diversity measure) rose from about {a} to about {b}, varying from year to year.",
    slow_reshuffle_head: "Risers and fallers among the named constructs",
    slow_reshuffle_sub: "The {k} named constructs, ranked against each other, and how their ranking changed between {y0} and {y1}.",
    slow_climbed: "Rose",
    slow_slipped: "Fell",
    slow_steady: "steady",
    slow_steady_title: "A steady move across the decade, year after year.",
    slow_ladder_head: "The full ranking",
    slow_ladder_sub: "All {n} constructs, by how far each moved in the field's overall ranking between {y0} and {y1}.",
    slow_arrived_head: "Arrived mid-decade",
    slow_arrived_sub: "Too new in {y0} to hold a decade-long rank; shown at their {y1} rank and paper count.",
    slow_arrived_at: "rank {r} in {y1}, {n} papers",
    slow_th_r0: "Rank ’{yy0}",
    slow_th_r1: "Rank ’{yy1}",
    slow_th_move: "Move",
    slow_th_path: "Path",
    slow_th_real: "Real terms",
    slow_real_up: "gained share", slow_real_flat: "steady", slow_real_down: "lost share",
    slow_dir_label: "Move",
    slow_dir_up: "Climbed", slow_dir_down: "Slipped", slow_dir_flat: "Held",
    slow_sort_move_desc: "Biggest climb", slow_sort_move_asc: "Biggest slip", slow_sort_rank: "Rank in ’{yy1}",
    slow_spark_aria: "{label}, rank {word} from {y0} to {y1}",
    slow_w_up: "climbing", slow_w_down: "slipping", slow_w_flat: "roughly steady",
    slow_note: "Ranks compare the constructs we track to one another, within each year. The current year is still indexing, so the table ends at the last complete year, {y1}.",

    /* Against their best year */
    doc_title_bestyear: "Against their best year · Word on the Street",
    doc_desc_bestyear: "For each construct, its 2025 share of the field as a percentage of its own best year between 2014 and 2024, after the indexing drift is removed, across linguistics, applied linguistics, and language education.",
    by_title: "Against their best year",
    by_standfirst: "Every construct here is measured against its own best year. For each one we find the year between 2014 and 2024 when it held its largest share of the field, then show where it sits in 2025 as a percentage of that year.",
    by_lead: "Of the {total} named constructs present since 2014, {below} now hold less than 60% of their best year's share, and {above} are at or above their best year.",
    by_below_head: "Below their best year",
    by_above_head: "At or above their best year",
    by_table_head: "Every construct",
    by_table_sub: "All {n} constructs present in 2014, by where they sit against their own best year.",
    by_th_pct: "Share vs best year",
    by_th_peak: "Best year",
    by_th_papers: "Papers then / now",
    by_th_path: "Trajectory",
    by_rowsub: "best {y} · {a} papers then, {b} now",
    by_thin: "thin",
    by_thin_title: "This best year rests on a small number of papers.",
    by_dir_label: "Compared with best year",
    by_dir_below: "Below", by_dir_above: "Above",
    by_sort_pct_asc: "Furthest below first", by_sort_pct_desc: "Furthest above first", by_sort_peak: "Best year, most recent",
    by_new_head: "Too new to compare",
    by_new_sub: "These constructs had no papers before 2015, so they have no earlier year to compare against. Their latest paper counts are shown on their own.",
    by_new_at: "{n} papers in {y1}",
    by_note: "These percentages compare each construct's 2025 share of the field with its single best year. For Study abroad and Language aptitude the gap narrows to about 62% when the last three years are averaged, so read those as easing. A construct can sit well below its best year while its raw paper count holds steady, because the indexed literature has grown around it: Formulaic language is at 56% of its 2015 share on almost the same number of papers.",
    by_spark_aria: "{label}, its share of the field over the complete years, with its best year marked",

    /* Research openings (underserved niches by direction of output) */
    doc_title_openings: "Research gaps in linguistics and applied linguistics · Word on the Street",
    doc_desc_openings: "The underserved niches cited well above the field's rate, set against the direction of their output: which are drawing more papers than a few years ago and which fewer, across linguistics, applied linguistics, and language education.",
    op_title: "Underserved niches",
    op_standfirst: "Every niche here is cited well above the field's rate while the literature on it is still thin. This page sets that against the direction of its output: which niches the field is producing more work on than a few years ago, and which fewer.",
    op_lead: "Of the {total} underserved niches, {rising} are producing more papers than in {e0}-{e1}, {falling} fewer, and {steady} about the same. {newn} began only mid-decade, with no settled earlier window to compare.",
    op_rising_head: "Cited early, and output rising",
    op_falling_head: "Cited early, but output falling",
    op_table_head: "Every niche",
    op_form_aria: "Filter and sort niches",
    op_th_floor: "Cautious floor",
    op_th_trend: "Output trend",
    op_dir_rising: "Rising", op_dir_falling: "Falling", op_dir_steady: "Steady", op_dir_new: "new",
    op_trend_label: "Output trend", op_type_label: "Type", op_type_topics: "Topics", op_type_methods: "Methods",
    op_sort_lift: "Citation pull, high to low",
    op_sort_floor: "Cautious floor, high to low",
    op_sort_trend_desc: "Output, fastest rising",
    op_sort_trend_asc: "Output, fastest falling",
    op_caption: "Underserved niches, by citation pull and the direction of their output",
    op_empty_html: "No niches match. <button type=\"reset\" form=\"op-form\" class=\"linklike\">Reset.</button>",
    op_rowsub: "{lift} the field rate · at least {floor} at the cautious end · {n} cohort papers",
    op_method: "method",
    op_method_title: "A research method or study type, not a research topic. The figure is how often work using it is cited early.",
    op_spark_aria: "{label}, papers per year across the tracked years",
    op_new_head: "Recently emerged",
    op_new_sub: "These began only mid-decade, so there is no settled earlier window to compare their output against. Shown with their citation pull and latest paper count.",
    op_new_at: "{lift} the field · {n} papers in {y}",
    op_note_trend: "Output trend compares papers in {l0}-{l1} with the three years before, {e0}-{e1}. The current year, {y}, is still being added to by OpenAlex, so it shows in the trajectory but is kept out of the trend figure.",
    op_note_field: "‘vs field’ is how often a niche's recent papers are cited at least five times, set against the field's rate. It measures early attention, not importance or quality.",
    op_note_floor: "The cautious floor is the low end of a sampling range on that rate. A niche resting on a few dozen papers is less firm than one resting on several hundred, so read small cohorts with more caution.",
    op_note_conc: "A high ‘vs field’ figure can rest on one or two heavily cited papers; the count cannot tell a single influential paper from many.",
    op_note_method: "Four entries are research methods or study types, not topics: Meta-analysis, Eye-tracking, Replication study, and Narrative inquiry. They are marked, and can be hidden with the Type filter.",

    /* Construct detail */
    doc_title_construct: "Construct · Word on the Street",
    doc_desc_construct: "A construct's share of the field over time, its recent change, and a path to the works behind the numbers.",
    c_doc_title: "{label} · Word on the Street",
    c_not_found: "Construct not found",
    c_not_found_title: "Not found · Word on the Street",
    c_not_found_body_html: "That construct is not in the index. <a href=\"explore.html\">Browse all constructs</a>.",
    prov_curated: "Curated coinage",
    prov_openalex: "OpenAlex topic keyphrase",
    c_kicker: "{prov} · ranked {rank} of {total} by {refYear} share",
    c_sf_none: "Tracked across the field; no firm year-over-year change yet.",
    c_sf_flat: "Little changed through {refYear}, the last fully indexed year.",
    c_sf_down: "Fading through {refYear}, the last fully indexed year.",
    c_sf_up: "Rising through {refYear}, the last fully indexed year.",
    c_lede_none: "{label} accounted for {share} of the field's output in {refYear}.",
    c_lede_flat: "{label} accounted for {share} of the field's output in {refYear}, little changed on the year before.",
    c_lede_move: "{label} accounted for {share} of the field's output in {refYear}, {updown} {moved} on the year before.",
    c_up: "up", c_down: "down",
    c_chglab_none: "share in {refYear}, no firm year-over-year yet",
    c_fact_share: "Share in {refYear}",
    c_fact_change: "Change vs {priorYear}",
    c_fact_rank: "Rank",
    c_fact_rank_suffix: "of {total} by {refYear} share",
    c_fact_matched: "Matched works, {refYear}",
    c_fact_source: "Source",
    c_fact_earlycite: "Early-citation rate",
    c_earlycite_dd: "×{lift} the field ({span})",
    c_provisional: "{year} is still indexing, so its share is inflated; it is left off the chart and these figures.",
    c_provisional_leader: " It is among the fastest risers so far in {year}, by rank; the size of that move is not yet firm.",
    c_papers_note: "{label} matched about {n} works in {refYear}. The full list lives on OpenAlex, scoped exactly as the counts here are built.",
    c_numbers_head: "The numbers",
    c_read_papers_head: "Read the papers",
    c_oa_link: "View these works on OpenAlex →",
    c_oa_note: "Opens OpenAlex filtered to the two linguistics subfields and matched on title and abstract, the same rule behind the counts here. Individual papers are not stored, so the live list will differ slightly as indexing continues.",
    c_about_nums_cov_html: "Trends are share of the field's output, ranked on the last complete year. Read the full <a href=\"about.html\">methodology and limits</a>.",

    coverage_note: "Every figure is each construct's share of the OpenAlex-indexed, mostly-English journal literature."
  },

};

function curLang() { try { return localStorage.getItem("lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; } }

function T(key, vars) {
  var lang = curLang();
  var s = (STR[lang] && STR[lang][key]);
  if (s == null) s = (STR.en[key] != null ? STR.en[key] : key);
  if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ""; });
  return s;
}

/* ---- construct glossary (Arabic names), loaded on demand; English fallback for anything unmapped ---- */
var _glossary = null;
async function loadGlossary() {
  if (_glossary) return _glossary;
  try {
    var r = await fetch("data/constructs_ar.json", { cache: "no-cache" });
    if (r.ok) { var j = await r.json(); _glossary = (j && j.labels) ? j.labels : (j || {}); }
  } catch (e) { /* keep null -> treated as empty below */ }
  if (!_glossary) _glossary = {};
  return _glossary;
}
function cLabel(id, en) {
  if (curLang() === "ar" && _glossary && _glossary[id]) return _glossary[id];
  return en;
}
function cLabelBoth(id, en) {
  if (curLang() === "ar" && _glossary && _glossary[id]) return _glossary[id] + " (" + en + ")";
  return en;
}

/* ---- fill static markup from the table ---- */
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(function (el) { var v = T(el.getAttribute("data-i18n")); if (v != null) el.textContent = v; });
  document.querySelectorAll("[data-i18n-html]").forEach(function (el) { var v = T(el.getAttribute("data-i18n-html")); if (v != null) el.innerHTML = v; });
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) { var v = T(el.getAttribute("data-i18n-aria")); if (v != null) el.setAttribute("aria-label", v); });
  var d = document.documentElement;
  var tk = d.getAttribute("data-i18n-title"); if (tk) { var tv = T(tk); if (tv) document.title = tv; }
  var dk = d.getAttribute("data-i18n-desc"); if (dk) { var dv = T(dk); if (dv) { var m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute("content", dv); } }
}

/* ---- language button + switching ---- */
function updateLangButton() {
  var btn = document.getElementById("lang-toggle"); if (!btn) return;
  var lang = curLang();
  btn.textContent = lang === "ar" ? "EN" : "ع";              // the button shows the OTHER language
  btn.setAttribute("aria-label", lang === "ar" ? (STR.ar || STR.en).switch_to_en : STR.en.switch_to_ar);
}
/* The Arabic string table lives in i18n.ar.js and is fetched on demand the first time Arabic is
   needed (a click, ?lang=ar, or a saved preference), so English-default visitors never download it.
   Until it arrives T() falls back to English, so nothing breaks if the fetch is slow or fails. */
var _arLoaded = false, _arWaiters = null;
function ensureAr(cb) {
  if (_arLoaded || STR.ar) { cb(); return; }
  if (_arWaiters) { _arWaiters.push(cb); return; }
  _arWaiters = [cb];
  var s = document.createElement("script");
  s.src = "assets/i18n.ar.js?v=2";
  s.onload = function () { _arLoaded = true; var w = _arWaiters; _arWaiters = null; w.forEach(function (f) { f(); }); };
  s.onerror = function () { var w = _arWaiters; _arWaiters = null; w.forEach(function (f) { f(); }); };
  document.head.appendChild(s);
}
function applyLang() {
  updateLangButton();
  applyI18n();
  if (typeof window.refreshThemeLabel === "function") window.refreshThemeLabel();
  if (typeof window.renderI18n === "function") window.renderI18n();
}
function setLang(lang) {
  lang = lang === "ar" ? "ar" : "en";
  try { localStorage.setItem("lang", lang); } catch (e) { /* storage may be blocked */ }
  var d = document.documentElement;
  d.lang = lang; d.dir = lang === "ar" ? "rtl" : "ltr";   // direction flips at once; text follows once strings load
  if (lang === "ar") ensureAr(applyLang); else applyLang();
}
function initI18n() {
  updateLangButton();
  var btn = document.getElementById("lang-toggle");
  if (btn) btn.addEventListener("click", function () { setLang(curLang() === "ar" ? "en" : "ar"); });
  if (curLang() === "ar") ensureAr(applyLang); else applyI18n();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initI18n);
else initI18n();
