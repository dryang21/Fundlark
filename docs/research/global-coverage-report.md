# Fundlark global discovery: coverage and evidence audit

This release expands **discovery**, not verified live grant availability. A source is a portal; a program family is an established scheme; an open call has a published application window. They must never be counted as equivalent.

- Existing input catalog records (before merge): **1017**; distinct input IDs: **961**.
- New maintained named program records: **263** (from 265 program seeds).
- New funding-source hubs published: **144** (from 168 seeds), plus 81 prior hubs.
- Added family-level entries with **unknown next open round**: **246**.
- Added identified specific calls: **17** (verify the linked official notice).

## New programs by sponsor type

- Foundation: 26
- Government: 126
- Industry: 14
- Institution: 50
- Society: 47

## New program coverage by location

- Australia: 18
- Canada: 34
- European Union: 11
- Germany: 16
- Hong Kong: 41
- India: 1
- International: 35
- New Zealand: 3
- Singapore: 18
- United Kingdom: 26
- United States: 59
- United States/Canada: 1

## New source directory coverage by location

- Africa: 1
- Argentina: 1
- Australia: 7
- Austria: 1
- Belgium: 1
- Brazil: 3
- Canada: 4
- China: 1
- Denmark: 3
- Europe: 1
- European Union: 6
- Finland: 1
- France: 2
- Germany: 2
- Hong Kong: 6
- India: 5
- International: 28
- Ireland: 1
- Israel: 1
- Italy: 1
- Japan: 4
- Netherlands: 2
- New Zealand: 3
- Norway: 1
- Poland: 1
- Portugal: 1
- Singapore: 8
- South Africa: 1
- South Korea: 1
- Spain: 2
- Sweden: 3
- Taiwan: 1
- United Arab Emirates: 1
- United Kingdom: 10
- United States: 29

## Operational limitations and gaps

1. These records were seeded from named funders and scheme families; many official pages were **not independently reviewed during this build**. Null `last_source_review` denotes an unreviewed listing.
2. National calls are not automatically restricted to applicants in that nation. Eligibility differs by sponsor and must be checked against the official scheme.
3. Institution-only/internal grants may require an authenticated campus intranet and can only be partially indexed without institutional access.
4. Industry programs may offer compute credits, datasets, equipment, sponsorship or research fellowships rather than unrestricted cash.
5. Portal/source changes are staging signals, not grant approvals. Automated checks must respect usage policies, robots rules and private data.
6. The included grants.gov update tool collects a bounded set of topics. It is **not an exhaustive federal harvest** and should be treated as a candidate ingestion feed.
7. A globally comprehensive list of every society, foundation and university cannot be guaranteed. Maintainers should publish field × country × funder-type coverage and unresolved gaps.

## Refresh policy

- Daily (when a remote GitHub Actions workflow is enabled): query public Grants.gov discovery API; stage a proposed catalog for human review.
- Weekly: monitor public official source listing pages for material changes and stage review alerts. No restricted-content scraping.
- Monthly: manually review frequent-changing institutional, industry and foundation sources; confirm that old deadlines have not been carried into new rounds.
- Each record should preserve official URL, evidence grade, last review, window status, original sponsor, and the applicant-rule caveats.
- Never infer that a program is open from an award history, program name or university/society directory link.
