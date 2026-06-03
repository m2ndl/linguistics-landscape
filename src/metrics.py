"""
Compute a field snapshot for a given reference date, and derive trends across snapshots.

Two layers of signal are stored per snapshot:
  - field_total + topic rows  (the broad OpenAlex topic structure, background context)
  - construct rows            (specific named constructs/methods, the interesting layer;
                               computed in constructs.py and merged in by the harvester)

The same machinery serves the live weekly run and the historical backfill, so the site
launches with real history. All trend numbers are deterministic and reproducible. Trends
are measured as SHARE of corpus output, never raw counts, because the index grows over time.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import openalex
import snapshots  # noqa: F401  (kept for callers that import metrics)

ROOT = Path(__file__).resolve().parent.parent


def load_scope() -> dict:
    return json.loads((ROOT / "config" / "scope.json").read_text(encoding="utf-8"))


def minus_years(d: dt.date, years: int) -> dt.date:
    try:
        return d.replace(year=d.year - years)
    except ValueError:          # 29 Feb in a non-leap target year
        return d.replace(year=d.year - years, day=28)


def windows(ref_date: dt.date) -> tuple[tuple[dt.date, dt.date], tuple[dt.date, dt.date]]:
    recent = (minus_years(ref_date, 1), ref_date)
    prior = (minus_years(ref_date, 2), minus_years(ref_date, 1) - dt.timedelta(days=1))
    return recent, prior


def compute_corpus_totals(ref_date: dt.date, scope: dict | None = None):
    """Corpus work counts for the two windows, plus the field_total snapshot row.
    These are the shared denominator for all construct shares."""
    scope = scope or load_scope()
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])
    (r0, r1), (p0, p1) = windows(ref_date)

    def win(d0, d1):
        return f"{base},from_publication_date:{d0.isoformat()},to_publication_date:{d1.isoformat()}"

    tr = max(1, openalex.count_works(win(r0, r1)))
    tp = max(1, openalex.count_works(win(p0, p1)))
    field_total = {
        "snapshot_date": ref_date.isoformat(), "dimension_type": "field_total",
        "dimension_id": "ALL", "dimension_label": "All linguistics (union)",
        "count_recent": tr, "count_prior": tp, "share_recent": 1.0, "share_prior": 1.0,
        "yoy_share_change": 0.0, "rank_recent": 0, "taxonomy_version": "", "data_version": "default",
    }
    return {"recent": tr, "prior": tp}, field_total


def _short_topic_id(key: str) -> str:
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


def compute_snapshot(ref_date: dt.date, scope: dict | None = None):
    """
    Returns (rows, topic_labels, totals).
    rows: the field_total row + one row per OpenAlex topic.
    totals: {"recent": corpus_total_recent, "prior": corpus_total_prior}, used to
            normalise both topic and construct shares against the same denominator.
    """
    scope = scope or load_scope()
    ids = [s["id"] for s in scope["openalex"]["subfield_union"]]
    base = openalex.subfield_filter(ids)
    group_key = scope["openalex"]["topic_group_key"]
    (r0, r1), (p0, p1) = windows(ref_date)

    def win(d0, d1):
        return f"{base},from_publication_date:{d0.isoformat()},to_publication_date:{d1.isoformat()}"

    total_recent = max(1, openalex.count_works(win(r0, r1)))
    total_prior = max(1, openalex.count_works(win(p0, p1)))

    recent_counts, recent_labels = _groups_to_maps(openalex.group_works(win(r0, r1), group_key))
    prior_counts, _ = _groups_to_maps(openalex.group_works(win(p0, p1), group_key))

    taxonomy_version = hashlib.sha1(
        json.dumps(sorted(recent_labels.items()), ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:10]

    date_str = ref_date.isoformat()
    rows: list[dict] = [{
        "snapshot_date": date_str, "dimension_type": "field_total",
        "dimension_id": "ALL", "dimension_label": "All linguistics (union)",
        "count_recent": total_recent, "count_prior": total_prior,
        "share_recent": 1.0, "share_prior": 1.0, "yoy_share_change": 0.0,
        "rank_recent": 0, "taxonomy_version": taxonomy_version, "data_version": "default",
    }]
    for rank, (tid, c_recent) in enumerate(sorted(recent_counts.items(), key=lambda kv: kv[1], reverse=True), start=1):
        c_prior = prior_counts.get(tid, 0)
        sr, sp = c_recent / total_recent, (c_prior / total_prior if total_prior else 0.0)
        rows.append({
            "snapshot_date": date_str, "dimension_type": "topic",
            "dimension_id": tid, "dimension_label": recent_labels.get(tid, tid),
            "count_recent": c_recent, "count_prior": c_prior,
            "share_recent": round(sr, 9), "share_prior": round(sp, 9),
            "yoy_share_change": round(sr - sp, 9),
            "rank_recent": rank, "taxonomy_version": taxonomy_version, "data_version": "default",
        })
    return rows, recent_labels, {"recent": total_recent, "prior": total_prior}


# --- derivations over the accumulated snapshot history (pure, no network) ---

def _f(x, default=0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def build_timeseries(all_snaps: dict[str, list[dict]], dim_type: str = "construct") -> dict:
    series: dict[str, dict] = {}
    for date_str in sorted(all_snaps):
        for r in all_snaps[date_str]:
            if r.get("dimension_type") != dim_type:
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


def field_totals(all_snaps: dict[str, list[dict]], dates: list[str] | None = None) -> dict:
    dates = dates if dates is not None else sorted(all_snaps)
    series, latest_total = [], 0
    for d in dates:
        for r in all_snaps[d]:
            if r.get("dimension_type") == "field_total":
                c = int(_f(r.get("count_recent")))
                series.append({"date": d, "count": c})
                latest_total = c
    return {"count_recent": latest_total, "series": series}


def is_complete_year(date_str: str) -> bool:
    """A snapshot stands for a complete calendar year iff its date is that year's 31 Dec.
    build_series writes complete years as YYYY-12-31 and the partial current year as today's
    date, so this cleanly separates settled years from the still-indexing current one."""
    return bool(date_str) and date_str.endswith("-12-31")


def latest_complete_date(all_snaps: dict[str, list[dict]]) -> str | None:
    complete = [d for d in sorted(all_snaps) if is_complete_year(d)]
    return complete[-1] if complete else None


def classify_trends(all_snaps: dict[str, list[dict]], scope: dict, dim_type: str = "construct",
                    reference_date: str | None = None) -> dict:
    """
    Rising / cooling dimensions for a reference snapshot.
    Ranking is by RELATIVE growth in share (share_recent / share_prior), which is what makes
    "task-based teaching up 160%" possible, with a volume floor and a multi-snapshot
    persistence guard so a one-off blip cannot register as a trend.

    reference_date pins which snapshot the rising/cooling movement is read from. The site uses
    the latest COMPLETE year here, because the partial current year is only fractionally indexed
    and inflates every construct's share roughly uniformly (an artifact, not a trend). The current
    year is surfaced separately, by rank only, via current_year_leaders().
    """
    dates = sorted(all_snaps)
    g = scope["trends"]
    if not dates:
        return {"rising": [], "cooling": [], "snapshot_count": 0, "latest": None, "baseline_building": True}
    latest = reference_date or dates[-1]
    min_works, persistence = g["min_works_per_window"], g["persistence_snapshots"]

    # Only consider snapshots up to and including the reference date, so a later (partial)
    # snapshot never bleeds into the reference year's reading or its persistence tail.
    hist: dict[str, list] = {}
    labels: dict[str, str] = {}
    for d in dates:
        if d > latest:
            continue
        for r in all_snaps[d]:
            if r.get("dimension_type") != dim_type:
                continue
            tid = r["dimension_id"]
            labels[tid] = r["dimension_label"]
            hist.setdefault(tid, []).append((
                d, _f(r.get("yoy_share_change")), int(_f(r.get("count_recent"))),
                _f(r.get("share_recent")), _f(r.get("share_prior")),
            ))

    rising, cooling = [], []
    for tid, points in hist.items():
        d_, yoy, c_recent, s_recent, s_prior = points[-1]
        if d_ != latest or c_recent < min_works:
            continue
        growth = (s_recent / s_prior - 1.0) if s_prior > 0 else None
        tail = points[-persistence:]
        confirmed = len(tail) >= persistence and (all(p[1] > 0 for p in tail) or all(p[1] < 0 for p in tail))
        entry = {
            "id": tid, "label": labels[tid], "count_recent": c_recent,
            "share_recent": s_recent, "yoy_share_change": yoy, "growth": growth,
            "is_new": s_prior == 0 and s_recent > 0, "confirmed": confirmed,
        }
        if yoy > 0:
            rising.append(entry)
        elif yoy < 0:
            cooling.append(entry)

    rising.sort(key=lambda e: (float("inf") if e["growth"] is None else e["growth"]), reverse=True)
    cooling.sort(key=lambda e: (e["growth"] if e["growth"] is not None else 0.0))
    return {
        "rising": rising[:12], "cooling": cooling[:12],
        "snapshot_count": len(dates), "latest": latest,
        "baseline_building": len(dates) < persistence,
    }


def current_year_leaders(all_snaps: dict[str, list[dict]], scope: dict,
                         dim_type: str = "construct", top: int = 6) -> dict:
    """
    The current year's fastest-rising constructs, by RANK only.

    The latest snapshot is the still-indexing current year, where every construct's share is
    inflated roughly uniformly, so the growth PERCENTAGES are not trustworthy and are not shown.
    The ORDER, however, is robust to a uniform multiplicative inflation, so naming who is surging
    "this year so far" is honest where quoting how much would not be. Counts use a relaxed floor
    because only a fraction of the year is indexed.
    """
    dates = sorted(all_snaps)
    if not dates:
        return {"year": None, "provisional": False, "leaders": []}
    latest = dates[-1]
    provisional = not is_complete_year(latest)
    # Rank by relative growth, but keep the headline leaders substantial: a half-indexed year
    # makes tiny constructs (n in the teens) jump to the top on noise, so hold the floor up.
    floor = max(scope["trends"]["min_works_per_window"], 50)

    rows = []
    for r in all_snaps[latest]:
        if r.get("dimension_type") != dim_type:
            continue
        sr, sp = _f(r.get("share_recent")), _f(r.get("share_prior"))
        c = int(_f(r.get("count_recent")))
        if c < floor or sp <= 0:
            continue
        rows.append({
            "id": r["dimension_id"], "label": r["dimension_label"],
            "count_recent": c, "share_recent": sr, "ratio": sr / sp,
        })
    rows.sort(key=lambda e: e["ratio"], reverse=True)
    return {"year": latest[:4], "provisional": provisional, "leaders": rows[:top]}


def most_discussed(all_snaps: dict[str, list[dict]], dim_type: str = "construct", top: int = 12) -> list[dict]:
    dates = sorted(all_snaps)
    if not dates:
        return []
    rows = [r for r in all_snaps[dates[-1]] if r.get("dimension_type") == dim_type]
    rows.sort(key=lambda r: int(_f(r.get("count_recent"))), reverse=True)
    return [{
        "id": r["dimension_id"], "label": r["dimension_label"],
        "count_recent": int(_f(r.get("count_recent"))), "share_recent": _f(r.get("share_recent")),
    } for r in rows[:top]]
