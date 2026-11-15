# Changelog

## v5.3.1 — Color trim and sticky keywords (2026-11-15)

- Accent color kept only on the main search box; status labels and amount/deadline chips keep their soft tints. Links, buttons, selected filters, the tracker, keyword tags and pickers are neutral again.
- Clearing the search box (× or deleting the text) keeps its keywords as tags; only "Clear all" resets them.

## v5.3 — Calm accent color (2026-11-15)

- One muted slate-blue accent for buttons, links, selected filters, section labels and the tracker; warm off-white page background.
- Soft tinted status labels on result cards: green for open, blue for upcoming, amber for date not confirmed, grey for past rounds.
- Editable keyword tags under the search: remove any extracted keyword, add your own, restore removed ones; results update immediately. Hyphenated terms such as "single-cell" stay together.
- The AI-request form brings back separate Institutions and Memberships pickers: search the list, add any name, remove with ×. A worldwide institution search uses the Research Organization Registry.

## v5.2 — Cleaner, tighter interface (2026-11-15)

- One type scale: body text 15px, secondary text 13–14px, nothing below 12px (many labels were 10–11px).
- One neutral palette: the tracker, its stat cards, labels and saved state no longer use the old green theme.
- Shorter copy: removed caveat and instruction text that users don't need, the duplicate "pick up where you left off" panel and the green shortlist bar; tightened labels ("Best match", "Open now", "Official page", "Save").
- Societies and conferences now share the funder directory's layout.
- If a browser pairs a cached older page with a newer script, the page reloads once instead of reporting that the catalog could not be loaded.

## v5.1 — One search box (2026-11-15)

- The hero box is now the only search box; results update as you type, and Enter or an example search jumps to them. The duplicate box in the results section is removed.
- A line under the search explains what it matched on: recognized research topics, other words that also count, support type (fellowship, grant, travel…) and any career stage that boosts matching fellowships.

## v5.0 — Broad search on the web, personalization in the skill (2026-11-15)

- **Web demo is now a broad, cross-disciplinary search.** The research-profile form and personalized match dashboard are removed from the page. Search comes first, then the application tracker, then a hand-off panel that builds a request for the user's own AI assistant and compares what the website and the Fundlark skill each do.
- **Plain-language search.** Any query word now counts, not only research-dictionary concepts, so funder names ("Damon Runyon") and unlisted topics ("gentrification") are found. Title words and adjacent phrases ("single cell") rank higher than scattered words; stage words ("postdoc", "PhD") boost matching fellowships only when the topic also matches. Added `search-text.mjs`.
- **Early-career fellowships.** New `fellowships.json` (19 records, built by `scripts/build_fellowships.py`): Damon Runyon, Jane Coffin Childs, Helen Hay Whitney, LSRF, HHMI Hanna Gray, CRI Irvington, AACR, BWF CASI, HFSP, Humboldt, Schmidt Science Fellows, NSF GRFP, Hertz, NDSEG, DOE CSGF, Paul & Daisy Soros and NAEd/Spencer. Each was checked on the funder's page on 2026-11-15; deadlines appear only where that page stated them, with timing evidence.
- **Stale rounds.** A record named for a year two or more years past (e.g. "2022 … Fund") with no current deadline is shown as a past round.
- **Assistant request** includes research location and a readable career stage, adds the fellowships index, and opens with "Use the Fundlark skill" when the user says it is installed.
- **Skill 0.3.0:** start junior researchers with fellowships that fund the person; treat aggregators and newsletters as pointers to the official page and report conflicts.
- Tests: new `broad-search-v5.test.mjs`; UI tests updated for the new layout (132 JS + 67 Python passing).

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
