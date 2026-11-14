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
