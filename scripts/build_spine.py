"""
Build the Track A 'spine' vocabulary: clean, OpenAlex-maintained linguistics constructs.

Source 1: OpenAlex /topics keyphrases for subfields 1203 + 3310 (~211, crowd-curated upstream).
Source 2: our existing config/constructs.json (~50 curated, carries newest coinages OpenAlex lacks:
          ChatGPT, raciolinguistics, willingness to communicate, ...).

We prune a set-once stop-set of over-broad / proper-noun / non-construct keyphrases, dedupe case
variants, union the two sources, and write config/spine.json. This runs once now and on a slow
(monthly) refresh later; nobody curates it weekly. The owner never edits a list; OpenAlex and the
field do the curating.

Usage:  python scripts/build_spine.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import openalex  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SUBFIELDS = "1203|3310"

# Set-once: over-broad fields, proper nouns, places, and non-construct labels to drop.
STOP = {
    "anthropology", "culture", "cultural studies", "cultural history", "cultural diversity",
    "cultural identity", "cultural implications", "cultural semiotics", "critical theory",
    "classical studies", "comparative philology", "ancient languages", "catalonia", "education",
    "education policy", "educational technology", "artificial intelligence", "accessibility studies",
    "conceptual variation", "communication practices", "digital media", "digital communication",
    "electronic", "ethnicity", "didactics", "philosophy", "psychology", "sociology", "history",
    "literature", "media", "communication", "globalization", "identity", "migration", "gender",
    "politics", "religion", "ethics", "aesthetics", "modernity", "postmodernism", "narrative",
    "rhetoric", "translation", "interpretation", "cultural sustaining pedagogy", "critical pedagogy",
    "social media", "higher education", "language", "languages", "linguistics", "applied linguistics",
    "cognitive science", "neuroscience", "computer science", "information technology", "knowledge",
    "learning", "teaching", "assessment", "evaluation", "methodology", "research methods",
    "qualitative research", "quantitative research", "mixed methods",
}


def slugify(s: str) -> str:
    return "ox_" + re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def normalize(s: str) -> str:
    """Dedupe key: lowercase, unify hyphens/spaces, so 'Eye-tracking' == 'Eye Tracking'."""
    return re.sub(r"[-\s]+", " ", (s or "").lower()).strip()


STOP_N = {normalize(s) for s in STOP}


def fetch_keyphrases() -> dict[str, str]:
    """Return {normalized: best_display} across linguistics topic keyphrases."""
    obj = openalex.get("topics", {"filter": f"subfield.id:{SUBFIELDS}", "per-page": 100})
    out: dict[str, str] = {}
    for t in obj.get("results", []):
        for k in (t.get("keywords") or []):
            disp = (k or "").strip()
            key = normalize(disp)
            if not key:
                continue
            # prefer a display form that starts uppercase (title-ish) over a lowercase variant
            if key not in out or (disp[:1].isupper() and not out[key][:1].isupper()):
                out[key] = disp
    return out


def main() -> int:
    kws = fetch_keyphrases()
    print(f"Fetched {len(kws)} distinct keyphrases from OpenAlex linguistics topics.")

    spine: dict[str, dict] = {}     # keyed by normalized query (lowercase label)
    pruned = []
    for key, disp in sorted(kws.items()):
        if key in STOP_N or len(key) < 3:
            pruned.append(disp)
            continue
        spine[key] = {"id": slugify(key), "label": disp, "q": key, "source": "openalex"}

    print(f"Pruned {len(pruned)} over-broad/proper-noun keyphrases.")
    print(f"Kept {len(spine)} OpenAlex constructs.")

    # Merge curated constructs (prefer their tuned query + stable id).
    curated_path = ROOT / "config" / "constructs.json"
    added_curated = 0
    if curated_path.exists():
        curated = json.loads(curated_path.read_text(encoding="utf-8")).get("constructs", [])
        for c in curated:
            key = normalize(c.get("q") or c.get("label") or "")
            if not key:
                continue
            if key not in spine:
                added_curated += 1
            spine[key] = {"id": c["id"], "label": c["label"], "q": c["q"], "source": "curated"}
    print(f"Merged curated constructs: {added_curated} new, {len(spine)} total in spine.")

    out = {
        "version": "2026-06-02",
        "source_note": "Constructs are crowd-curated: OpenAlex topic keyphrases (subfields 1203+3310) "
                       "plus a small set of curated newer coinages. Pruned once for over-broad terms; "
                       "grown automatically. No weekly human curation.",
        "constructs": sorted(spine.values(), key=lambda e: e["label"].lower()),
    }
    out_path = ROOT / "config" / "spine.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} with {len(out['constructs'])} constructs.")
    print("\nPruned list:")
    print("  " + ", ".join(pruned))
    print("\nSample kept (first 50):")
    print("  " + " | ".join(e["label"] for e in out["constructs"][:50]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
