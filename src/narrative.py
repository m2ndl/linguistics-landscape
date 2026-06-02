"""
Plain-language weekly narrative, built from templated sentences only.

There is NO LLM and no network call here, so this step can never fail, never costs
money, and never depends on a free tier that might disappear. An optional LLM rewrite
could be layered on later, but the site is fully functional without it.
"""
from __future__ import annotations


def _pct(x: float) -> str:
    return f"{x * 100:.2f}%"


def _points(x: float) -> str:
    return f"{x * 100:+.2f} points"


def weekly_narrative(trends: dict, totals: dict) -> str:
    parts: list[str] = []
    n = int(totals.get("count_recent", 0))
    parts.append(f"Over the trailing 12 months the indexed linguistics and language literature "
                 f"recorded about {n:,} works.")

    if trends.get("baseline_building"):
        parts.append("The observatory is still accumulating its baseline, so read these movements "
                     "as provisional rather than settled trends.")

    rising = trends.get("rising", [])
    cooling = trends.get("cooling", [])

    if rising:
        top = rising[0]
        tag = "a confirmed rise" if top.get("confirmed") else "an early rise"
        parts.append(f"The sharpest upward move is {top['label']}, now {_pct(top['share_recent'])} "
                     f"of output ({_points(top['yoy_share_change'])} year over year), {tag}.")
    if cooling:
        bottom = cooling[0]
        parts.append(f"The sharpest decline is {bottom['label']}, now {_pct(bottom['share_recent'])} "
                     f"({_points(bottom['yoy_share_change'])}).")

    if not rising and not cooling:
        parts.append("No topic cleared the volume and persistence thresholds for a trend this period.")

    return " ".join(parts)
