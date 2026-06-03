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
# Identify ourselves to OpenAlex's "polite pool" (a public URL is enough; no personal data).
USER_AGENT = "applied-linguistics-landscape/0.2 (+https://m2ndl.github.io/applied-linguistics-landscape/)"
# Optional contact for the polite pool; set OPENALEX_MAILTO locally / as a CI secret if desired.
_MAILTO = (os.environ.get("OPENALEX_MAILTO") or "").strip()
POLITE_DELAY_SECONDS = 1.0          # gentle gap between calls; reliability over speed
MAX_RETRIES = 6
# Once the API key's daily budget is spent, latch to the free keyless pool for the rest of the run.
_budget_blocked = False
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
    """Kept for call-site compatibility. A key is now OPTIONAL: /works is reachable through
    OpenAlex's free polite pool, and get() falls back to it automatically when no key (or no
    remaining budget) is available, so this no longer raises."""
    return None


def _read_body(e: urllib.error.HTTPError) -> str:
    try:
        return e.read().decode("utf-8")[:600]
    except Exception:
        return ""


def _build_url(path: str, params: dict, use_key: bool = True) -> str:
    q = dict(params or {})
    key = _api_key() if use_key else None
    if key:
        q["api_key"] = key
    if _MAILTO and "mailto" not in q:
        q["mailto"] = _MAILTO          # polite-pool identification, esp. when running keyless
    # quote_via=quote so spaces become %20 (needed for multi-word search filters)
    return f"{API_BASE}/{path.lstrip('/')}?" + urllib.parse.urlencode(q, safe=_SAFE, quote_via=urllib.parse.quote)


def get(path: str, params: dict | None = None) -> dict:
    """GET a JSON object from OpenAlex, with retries on transient errors.

    Auth: the API key is used when present, but OpenAlex now bills per call against a daily
    budget. When that budget is spent it returns 429 with a Retry-After of several hours; rather
    than sleep until the midnight-UTC reset, we latch to the free, keyless polite pool for the
    rest of the run. So a spent budget degrades to 'slightly slower', never a multi-hour stall.
    """
    global _budget_blocked
    params = params or {}
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        url = _build_url(path, params, use_key=not _budget_blocked)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = resp.read().decode("utf-8")
            time.sleep(POLITE_DELAY_SECONDS)
            return json.loads(payload)
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                body = _read_body(e)
                ra = e.headers.get("Retry-After") if e.headers else None
                ra_s = int(ra) if (ra and str(ra).isdigit()) else None
                # Budget/credit exhaustion (resets at midnight UTC): a key was in use and the
                # server is telling us to wait hours. Drop the key and retry on the free pool
                # immediately instead of honouring a multi-hour Retry-After.
                if not _budget_blocked and ("budget" in body.lower() or (ra_s or 0) > 120):
                    _budget_blocked = True
                    continue
                # Otherwise a genuine short-term rate limit: brief, hard-capped backoff.
                time.sleep(min(ra_s if ra_s is not None else 5 * (attempt + 1), 60))
                continue
            if e.code in (500, 502, 503, 504):
                time.sleep(1.5 * (attempt + 1))
                continue
            raise OpenAlexError(f"HTTP {e.code} for /{path.lstrip('/')}: {_read_body(e)}") from e
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


def iterate_works(filter_str: str, select: str | None = None, per_page: int = 200):
    """Stream every work matching a filter, using cursor pagination."""
    require_key()
    cursor = "*"
    while cursor:
        params = {"filter": filter_str, "per-page": per_page, "cursor": cursor}
        if select:
            params["select"] = select
        obj = get("works", params)
        results = obj.get("results", []) or []
        for w in results:
            yield w
        if not results:
            break
        cursor = (obj.get("meta") or {}).get("next_cursor")
