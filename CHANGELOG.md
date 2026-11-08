# Changelog

## Unreleased

- Extend affiliation pickers with reviewed profile/CV suggestions and cross-disciplinary examples; recognize unknown organizations in explicit CV membership sections.

- Fix empty society/institution catalog categories with sourced program records and honest closed/verify states.
- Send saved affiliations to Discover, retain affiliation metadata in SQLite/public exports, and explain affiliation ranking separately from eligibility.
- Keep official funding-source routes visible when no indexed records match filters, with a clear-filter action and a testing guide.

- Expand to 25 official source routes, including 15 industry sources and IEEE/ASTRO/AAPM/Stanford discovery.
- Add reviewable CV affiliation evidence, editable browser-local memberships/institutions, and explained source recommendations without inferring eligibility.
- Add 10 industry program records marked `verify`; seven additional affiliation/profile tests pass (41 total).

- Add a portable Fundlark agent skill, optional keyless standard-library federal search, and documented Codex/Claude Code installation.
- Add an allowlisted public snapshot exporter, static catalog demo, skill ZIP packaging, and a manual GitHub Pages workflow.
- Record a dated source review of six popular/scientific skill repositories and add host behavior evaluation scenarios (not yet run).

- Preserve pending source-change reviews across later checks and temporary failures.
- Retain 20 distinct official-page snapshots per source and show their text/link diffs.
- Record page reviews against the current snapshot hash; reject reviews of outdated snapshots.
- Add persistent candidate-link triage and review audit history without automatic publication.
- Bound collection responses, retry transient failures, use HTTP validators and check robots restrictions at every allowed redirect target.
- Parse nested Simpler.Grants.gov summaries and share canonical IDs with Grants.gov where available.
- Distinguish empty searches, partial syncs and failures; return nonzero collection-job exits for incomplete coverage.
- Fix overview metrics when live opportunities have no deadline and correct calendar-day countdowns.
- Protect CSV exports against formula execution; bound individual search terms and profile keywords.
- Add GitHub contribution templates, an explicit Node.js CI runtime, Docker context exclusions and additive database migrations.

Validation: 46 Python tests, JavaScript syntax validation, skill frontmatter validation, live keyless skill-helper retrieval on Python 3.9 and 3.12, live Grants.gov import, eight official-page baseline checks, and mobile inspection of the local dashboard and static demo. Static search/filter behavior and browser skill download were checked. Docker was unavailable locally. The authenticated Simpler adapter was checked against its official OpenAPI schema and mocked responses; a live authenticated request was not made. Actual Claude Code skill behavior has not been evaluated locally.
