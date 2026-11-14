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
