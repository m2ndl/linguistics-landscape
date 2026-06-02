"""
Compute a field snapshot for a given reference date, and derive trends across snapshots.

The same compute_snapshot() is used for both the live weekly run (reference date =
today) and the historical backfill (reference date = a past month). That is what lets
the site launch with real history instead of a flat line: we replay the past using
publication-date windows.

All trend numbers are deterministic and reproducible from OpenAlex counts. No LLM,
no randomness. Trends are measured as SHARE of field output, never raw counts,
because the index itself grows over time.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import openalex
import snapshots

ROOT = Path(__file__).resolve().parent.parent


def load_scope() -> dict:
    return json.loads((ROOT / "config" / "scope.json").read_text(encoding="utf-8"))


def minus_years(d: dt.date, years: int) -> dt.date:
    try:
        return d.replace(year=d.year - years)
    except ValueError:          # 29 Feb in a non-leap target year
        return d.replace(year=d.year - years, day=28)


def _short_topic_id(key: str) -> str:
    # "https://openalex.org/T10265" -> "T10265"
    return (key or "").rstrip("/").split("/")[-1]


def _groups_to_maps(groups: list[dict]) -> tuple[dict[str, int], dict[str, str]]:
    counts: dict[str, int] = {}
    labels: dict[str, str] = {}
    for g in groups:
        tid = _short_topic_id(g.get("key", ""))
        if not tid or tid.lower() == "unknown":
            continue
        counts[tid] = int(g.get("count", 0))
        labels[tid] = g.get("key_display_name", tid)
    return counts, labels


def compute_snapshot(ref_date: dt.date, scope: dict | None = None) -> tuple[list[dict], dict[str, str]]:
    """Query OpenAlex and build the per-topic rows for a snapshot dated ref_date."""
    scope = scope or load_scope()
    ids = [s["id"] for s in scope["openalex"]["subfield_union"]]
    base = openalex.subfield_filter(ids)
    group_key = scope["openalex"]["topic_group_key"]

    recent_from, recent_to = minus_years(ref_date, 1), ref_date
    prior_from, prior_to = minus_years(ref_date, 2), recent_from - dt.timedelta(days=1)

    def window(d0: dt.date, d1: dt.date) -> str:
        return f"{base},from_publication_date:{d0.isoformat()},to_publication_date:{d1.isoformat()}"

    recent_counts, recent_labels = _groups_to_maps(openalex.group_works(window(recent_from, recent_to), group_key))
    prior_counts, _ = _groups_to_maps(openalex.group_works(window(prior_from, prior_to), group_key))

    total_recent = sum(recent_counts.values()) or 1
    total_prior = sum(prior_counts.values()) or 1

    taxonomy_version = hashlib.sha1(
        json.dumps(sorted(recent_labels.items()), ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:10]
    data_version = "default"

    date_str = ref_date.isoformat()
    rows: list[dict] = [{
        "snapshot_date": date_str, "dimension_type": "field_total",
        "dimension_id": "ALL", "dimension_label": "All linguistics (union)",
        "count_recent": total_recent, "count_prior": total_prior,
        "share_recent": 1.0, "share_prior": 1.0, "yoy_share_change": 0.0,
        "rank_recent": 0, "taxonomy_version": taxonomy_version, "data_version": data_version,
    }]

    ranked = sorted(recent_counts.items(), key=lambda kv: kv[1], reverse=True)
    for rank, (tid, c_recent) in enumerate(ranked, start=1):
        c_prior = prior_counts.get(tid, 0)
        share_recent = c_recent / total_recent
        share_prior = (c_prior / total_prior) if total_prior else 0.0
        rows.append({
            "snapshot_date": date_str, "dimension_type": "topic",
            "dimension_id": tid, "dimension_label": recent_labels.get(tid, tid),
            "count_recent": c_recent, "count_prior": c_prior,
            "share_recent": round(share_recent, 8), "share_prior": round(share_prior, 8),
            "yoy_share_change": round(share_recent - share_prior, 8),
            "rank_recent": rank, "taxonomy_version": taxonomy_version, "data_version": data_version,
        })
    return rows, recent_labels


# --- derivations over the accumulated snapshot history (pure, no network) ---

def _f(x, default=0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def build_timeseries(all_snaps: dict[str, list[dict]]) -> dict:
    """Per-topic share-of-field over time, for the charts."""
    series: dict[str, dict] = {}
    for date_str in sorted(all_snaps):
        for r in all_snaps[date_str]:
            if r.get("dimension_type") != "topic":
                continue
            tid = r["dimension_id"]
            s = series.setdefault(tid, {"label": r["dimension_label"], "points": []})
            s["label"] = r["dimension_label"]
            s["points"].append({
                "date": date_str,
                "share": _f(r.get("share_recent")),
                "count": int(_f(r.get("count_recent"))),
            })
    return series


def field_totals(all_snaps: dict[str, list[dict]]) -> dict:
    dates = sorted(all_snaps)
    if not dates:
        return {"count_recent": 0, "series": []}
    series = []
    latest_total = 0
    for d in dates:
        for r in all_snaps[d]:
            if r.get("dimension_type") == "field_total":
                c = int(_f(r.get("count_recent")))
                series.append({"date": d, "count": c})
                latest_total = c
    return {"count_recent": latest_total, "series": series}


def classify_trends(all_snaps: dict[str, list[dict]], scope: dict) -> dict:
    """Rising / cooling topics from the latest snapshot, with volume + persistence guards."""
    dates = sorted(all_snaps)
    g = scope["trends"]
    if not dates:
        return {"rising": [], "cooling": [], "snapshot_count": 0,
                "baseline_building": True, "latest": None}
    latest = dates[-1]
    min_works = g["min_works_per_window"]
    persistence = g["persistence_snapshots"]

    hist: dict[str, list] = {}
    labels: dict[str, str] = {}
    for d in dates:
        for r in all_snaps[d]:
            if r.get("dimension_type") != "topic":
                continue
            tid = r["dimension_id"]
            labels[tid] = r["dimension_label"]
            hist.setdefault(tid, []).append(
                (d, _f(r.get("yoy_share_change")), int(_f(r.get("count_recent"))), _f(r.get("share_recent")))
            )

    rising, cooling = [], []
    for tid, points in hist.items():
        last = points[-1]
        if last[0] != latest or last[2] < min_works:
            continue  # not in latest snapshot, or below the volume floor
        tail = points[-persistence:]
        confirmed = len(tail) >= persistence and (
            all(p[1] > 0 for p in tail) or all(p[1] < 0 for p in tail)
        )
        entry = {
            "id": tid, "label": labels[tid], "share_recent": last[3],
            "yoy_share_change": last[1], "count_recent": last[2], "confirmed": confirmed,
        }
        if last[1] > 0:
            rising.append(entry)
        elif last[1] < 0:
            cooling.append(entry)

    rising.sort(key=lambda e: e["yoy_share_change"], reverse=True)
    cooling.sort(key=lambda e: e["yoy_share_change"])
    return {
        "rising": rising[:12], "cooling": cooling[:12],
        "snapshot_count": len(dates), "latest": latest,
        "baseline_building": len(dates) < persistence,
    }
