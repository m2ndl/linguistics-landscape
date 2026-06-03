"""
One-shot rebuild of the yearly construct series and the site data.

Thin CLI over series.build_yearly (the same data path the weekly run in src/harvest.py uses), kept
for manual rebuilds and first-time seeding. ~210 gentle group_by-publication_year calls, a few minutes.

Usage:  python scripts/build_series.py [--start-year 2014]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import metrics    # noqa: E402
import render     # noqa: E402
import series     # noqa: E402
import snapshots  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-year", type=int, default=2014)
    args = ap.parse_args(argv)

    scope = metrics.load_scope()
    series.build_yearly(scope, start_year=args.start_year, log=lambda m: print(m, flush=True))
    print(f"Done. {len(snapshots.list_dates())} snapshots on record.")
    render.build_all(scope)
    print("Rendered site data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
