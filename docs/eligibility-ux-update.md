# Eligibility & discovery UX update (2026-11-14)

## Intent

An early-career researcher must be able to identify **what to investigate**, **what they can start personally**, **what needs a faculty/institutional sponsor**, and **what information is still missing**. The platform must never translate topic overlap into a final eligibility decision.

## What changed

- `docs/demo/matching.mjs` — `applicationPath()` now returns `kind`, `label`, `next`, `blockers`, and `checks`. Its kinds are `direct`, `partner`, `check`, `ineligible`, `watch`. **Direct means only that the catalog explicitly identifies a direct submission route; the sponsor must still verify final eligibility.** Sparse records never receive a direct route merely because `eligible_stages` contains the user's stage.
- `docs/demo/matching.mjs` — `fundingPriority()` moves resident-appropriate / reviewed opportunities above weak keyword imports and deprioritizes known stage mismatches. Open/rolling/forecast/unknown statuses are still shown explicitly; no timestamp alone proves an open portal.
- `docs/demo/index.html` & `demo.js` — optional profile fields capture appointment subtype, faculty rank, years since PhD, PI rights, protected research effort, and broad citizenship category. Unknown is a supported and preferred answer when uncertain. All profile details are kept in the user's browser storage. Optional eligibility details are *not* inserted into the assistant prompt.
- `docs/demo/cv-profile.mjs` — fixes a section-boundary error where the first line beginning "Teaching Assistant" or "Journal ..." terminated a professional-service membership list. Explicit AAPM, ACR, ASTRO and Sigma Xi lines are now detected. It prioritizes technical research-experience language and avoids extracting every sentence fragment as a research keyword. Suggestions (including organizations) are preselected for **user review**, not automatically saved.
- `docs/demo/demo.js` — application-plan headings and individual result cards show specific unresolved rules. Directory counts distinguish sources linked to indexed funding from directory-only sources.

## Limitations that remain

1. **No automated sponsor eligibility verification.** Structured rules cover only what the catalog editor recorded. The candidate must review the current official notice, especially protected time, immigration/citizenship eligibility, institution and PI authority.
2. **Incomplete curated catalog.** Most supplemental/imported items lack structured applicant rules and remain "check" items. New funding sources, dates or amounts were **not** scraped or independently refreshed in this change.
3. **Source dates can age.** "Listed open" is not a live availability check. The current date, opening date, deadline and stale-source warnings still matter.
4. **CV extraction is heuristic.** Scanned PDFs require user-provided text. Some institutions or appointment patterns may still need manual correction.
5. **Source directory ≠ award inventory.** Sources with no attached funding record are directory-only leads.

## How to verify

```bash
npm run test:core
pytest -q
python3 -m http.server 8010 --bind 127.0.0.1 --directory docs/demo
```

The 2026-11-14 validation ran 40 front-end unit/benchmark tests and 54 Python tests successfully. Two separate Cloudflare integration tests were not run in the offline environment because the `wrangler` dependency was unavailable. Static desktop/mobile rendering was checked at 1440px and 375px without horizontal overflow. A full browser network-interaction smoke test was blocked by the test environment's local-navigation restriction.

## Example clinical researcher regression test

Synthetic clinical CV text includes a 2026–2028 residency, technical research projects, and professional-service memberships following a "Teaching Assistant" and a "Journal of..." line. The regression test checks current institution/stage, four memberships, and meaningful scientific keyword recognition. Private CV files are not included in the distribution.
