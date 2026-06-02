"""
Build the static site's data files (docs/data/*.json) from stored snapshots + feed.

This step makes NO network calls. It reads the committed snapshot history and the saved
papers feed and writes the JSON the front-end fetches, so the site can always be rebuilt
offline and deterministically from what is in the repo.
"""
from __future__ import annotations

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

    trends = metrics.classify_trends(all_snaps, scope)
    totals = metrics.field_totals(all_snaps)
    series = metrics.build_timeseries(all_snaps)
    feed = papers.load_feed()

    # Keep trends.json light: only the topics we actually plot.
    shown = {e["id"] for e in trends["rising"]} | {e["id"] for e in trends["cooling"]}
    if dates:
        latest_topics = [r for r in all_snaps[dates[-1]] if r.get("dimension_type") == "topic"]
        latest_topics.sort(key=lambda r: _f(r.get("share_recent")), reverse=True)
        shown |= {r["dimension_id"] for r in latest_topics[:15]}
    series_out = {tid: series[tid] for tid in shown if tid in series}

    written = [
        _write("latest.json", {
            "site_name": scope["site_name"],
            "tagline": scope["tagline"],
            "as_of": trends.get("latest"),
            "generated_on": gen,
            "coverage_note": scope["coverage_note"],
            "baseline_building": trends.get("baseline_building", True),
            "totals": {"count_recent": totals["count_recent"]},
            "narrative": narrative.weekly_narrative(trends, totals),
            "rising": trends["rising"],
            "cooling": trends["cooling"],
            "papers": feed,
            "snapshot_count": trends.get("snapshot_count", len(dates)),
        }),
        _write("trends.json", {
            "snapshots": dates,
            "field_total_series": totals["series"],
            "topics": series_out,
        }),
        _write("meta.json", {
            "generated_on": gen,
            "snapshot_count": len(dates),
            "first_snapshot": dates[0] if dates else None,
            "latest_snapshot": dates[-1] if dates else None,
            "subfields": scope["openalex"]["subfield_union"],
        }),
    ]
    return written
