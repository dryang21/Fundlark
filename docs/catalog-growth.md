# Grow Fundlark’s catalog on a small budget

Prioritize the funding researchers are least likely to find in a single government portal: professional society awards and travel grants, company research support and credits, and university seed funding. Keep federal opportunities as secondary coverage. Track verified calls by category, field, career stage, and institution; more federal records alone do not close affiliation gaps.

Collect from official feeds when offered, otherwise watch official funding pages. From the checkout, run:

```sh
python -m app.jobs --monitor --category Society --category Industry --category Institution --summary
```

This reads the registered pages in `app/sources.json`, honors robots rules, uses cache validators when available, and stores candidate links and page changes in local SQLite. Skipped or inaccessible sources need direct review. The runner reads public pages; it does not use a paid search or model API. No user CV or profile is used as a query.

Review candidates against the exact official call. Record what it funds, who can apply, and the deadline or next step. Distinguish awards open to all applicants from those that require society membership or an institutional appointment. Do not turn a directory link into an award or infer a new deadline from an old round. When a call is restricted to an internal portal, save the public route and explain the access constraint.

Publish the curated snapshot as static JSON, separate from the local review queue. Add or amend the source and its funding records, then run `python scripts/build_coverage.py --check` and review the diff before release. A weekly watch is a reasonable starting cadence; schedule it separately if desired. Rotate editorial review across fields and start with organizations that users actually add to their profiles, without collecting their profile data remotely.

For optional triage, run `python -m scripts.triage_catalog` with an installed Ollama model (`--model` selects a different local model). It sends only public titles and URLs to the local Ollama server and prints a suggested review order. It makes no database changes and cannot verify funding facts. Skip it when the queue is straightforward or no local model is available.

## Expanded official listings

Run these commands from the Fundlark checkout. Stanford collection follows the host's crawl delay and takes several minutes.

```sh
python -m scripts.collect_stanford_seed /tmp/fundlark-stanford.json
python -m scripts.refresh_public_catalog --output /tmp/fundlark-federal.json
python -m scripts.build_supplemental_catalog /tmp/fundlark-stanford.json /tmp/fundlark-federal.json --store-local
```

The supplemental static snapshot combines official listings with a basic research relevance filter for federal results. Listing metadata still needs applicant-level review. The site keeps editorial records when an imported listing points to the same call, hides closed rounds by default, and labels the import source on each card. SQLite inserts only new IDs; updating the static snapshot does not overwrite prior local reviews.

Structured opportunity fields are additive: numeric `amount_min` and `amount_max` in whole currency units, ISO currency code, maximum award period in months, ISO opening and deadline dates, local deadline time with IANA time zone, and structured `eligibility_rules`. Keep the original amount and applicant summaries for tiered and conditional awards. Leave unknown fields null; do not assume an amount or convert currencies. Institution and society tags drive affiliation matching; the eligibility rules are source facts for review, not a determination that any applicant qualifies.

## Expand toward commercial catalog coverage

Compare equivalent measures. [Pivot-RP](https://clarivate.com/academia-government/scientific-and-academic-research/research-funding-analytics/pivot-rp-funding/) reports 34,000+ active opportunities; [GrantForward](https://www.grantforward.com/subscription_plans) advertises 84,000+ opportunities without defining that figure as active on its pricing page. Keep separate counts for listed open or rolling, upcoming, application window unconfirmed, and past rounds. Don't count directory links, prior awards, or unannounced annual schemes as open calls.

Start with free public sources that can be checked repeatedly. Use the [UKRI Funding Finder](https://www.ukri.org/opportunity/) collector to stage a proposal:

```sh
python -m scripts.collect_ukri --output /tmp/fundlark-ukri-proposal.json
```

The importer keeps titles, funders, official call URLs, application windows, and stated amounts. It excludes closed calls and loans, preserves deadlines in UK local time, and leaves applicant eligibility unreviewed. If pagination fails or the site returns an incomplete snapshot, the current snapshot is left intact. Review status changes and duplicates before replacing `docs/demo/ukri-calls.json`. The existing GitHub workflow can stage the same snapshot for review; it cannot publish the snapshot to the catalog. Collection needs no API key or model. For a local combined CSV and SQLite export, run `python scripts/export_complete_database.py`; treat the database as a generated artifact.

Next, add one collector at a time for sources with real call data, beginning with the [EU Funding & Tenders API](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis) and the [Grants.gov extract](https://www.grants.gov/xml-extract). Filter for research grants and fellowships, and keep procurement, award history, and deferred calls distinct. Use this bulk layer for breadth. In parallel, review society and conference award calendars, company research grants and credits, foundation calls, and internal seed funding across universities. Track the number of actionable calls by sponsor type and region so government imports cannot hide gaps in member and campus funding.

The bulk collector stages separate files for current discovery and historical lookup. Download the dated ZIP linked on the [official Grants.gov extract page](https://www.grants.gov/xml-extract) and run:

```sh
python -m scripts.collect_bulk_calls /path/to/GrantsDBExtractYYYYMMDDv2.zip --output-dir /tmp/fundlark-bulk
```

Use `--federal-only` to stage just the federal source if Horizon Europe's pagination fails. Retain the last healthy source snapshot before promoting a partial refresh. The federal importer scans the extract once and keeps discretionary grant and cooperative agreement calls with a civilian research signal. It excludes procurement, continuations, and other excluded categories; those checks are relevance filters, not eligibility reviews. The import distinguishes dated past rounds, published calls with a valid window, forecasts, and uncertain windows. It keeps only public opportunity facts and does not ingest contact information or raw descriptions. Dedupe with existing records before comparing counts. A major increase in historic rows does not close a current opportunity or sponsor gap.

Review and copy `bulk-calls.json` and `bulk-archive.json` together. The archive revision prevents mismatched files from being combined. The demo loads the compact archive when a visitor chooses **Past rounds** or **All programs** in Explore; day-to-day matching uses the smaller current catalog. Validate both availability modes and a search by official call number. To verify a downloadable export without changing the working tree, run `python scripts/export_complete_database.py --output-dir /tmp/fundlark-export`. Judge coverage on the relevance and eligibility of the first page for sample profiles across fields and institutions, alongside the raw totals.
