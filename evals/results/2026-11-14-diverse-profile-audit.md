# Fundlark v4.9: expanded profile audit, November 14, 2026

We ran the browser demo’s matching and keyword extraction code against **72 fictional profiles**, across **31 named countries, 38 self-described fields and all seven supported career stages**. One user left country and stage unspecified. The selected institutions are context, not real participants. The run loaded 1,917 catalog records; the larger, on-demand archive is not part of the default personalized search. A local Qwen reviewer interpreted the output, and selected sponsor rules were separately checked on official sites. The 72 runs exercise code, not 72 interactive browser sessions or an end-to-end model search.

| Measure | Result |
|---|---:|
| No personalized leads | 35 of 72 |
| No extracted keywords | 23 of 72; all 23 returned no leads |
| Keywords extracted but no leads | 12 of 72 |
| Fewer than three leads | 39 of 72 |
| Median leads | 1 |
| No lead listed open or rolling | 38 of 72 |
| No exact country choice | 31 of 71 who supplied a country; 8 used Europe / EU and 23 used Other |
| Top-five slots requiring verification | 167 of 167 returned across the 37 non-empty cases |
| Top-five slots with only broad topical field evidence and no affiliation match | 122 of 167 |

“Listed open or rolling” is the catalog status, not a live source check. The top-five statistics count displayed slots, so a grant recommended to several profiles is counted several times. “Needs verification” is not an error verdict or a measure of eligibility precision. The fixtures are intentionally varied and do not represent a random sample of researchers.

- **Retrieval failure:** the German robotics profile still returned zero leads because no topics were recognized. Adding “robotics” restored 27, including an indexed [Horizon Europe robotics collaboration call](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL4-2027-02-DIGITAL-EMERGING-52-two-stage). Japan’s soft-robotics profile also produced zero keywords.
- **False progress:** the Kenyan crop researcher saw one result, a [USDA program limited to Hispanic-serving institutions](https://www.nifa.usda.gov/grants/funding-opportunities/hispanic-serving-institutions-education-grants-program). Brazil’s agroforestry researcher got 25 leads, but the first was an [MRC call for medical product development](https://www.ukri.org/opportunity/ukri-translation-mrc-impact-acceleration-awards/), a topic mismatch. MRC permits eligible international partners or co-leads under separate rules, so sponsor geography alone is not a reason to exclude it.
- **Control passed:** the [Adobe India AI fellowship](https://research.adobe.com/india-ai-research-fellowship/) remained hidden for the U.S. PhD and ranked first for the India PhD. Fundlark still did not establish an open application window.
- **Limits of measurement:** a zero list after keyword extraction can reflect missing records, a stage or affiliation filter, or an overly strict relevance rule. It does not prove there is no funding. These cases are best used to guide fixes and check regressions.

Fix failed keyword extraction and add country entry before widening the public catalog further. Rank candidates with specific topic evidence and confirmed application routes before broad matches. The [personal workspace proposal](../../docs/personal-workspace-proposal.md) describes the skill-to-tracker handoff.

Reproduce with `node scripts/audit_current_matches.mjs --expanded` from the v4.9 root. The 65 added synthetic profiles are in [diverse-profiles.tsv](../diverse-profiles.tsv); the original seven remain in the script. Counts can change as calls and the catalog change.

## Per-profile results

| Profile | Country | Field | Stage | Topics extracted | Leads | Listed open or rolling | First lead |
|---|---|---|---|---:|---:|---:|---|
| stanford-medical-physics | United States | medical physics | resident | 6 | 54 | 16 | [Stanford AIMI–AWS Cloud Credit Program](https://aimi.stanford.edu/aws-cloud-credit-program) |
| us-ai-phd | United States | computing | phd | 3 | 57 | 14 | [Anthropic AI for Science — Research Credits](https://www.anthropic.com/news/expanding-support-for-scientists) |
| india-ai-phd | India | computing | phd | 3 | 58 | 14 | [Adobe India AI Research Fellowship](https://research.adobe.com/india-ai-research-fellowship/) |
| uk-humanities-postdoc | United Kingdom | humanities | postdoc | 4 | 18 | 11 | [AHRC International Placement Scheme 2027](https://www.ukri.org/opportunity/international-placement-scheme-2027/) |
| canadian-engineering-undergrad | Canada | engineering | undergrad | 2 | 22 | 9 | [ASME Engineering Scholarships — Undergraduate (2027–28)](https://www.asme.org/asme-programs/students-and-faculty/scholarships/4-year-baccalaureate-graduate-students) |
| german-robotics-faculty | Germany | robotics | faculty | 0 | 0 | 0 | — |
| nigerian-agriculture | Nigeria | agriculture | faculty | 3 | 14 | 6 | [USDA NIFA Hispanic-Serving Institutions Education Grants](https://www.nifa.usda.gov/grants/funding-opportunities) |
| us-chemistry | United States | chemistry | undergrad | 1 | 0 | 0 | — |
| us-nursing | United States | nursing | masters | 0 | 0 | 0 | — |
| us-math | United States | mathematics | phd | 2 | 0 | 0 | — |
| us-education | United States | education | postdoc | 0 | 0 | 0 | — |
| us-public-health | United States | public health | staff | 0 | 0 | 0 | — |
| us-neuroscience | United States | neuroscience | faculty | 3 | 2 | 1 | [NSF Major Research Instrumentation (MRI) — January 2027 window](https://www.nsf.gov/funding/opportunities/mri-major-research-instrumentation-program) |
| us-architecture | United States | architecture | masters | 0 | 0 | 0 | — |
| us-geology | United States | earth science | phd | 0 | 0 | 0 | — |
| us-economics | United States | economics | postdoc | 0 | 0 | 0 | — |
| us-oncology | United States | oncology | resident | 1 | 7 | 6 | [2027 ASTRO–AAPM Physics Residents / Postdoctoral Fellows Seed Grant](https://aapm.secure-platform.com/gaf/page/AAPM_ASTROseed) |
| us-biology | United States | life sciences | undergrad | 1 | 18 | 9 | [SIAM Geosciences 2027 — Student Travel Award](https://www.siam.org/conferences-events/siam-conferences/gs27/program/student-information/) |
| us-music | United States | music | phd | 0 | 0 | 0 | — |
| canada-earth | Canada | climate | postdoc | 1 | 10 | 5 | [DFG Individual Research Grants](https://www.dfg.de/en/research-funding/funding-opportunities/programmes/individual/research-grants) |
| canada-literature | Canada | literature | phd | 1 | 9 | 5 | [AHRC International Placement Scheme 2027](https://www.ukri.org/opportunity/international-placement-scheme-2027/) |
| canada-imaging | Canada | medical imaging | faculty | 1 | 3 | 2 | [NSF Major Research Instrumentation (MRI) — January 2027 window](https://www.nsf.gov/funding/opportunities/mri-major-research-instrumentation-program) |
| canada-cleanenergy | Canada | energy | masters | 2 | 18 | 7 | [Water4All 2026 call: sustainable water management](https://www.ukri.org/opportunity/water4all-2026-call-sustainable-water-management/) |
| canada-indigenous | Canada | social science | staff | 0 | 0 | 0 | — |
| uk-law | United Kingdom | law | faculty | 1 | 0 | 0 | — |
| uk-marine | United Kingdom | marine science | phd | 2 | 21 | 9 | [Marie Skłodowska-Curie Postdoctoral Fellowships](https://marie-sklodowska-curie-actions.ec.europa.eu/actions/postdoctoral-fellowships) |
| uk-med | United Kingdom | clinical research | resident | 1 | 8 | 6 | [OpenAI Researcher Access Program](https://openai.com/form/researcher-access-program/) |
| uk-chem | United Kingdom | chemistry | postdoc | 2 | 15 | 8 | [DFG Walter Benjamin Programme](https://www.dfg.de/en/research-funding/funding-opportunities/programmes/individual/walter-benjamin) |
| uk-social | United Kingdom | psychology | undergrad | 0 | 0 | 0 | — |
| uk-stat | United Kingdom | statistics | staff | 0 | 0 | 0 | — |
| germany-physics | Germany | physics | phd | 0 | 0 | 0 | — |
| germany-literature | Germany | literature | postdoc | 1 | 16 | 9 | [AHRC Catalyst Awards — Emerging Research Leaders](https://www.ukri.org/opportunity/ahrc-catalyst-awards-applicant-led-mode/) |
| germany-chem | Germany | materials science | faculty | 2 | 0 | 0 | — |
| france-heritage | France | humanities | staff | 2 | 16 | 9 | [NEH Collections Stewardship (December 2026)](https://www.neh.gov/program/collections-stewardship) |
| france-cv | France | computing | phd | 2 | 45 | 9 | [IEEE Photonics Society Graduate Student Scholarship](https://ieeephotonics.org/awards/graduate-student-scholarship/) |
| spain-ecology | Spain | ecology | postdoc | 0 | 0 | 0 | — |
| italy-art | Italy | arts | masters | 0 | 0 | 0 | — |
| netherlands-policy | Netherlands | public policy | faculty | 1 | 0 | 0 | — |
| sweden-materials | Sweden | materials science | phd | 0 | 0 | 0 | — |
| denmark-food | Denmark | agriculture | postdoc | 2 | 11 | 7 | [FAPESP Young Investigator Grant for International Researchers](https://fapesp.br/en/18389/call-for-proposals-fapesp-young-investigator-grant-for-international-researchers) |
| ireland-hci | Ireland | computing | masters | 1 | 2 | 0 | [Adobe Research Fellowship](https://research.adobe.com/fellowship/) |
| australia-conservation | Australia | conservation | undergrad | 0 | 0 | 0 | — |
| australia-cyber | Australia | computing | phd | 1 | 45 | 9 | [IEEE Photonics Society Graduate Student Scholarship](https://ieeephotonics.org/awards/graduate-student-scholarship/) |
| australia-geophysics | Australia | earth science | faculty | 0 | 0 | 0 | — |
| australia-education | Australia | education | staff | 0 | 0 | 0 | — |
| newzealand-water | New Zealand | environment | postdoc | 0 | 0 | 0 | — |
| india-mathematics | India | mathematics | faculty | 2 | 6 | 4 | [NSF Major Research Instrumentation (MRI) — January 2027 window](https://www.nsf.gov/funding/opportunities/mri-major-research-instrumentation-program) |
| india-undergrad | India | engineering | undergrad | 2 | 0 | 0 | — |
| india-postdoc | India | life sciences | postdoc | 1 | 11 | 7 | [DFG Walter Benjamin Programme](https://www.dfg.de/en/research-funding/funding-opportunities/programmes/individual/walter-benjamin) |
| india-public-health | India | public health | staff | 1 | 9 | 7 | [UKRI/MRC Impact Acceleration Award — Translation](https://www.ukri.org/opportunity/ukri-translation-mrc-impact-acceleration-awards/) |
| japan-robotics | Japan | robotics | postdoc | 0 | 0 | 0 | — |
| japan-physics | Japan | physics | phd | 1 | 0 | 0 | — |
| korea-electrical | South Korea | engineering | faculty | 2 | 12 | 4 | [NSF Engineering Core Research: CBET](https://www.nsf.gov/eng) |
| singapore-cities | Singapore | urban studies | staff | 1 | 0 | 0 | — |
| singapore-ml | Singapore | computing | phd | 0 | 0 | 0 | — |
| taiwan-nano | Taiwan | materials science | masters | 1 | 0 | 0 | — |
| china-ev | China | energy | phd | 1 | 15 | 3 | [IEEE Photonics Society Graduate Student Scholarship](https://ieeephotonics.org/awards/graduate-student-scholarship/) |
| china-education | China | education | postdoc | 1 | 41 | 26 | [AHRC Catalyst Awards — Emerging Research Leaders](https://www.ukri.org/opportunity/ahrc-catalyst-awards-applicant-led-mode/) |
| brazil-agro | Brazil | agriculture | faculty | 2 | 25 | 14 | [UKRI/MRC Impact Acceleration Award — Translation](https://www.ukri.org/opportunity/ukri-translation-mrc-impact-acceleration-awards/) |
| brazil-hci | Brazil | computing | phd | 1 | 3 | 0 | [Google PhD Fellowship Program](https://research.google/programs-and-events/phd-fellowship/) |
| chile-astronomy | Chile | astronomy | postdoc | 2 | 0 | 0 | — |
| mexico-epidemiology | Mexico | public health | masters | 1 | 8 | 5 | [Biswas Family Foundation Fast Grants — Cycle 2](https://www.biswasfamilyfoundation.org/science/fast-grants) |
| colombia-peace | Colombia | social science | phd | 0 | 0 | 0 | — |
| southafrica-society | South Africa | social science | postdoc | 2 | 16 | 12 | [AHRC Catalyst Awards — Emerging Research Leaders](https://www.ukri.org/opportunity/ahrc-catalyst-awards-applicant-led-mode/) |
| southafrica-water | South Africa | environment | faculty | 2 | 15 | 5 | [NSF Engineering Core Research: CBET](https://www.nsf.gov/eng) |
| kenya-crops | Kenya | agriculture | phd | 2 | 1 | 1 | [USDA NIFA Hispanic-Serving Institutions Education Grants](https://www.nifa.usda.gov/grants/funding-opportunities) |
| ghana-engineering | Ghana | engineering | undergrad | 1 | 1 | 0 | [ASME Engineering Scholarships — Undergraduate (2027–28)](https://www.asme.org/asme-programs/students-and-faculty/scholarships/4-year-baccalaureate-graduate-students) |
| uganda-health | Uganda | public health | staff | 0 | 0 | 0 | — |
| egypt-heritage | Egypt | humanities | masters | 1 | 10 | 6 | [NEH Collections Stewardship (December 2026)](https://www.neh.gov/program/collections-stewardship) |
| morocco-cleanwater | Morocco | engineering | faculty | 1 | 0 | 0 | — |
| norway-philosophy | Norway | philosophy | postdoc | 2 | 13 | 9 | [AHRC Catalyst Awards — Emerging Research Leaders](https://www.ukri.org/opportunity/ahrc-catalyst-awards-applicant-led-mode/) |
| no-stage-international | Unknown | materials science | Unknown | 1 | 0 | 0 | — |
