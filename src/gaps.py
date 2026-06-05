"""
Gap finder: underserved niches -- constructs cited early at well above the field's rate, while the
literature on them is still thin (candidate angles for a next paper or dissertation).

The honest core is COHORT NORMALIZATION. Citations accrue with age, so any raw "citations rising"
reading is dominated by citation lag, not impact (every recent year looks like it is cooling). We fix
the cohort to a SETTLED trailing 3-year block ending two years before the current year (for a 2026 run:
2022-2024), so every construct is measured at the same paper age, then divide by the FIELD's own rate so
the uniform lag inflation cancels:

    early_cite_rate(construct) = cohort papers with >=5 citations / cohort papers
    lift = early_cite_rate(construct) / early_cite_rate(field)

A gap = lift >= LIFT_MIN and the cohort volume is in [VOL_MIN, VOL_MAX] (small enough to be underserved,
big enough not to be noise). Surfaces CONSTRUCTS only (never people), so it is safe to publish.

Runs as a SEPARATE, guarded pass after Track A in the weekly harvest, writing its own sidecar
docs/data/gaps.json. It does NOT touch series.py or snapshots.py, so a failure here cannot break the
firm spine. Standard library only.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import openalex
import snapshots
from constructs import load_spine

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "docs" / "data" / "gaps.json"
GAPS_DIR = ROOT / "data" / "gaps"

LIFT_MIN = 2.0
VOL_MIN = 20
VOL_MAX = 400
CITE_BAR = 4            # cited_by_count:>4  i.e. >= 5 citations
SHOW = 8


def _f(x) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def _cohort_years(ref: dt.date) -> list[int]:
    cur = ref.year
    return [cur - 4, cur - 3, cur - 2]


def build_gaps(scope: dict, ref: dt.date | None = None, log=lambda *_: None, write: bool = True) -> dict:
    ref = ref or dt.date.today()
    years = _cohort_years(ref)
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])

    # Cohort denominators come for free from the snapshots Track A already wrote (no extra calls).
    all_snaps = snapshots.read_all()
    vol: dict[str, int] = {}
    labels: dict[str, str] = {}
    field_vol = 0
    for y in years:
        for r in all_snaps.get(f"{y}-12-31", []):
            if r.get("dimension_type") == "construct":
                cid = r["dimension_id"]
                vol[cid] = vol.get(cid, 0) + int(_f(r.get("count_recent")))
                labels[cid] = r.get("dimension_label", cid)
            elif r.get("dimension_type") == "field_total":
                field_vol += int(_f(r.get("count_recent")))
    if field_vol == 0:
        log("Gaps: no cohort snapshots available; skipping.")
        return {"gaps": []}

    def cited_in_cohort(filter_str: str) -> int:
        total = 0
        for g in openalex.group_works(filter_str, "publication_year"):
            try:
                if int(g["key"]) in years:
                    total += int(g["count"])
            except (TypeError, ValueError, KeyError):
                continue
        return total

    # Field baseline rate (one call).
    field_cited = cited_in_cohort(f"{base},cited_by_count:>{CITE_BAR}")
    field_rate = field_cited / max(1, field_vol)
    log(f"Gaps: field early-cite rate = {field_rate:.4f} ({field_cited}/{field_vol}, cohort {years[0]}-{years[-1]}).")

    # Per-construct numerator (one call each, guarded so one failure cannot abort the run).
    rows = []
    spine = load_spine()
    for i, c in enumerate(spine, 1):
        cid = c["id"]
        v = vol.get(cid, 0)
        if v < VOL_MIN or v > VOL_MAX:          # only the underserved-volume band is eligible
            continue
        try:
            num = cited_in_cohort(f"{base},title_and_abstract.search:{openalex.search_term(c['q'])},cited_by_count:>{CITE_BAR}")
        except openalex.OpenAlexError:
            continue
        rate = num / v
        lift = rate / field_rate if field_rate > 0 else 0.0
        if lift >= LIFT_MIN:
            rows.append({
                "id": cid, "label": labels.get(cid, c["label"]),
                "lift": round(lift, 2), "cohort_volume": v,
                "early_cite_rate": round(rate, 4), "cited": num,
            })
        if i % 50 == 0:
            log(f"  gaps scored {i}/{len(spine)}")

    rows.sort(key=lambda r: r["lift"], reverse=True)
    out = {
        "generated_on": ref.isoformat(),
        "cohort_years": years,
        "field_rate": round(field_rate, 4),
        "gaps": rows,
    }
    if write:
        GAPS_DIR.mkdir(parents=True, exist_ok=True)
        (GAPS_DIR / f"gaps-{ref.isoformat()}.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(json.dumps({**out, "gaps": rows[:SHOW], "all": rows}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        log(f"Gaps: wrote {OUT_PATH.name} ({len(rows)} niches; top {min(SHOW, len(rows))} shown).")
    return out
