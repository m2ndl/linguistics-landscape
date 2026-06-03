"""
One-time historical backfill of CONSTRUCT snapshots, so the site launches with real history.

For each date going back N years, compute the spine snapshot 'as if' run then, using OpenAlex
publication-date windows. Cost is ~2 calls per construct per snapshot, so use a modest cadence
(semiannual by default keeps a ~210-construct backfill inside the free daily budget).

Usage:  python scripts/backfill.py --years 6 --step-months 6
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import harvest      # noqa: E402
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
    ap = argparse.ArgumentParser(description="Backfill historical construct snapshots.")
    ap.add_argument("--years", type=int, default=6)
    ap.add_argument("--step-months", type=int, default=6)
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
            rows = harvest.build_snapshot(d, scope, overwrite=args.overwrite, fetch_papers=False)
            total = next((r["count_recent"] for r in rows if r["dimension_type"] == "field_total"), "?")
            print(f"  wrote {ds}  (corpus 12-mo: {total}, {len(rows) - 1} constructs)", flush=True)
            made += 1
        d = add_months(d, args.step_months)

    print(f"Backfill complete: {made} new snapshots, {len(snapshots.list_dates())} total on record.")
    if not args.no_render:
        render.build_all(scope)
        print("Rebuilt site data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
