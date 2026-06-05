# CLAUDE.md

Working guide for making code changes to this repo safely. This is the durable "how things work
and what not to break" doc. It is deliberately separate from the running journal:

- **`project/LOG.md`** (gitignored) — the session-by-session journal. **Read it first to resume**;
  it holds the latest state, decisions, and open items.
- **`SUGGESTED_ENHANCEMENTS.md`** (gitignored) — the product backlog and open decisions.
- **`README.md` / `RUNBOOK.md`** (committed) — operator docs: what the project is, one-time deploy,
  running the weekly job, re-keying, re-scoping. Don't duplicate those here.

## What this is

"Word on the Street" (live at language-research.com): a free, fully automated site tracking research
trends across linguistics, applied linguistics, and language education, with longitudinal history.
A stdlib-only Python harvester reads OpenAlex, writes dated snapshots into the repo, and rebuilds a
static site in `docs/`, deployed weekly via GitHub Actions + Pages. The git history is the database.
Target cost: $0/year. English is the default UI with an Arabic / RTL toggle.

## Architecture (read before editing)

- The pipeline writes **data only**. `src/harvest.py` (and `--render-only`) / `src/render.py`
  regenerate `docs/data/*.json` from the snapshots in `data/`. They do **not** emit HTML.
- Therefore **`docs/*.html` and `docs/assets/*` are hand-maintained source** — edit them directly;
  the weekly rebuild will not overwrite them. (Head-level changes like the analytics beacon persist.)
- `data/snapshots/*.csv` is the append-only longitudinal record. **Never hand-edit it**; a run
  rebuilds `docs/data/*` from it.
- Depth pages (Index, Rankings, Best year, Underserved, Papers) recompute **client-side** from the
  already-served `docs/data/*.json`. A new or changed depth page must make **zero new API calls**.
- The ~209-topic spine is built from OpenAlex `/topics` keyphrases + curated coinages
  (`config/spine.json`, `scripts/build_spine.py`). Corpus = OpenAlex subfields 1203 ∪ 3310.

## Hard constraints (don't break these)

- **CSP is strict.** Every page carries a Content-Security-Policy meta; an inline `<script>` is
  **blocked in production**. Put JS in an external file under `docs/assets/` (runs under `'self'`).
  Inline `<style>` and `style="..."` are still allowed.
- **Cache-bust on every asset edit.** When you change a file in `docs/assets/`, bump its `?v=` on the
  `<link>`/`<script>` refs, and keep that version **in lockstep across every page** that loads it
  (mismatched versions cause stale-cache bugs).
- **Bilingual split.** English UI strings live in `docs/assets/i18n.js` (`STR.en`); Arabic in
  `docs/assets/i18n.ar.js` (`STR.ar`), lazy-loaded on first Arabic use — bump its `?v=` inside
  `ensureAr()` when you edit it. English is the unconditional default; there is no
  `navigator.language` detection.
- **Pre-paint boot.** `docs/assets/boot.js` sets theme + language before first paint. Keep that there
  (not inline — CSP; not after paint — flash).
- **Front-page-only changes are scoped via `body.home`** (only `index.html` has that class), so a
  `.home`-scoped rule cannot affect the other pages.
- **Reserve space for anything JS fills after fetch** (lists, sections) with `min-height`, or the page
  reflows on load (CLS). The dynamic front-page blocks are already reserved in `magazine.css`.

## Running and verifying

- Serve locally from `docs/` (the JS fetches `data/*.json`, so it needs http, not `file://`):
  `python -m http.server 8021 --directory docs`.
- Verify real changes in a browser (Playwright): check **English, Arabic/RTL, dark mode, and mobile**.
  The console should be clean except one localhost-only Cloudflare-beacon CORS error (absent on the
  live domain). No CSP violations.
- **Recompute any number you publish.** The gitignored `project/*.py` scripts (`_slow_verify.py`,
  `_gap_verify.py`, `_peak_verify.py`, …) are the reference recomputations; re-run them after a data
  change rather than trusting hand arithmetic.

## Git / deploy

- Changes land on **`main`**; pushing `main` triggers the Pages deploy. **The maintainer runs the
  push** (an agent here is blocked from pushing `main` by a safety classifier) — leave the commit
  ready and hand off `git push origin main`.
- End commit messages with the project's Co-Authored-By trailer when an agent made the change.
- `openalex.key` is gitignored (a daily-budget API key; the GitHub secret is `OPENALEX_API_KEY`). The
  site also runs keyless on OpenAlex's free polite pool, so an apparent "hang" usually means the key's
  daily budget is spent, not a bug.

## Public-facing copy

Plain, literal English. No metaphors or figurative framing, no process/methodology asides, no
"this not that" parallelism — say plainly what a thing is. (This is the site's own voice; the
academic `STYLE.md` ruleset does **not** apply to this web copy.)
