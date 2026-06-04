"use strict";

/* Word on the Street -- Niches ("Underserved niches"). Loads data/gaps.json once and renders the full
   `all` list of niche constructs as a table, then filters/sorts entirely in memory. A niche is a
   construct whose settled-cohort papers were cited well above the field's rate while its literature is
   still thin; `lift` is that early-citation rate over the field's. Bilingual: names come from the
   glossary (Arabic name with the English original in parentheses), search matches either script, and
   name-sort follows the displayed language. Depends on util.js + i18n.js. */

let NICHES = [];
const nodeById = new Map();
let qInput, sortSel, rowsTbody, emptyP, resetBtn, form;
let META = { count: 0, cohortYears: [] };

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

function rowHTML(c) {
  return `<tr class="crow" id="row-${escapeHtml(c.id)}">
    <td class="c-name"><a href="construct.html?id=${encodeURIComponent(c.id)}">${escapeHtml(cLabelBoth(c.id, c.label))}</a></td>
    <td class="c-lift">${escapeHtml(T("ni_lift_val", { x: c.lift.toFixed(1) }))}</td>
    <td class="c-vol">${INT(c.cohort_volume)}</td>
  </tr>`;
}

function buildRows() {
  rowsTbody.innerHTML = NICHES.map(rowHTML).join("");
  nodeById.clear();
  NICHES.forEach(c => nodeById.set(c.id, document.getElementById("row-" + c.id)));
}

function currentQuery() {
  const params = new URLSearchParams();
  if (qInput.value.trim()) params.set("q", qInput.value.trim());
  if (sortSel.value !== "lift_desc") params.set("sort", sortSel.value);
  return params.toString();
}

function offDefault() {
  return Boolean(qInput.value.trim()) || sortSel.value !== "lift_desc";
}

function applyView() {
  const qRaw = qInput.value.trim();
  const qLat = normKey(qRaw), qAr = normKeyAr(qRaw);
  const lang = curLang() === "ar" ? "ar" : "en";
  let list = NICHES.filter(c => {
    if (!qRaw) return true;
    return (qLat && c._key.includes(qLat)) || (qAr && c._keyAr && c._keyAr.includes(qAr));
  });
  const cmp = {
    lift_desc: (a, b) => b.lift - a.lift,
    vol_asc: (a, b) => a.cohort_volume - b.cohort_volume,
    vol_desc: (a, b) => b.cohort_volume - a.cohort_volume,
    name_asc: (a, b) => cLabel(a.id, a.label).localeCompare(cLabel(b.id, b.label), lang),
  }[sortSel.value] || ((a, b) => b.lift - a.lift);
  list.sort(cmp);

  const visible = new Set(list.map(c => c.id));
  NICHES.forEach(c => { const n = nodeById.get(c.id); if (n) n.classList.toggle("is-hidden", !visible.has(c.id)); });
  const frag = document.createDocumentFragment();
  list.forEach(c => frag.appendChild(nodeById.get(c.id)));
  rowsTbody.appendChild(frag);

  setText("shown", list.length);
  emptyP.classList.toggle("hidden", list.length !== 0);
  resetBtn.classList.toggle("hidden", !offDefault());
  const qs = currentQuery();
  history.replaceState(null, "", qs ? "niches.html?" + qs : "niches.html");
}

function readURL() {
  const p = new URLSearchParams(location.search);
  if (p.get("q")) qInput.value = p.get("q");
  const sort = p.get("sort");
  if (sort && [...sortSel.options].some(o => o.value === sort)) sortSel.value = sort;
}

function cohortLabel() {
  const cy = META.cohortYears || [];
  if (!cy.length) return T("gaps_cohort_fallback");
  return `${cy[0]} ${curLang() === "ar" ? "إلى" : "to"} ${cy[cy.length - 1]}`;
}

function renderChrome() {
  applyI18n();                                              // also rewrites the gaps_intro note (resets #gaps-window)
  setText("total", META.count);
  const win = document.getElementById("gaps-window");       // keep the stated cohort window in sync with the data
  if (win) win.textContent = cohortLabel();
  qInput.setAttribute("placeholder", T("ni_search_ph", { n: META.count }));
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

  const data = await getJSON("data/gaps.json");
  const all = (data && (data.all || data.gaps)) || [];
  if (!all.length) {                                        // no niche data yet: show the warming notice, and keep it correct across a language toggle
    emptyP.removeAttribute("data-i18n-html");
    emptyP.setAttribute("data-i18n", "ex_warming");
    window.renderI18n = applyI18n;
    applyI18n();
    emptyP.classList.remove("hidden");
    return;
  }

  NICHES = all.map(c => ({ ...c, _key: normKey(c.label) }));
  await loadGlossary();
  NICHES.forEach(c => { c._keyAr = normKeyAr((_glossary && _glossary[c.id]) || ""); });
  META = { count: NICHES.length, cohortYears: (data && data.cohort_years) || [] };

  buildRows();
  readURL();
  renderChrome();
  applyView();

  window.renderI18n = onLangChange;

  let searchTimer;
  qInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(applyView, 120); });
  sortSel.addEventListener("change", applyView);
  form.addEventListener("reset", () => setTimeout(applyView, 0));
}

main();
