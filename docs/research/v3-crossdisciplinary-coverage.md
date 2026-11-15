# Fundlark v3: multidisciplinary funding and coverage audit

**Audit date: November 14, 2026.** This document distinguishes *indexed program records*, *official source portals*, and *independently checked application windows*. None of the metrics below is a count of grants a particular researcher is eligible for.

## What changed

Fundlark v3 extends the previous medical/AI-focused prototype into a local-first funding workspace that works across 13 research groups: computing & AI; medicine and public health; life sciences; engineering; physical sciences; climate, earth & environment; mathematics; social/behavioral sciences; humanities & language; education; agriculture & food; arts, media & design; and business, law & policy.

The static app now provides a **personalized funding dashboard**, field browser, research-stage and appointment profile, explicit uncertainties in application routes, personal application tracker, deadline calendar (ICS), CSV export, and a browsable **official funding source directory** with field, region and sponsor-type filters. Saved research profiles and tracker notes are local to the browser.

## Quantitative baseline (snapshot as of 2026-11-14)

| Metric | Value | Interpretation |
|:--|--:|:--|
| Distinct indexed funding records | 961 | Merged and deduplicated display records, some very old |
| Closed/past rounds | 474 | These are **not** current applications |
| Listed open | 298 | Catalog status; **not** independently verified as accepting applications today |
| Listed rolling | 10 | Check sponsor rules and any current call changes |
| Upcoming/forecast | 132 | Not currently open by definition |
| Status unknown / requires confirmation | 47 | Never label these as currently open |
| New individually reviewed crossdisciplinary call examples | 19 | Official program URLs and source-check dates, not an exhaustive sweep |
| Official sponsor directory records | 81 | Entry points to search; **not** 81 open grants |
| Regions in sponsor directory | 21 | Country/region labels; varying density |

Source-category bias in the **indexed catalog**: 490 institutional, 392 government, 50 society, 20 industry, and 9 foundation entries. The very high institutional count reflects a large Stanford-specific inventory. **This is still a significant coverage gap** for a global platform, especially non-U.S. foundations, private industry, agriculture, mathematics, and lower-coverage regions.

### Coverage by broad research field

Heuristic record tags are approximate, may overlap, and are not a measure of complete or correct disciplinary coverage.

| Research field | Indexed records with a matching field tag |
|:--|--:|
| Computing & AI | 77 |
| Medicine & public health | 340 |
| Life sciences | 50 |
| Engineering & technology | 71 |
| Physics, chemistry & materials | 42 |
| Climate, earth & environment | 35 |
| Mathematics & statistics | 27 |
| Social & behavioral sciences | 27 |
| Humanities & language | 29 |
| Education & learning | 101 |
| Agriculture & food | 11 |
| Arts, media & design | 32 |
| Business, law & policy | 71 |

## Publisher/maintainer workflow

1. Identify official agency/funder call pages or API feeds; do not copy unreviewed third-party grant claims as verified.
2. Add navigational sources to `scripts/build_source_hubs.py` (`RAW` lines: ID, title, region, funder class, field tags, official URL, description), and run `python3 scripts/build_source_hubs.py`. A sponsor source is not an open opportunity.
3. For a **specific** published call, confirm deadline, open state, award form, career stage, host country, PI rights, citizenship and membership on its official page. Add an editorial entry in `scripts/build_crossdisciplinary_examples.py`, or use the existing review and catalog-import workflows. Mark uncertain windows `verify`, recurring open opportunities `rolling`, future rounds `forecast`. Keep `last_verified_at` updated only after inspection.
4. Run `npm run test:core` and `pytest -q`; verify the dashboard with a medical CV, engineering student, education researcher, humanist, and environmental PhD candidate.
5. Use the backend's optional Grants.gov and Simpler.Grants.gov import routes to refresh U.S. federal opportunities; source monitor/agent contributions still require maintainer review. There is **no automatic global crawl** of the 81 portals.

## Prioritized next coverage investments

- **Automated official integrations** (where terms and rate limits permit): Grants.gov, NSF, NIH/NIH NOFO filtered feeds, UKRI, EU Funding & Tenders, Canada agency calls, ANR, DFG, ARC, NHMRC, and national portals. Build separate adapters with provenance and audit logs; do not silently treat portal home pages as grant data.
- **Partnered university + foundation sources**: non-Stanford university internal grants, independent societies, Mellon, Sloan, Spencer, Wellcome, Simons, national humanities programs, regional and emerging-market research foundations.
- **Researcher eligibility rigor**: structured citizenship/immigration, host-country, faculty rank, years since PhD, prior-grant history, fellowship appointment, sponsor membership and institution-specific PI rights; default to “check” when metadata absent.
- **Quality benchmarks**: hand-reviewed gold sets for at least five distinct career stages and 13 fields; measure top-10 precision, eligible-vs-ineligible false positives, missing program recall, and stale deadline rates. Do not evaluate with topic similarity alone.
- **Product services**: authentication, encrypted server-side user storage if sync is added, deadline change alerts, duplicate rounds, source coverage dashboards, and abuse-resistant ingestion moderation. Never transmit CV text to sponsor sites or community services without explicit consent.

## Trust and privacy boundaries

- Relevance **is not** an eligibility verdict. Even an “individual/direct route” means only that a person can begin reviewing an individual submission path.
- Indexed statuses and amounts may have been superseded since their `last_verified_at` date. A forecast status must never be reported as open merely because the calendar date passed.
- Sponsor portals show **where to look**, not how many opportunities are available today.
- The static demo retains user CV-derived profile suggestions and personal tracker information in the local browser. External institution lookup and official sponsor browsing are separate, user-initiated actions.
- No website can truthfully guarantee exhaustive global fellowship/grant coverage without maintained APIs, partnerships, ongoing manual review and validated country-specific eligibility rules.
