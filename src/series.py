"""
Build the construct trend data as YEARLY snapshots, cheaply, via one group_by-publication_year
call per construct.

This is the SINGLE data path for both the one-shot CLI (scripts/build_series.py) and the weekly
run (src/harvest.py). group_by publication_year returns a construct's whole yearly history in ONE
call, so the entire ~200-construct series costs ~210 calls total, runs in a few minutes, and stays
well under the OpenAlex free tier. Re-running it each week refreshes recent years as OpenAlex
finishes indexing them (git history then shows the numbers firm up) and rolls a new year in by itself.

Snapshots are keyed by the DATA year, not the run date: complete years are written as YYYY-12-31
and overwritten on each run; the still-incomplete current year is written under the run date, and
is the only non-12-31 snapshot kept (older current-year partials are pruned each run so they do not
pile up). All network reads happen before any file is written, so a fetch error fails the run before
it can leave a half-built series behind.
"""
from __future__ import annotations

import datetime as dt

import constructs
import openalex
import snapshots


def year_counts(filter_str: str) -> dict[int, int]:
    out: dict[int, int] = {}
    for g in openalex.group_works(filter_str, "publication_year"):
        try:
            out[int(g["key"])] = int(g["count"])
        except (TypeError, ValueError):
            continue
    return out


def build_yearly(scope: dict, start_year: int = 2014, today: dt.date | None = None, log=lambda *_: None) -> list[str]:
    """Fetch the whole yearly series and write one snapshot per year. Returns the dates written."""
    today = today or dt.date.today()
    cur = today.year
    today_s = today.isoformat()
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])

    log("Corpus yearly totals...")
    corpus = year_counts(base)

    spine = constructs.load_spine()
    log(f"Fetching yearly counts for {len(spine)} constructs (one call each)...")
    cdata: dict[str, dict] = {}
    for i, c in enumerate(spine, 1):
        f = f"{base},title_and_abstract.search:{openalex.search_term(c['q'])}"
        cdata[c["id"]] = {"label": c["label"], "src": c.get("source", ""), "years": year_counts(f)}
        if i % 40 == 0:
            log(f"  {i}/{len(spine)}")

    years = [y for y in range(start_year, cur + 1) if corpus.get(y, 0) > 0]
    log(f"Writing {len(years)} yearly snapshots ({years[0]}..{years[-1]})...")
    written: list[str] = []
    for y in years:
        ct = max(1, corpus.get(y, 0))
        cp = max(1, corpus.get(y - 1, 0))
        date_str = f"{y}-12-31" if y < cur else today_s
        rows = [{
            "snapshot_date": date_str, "dimension_type": "field_total",
            "dimension_id": "ALL", "dimension_label": "All linguistics (union)",
            "count_recent": ct, "count_prior": cp, "share_recent": 1.0, "share_prior": 1.0,
            "yoy_share_change": 0.0, "rank_recent": 0, "taxonomy_version": "spine-year", "data_version": "",
        }]
        ranked = sorted(cdata.items(), key=lambda kv: kv[1]["years"].get(y, 0), reverse=True)
        for rank, (cid, d) in enumerate(ranked, 1):
            rc = d["years"].get(y, 0)
            pc = d["years"].get(y - 1, 0)
            sr, sp = rc / ct, pc / cp
            rows.append({
                "snapshot_date": date_str, "dimension_type": "construct",
                "dimension_id": cid, "dimension_label": d["label"],
                "count_recent": rc, "count_prior": pc,
                "share_recent": round(sr, 9), "share_prior": round(sp, 9),
                "yoy_share_change": round(sr - sp, 9),
                "rank_recent": rank, "taxonomy_version": "spine-year", "data_version": d["src"],
            })
        snapshots.write_snapshot(date_str, rows, overwrite=True)
        written.append(date_str)

    # Keep exactly one current-year partial (today's). Prune any older non-12-31 snapshots so weekly
    # runs do not accumulate a year's worth of intermediate current-year files.
    for d in snapshots.list_dates():
        if not d.endswith("-12-31") and d != today_s:
            snapshots.remove_snapshot(d)

    return written
