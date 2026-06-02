"""
Minimal OpenAlex API client -- Python standard library only (no pip installs).

OpenAlex requires a free API key for /works queries as of 2026. Pass it via the
OPENALEX_API_KEY environment variable. Get a key at https://openalex.org/settings/api

The small reference endpoints (e.g. /subfields) are open and need no key, so we can
verify the corpus scope without one.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_BASE = "https://api.openalex.org"
USER_AGENT = "applied-linguistics-landscape/0.1 (research-trends observatory)"
POLITE_DELAY_SECONDS = 0.2          # gentle gap between calls
MAX_RETRIES = 4
# Characters OpenAlex expects to stay literal inside a filter value
# (colon separates key:value, | is OR, comma separates filters, / appears in some ids).
_SAFE = ":|/,"


class OpenAlexError(RuntimeError):
    """Any non-recoverable problem talking to OpenAlex."""


def _api_key() -> str | None:
    # 1) environment variable (used in CI via a GitHub secret)
    key = (os.environ.get("OPENALEX_API_KEY") or "").strip()
    if key:
        return key
    # 2) local convenience: a gitignored 'openalex.key' file at the project root,
    #    so you can run the pipeline on your own machine without exporting a variable.
    key_file = Path(__file__).resolve().parent.parent / "openalex.key"
    if key_file.exists():
        return key_file.read_text(encoding="utf-8").strip() or None
    return None


def require_key() -> None:
    if not _api_key():
        raise OpenAlexError(
            "OPENALEX_API_KEY is not set. OpenAlex requires a free API key for works "
            "queries. Get one at https://openalex.org/settings/api and set it as an "
            "environment variable locally, or as a GitHub Actions secret in CI."
        )


def _build_url(path: str, params: dict) -> str:
    q = dict(params or {})
    key = _api_key()
    if key:
        q["api_key"] = key
    return f"{API_BASE}/{path.lstrip('/')}?" + urllib.parse.urlencode(q, safe=_SAFE)


def get(path: str, params: dict | None = None) -> dict:
    """GET a JSON object from OpenAlex, with retries on transient errors."""
    url = _build_url(path, params or {})
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = resp.read().decode("utf-8")
            time.sleep(POLITE_DELAY_SECONDS)
            return json.loads(payload)
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(1.5 * (attempt + 1))
                continue
            body = ""
            try:
                body = e.read().decode("utf-8")[:600]
            except Exception:
                pass
            raise OpenAlexError(f"HTTP {e.code} for /{path.lstrip('/')}: {body}") from e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
            continue
    raise OpenAlexError(f"Failed after {MAX_RETRIES} retries for /{path.lstrip('/')}: {last_err}")


# --- open reference endpoints (no key needed) ---

def subfield(subfield_id: int) -> dict:
    """Authoritative subfield record, including display_name and works_count."""
    return get(f"subfields/{subfield_id}")


# --- works endpoints (key required) ---

def subfield_filter(subfield_ids: list[int]) -> str:
    """Build a works filter that ORs several subfields together (the corpus union)."""
    return "primary_topic.subfield.id:" + "|".join(str(s) for s in subfield_ids)


def count_works(filter_str: str) -> int:
    """Total number of works matching a filter (one cheap call)."""
    require_key()
    obj = get("works", {"filter": filter_str, "per-page": 1})
    return int((obj.get("meta") or {}).get("count", 0))


def group_works(filter_str: str, group_by: str, extra: dict | None = None) -> list[dict]:
    """
    Counts per group for a works query, returned in a single call.
    Each entry looks like {"key": ..., "key_display_name": ..., "count": N}.
    This is how we get per-topic counts cheaply without paging every paper.
    """
    require_key()
    params = {"filter": filter_str, "group_by": group_by, "per-page": 200}
    if extra:
        params.update(extra)
    return get("works", params).get("group_by", []) or []


def top_works(filter_str: str, sort: str = "cited_by_count:desc",
              per_page: int = 25, select: str | None = None) -> list[dict]:
    """A page of works for the 'most prominent papers' feed."""
    require_key()
    params = {"filter": filter_str, "sort": sort, "per-page": per_page}
    if select:
        params["select"] = select
    return get("works", params).get("results", []) or []
