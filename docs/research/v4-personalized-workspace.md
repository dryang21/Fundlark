# Fundlark v4 — personalized workspace and independent exploration

Release date: November 14, 2026. Based on v3.1 CV-personalized-funding-fix.

## Step 1 — stage-aware research profile

The optional CV import, institutional affiliation, research topics, society memberships,
research host region, and sensitive eligibility fields remain browser-local. Profile
questions depend on the selected stage:

| Stage | Stage-specific questions |
| --- | --- |
| Undergraduate / Master's / PhD student | Current year of study, expected completion year |
| PhD student | Also optional protected research time |
| Medical/clinical resident | Appointment subtype, expected completion year, optional prior PhD award year, protected research time, PI permissions |
| Postdoc | Optional PhD award year, expected appointment end, appointment subtype, protected research time, PI permissions |
| Research staff | Optional PhD award year, appointment subtype, protected research time, PI permissions |
| Faculty | Faculty rank, optional PhD award year, protected research time, PI permissions |

Years since PhD is computed in calendar years from a completed PhD award year for
applicable stages. The UI does **not** ask students without a doctorate for this number.
Changing to a student stage clears hidden post-PhD application conditions from the
normalized matching profile.

## Step 2 — all personalized matches in one panel

- The dashboard always displays **every** matching catalog record instead of a six-item
  shortlist. `34 shown` means 34 rendered result rows for the test CV.
- Source filters for society, university/institution, government, industry, and
  foundation are directly above the matching list, with counts from the current profile.
- Search within matches, career/application route, research field, availability,
  support type, and saved-only filters are also in that same result panel.
- The optional collapsed *First applications to investigate* guide remains within Step 2.
- The application tracker (saved programs, target dates, stages, notes, CSV and ICS)
  is a tab in Step 2, not a standalone step below Explore.
- Source counts are record counts, not counts of independently verified applicant
  eligibilities. `Individual route indicated` means the program has a structured
  individual application route **subject to official verification**.

## Step 3 — independent catalog exploration

- Text search can use a full research idea and/or keywords, plus optional suggested
  topics and multi-select discipline chips.
- All funder types, support types, dates, and optional career-stage filters work
  without constructing a CV or selecting a personal profile.
- Search ranks text/topic overlap heuristically. It is *not* a semantic search model,
  live internet search, or determination of applicant eligibility.
- Only the first 24 **general** catalog results render at once, with working `Show more`
  pagination. Matched results in Step 2 are **not truncated**.
- The separate official-funder hub directory remains available after Step 3.

## Current coverage and limitations

All existing catalog JSON files are preserved, including the broad v3 catalog and
81 official funding hubs. This release improves discovery and navigation, **not**
new funding collection, freshness, or exhaustive global coverage. Some records refer
to historical calls. The current official sponsor page remains the source of truth.

## Validation

- 50 core JavaScript tests passed (new stage-awareness, cross-field exploration,
  and dashboard test cases included).
- 54 Python tests passed.
- Browser-driven CV import showed 34 of 34 matched leads in the Step 2 DOM. Society
  filtering reduced this to four; tracker save and tabs worked; general Explore remained
  independent. Undergraduate, master's, PhD, postdoc, resident, engineering, humanities,
  education and 375px mobile behaviors were checked.
- The two community-Worker tests need a local Wrangler install to run; they were not
  verified in the packaged environment.
