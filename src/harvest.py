"""
Weekly run: rebuild the yearly construct series, refresh the papers feed, rebuild the site.

The data path is the cheap group_by-publication_year rebuild in series.build_yearly. Re-running it
each week refreshes recent years as OpenAlex finishes indexing them and rolls a new year in by itself,
so the site stays current with no manual step. All network reads happen before any write, so a fetch
error fails the run before it can publish a half-built update.

build_snapshot() (a single rolling-window snapshot) is retained only for the historical backfill
helper (scripts/backfill.py); it is not on the weekly path.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

import constructs
import gaps
import metrics
import papers
import radar
import render
import series
import snapshots


def build_snapshot(ref: dt.date, scope: dict, overwrite: bool = False, fetch_papers: bool = False):
    """Legacy single rolling-12-month snapshot for a reference date (used by scripts/backfill.py)."""
    totals, field_total = metrics.compute_corpus_totals(ref, scope)       # 2 calls
    rows = [field_total] + constructs.compute_rows(ref, scope, totals)    # ~2 calls per construct
    snapshots.write_snapshot(ref.isoformat(), rows, overwrite=overwrite)
    if fetch_papers:
        papers.save_feed(papers.fetch_feed(scope, ref))                   # 2 calls
    return rows


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Run a weekly Word on the Street update.")
    ap.add_argument("--date", help="Reference date YYYY-MM-DD (default: today)")
    ap.add_argument("--render-only", action="store_true", help="Rebuild the site from stored data only")
    args = ap.parse_args(argv)

    scope = metrics.load_scope()
    ref = dt.date.fromisoformat(args.date) if args.date else dt.date.today()

    if not args.render_only:
        series.build_yearly(scope, today=ref, log=lambda m: print(m, flush=True))   # yearly construct series (firm)
        papers.save_feed(papers.fetch_feed(scope, ref))                             # latest-papers feed
        # Track B and the gap finder are EXPERIMENTAL sidecars. Guard each so a failure here can never
        # block the firm site (the spine series + papers feed have already been written above).
        # Track B radar PARKED 2026-06-03: its rising-phrase quality is not ship-worthy yet (mostly
        # field-generic vocabulary; see project/LOG.md), so the heavy ~70-min harvest is skipped weekly
        # until the scoring is tuned and a frontend is built. Flip RUN_RADAR to re-enable.
        RUN_RADAR = False
        if RUN_RADAR:
            try:
                radar.build_radar(scope, ref, log=lambda m: print(m, flush=True))
            except Exception as e:                                                   # noqa: BLE001
                print(f"WARN: radar (Track B) failed, skipping: {e}", flush=True)
        try:
            gaps.build_gaps(scope, ref, log=lambda m: print(m, flush=True))
        except Exception as e:                                                       # noqa: BLE001
            print(f"WARN: gap finder failed, skipping: {e}", flush=True)

    render.build_all(scope, generated_on=ref.isoformat())
    print(f"OK: {len(snapshots.list_dates())} snapshots on record; site data rebuilt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
