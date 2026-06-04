"use strict";

/* Word on the Street -- Papers. The fuller latest / most-cited feed (the front page shows a short
   slice). Loads data/latest.json once; render() paints both lists with the shared row helpers and is
   re-run on a language switch. Depends on util.js + i18n.js. */

let _latest = null;

function render() {
  applyI18n();
  const p = (_latest && _latest.papers) || {};
  setHTML("newest", (p.newest || []).map(paperRow).join("") || emptyLi(T("no_papers")));
  setHTML("most-cited", (p.most_cited_recent || []).map(citedRow).join("") || emptyLi(T("no_citations")));
  setText("as-of", p.as_of ? T("pp_as_of", { date: p.as_of }) : "");
}

async function main() {
  _latest = await getJSON("data/latest.json");
  window.renderI18n = render;
  render();
}

main();
