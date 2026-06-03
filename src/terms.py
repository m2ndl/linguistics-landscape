"""
Automated phrase-trend mining from paper titles.

Reads the titles of English journal articles in the corpus, counts distinctive terms per
month, and lets the data say which are rising, emerging, and fading. Nothing is hand-picked.
The only human input is a STABLE set of stop-lists (generic filler, document-type noise, and
non-English markers), which never needs weekly attention because that vocabulary does not change.

Filtering strategy (after several noisy passes):
  - type:article|review and language:en at the API.
  - A non-English title gate (OpenAlex mislabels ~15% of languages), using giveaway function words.
  - Single-word terms must be long and distinctive (short words are mostly fragments/generics).
  - Multi-word phrases are kept permissively (so "teacher education" survives), minus an explicit
    generic-phrase stop-list.
  - "Rising" needs a real prior baseline so small counts cannot fake a giant trend.
Document frequency is used (a term counts once per paper); trends are SHARE of output.
"""
from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

import openalex

ROOT = Path(__file__).resolve().parent.parent
TERMS_DIR = ROOT / "data" / "terms"

MIN_RECENT = 40
MIN_PRIOR_RISE = 25
MIN_PRIOR_EMERGE = 6
MIN_RECENT_EMERGE = 50
PRUNE_MIN_TOTAL = 18
UNIGRAM_MIN_LEN = 7

_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]")
_NUMERIC = re.compile(r"^[0-9][0-9-]*$")

STOP = set("""a an the and or but of in on for to with as at by from into about between through during
is are was were be been being this that these those it its their there we our you your they them he she his her
who which what when where how why can may will would should could not no nor so than then more most some any all
each both few other such only own same too very s t do does did has have had using than per into onto out up down
toward towards via within without across after before over under above below""".split())

# Giveaway non-English function words. Two or more in a title => skip it (mislabelled language).
NON_EN = set("""dan yang dalam pada untuk dengan dari terhadap sebagai oleh adalah ini itu pembelajaran
los las una para por como sus uma dos das nas nos del entre sobre desde aprendizaje estudiantes lengua ensino
dans pour avec aux leurs cette nous langue enseignement apprentissage
und eine einer einen zur zum durch werden sprache unterricht deutschen
della degli nella gli insegnamento lingua""".split())

# Generic single words dropped as standalone terms (multi-word phrases are not judged by this set).
GENERIC_UNI = set("""language languages linguistic linguistics learning teaching learners learner teacher teachers
english study studies research analysis analyses educational student students approach approaches effect effects
impact role review reviews evidence perspective perspectives development model models method methods using based
classroom instruction acquisition skills skill knowledge practice practices context factors level levels paper papers
case results result theory theoretical empirical investigation influence relationship system systems process
processes feature features framework frameworks reference references support achievement application applications
implementation implications overview introduction comparison insights findings outcomes directions strategies
effectiveness efficacy professional innovative innovation exploring examining investigating understanding rethinking
revisiting reconsidering negotiating mediating navigating bridging fostering enhancing improving developing designing
implementing evaluating assessing measuring comparing analyzing analysing mapping addressing promoting supporting
integrating applying introducing exploration challenges opportunities perception perceptions toward beyond among
chinese arabic spanish french german japanese korean russian turkish persian italian portuguese
berlin london paris madrid beijing tokyo ukrainian indonesia indonesian malaysian nigerian iranian""".split())

# Generic / document-type multi-word phrases dropped outright.
GENERIC_PHRASES = {
    "second language", "foreign language", "first language", "target language", "english language",
    "second language acquisition", "language learning", "language teaching", "language acquisition",
    "language learners", "language learner", "language education", "language classroom", "language proficiency",
    "language skills", "language use", "language teachers", "language teacher", "language development",
    "applied linguistics", "case study", "case studies", "systematic review", "literature review",
    "systematic literature review", "scoping review", "narrative review", "review article", "research article",
    "original research", "research paper", "research project", "research framework", "conceptual framework",
    "theoretical framework", "present study", "current study", "future directions", "future research",
    "data analysis", "content analysis", "research methods", "research method", "qualitative study",
    "quantitative study", "empirical study", "pilot study", "comparative study", "comparative analysis",
    "higher education", "english language teaching", "english language learners", "foreign language learning",
    "foreign language teaching", "secondary school", "primary school", "high school", "young learners",
    "working paper", "policy brief", "data note", "teaching guide", "executive summary", "press release",
    "special issue", "book review", "post covid", "english translation",
}


def tokenize(title: str) -> list[str]:
    return _TOKEN_RE.findall((title or "").lower())


def is_non_english(toks: list[str]) -> bool:
    hits = set()
    for t in toks:
        if t in NON_EN:
            hits.add(t)
            if len(hits) >= 2:
                return True
    return False


def terms_from_tokens(toks: list[str]) -> set[str]:
    out: set[str] = set()
    n = len(toks)
    for size in (1, 2, 3):
        for i in range(n - size + 1):
            gram = toks[i:i + size]
            if any(len(t) < 2 or _NUMERIC.match(t) for t in gram):
                continue
            if size == 1:
                w = gram[0]
                if len(w) < UNIGRAM_MIN_LEN or w in STOP or w in GENERIC_UNI:
                    continue
                out.add(w)
            else:
                if gram[0] in STOP or gram[-1] in STOP:
                    continue
                phrase = " ".join(gram)
                if phrase in GENERIC_PHRASES:
                    continue
                out.add(phrase)
    return out


def mine(scope: dict, start: str, end: str, progress: bool = False):
    base = openalex.subfield_filter([s["id"] for s in scope["openalex"]["subfield_union"]])
    f = (f"{base},from_publication_date:{start},to_publication_date:{end}"
         ",type:article|review,language:en")
    term_months: dict[str, dict[str, int]] = {}
    totals: dict[str, int] = {}
    n = 0
    for w in openalex.iterate_works(f, select="title,publication_date", per_page=200):
        pd = w.get("publication_date") or ""
        if len(pd) < 7:
            continue
        toks = tokenize(w.get("title") or w.get("display_name") or "")
        if is_non_english(toks):
            continue
        month = pd[:7]
        totals[month] = totals.get(month, 0) + 1
        n += 1
        for t in terms_from_tokens(toks):
            tm = term_months.get(t)
            if tm is None:
                tm = term_months[t] = {}
            tm[month] = tm.get(month, 0) + 1
        if progress and n % 25000 == 0:
            print(f"    mined {n} titles...", flush=True)
    return term_months, totals, n


def prune(term_months: dict, min_total: int = PRUNE_MIN_TOTAL) -> dict:
    return {t: m for t, m in term_months.items() if sum(m.values()) >= min_total}


def months_back(ref: dt.date, k: int) -> list[str]:
    y, m, out = ref.year, ref.month, []
    for _ in range(k):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return out


def derive(term_months: dict, totals: dict, ref: dt.date) -> dict:
    allm = months_back(ref, 24)
    recent_m, prior_m = set(allm[:12]), set(allm[12:24])
    tot_r = sum(totals.get(m, 0) for m in recent_m) or 1
    tot_p = sum(totals.get(m, 0) for m in prior_m) or 1

    items = []
    for t, tm in term_months.items():
        r = sum(c for mo, c in tm.items() if mo in recent_m)
        if r < MIN_RECENT:
            continue
        p = sum(c for mo, c in tm.items() if mo in prior_m)
        sr, sp = r / tot_r, (p / tot_p if tot_p else 0.0)
        growth = (sr / sp - 1.0) if sp > 0 else None
        items.append({"term": t, "recent": r, "prior": p, "share_recent": sr,
                      "share_prior": sp, "growth": growth})

    rising = sorted([i for i in items if i["prior"] >= MIN_PRIOR_RISE and i["growth"] and i["growth"] > 0],
                    key=lambda i: i["growth"], reverse=True)
    cooling = sorted([i for i in items if i["prior"] >= MIN_PRIOR_RISE and i["growth"] is not None and i["growth"] < 0],
                     key=lambda i: i["growth"])
    emerging = sorted([i for i in items if i["prior"] < MIN_PRIOR_EMERGE and i["recent"] >= MIN_RECENT_EMERGE],
                      key=lambda i: i["recent"], reverse=True)
    frequent = sorted(items, key=lambda i: i["recent"], reverse=True)
    return {"rising": rising, "cooling": cooling, "emerging": emerging,
            "frequent": frequent, "total_recent": tot_r, "total_prior": tot_p}
