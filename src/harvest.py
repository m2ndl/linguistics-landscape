"""
Weekly run: compute today's snapshot, refresh the latest-papers feed, rebuild the site.

This is what GitHub Actions calls every week. It is also safe to run by hand.

Fail-safe by design: if OpenAlex errors, compute_snapshot raises before anything is
written, so we never produce a partial snapshot or a half-built site. The last good
committed data simply stays in place and the workflow reports the failure.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

import metrics
import papers
import render
import snapshots


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Run a weekly Applied Linguistics Landscape update.")
    ap.add_argument("--date", help="Reference date YYYY-MM-DD (default: today)")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite today's snapshot if it exists")
    ap.add_argument("--render-only", action="store_true", help="Skip harvest; rebuild the site from stored data")
    args = ap.parse_args(argv)

    scope = metrics.load_scope()
    ref = dt.date.fromisoformat(args.date) if args.date else dt.date.today()

    if not args.render_only:
        rows, topic_labels = metrics.compute_snapshot(ref, scope)        # network: 2 calls
        snapshots.write_snapshot(ref.isoformat(), rows, overwrite=args.overwrite)
        snapshots.write_taxonomy(ref.isoformat(), topic_labels)
        papers.save_feed(papers.fetch_feed(scope, ref))                  # network: 2 calls

    written = render.build_all(scope, generated_on=ref.isoformat())
    print(f"OK: wrote {len(written)} site data files; "
          f"{len(snapshots.list_dates())} snapshots on record.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
