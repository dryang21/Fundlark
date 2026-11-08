# Affiliation-aware funding discovery

Reviewed November 8, 2026. The registry now has 25 sources: 15 industry, three
professional-society, two institutional, three foundation and two government API
sources. Source coverage is expandable, not exhaustive.

New industry starting points: Microsoft Research Fellowship, Sony Research Award
Program, Cisco Research Funding, AWS Cloud Credit for Research, Samsung Global
Research Outreach, Adobe India AI Research Fellowship, Varian/Siemens Healthineers
investigator-initiated research, Elekta investigator-initiated research, Pfizer
Investigator Sponsored Research and Merck Investigator Studies Program.

Each new program record is `verify`: no open deadline, funding amount or applicant
eligibility is inferred from the existence of its program page. Adobe's geography
and medical/industry sponsorship rules require particular care. Official URLs,
source-review dates and topical tags are in `app/sources.json`. A source-review
date is not a verification that an application round is open.

## Society and institution evidence

- [ASTRO funding opportunities](https://www.astro.org/provider-resources/research/funding-opportunities)
  lists radiation-oncology research support, including joint programs.
- [AAPM grants and fellowships](https://prod.aapm.org/advance/grants-and-fellowships)
  provides medical-physics funding routes. Check each call's member, stage and
  appointment criteria.
- [IEEE student funds and awards](https://students.ieee.org/membership-benefits/ieee-benefits/funds-and-awards/)
  is a discovery starting point; the retrieval returned 403 during review. The skill
  should also search the relevant technical society/chapter and respect access rules.
- [Stanford Seed Funding](https://seedfunding.stanford.edu/about) describes an
  internal-funding directory. [Bio-X seed grants](https://biox.stanford.edu/research/seed-grants)
  are a more specific interdisciplinary route. Stanford affiliation alone does not
  settle PI, department or appointment eligibility.

The CV endpoint returns `affiliations.societies` and `affiliations.institutions`,
each with supporting evidence, a relationship label and `needs_confirmation=true`.
Extraction is heuristic and bounded. The starter dictionary covers IEEE, ASTRO,
AAPM, ASCO, RSNA, ACM and several institution aliases, with a limited generic
university-name fallback. It does not resolve every institution or ambiguous CV
layout. The agent skill supports broader contextual extraction and official-domain
discovery; the user should review all proposed identities and relationships.

`POST /api/profile/sources` accepts keywords, confirmed society names and current
institution names, and returns explained source suggestions plus institution search
queries. It does not make eligibility decisions or save personal profiles on the
server. In the local dashboard, review suggestions in My research profile before
saving them in browser storage. Private evidence is excluded from public exports.

No membership is inferred solely from a paper, conference attendance, journal title
or society mention. Previous education is distinct from a current appointment.
For institutions absent from the registry, search the official research office,
department/cancer center, postdoc office and limited-submission competitions. Private
internal portals require user-supplied announcements or authorized user access.
