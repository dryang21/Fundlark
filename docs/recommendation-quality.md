# Recommendation quality

The demo puts up to five next steps above the broader matches. This shortlist uses
recently reviewed calls with a current window, a specific research or affiliation
match, and no known applicant conflict. It distinguishes an individual application,
an application led by a faculty member or institution, and a lead with conditions
still to check. Records solely based on a listing, or calls requiring an invitation,
remain outside the shortlist. Catalog and tracker actions run in the browser.

The deadline guard treats unusually distant federal dates as unconfirmed until checked.
The [NSF robotics program](https://www.nsf.gov/funding/opportunities/frr-foundational-research-robotics)
is a source-backed exception: its full proposals are accepted anytime. The same
display guard applies to search, saved results and calendar exports. The notice
and time zone are shown when available; for example, the
[NEH Collections Stewardship notice](https://www.neh.gov/sites/default/files/Collections%20Stewardship%202026%20NOFO.pdf)
lists an Eastern Time cutoff and excludes foreign applicants.

## First audit: November 15, 2026

Reproduce from the source tree:

```sh
node scripts/audit_current_matches.mjs --expanded --as-of=2026-11-15 > audit.json
```

| Measure | Result |
|---|---:|
| Synthetic profiles | 72 |
| Profiles with at least one starter recommendation | 15 |
| Profiles with at least two starter recommendations | 8 |
| Profiles with a starter recommendation classified as an individual application with no unresolved indexed checks | 0 |
| Suspicious catalog deadlines still awaiting sponsor verification | 33 |

This measures the catalog and the rules together. It does not measure recommendation
precision or prove sponsor eligibility. Conditional and partner leads count toward
shortlist coverage; they should not be counted as applications a researcher can submit.

## Next quality gate

1. Have two reviewers independently judge the first five results for a held-out set of
   50 profiles, keeping the same catalog snapshot and assessment date for comparisons.
   Record relevance, current application window, applicant role, eligibility blockers
   and source excerpts or page sections. Disagreements should be adjudicated; unknowns
   should stay unknown.
2. Track actionable precision at five, incorrect eligibility claims, route accuracy and
   the number of profiles with at least two actionable leads. Report coverage separately
   so a cautious but empty shortlist does not look like a quality win.
3. Use empty or conditional-only results to prioritize sponsor verification. Start with
   relevant student and postdoctoral society awards, industry programs and institution
   rounds. Add claim-level verification to those records and extend it to skill imports.
