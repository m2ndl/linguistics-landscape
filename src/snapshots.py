"""
Read and write the yearly snapshot history (plain CSV, one file per data year).

Snapshots are keyed by the DATA year. Complete years (YYYY-12-31) are rewritten on each weekly run
so their counts firm up as OpenAlex finishes indexing them; the current year is kept as a single
dated partial. The immutable record lives in git: each weekly commit is a timestamped diff of exactly
what changed, so the longitudinal history is preserved at the commit level even though files are
refreshed. CSV is chosen so a non-technical owner can open any snapshot in Excel and read the diff.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAP_DIR = ROOT / "data" / "snapshots"
TAXO_DIR = ROOT / "data" / "taxonomy"

FIELDS = [
    "snapshot_date", "dimension_type", "dimension_id", "dimension_label",
    "count_recent", "count_prior", "share_recent", "share_prior",
    "yoy_share_change", "rank_recent", "taxonomy_version", "data_version",
]


def snapshot_path(date_str: str) -> Path:
    return SNAP_DIR / f"snapshot-{date_str}.csv"


def exists(date_str: str) -> bool:
    return snapshot_path(date_str).exists()


def remove_snapshot(date_str: str) -> None:
    """Delete a snapshot file if present (used to prune superseded current-year partials)."""
    path = snapshot_path(date_str)
    if path.exists():
        path.unlink()


def write_snapshot(date_str: str, rows: list[dict], *, overwrite: bool = False) -> Path:
    """Write one immutable snapshot file. Existing files are kept unless overwrite=True."""
    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    path = snapshot_path(date_str)
    if path.exists() and not overwrite:
        return path
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in FIELDS})
    return path


def list_dates() -> list[str]:
    if not SNAP_DIR.exists():
        return []
    return sorted(p.stem.replace("snapshot-", "") for p in SNAP_DIR.glob("snapshot-*.csv"))


def read_snapshot(date_str: str) -> list[dict]:
    path = snapshot_path(date_str)
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def read_all() -> dict[str, list[dict]]:
    return {d: read_snapshot(d) for d in list_dates()}


def write_taxonomy(date_str: str, topics: dict[str, str]) -> Path:
    """Snapshot the topic id->label map so taxonomy drift is detectable later."""
    TAXO_DIR.mkdir(parents=True, exist_ok=True)
    path = TAXO_DIR / f"topics-{date_str}.json"
    path.write_text(json.dumps(topics, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return path
