# Applied Linguistics Landscape

A website that refreshes itself every week and shows the current state of research in
linguistics, applied linguistics, and language education, along with how the field's
trends change over time. It is built to run for years, unattended, for free.

- **Primary purpose:** capture trends and, over months and years, how those trends shift.
- **Secondary purpose:** surface the latest and most prominent papers.
- **Cost:** $0 a year (an optional custom domain is about $12/year).
- **Maintenance:** essentially none. It runs itself and emails you if it ever breaks.

## How it works (in one paragraph)

A small Python script runs once a week inside GitHub Actions. It asks
[OpenAlex](https://openalex.org) how many papers were published in each linguistics topic
over the last 12 months, writes that as a dated snapshot file into this repository, and
rebuilds the web pages. The repository's own history becomes the permanent longitudinal
record. There is no server and no database. The website is just static files served free
by GitHub Pages. Everything you see is computed from numbers; an LLM is not involved.

## The honest scope

This measures the OpenAlex-indexed, mostly-English, journal-article slice of the field.
It under-represents books, edited volumes, non-English scholarship, and grey literature.
Read it as *trends in the indexed journal literature*, not a complete picture of the field.
The site says so on its own About page, on purpose.

## One-time setup

You only do this once. It takes about half an hour.

1. **Get a free OpenAlex API key.** Sign in at <https://openalex.org/settings/api> and copy
   your key. (OpenAlex now requires a key for data queries. The free tier is $1 of usage a
   day, which is far more than this project uses.)
2. **Put the code on GitHub** as a new **public** repository (public is what makes the
   automation free and unlimited).
3. **Add the key as a secret.** In the repo: Settings → Secrets and variables → Actions →
   New repository secret. Name it `OPENALEX_API_KEY`, paste your key.
4. **Turn on GitHub Pages.** Settings → Pages → Source: "Deploy from a branch", Branch:
   `main`, Folder: `/docs`.
5. **Seed the history** (so the site launches with real depth, not a flat line). Run the
   backfill once, then commit (see RUNBOOK for the exact commands), or run the workflow and
   let the weekly snapshots accumulate.
6. **Run it once now.** Actions tab → "Weekly update" → "Run workflow". After it finishes,
   your site is live at `https://<your-username>.github.io/<repo-name>/`.

The full click-by-click walkthrough is in **RUNBOOK.md**.

## Running it on your own computer (optional)

You do not need to, but you can. Put your OpenAlex key in a file named `openalex.key` at the
project root (one line, just the key). That file is gitignored and never leaves your machine.
Then:

```
python src/harvest.py            # one weekly update
python scripts/backfill.py       # seed several years of history (run once)
python src/harvest.py --render-only   # rebuild the pages from existing data, no network
```

Python 3.10+ and nothing else. There are no packages to install.

## Day to day

Nothing. It updates every Monday on its own. If a run ever fails, GitHub emails you and opens
an issue in the repo explaining the likely cause. The previously published site stays live.

## What is in here

```
config/      scope.json (the corpus definition), journals.csv + construct_tags.json (phase 2)
src/         the pipeline (harvest, metrics, snapshots, papers, render, narrative, openalex)
scripts/     backfill.py (one-time history seeding)
data/        the append-only snapshot history (this is the real database; never edit by hand)
docs/        the website (served by GitHub Pages); docs/data/*.json is generated
.github/     the weekly workflow
```

Data and metadata are from OpenAlex under a CC0 licence.
