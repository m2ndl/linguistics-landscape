"""
Build the static site's data files (docs/data/*.json) from stored snapshots + feed.

This step makes NO network calls. It reads the committed snapshot history and the saved
papers feed and writes the JSON the front-end fetches, so the site can always be rebuilt
offline and deterministically from what is in the repo.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
from pathlib import Path

import metrics
import narrative
import papers
import snapshots

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "data"


def _f(x, default=0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _write(name: str, obj: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path


def build_all(scope: dict | None = None, generated_on: str | None = None) -> list[Path]:
    scope = scope or metrics.load_scope()
    all_snaps = snapshots.read_all()
    dates = sorted(all_snaps)
    gen = generated_on or dt.date.today().isoformat()

    # Firm movements are read from the latest COMPLETE year; the partial current year is
    # surfaced separately, by rank only (see metrics for why the partial-year % is unreliable).
    ref = metrics.latest_complete_date(all_snaps)
    trends = metrics.classify_trends(all_snaps, scope, reference_date=ref)
    current = metrics.current_year_leaders(all_snaps, scope)
    series = metrics.build_timeseries(all_snaps)
    feed = papers.load_feed()

    # The chart plots complete years only, so the partial current year cannot add a misleading
    # end-of-line uptick. The full series (including the partial year) still ships in constructs.csv.
    complete_dates = [d for d in dates if metrics.is_complete_year(d)]
    # Headline corpus figure is the last complete year, not the part-indexed current one.
    totals = metrics.field_totals(all_snaps, complete_dates or dates)

    # Keep trends.json light: only the constructs we actually plot.
    shown = {e["id"] for e in trends["rising"]} | {e["id"] for e in trends["cooling"]}
    shown |= {e["id"] for e in current["leaders"]}
    if complete_dates:
        latest_topics = [r for r in all_snaps[complete_dates[-1]] if r.get("dimension_type") == "construct"]
        latest_topics.sort(key=lambda r: _f(r.get("share_recent")), reverse=True)
        shown |= {r["dimension_id"] for r in latest_topics[:15]}
    series_out = {}
    for tid in shown:
        if tid not in series:
            continue
        pts = [p for p in series[tid]["points"] if metrics.is_complete_year(p["date"])]
        series_out[tid] = {"label": series[tid]["label"], "points": pts}

    written = [
        _write("latest.json", {
            "site_name": scope["site_name"],
            "tagline": scope["tagline"],
            "as_of": trends.get("latest"),
            "generated_on": gen,
            "coverage_note": scope["coverage_note"],
            "baseline_building": trends.get("baseline_building", True),
            "totals": {"count_recent": totals["count_recent"]},
            "narrative": narrative.weekly_narrative(trends, totals, current),
            "reference_year": (ref or "")[:4],
            "current_year": current,
            "rising": trends["rising"],
            "cooling": trends["cooling"],
            "papers": feed,
            "snapshot_count": trends.get("snapshot_count", len(dates)),
        }),
        _write("trends.json", {
            "snapshots": complete_dates,
            "field_total_series": [p for p in totals["series"] if metrics.is_complete_year(p["date"])],
            "topics": series_out,
        }),
        _write("meta.json", {
            "generated_on": gen,
            "snapshot_count": len(dates),
            "complete_year_count": len(complete_dates),
            "first_snapshot": dates[0] if dates else None,
            "latest_snapshot": dates[-1] if dates else None,
            "reference_year": (ref or "")[:4],
            "current_year": current.get("year"),
            "construct_count": sum(1 for r in all_snaps[dates[-1]] if r.get("dimension_type") == "construct") if dates else 0,
            "subfields": scope["openalex"]["subfield_union"],
        }),
    ]

    # Per-construct dataset for the Explore and construct-detail pages: every construct's full
    # complete-year share series plus summary fields (latest share, rank, firm year-over-year growth).
    ref_rows = all_snaps.get(ref, []) if ref else []
    constructs_out = []
    for r in ref_rows:
        if r.get("dimension_type") != "construct":
            continue
        cid = r["dimension_id"]
        sr, sp = _f(r.get("share_recent")), _f(r.get("share_prior"))
        growth = (sr / sp - 1.0) if sp > 0 else None
        pts = [{"year": int(p["date"][:4]), "share": round(p["share"], 9), "papers": int(p["count"])}
               for p in (series.get(cid, {}).get("points") or []) if metrics.is_complete_year(p["date"])]
        constructs_out.append({
            "id": cid, "label": r["dimension_label"], "source": r.get("data_version", ""),
            "latest_share": round(sr, 9), "latest_papers": int(_f(r.get("count_recent"))),
            "rank": int(_f(r.get("rank_recent"))),
            "growth": (round(growth, 6) if growth is not None else None),
            "series": pts,
        })
    constructs_out.sort(key=lambda c: (c["rank"] or 99999))
    written.append(_write("constructs.json", {
        "generated_on": gen,
        "reference_year": (ref or "")[:4],
        "current_year": current.get("year"),
        "complete_years": [int(d[:4]) for d in complete_dates],
        "count": len(constructs_out),
        "constructs": constructs_out,
    }))

    # Consolidated long-format dataset for download (the research-data-engine artifact).
    csv_path = OUT_DIR / "constructs.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["year", "construct_id", "construct", "source", "papers", "corpus_papers", "share"])
        for date in dates:
            corpus = next((int(_f(r.get("count_recent"))) for r in all_snaps[date]
                           if r.get("dimension_type") == "field_total"), 0)
            for r in all_snaps[date]:
                if r.get("dimension_type") != "construct":
                    continue
                w.writerow([date[:4], r["dimension_id"], r["dimension_label"], r.get("data_version", ""),
                            int(_f(r.get("count_recent"))), corpus, round(_f(r.get("share_recent")), 8)])
    written.append(csv_path)

    return written
