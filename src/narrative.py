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


def weekly_narrative(trends: dict, totals: dict, current: dict | None = None) -> str:
    parts: list[str] = []
    ref_year = (trends.get("latest") or "")[:4]
    n = int(totals.get("count_recent", 0))
    if n:
        parts.append(f"In {ref_year}, the last fully indexed year, the linguistics and language "
                     f"literature recorded about {n:,} indexed works.")

    if trends.get("baseline_building"):
        parts.append("The observatory is still accumulating its baseline, so read these movements "
                     "as provisional rather than settled trends.")

    rising = trends.get("rising", [])
    cooling = trends.get("cooling", [])

    if rising:
        top = rising[0]
        tag = "a confirmed rise" if top.get("confirmed") else "an early rise"
        parts.append(f"The sharpest upward move was {top['label']}, reaching {_pct(top['share_recent'])} "
                     f"of output ({_points(top['yoy_share_change'])} year over year), {tag}.")
    if cooling:
        bottom = cooling[0]
        parts.append(f"The sharpest decline was {bottom['label']}, at {_pct(bottom['share_recent'])} "
                     f"({_points(bottom['yoy_share_change'])}).")

    if not rising and not cooling:
        parts.append("No construct cleared the volume and persistence thresholds for a trend this period.")

    if current and current.get("provisional") and current.get("leaders"):
        names = ", ".join(e["label"] for e in current["leaders"][:3])
        parts.append(f"So far in {current['year']}, the constructs gaining fastest are {names}, "
                     f"though that year is only partly indexed.")

    return " ".join(parts)
