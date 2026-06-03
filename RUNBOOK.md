# Runbook

Short, practical answers for running and fixing this project. No coding required for any of it.

## First-time deploy, click by click

1. **OpenAlex key:** <https://openalex.org/settings/api> → sign in → copy the key.
2. **Create the repo:** make a new **public** repo on GitHub and upload this whole folder
   (or push it with git). Public is required for the free, unlimited automation.
3. **Add the secret:** repo → Settings → Secrets and variables → Actions → New repository
   secret → name `OPENALEX_API_KEY`, value = your key → Add secret.
4. **Enable Pages:** repo → Settings → Pages → Source "Deploy from a branch" → Branch `main`,
   Folder `/docs` → Save.
5. **Build the history (recommended):** locally, once:
   ```
   python scripts/build_series.py
   git add data docs/data && git commit -m "Build history" && git push
   ```
   (Needs your key in `openalex.key` locally. This fetches the full yearly series, 2014 to now,
   in a few minutes. If you skip it, the first weekly run builds the same history on GitHub.)
6. **First live run:** repo → Actions → "Weekly update" → "Run workflow".
7. **Visit:** `https://<your-username>.github.io/<repo-name>/`

## Run it now, by hand

Actions tab → "Weekly update" → "Run workflow". That is the same thing the Monday schedule does.

## The API key expired or changed

Symptoms: a failure issue appears, or the site stops updating. Fix:
1. Get a fresh key at <https://openalex.org/settings/api>.
2. Repo → Settings → Secrets and variables → Actions → `OPENALEX_API_KEY` → Update.
3. Re-run the workflow (Actions → Run workflow).

## The schedule stopped running

GitHub disables a weekly workflow only after 60 days of **no repository activity**. Because
every successful run commits data, this should never happen. If it ever does: open the Actions
tab and click "Run workflow" once. That re-arms it.

## Change how often it runs

Edit `.github/workflows/update.yml`, the line `cron: "0 6 * * 1"`.
- Weekly (Mondays 06:00 UTC): `0 6 * * 1`  ← default, recommended.
- Daily (06:00 UTC): `0 6 * * *`. Daily adds noise, not signal; weekly is the honest cadence.

## Where the data is

- `data/snapshots/snapshot-YYYY-12-31.csv` — one file per year, plus one dated file for the
  current, still-incomplete year. Each weekly run refreshes the recent years as OpenAlex finishes
  indexing them; the git history is the permanent record of how the numbers firmed up. **Never edit
  these by hand.** You can open any of them in Excel.
- `data/feed/latest_papers.json` — the latest and most-cited papers shown on the site.
- `docs/data/*.json` and `docs/data/constructs.csv` — generated for the website. Safe to delete; a run rebuilds them.

## Re-key, re-scope, or expand later

- **Re-scope** (e.g. add an Education subfield): edit `config/scope.json` → `subfield_union`.
  Re-verify counts against `https://api.openalex.org/subfields/<id>` first.
- **Phase 2 overlays** (`config/journals.csv`, `config/construct_tags.json`): scaffolding for a
  curated journal core and field-specific construct tags. Not wired into the metrics yet. When
  you activate them, follow the add-only rule noted inside `construct_tags.json` so the history
  stays comparable. Verify each journal ISSN against OpenAlex `/sources` before relying on it.

## What "confirmed" vs "early" means on the site

A topic is labelled **confirmed** only after it has moved the same direction across several
consecutive snapshots and cleared a minimum volume. Anything younger is **early**. This is the
guard against reading a three-week wiggle as a real trend.

## Sanity check the numbers

Counts come from OpenAlex. To spot-check a topic, open
`https://api.openalex.org/works?filter=primary_topic.subfield.id:1203|3310&group_by=primary_topic.id&api_key=YOUR_KEY`
in a browser and compare.
