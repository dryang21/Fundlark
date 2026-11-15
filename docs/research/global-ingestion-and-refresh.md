# Fundlark v4.9 — Global discovery, verification, and refresh architecture

**As-of initial seed:** November 14, 2026. **Primary rule:** an agency portal, a historical funding program and a currently accepting call are different records. The bundled system is a broadening *discovery* catalog, not an assurance that 100% of world academic grants are known or currently open.

## What is actually included

- Existing v4.8 catalog: 961 distinct records after the existing deduplication algorithm, sourced from four static JSON catalog files. The legacy data contains closed and unverified records and has a strong U.S./Stanford bias.
- Global seed: named schemes and program families for funding agencies, universities, learned societies, foundations and companies across ten main program regions (U.S., Canada, U.K., E.U., Germany, Australia, Hong Kong, Singapore, New Zealand, International). The source *directory* includes many additional country-level entry points across Europe, East and South Asia, South America, Africa and Oceania. Program family records use `status: verify` by default and no fabricated deadlines.
- Official funder source directory: original 81 plus new deduplicated entry points. Newly introduced URLs are candidate official public resources and **not all were live checked**; `last_source_review: null` documents this.
- Discovery queues: 183 universities/research institutions, 97 industry companies and 205 distinct societies/foundations. **Queues are not grants**. Each needs official funding-program verification before promotion.
- `data/global/funding.sqlite` and `data/global/all-funding-opportunities.csv` include the **complete frontend-merged dataset** (existing + new). `data/global/global-programs.csv` and `docs/demo/global-programs.json` contain the additional seed entries only; the website dynamically merges these with the original catalog. `source-registry.json` and `program-registry.json` are editable source-of-truth input files.
- `data/global/research-field-region-matrix.json` is a conservative 13-field × region coverage matrix. An empty cell is a research/indexing gap, NOT proof a country has no grants.

## Distinct information layers

| Layer | Typical evidence | UI status | Published automatically? |
|---|---|---|---|
| Source hub | Official grants portal, funder research page, university research office | `Browse official funding sources` | Yes, with provenance caveat |
| Program family | Named recurring fellowship or scheme from the funder's official listings | `Verify`, no unverified deadline | Yes, as discovery lead only |
| Specific round | Official sponsor notice with round ID, window and applicants | `Open/Forecast/Closed` only when documented | Only after editorial checks |
| Applicant eligibility | Sponsor rule + sufficient self-declared applicant data | Known conflict or expandable caveat | Never inferred from topic match |
| Discovery queue | Target university/company/society to investigate | Not a funding result | Never |

Do not silently turn funding history (e.g., OpenAlex past awards), a sponsor logo, or a generic landing page into an open grant. Keep eligibility and relevance separate. Do not invent currency, award amount, citizenship, institutional PI privileges, date, protected time, or funding type.

## Refresh/update cadence

| Source family | Candidate schedule | Technical method | Human review |
|---|---|---|---|
| U.S. cross-agency Grants.gov | Daily | Official `POST https://api.grants.gov/v1/api/search2` through `scripts/refresh_public_catalog.py` | Review calls and applicant rules before promotion |
| European Commission Funding & Tenders | Daily after a tested adapter is built | Official public SEARCH/FACET API | Normalize reference codes, deduplicate calls by topic/call identifier |
| National research agencies (UKRI, DFG, NHMRC, Canada Tri-Agency, RGC, NRF/NMRC, etc.) | Weekly | Official data feeds where available; otherwise change monitoring | Verify calls, deadlines, nationality/host rules |
| University internal awards and limited calls | Monthly (weekly near known rounds) | Research-office pages and opt-in campus administrators | Some pages are private; campus participation needed |
| Industry RFPs, cloud credits, research fellowships | Weekly | Company academic research programs pages + dated press releases | Distinguish credits from money and job posts from research awards |
| Societies, travel awards and disciplinary foundations | Monthly and ahead of annual conference cycles | Official society/foundation listing pages | Verify standing membership, student category and nomination routes |
| Record QA / broken links / duplicate reviews | Weekly | Coverage matrix + independent link audit where authorized | Manually accept source changes and resolve discrepancies |

### Online automated process (requires deployment)

`.github/workflows/global-funding-refresh.yml` is configured for a daily GitHub Actions run and manual dispatch. When enabled in the **user's own GitHub repository**, it:

1. Validates the global source/program seed registries.
2. Queries a bounded cross-disciplinary sample of **public Grants.gov** posted/forecast records and produces `data/global/staging/grantsgov-proposed-catalog.json`. It does not modify published data.
3. Checks a rotating subset of public official-source pages, respects robots.txt, and stages `source-change-review.json` and baseline source hashes. Changes are **alerts for editors**, not new awards.
4. Creates/updates an editorial pull request with candidate data. Human reviewers confirm sources, deadlines, eligibility and publication rights. The PR must not auto-merge.

Scheduling starts only when the workflow is committed to GitHub on a repository where Actions is enabled and has pull-request permissions. It does **not** run from this chat, the offline ZIP, or a local Python server. API failures and robots restrictions are recorded rather than bypassed; previous published listings are retained.

**Important:** The current Grants.gov collection samples 17 disciplinary keywords with bounded pagination. It does not harvest the complete federal catalog and can miss grants. To reach exhaustive coverage, implement source-defined full pagination, global opportunity ID deduplication, and query completeness audits, respecting official API constraints.

### Human-reviewed promotion of federal candidates

After inspecting the proposed catalog and complete official notices, create a JSON array of exact IDs such as:

```json
["grantsgov:123456", "grantsgov:234567"]
```

Preview:

```bash
python scripts/promote_reviewed_candidates.py --candidate data/global/staging/grantsgov-proposed-catalog.json --approved reviewed-ids.json
```

Explicitly write approved rows into `docs/demo/data.json`:

```bash
python scripts/promote_reviewed_candidates.py --candidate data/global/staging/grantsgov-proposed-catalog.json --approved reviewed-ids.json --apply
```

The promoter requires an allowlist, checks expected official URL patterns, protects editorially curated records, and retains applicant eligibility as **unverified** until checked. No grant can be promoted by the page-change monitor alone.

### Local maintenance commands

```bash
python scripts/build_global_catalog.py        # regenerate additional global JSON and seed CSV, coverage report
python scripts/export_complete_database.py    # export complete merged CSV + SQLite
python scripts/build_global_catalog.py --check  # validate seed schema and URLs
python scripts/global_coverage_matrix.py      # update gap matrix
python scripts/build_discovery_queue.py       # university and industry outreach targets
python scripts/build_society_foundation_queue.py
python -m pytest -q
```

To collect a **staging preview** from Grants.gov on a machine with internet access:

```bash
python scripts/refresh_public_catalog.py --pages 2 --rows 50 --output data/global/staging/grantsgov-proposed-catalog.json
```

To monitor a shard of public source pages:

```bash
python scripts/global_source_monitor.py --limit 30
```

Network requests have **not** been executed against the official endpoints from the offline build environment. Their successful operation in production is not verified by the local tests.

## How to get closer to comprehensive coverage

1. Cover **every country × field × funder class** systematically. Use `global-field-region-gaps.md` to prioritize regions without indexed topical programs. Keep separate flags for *no verified opportunity indexed* versus *no funding program exists*.
2. Expand government APIs by country: UKRI, EU calls, German DFG, French ANR, Canadian Tri-Agency, Australian GrantConnect/NHMRC, Hong Kong RGC/ITC, Singapore NRF/NMRC, South Korea NRF, Japan JSPS/JST, India ANRF/ICMR/DBT, Taiwan NSTC, New Zealand MBIE/Marsden, Swiss SNSF, Swedish VR, Dutch NWO, Nordic research councils and others.
3. For universities, locate publicly linked research-office **internal seed funding**, graduate/postdoctoral fellowships, faculty development, philanthropic restricted funds, patient-care innovation seed programs and discipline-specific institute awards. Where intranets require auth, offer explicit campus administrator submission and leave content unindexed until authorized.
4. For societies/foundations, search each society's fellowships, research grants, new-investigator awards, travel, dissertation and meeting sections. Do not assume every society funds research; record negatives and last-checked date.
5. For industry, check AI/cloud credits, faculty RFPs, PhD fellowships, equipment and lab access, industry-sponsored collaborative proposals, clinical investigator-initiated trials, and startup-oriented innovation awards. Maintain *award type* (cash/credit/hardware/data/training/travel) and sponsor restrictions. Avoid treating internships/jobs as grants.
6. Use Crossref Open Funder Registry / OpenAlex to discover **funder identities and historical award relationships**, never as proof that a program is currently accepting applications. Use official funder sites for eligibility and open dates.
7. Design an opt-in university/funder contribution form with editorial approval, evidence attachments and source update expiry; enable participation at scale rather than relying exclusively on public-site crawling.
8. For each official-specific round, preserve ID, sponsor, parent family, official URL, first-seen date, last-reviewed date, funding category, currency, amount evidence, applicant restrictions, submission stage, opens/closes/time zone, and availability status.

## External official references

- US official Grants.gov API: https://www.grants.gov/api/api-guide
- EU Funding & Tenders public APIs: https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis
- UKRI funding finder: https://www.ukri.org/opportunity/
- Canadian federal research program calendar: https://www.canada.ca/en/research-coordinating-committee/program-calendar.html
- Australia GrantConnect: https://www.grants.gov.au/
- Hong Kong RGC funding: https://www.ugc.edu.hk/eng/rgc/funding_opport/
- Singapore NRF: https://www.nrf.gov.sg/
- Anthropic AI for Science: https://support.claude.com/en/articles/11199177-anthropic-s-ai-for-science-program
- OpenAI Researcher Access: https://openai.com/form/researcher-access-program/
- AWS Cloud Credit for Research: https://aws.amazon.com/government-education/research-and-technical-computing/cloud-credit-for-research/
- Google PhD Fellowships: https://research.google/programs-and-events/phd-fellowship/
- Apple Scholars AIML: https://machinelearning.apple.com/work-with-us
- Qualcomm Innovation Fellowship: https://www.qualcomm.com/news/releases/2026/10/qualcomm-launches-2027-innovation-fellowship-program-for-north-a

**Maintenance principle:** Coverage grows by verified programs and official calls, not by inflating portal/target counts. Every update must remain auditable and reversible.
