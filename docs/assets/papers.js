"use strict";

/* Word on the Street -- Papers. The fuller latest / most-cited feed (the front page shows a short
   slice). Loads data/latest.json and renders both lists with the shared row helpers. Depends on util.js. */

async function main() {
  const latest = await getJSON("data/latest.json");
  const p = (latest && latest.papers) || {};
  setHTML("newest", (p.newest || []).map(paperRow).join("") || emptyLi("No recent papers found."));
  setHTML("most-cited", (p.most_cited_recent || []).map(citedRow).join("") || emptyLi("No citation data yet."));
  if (p.as_of) setText("as-of", `As of ${p.as_of}.`);
}

main();
