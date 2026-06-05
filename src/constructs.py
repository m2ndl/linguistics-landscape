"""
Track A: count how often each spine construct appears in the corpus, per window.

For each construct in config/spine.json (the clean, OpenAlex-maintained vocabulary), one OpenAlex
count per 12-month window via title_and_abstract.search. Shares are normalised by the corpus totals
from metrics.compute_corpus_totals, so construct and field numbers use the same denominator.

This is the clean, credible 'findings' layer. The vocabulary is crowd-curated upstream (OpenAlex
topic keyphrases + a few newer coinages); nobody maintains a list by hand each week.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import metrics
import openalex

ROOT = Path(__file__).resolve().parent.parent
SPINE_PATH = ROOT / "config" / "spine.json"


def _spine_cfg() -> dict:
    return json.loads(SPINE_PATH.read_text(encoding="utf-8"))


def load_spine() -> list[dict]:
    return _spine_cfg().get("constructs", [])


def compute_rows(ref_date: dt.date, scope: dict, totals: dict) -> list[dict]:
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])
    (r0, r1), (p0, p1) = metrics.windows(ref_date)
    total_recent = max(1, int(totals.get("recent", 1)))
    total_prior = max(1, int(totals.get("prior", 1)))
    version = "spine-" + str(_spine_cfg().get("version", ""))
    date_str = ref_date.isoformat()

    def count(d0: dt.date, d1: dt.date, q: str) -> int:
        f = (f"{base},from_publication_date:{d0.isoformat()},to_publication_date:{d1.isoformat()}"
             f",title_and_abstract.search:{openalex.search_term(q)}")
        return openalex.count_works(f)

    measured = []
    for c in load_spine():
        rc = count(r0, r1, c["q"])
        pc = count(p0, p1, c["q"])
        measured.append((c, rc, pc))

    measured.sort(key=lambda m: m[1], reverse=True)
    rows = []
    for rank, (c, rc, pc) in enumerate(measured, start=1):
        sr = rc / total_recent
        sp = (pc / total_prior) if total_prior else 0.0
        rows.append({
            "snapshot_date": date_str, "dimension_type": "construct",
            "dimension_id": c["id"], "dimension_label": c["label"],
            "count_recent": rc, "count_prior": pc,
            "share_recent": round(sr, 9), "share_prior": round(sp, 9),
            "yoy_share_change": round(sr - sp, 9),
            "rank_recent": rank, "taxonomy_version": version, "data_version": c.get("source", ""),
        })
    return rows
