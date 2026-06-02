"""
Quick connectivity + scope check. Run this after putting your key in 'openalex.key':

    python scripts/check_api.py

It tells you whether the key works and how many works the corpus filter matches.
Handy any time the site stops updating and you want to know if the key is the problem.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import openalex  # noqa: E402


def main() -> int:
    if not openalex._api_key():
        print("No API key found. Put your key in 'openalex.key', or set OPENALEX_API_KEY.")
        return 1
    print("API key found.")

    variants = [
        "primary_topic.subfield.id:1203|3310",
        "primary_topic.subfield.id:subfields/1203|subfields/3310",
    ]
    best = None
    for f in variants:
        try:
            c = openalex.count_works(f)
            print(f"  filter {f!r} -> {c:,} works")
            if c and not best:
                best = f
        except Exception as e:
            print(f"  filter {f!r} -> ERROR {e}")

    if not best:
        print("No filter variant returned results. Check the key and OpenAlex status.")
        return 1

    print(f"Working filter: {best}")
    groups = openalex.group_works(
        best + ",from_publication_date:2025-06-01,to_publication_date:2026-06-01",
        "primary_topic.id",
    )
    print(f"  topics in the last 12 months: {len(groups)}")
    for g in groups[:10]:
        print(f"    {int(g.get('count', 0)):>7,}  {g.get('key_display_name')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
