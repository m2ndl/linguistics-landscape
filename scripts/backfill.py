"""
One-time historical backfill: replay the past so the site launches with real history
instead of a flat line.

For each month going back N years, we compute a snapshot 'as if' the site had run then,
using OpenAlex publication-date windows. Older windows are fully indexed, so this gives
an accurate multi-year baseline. Run this ONCE before (or just after) the first deploy.

Usage:
    python scripts/backfill.py --years 8 --step-months 3
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import metrics      # noqa: E402
import render       # noqa: E402
import snapshots    # noqa: E402


def add_months(d: dt.date, months: int) -> dt.date:
    y, m = d.year, d.month + months
    while m > 12:
        m -= 12
        y += 1
    while m < 1:
        m += 12
        y -= 1
    return dt.date(y, m, 1)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Backfill historical snapshots.")
    ap.add_argument("--years", type=int, default=8, help="How many years back to seed")
    ap.add_argument("--step-months", type=int, default=3, help="Spacing between historical snapshots")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--no-render", action="store_true")
    args = ap.parse_args(argv)

    scope = metrics.load_scope()
    today = dt.date.today().replace(day=1)
    start = add_months(today, -args.years * 12)

    d, made = start, 0
    while d <= today:
        ds = d.isoformat()
        if snapshots.exists(ds) and not args.overwrite:
            print(f"  skip  {ds} (exists)")
        else:
            rows, labels = metrics.compute_snapshot(d, scope)
            snapshots.write_snapshot(ds, rows, overwrite=args.overwrite)
            snapshots.write_taxonomy(ds, labels)
            total = next((r["count_recent"] for r in rows if r["dimension_type"] == "field_total"), "?")
            print(f"  wrote {ds}  (12-month works: {total})")
            made += 1
        d = add_months(d, args.step_months)

    print(f"Backfill complete: {made} new snapshots, {len(snapshots.list_dates())} total on record.")
    if not args.no_render:
        render.build_all(scope)
        print("Rebuilt site data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
