"""
Fetch the latest and most-cited works in the corpus, for the 'latest papers' feed.

We store ONLY metadata and links (title, authors, venue, year, DOI, open-access URL,
primary topic). We deliberately do NOT store or redisplay abstract text: OpenAlex's CC0
covers its metadata, not the publisher's copyright on abstract prose, so for a public
multi-year site we link out to the open-access full text instead.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import metrics
import openalex

ROOT = Path(__file__).resolve().parent.parent
FEED_DIR = ROOT / "data" / "feed"

SELECT = ",".join([
    "id", "doi", "title", "display_name", "publication_date", "publication_year",
    "cited_by_count", "primary_topic", "primary_location", "open_access", "authorships", "type",
])


def _authors(authorships: list, k: int = 4) -> list[str]:
    names = [a.get("author", {}).get("display_name", "") for a in (authorships or [])]
    names = [n for n in names if n]
    return names[:k] + (["et al."] if len(names) > k else [])


def _card(w: dict) -> dict:
    loc = w.get("primary_location") or {}
    src = (loc.get("source") or {}) if isinstance(loc, dict) else {}
    oa = w.get("open_access") or {}
    topic = w.get("primary_topic") or {}
    return {
        "id": w.get("id"),
        "title": w.get("title") or w.get("display_name") or "(untitled)",
        "authors": _authors(w.get("authorships")),
        "venue": (src.get("display_name") if isinstance(src, dict) else "") or "",
        "year": w.get("publication_year"),
        "date": w.get("publication_date"),
        "cited_by_count": w.get("cited_by_count", 0),
        "doi": w.get("doi"),
        "oa_url": oa.get("oa_url"),
        "topic": topic.get("display_name") if isinstance(topic, dict) else None,
        "type": w.get("type"),
    }


# Keep the feed to genuine scholarly outputs and drop OpenAlex's container/paratext records.
TYPES = "type:article|review|book|book-chapter|dissertation|preprint|report"

# Generic non-paper records that OpenAlex sometimes aggregates citations onto.
JUNK_TITLES = {
    "personal communication", "editorial", "introduction", "front matter",
    "back matter", "book review", "contents", "table of contents", "index",
    "preface", "untitled", "review", "erratum", "correction", "abstracts",
}


def _dedupe(cards: list[dict], limit: int) -> list[dict]:
    """Drop OpenAlex duplicate records (same paper re-indexed by several repositories)
    and obvious non-paper junk records."""
    seen: set[str] = set()
    out: list[dict] = []
    for c in cards:
        key = " ".join((c.get("title") or "").lower().split())
        if not key or key in seen or key in JUNK_TITLES:
            continue
        seen.add(key)
        out.append(c)
        if len(out) >= limit:
            break
    return out


def fetch_feed(scope: dict, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])
    today_s = today.isoformat()

    # Newest: last 90 days, never future-dated, most recent first.
    since_new = (today - dt.timedelta(days=90)).isoformat()
    newest = openalex.top_works(
        f"{base},{TYPES},from_publication_date:{since_new},to_publication_date:{today_s}",
        sort="publication_date:desc", per_page=40, select=SELECT)

    # Most prominent: most cited among works published in the last 24 months.
    since_cited = metrics.minus_years(today, 2).isoformat()
    prominent = openalex.top_works(
        f"{base},{TYPES},from_publication_date:{since_cited},to_publication_date:{today_s}",
        sort="cited_by_count:desc", per_page=40, select=SELECT)

    return {
        "as_of": today_s,
        "newest": _dedupe([_card(w) for w in newest], 15),
        "most_cited_recent": _dedupe([_card(w) for w in prominent], 15),
    }


def save_feed(feed: dict) -> Path:
    FEED_DIR.mkdir(parents=True, exist_ok=True)
    path = FEED_DIR / "latest_papers.json"
    path.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_feed() -> dict:
    path = FEED_DIR / "latest_papers.json"
    if not path.exists():
        return {"as_of": None, "newest": [], "most_cited_recent": []}
    return json.loads(path.read_text(encoding="utf-8"))
