"""
Track B: "On the Radar" -- automated discovery of EMERGING phrases the fixed spine does not yet name.

Mines distinctive 1-3 word phrases from recent titles+abstracts in the corpus, then scores each by:
  - WEIRDNESS: weighted log-odds z of the phrase IN-FIELD vs the whole of OpenAlex. A phrase that is
    common everywhere (e.g. "machine learning") scores low even when rising in the field; this contrast
    is what separates linguistics-native emerging terms from borrowed/generic filler, and is the fix for
    the title-only miner that plateaued at ~65% clean.
  - C-VALUE: multiword termhood (Frantzi et al.); favours coherent units, demotes fragments. Bare words
    get 0 here and must earn their place on weirdness + growth.
  - GROWTH: rising share inside the field across two 24-month windows.

This is a PROVISIONAL, machine-flagged sidecar, walled off from the firm spine. A phrase is auto-promoted
into the spine ONLY after it clears the gates across PROMOTE_RUNS consecutive weekly runs (read from the
dated history in data/radar/). Standard library only. Runs inside a guard in harvest.py so a radar
failure never blocks the firm site.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import re
from pathlib import Path

import openalex
import terms
from constructs import load_spine

ROOT = Path(__file__).resolve().parent.parent
RADAR_DIR = ROOT / "data" / "radar"
OUT_PATH = ROOT / "docs" / "data" / "radar.json"
SPINE_PATH = ROOT / "config" / "spine.json"
CACHE_PATH = RADAR_DIR / "_cache.json"      # gitignored resume cache (harvest + background counts)

# --- tunable thresholds (set against a dev sample before first publish) ---
WINDOW_DAYS = 730               # 24 months per window
MAX_WORKS = 55000               # hard ceiling per window so a corpus surge can't blow the budget/memory
ABSTRACT_TOKENS = 60            # only the opening of each abstract (keeps the n-gram set bounded)
MIN_DF_RECENT = 25              # a candidate must appear in >= this many recent works to be scored
PHASE_B_CAP = 400               # at most this many survivors get a background (global) lookup
SHOW_RISING = 14                # rows published in each list
SHOW_BREAKING = 10
Z_MIN_SHOW = 1.5                # weirdness floor to appear at all
GROWTH_MIN_RISING = 0.15        # rising-weird needs real in-field growth
PRIOR_FLOOR_RISING = 12         # ... and a real prior baseline
PRIOR_CEIL_BREAKING = 5         # breaking = near-absent before
RECENT_FLOOR_BREAKING = 45      # ... but clearly present now
W_Z, W_CVAL, W_GROWTH = 0.45, 0.25, 0.30

# --- auto-promotion gate (the only bridge into the firm spine) ---
PROMOTE_RUNS = 3                # must clear the gate this many consecutive runs
PROMOTE_Z = 3.0
PROMOTE_GROWTH = 0.25
PROMOTE_DF = 60


# Abstract-prose boilerplate (methodology / structure words) that titles rarely carry but abstracts do.
ABSTRACT_STOP = set("""abstract article study studies paper papers research data dataset results result finding
findings method methods methodology methodological qualitative quantitative approach approaches analysis analyses
participants participant interview interviews interviewee questionnaire questionnaires survey surveys sample samples
respondents respondent university universities college school schools undergraduate graduate semester semesters
present current previous recent significant significantly conclusion conclusions discussion introduction objective
objectives aim aims purpose findings implications contribution contributions evidence examine examined examines
explore explored explores investigate investigated investigates propose proposed proposes report reports reported
semi structured ended likert pretest posttest pre post test tests control experimental group groups condition
conditions year years month months week weeks day days hour hours number total mean average percentage percent
chapter chapters section sections table tables figure figures appendix""".split())

# Extra stop words (connectives / abstract hedges) that create fragments when they sit inside a gram.
STOP_EXTRA = set("""among amongst regarding concerning whether towards toward within across despite although
remains remain remained underexplored underexamined understudied hitherto thereby hereby moreover furthermore
nonetheless however thus hence overall namely particularly especially towards via amid amidst""".split())

# Acronyms that glue onto their expansion in titles/abstracts ("anxiety fla", "competence icc",
# "education dlbe", "enjoyment fle"). A stable, set-once list of common linguistics initialisms.
ABBREV = set("""efl esl eap esp eil elf elt ell ells esol tesol tesl tefl l1 l2 l3 fl sl tl sla fla fle flp wtc
tblt tbl tbli clt clil call mall cmc cmd cda mda sfl dmc dla dlbe der tam asr tts nlp ner pos lsp zpd mkr wcf cf
icc ica ila ielts toefl cefr llm llms gpt mt smt nmt ict ela ld ssl emi""".split())

# A few place / language proper nouns that score high on weirdness but are not constructs.
PLACES = set("hong kong mandarin cantonese taiwanese singaporean malaysian saudi emirati qatari omani".split())

BAD_TOKENS = ABSTRACT_STOP | ABBREV | PLACES


def _is_acronym(t: str) -> bool:
    """Short token with no vowel (wtc, tblt, flp, icc) -- almost always a glued initialism fragment here."""
    return len(t) <= 4 and not any(v in t for v in "aeiou")


def _phrases(toks: list[str]) -> set[str]:
    """Radar candidate phrases: clean 2-3 word grams only. Emerging constructs are phrases, not bare words,
    so unigrams (and the abstract words 'abstract'/'article' themselves) are excluded by construction. Also
    drops any gram containing a stop/connective, abstract-prose boilerplate, an abbreviation, a place name,
    or a no-vowel acronym fragment."""
    out: set[str] = set()
    n = len(toks)
    for size in (2, 3):
        for i in range(n - size + 1):
            gram = toks[i:i + size]
            if any(len(t) < 3 or terms._NUMERIC.match(t) for t in gram):
                continue
            if any((t in terms.STOP or t in STOP_EXTRA or t in BAD_TOKENS or _is_acronym(t)) for t in gram):
                continue
            phrase = " ".join(gram)
            if phrase in terms.GENERIC_PHRASES:
                continue
            out.add(phrase)
    return out


def _normalize(s: str) -> str:
    return re.sub(r"[-\s]+", " ", (s or "").lower()).strip()


def _slug(s: str) -> str:
    return "radar_" + re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def reconstruct_abstract(inv: dict | None, cap: int = ABSTRACT_TOKENS) -> str:
    """Rebuild abstract text (opening `cap` tokens) from OpenAlex's abstract_inverted_index."""
    if not inv:
        return ""
    pos: dict[int, str] = {}
    for word, idxs in inv.items():
        for i in idxs:
            if i < cap:
                pos[i] = word
    if not pos:
        return ""
    return " ".join(pos[i] for i in range(min(cap, max(pos) + 1)) if i in pos)


def _harvest(base: str, d0: dt.date, d1: dt.date, log) -> tuple[dict[str, int], int]:
    """Document-frequency of 1-3-grams over title+abstract opening, for one window. Returns (df, n_works)."""
    f = (f"{base},from_publication_date:{d0.isoformat()},to_publication_date:{d1.isoformat()}"
         ",type:article|review,language:en")
    df: dict[str, int] = {}
    n = 0
    for w in openalex.iterate_works(f, select="title,abstract_inverted_index,id", per_page=200):
        text = (w.get("title") or "") + ". " + reconstruct_abstract(w.get("abstract_inverted_index"))
        toks = terms.tokenize(text)
        if terms.is_non_english(toks):
            continue
        n += 1
        for t in _phrases(toks):
            df[t] = df.get(t, 0) + 1
        if n % 10000 == 0:
            log(f"  harvested {n} works ({len(df)} distinct phrases)...")
        if n >= MAX_WORKS:
            log(f"  reached MAX_WORKS={MAX_WORKS}; stopping harvest for this window.")
            break
    return df, n


def logodds_z(a: int, A: int, b: int, B: int) -> float:
    """Weighted log-odds (Monroe et al.) of a phrase in-field (a/A) vs global (b/B), with a 0.5 prior."""
    a, b = max(a, 0), max(b, 0)
    la = math.log((a + 0.5) / (A - a + 0.5))
    lb = math.log((b + 0.5) / (B - b + 0.5))
    return (la - lb) / math.sqrt(1.0 / (a + 0.5) + 1.0 / (b + 0.5))


def compute_cvalue(freq: dict[str, int]) -> dict[str, float]:
    """C-value termhood (Frantzi et al.) over the candidate set. Unigrams get 0 (log2(1))."""
    contained_in: dict[str, set[str]] = {t: set() for t in freq}
    for L in freq:
        ltoks = L.split()
        ln = len(ltoks)
        for size in range(1, ln):
            for i in range(ln - size + 1):
                s = " ".join(ltoks[i:i + size])
                if s in contained_in and s != L:
                    contained_in[s].add(L)
    cval: dict[str, float] = {}
    for t, f in freq.items():
        base = math.log2(len(t.split()) or 1)
        longers = contained_in.get(t) or set()
        if not longers:
            cval[t] = base * f
        else:
            cval[t] = base * (f - sum(freq[b] for b in longers) / len(longers))
    return cval


def _spine_keys() -> set[str]:
    """Normalized forms already covered by the spine (label + query), for de-duplication."""
    keys: set[str] = set()
    for c in load_spine():
        keys.add(_normalize(c.get("q") or ""))
        keys.add(_normalize(c.get("label") or ""))
    return {k for k in keys if k}


def _covered_by_spine(phrase: str, spine_keys: set[str]) -> bool:
    nf = _normalize(phrase)
    if nf in spine_keys:
        return True
    toks = set(nf.split())
    # drop a candidate that is a token-superset/subset of a tracked construct (trivial variant)
    for k in spine_keys:
        kt = set(k.split())
        if kt and (kt <= toks or toks <= kt):
            return True
    return False


def _minmax(values: list[float]) -> tuple[float, float]:
    lo, hi = min(values), max(values)
    return lo, (hi if hi > lo else lo + 1e-9)


def _save_cache(state: dict) -> None:
    RADAR_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(state), encoding="utf-8")


def _load_cache(ref: dt.date) -> dict | None:
    if not CACHE_PATH.exists():
        return None
    try:
        d = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return d if d.get("ref") == ref.isoformat() else None


def build_radar(scope: dict, ref: dt.date | None = None, log=lambda *_: None, write: bool = True,
                use_cache: bool = False) -> dict:
    """Harvest, score, gate, and (optionally) write radar.json + a dated history file.
    use_cache resumes from CACHE_PATH (skips the harvest and any background counts already fetched)."""
    ref = ref or dt.date.today()
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])
    r0, r1 = ref - dt.timedelta(days=WINDOW_DAYS), ref
    p0, p1 = ref - dt.timedelta(days=2 * WINDOW_DAYS), ref - dt.timedelta(days=WINDOW_DAYS + 1)
    gwin = f"from_publication_date:{r0.isoformat()},to_publication_date:{r1.isoformat()},type:article|review,language:en"

    cache = _load_cache(ref) if use_cache else None
    if cache:
        n_r, n_p, B = cache["n_r"], cache["n_p"], cache["B"]
        surv, cval, bg = cache["survivors"], cache["cval"], cache.get("bg", {})
        log(f"Radar: resumed from cache ({len(surv)} survivors, {len(bg)} background counts already done).")
    else:
        log("Radar: harvesting recent window...")
        df_r, n_r = _harvest(base, r0, r1, log)
        log(f"Radar: recent = {n_r} works, {len(df_r)} phrases. Harvesting prior window...")
        df_p, n_p = _harvest(base, p0, p1, log)
        log(f"Radar: prior = {n_p} works, {len(df_p)} phrases.")
        A_r0, A_p0 = max(n_r, 1), max(n_p, 1)
        spine_keys = _spine_keys()
        survivors = [t for t, c in df_r.items() if c >= MIN_DF_RECENT and not _covered_by_spine(t, spine_keys)]
        survivors.sort(key=lambda t: df_r[t] * (1.0 + max(0.0, (df_r[t] / A_r0) - (df_p.get(t, 0) / A_p0))), reverse=True)
        survivors = survivors[:PHASE_B_CAP]
        log(f"Radar: {len(survivors)} survivors after frequency floor + spine dedup (capped).")
        cval = compute_cvalue({t: df_r[t] for t in survivors})
        B = openalex.count_works(gwin)
        surv = {t: [df_r[t], df_p.get(t, 0)] for t in survivors}   # phrase -> [recent_df, prior_df]
        bg = {}                                                    # phrase -> global count
        _save_cache({"ref": ref.isoformat(), "n_r": n_r, "n_p": n_p, "B": B, "survivors": surv, "cval": cval, "bg": bg})

    A_r, A_p = max(n_r, 1), max(n_p, 1)
    log(f"Radar: global window total B = {B}. Background counts for {len(surv)} survivors ({len(bg)} cached)...")
    cands = []
    for i, (t, rp) in enumerate(surv.items(), 1):
        a, p = rp[0], rp[1]
        if t not in bg:
            try:
                bg[t] = openalex.count_works(f"{gwin},title_and_abstract.search:{t}")
            except openalex.OpenAlexError:
                continue                                   # skip one bad phrase, never fail the run
            if i % 25 == 0:
                _save_cache({"ref": ref.isoformat(), "n_r": n_r, "n_p": n_p, "B": B, "survivors": surv, "cval": cval, "bg": bg})
        b = bg[t]
        z = logodds_z(a, A_r, b, B)
        sr, sp = a / A_r, (p / A_p if A_p else 0.0)
        growth = (sr / sp - 1.0) if sp > 0 else None
        cands.append({"phrase": t, "recent": a, "prior": p, "global": b,
                      "z": round(z, 3), "cvalue": round(cval.get(t, 0.0), 2),
                      "share_recent": sr, "share_prior": sp,
                      "growth": (round(growth, 4) if growth is not None else None)})
        if i % 100 == 0:
            log(f"  scored {i}/{len(surv)}")
    _save_cache({"ref": ref.isoformat(), "n_r": n_r, "n_p": n_p, "B": B, "survivors": surv, "cval": cval, "bg": bg})

    # Composite score (min-max normalized within the candidate set).
    if cands:
        zlo, zhi = _minmax([c["z"] for c in cands])
        clo, chi = _minmax([c["cvalue"] for c in cands])
        glo, ghi = _minmax([(c["growth"] if c["growth"] is not None else 0.0) for c in cands])
        for c in cands:
            zn = (c["z"] - zlo) / (zhi - zlo)
            cn = (c["cvalue"] - clo) / (chi - clo)
            gn = ((c["growth"] if c["growth"] is not None else 0.0) - glo) / (ghi - glo)
            c["score"] = round(W_Z * zn + W_CVAL * cn + W_GROWTH * gn, 4)

    rising = sorted(
        [c for c in cands if c["z"] >= Z_MIN_SHOW and c["growth"] is not None
         and c["growth"] >= GROWTH_MIN_RISING and c["prior"] >= PRIOR_FLOOR_RISING],
        key=lambda c: c["score"], reverse=True)[:SHOW_RISING]
    breaking = sorted(
        [c for c in cands if c["z"] >= Z_MIN_SHOW and c["prior"] <= PRIOR_CEIL_BREAKING
         and c["recent"] >= RECENT_FLOOR_BREAKING],
        key=lambda c: c["score"], reverse=True)[:SHOW_BREAKING]

    date_str = ref.isoformat()
    record = {
        "generated_on": date_str,
        "window": {"recent": [r0.isoformat(), r1.isoformat()], "prior": [p0.isoformat(), p1.isoformat()]},
        "corpus_recent_works": n_r, "corpus_prior_works": n_p, "global_recent_works": B,
        "candidates": cands,            # full scored set (history needs it for the promotion gate)
    }

    promoted = _promote(record, log) if write else []
    published = {
        "generated_on": date_str,
        "window": record["window"],
        "corpus_recent_works": n_r,
        "rising": [_pub(c) for c in rising],
        "breaking": [_pub(c) for c in breaking],
        "promoted": promoted,
        "note": "Machine-flagged emerging phrases, unreviewed and provisional. Scored by how distinctive "
                "they are to linguistics versus all of academia, by phrase coherence, and by recent growth.",
    }
    if write:
        RADAR_DIR.mkdir(parents=True, exist_ok=True)
        (RADAR_DIR / f"radar-{date_str}.json").write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(json.dumps(published, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        log(f"Radar: wrote {OUT_PATH.name} ({len(rising)} rising, {len(breaking)} breaking, {len(promoted)} promoted).")
    return {"published": published, "record": record, "rising": rising, "breaking": breaking}


def _pub(c: dict) -> dict:
    return {"phrase": c["phrase"], "recent": c["recent"], "z": c["z"],
            "growth": c["growth"], "is_new": c["prior"] <= PRIOR_CEIL_BREAKING}


def _promote(record: dict, log) -> list[dict]:
    """Append phrases that cleared the gate across the last PROMOTE_RUNS runs (incl. this one) to the spine."""
    runs = [record]
    if RADAR_DIR.exists():
        for p in sorted(RADAR_DIR.glob("radar-*.json"), reverse=True):
            try:
                runs.append(json.loads(p.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
            if len(runs) >= PROMOTE_RUNS:
                break
    if len(runs) < PROMOTE_RUNS:
        return []

    def clears(run: dict, phrase: str) -> bool:
        for c in run.get("candidates", []):
            if c["phrase"] == phrase:
                return (c["z"] >= PROMOTE_Z and c["recent"] >= PROMOTE_DF
                        and c["growth"] is not None and c["growth"] >= PROMOTE_GROWTH)
        return False

    this_run = {c["phrase"] for c in record.get("candidates", []) if clears(record, c["phrase"])}
    spine_keys = _spine_keys()
    promoted = []
    for phrase in sorted(this_run):
        if _covered_by_spine(phrase, spine_keys):
            continue
        if all(clears(r, phrase) for r in runs[:PROMOTE_RUNS]):
            promoted.append(phrase)

    if promoted:
        cfg = json.loads(SPINE_PATH.read_text(encoding="utf-8"))
        existing = {c["id"] for c in cfg.get("constructs", [])}
        for phrase in promoted:
            sid = _slug(phrase)
            if sid in existing:
                continue
            cfg["constructs"].append({"id": sid, "label": phrase.title(), "q": phrase, "source": "auto"})
        cfg["constructs"].sort(key=lambda e: e["label"].lower())
        SPINE_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        log(f"Radar: promoted into the spine: {', '.join(promoted)}")
    return [{"phrase": p, "id": _slug(p)} for p in promoted]
