# Fundlark usability review — 8 November 2026

## Method and limits

Two independent agents reviewed the existing webpage and matching behavior as
researchers with limited CS experience: an ecology PhD student at the University
of Bristol, and a busy faculty researcher. Each supplied a prioritized critique,
then reviewed the changes. The main agent implemented fixes and exercised the
updated webpage through the browser.

These were simulated persona walkthroughs grounded in source code and matching
checks, not interviews, real participants, measured satisfaction, or a randomized
with/without-skill evaluation. Browser QA used an isolated local origin; it did not
change the user's profile on localhost.

## Product judgment

The first-use goal is to obtain a credible funding lead **or a useful next search
action** without learning package installation or editing structured data. The
largest risk is confusing an incomplete catalog with the absence of relevant
funding. Improving this journey takes priority over additional contribution
settings. New contributions remain background work for capable, authorized agents.

| Priority | Finding | Evidence from the original experience | Implemented response |
| --- | --- | --- | --- |
| P0 | A valid researcher reaches a dead end | Ecology/ESA/Bristol profile produced zero matches in the 109-record snapshot | Explicit coverage boundary; direct organization funding searches; one-click assistant request and filter recovery |
| P1 | Input looks conversational but expects exact terms | “My lab studies artificial intelligence” yielded zero; plain “artificial intelligence” matched | Comma/newline/semicolon support and sentence keyword extraction; visible interpreted words; original description preserved for the assistant |
| P1 | Deeper discovery assumes coding knowledge | ZIP extraction and hidden skill directories precede the useful copied brief | Ordinary copied request is primary; skill installation moves to optional advanced details |
| P1 | Relevance can be mistaken for readiness to apply | Closed calls rank alongside other matches; stage guidance hidden in details | Past rounds excluded by default; explicit unconfirmed/upcoming labels, stage concerns, amount and deadlines on cards |
| P1 | Freshness is essential to trust | A UI rewrite briefly hid source-age warnings; second review caught the regression | Visible record-check dates, stale warnings and source-change warnings restored |
| P2 | Useful findings are hard to retain | No public-page shortlist or export | Local Save, shortlist view, copy and text download; saved public snapshots survive catalog removal and flag changed details |
| P2 | Profile/filter state is inconsistent | Reload forgets matching mode; add/remove behaviors differ | Matching enabled for a restored profile; research/stage/affiliation changes update consistently; resetting filters removes the match-only restriction |
| P2 | Sharing language can overstate agent capability | Ordinary browser-chat assistants may lack an installed skill or HTTP tools | Basic request never authorizes contribution; optional mode requires an installed skill plus sharing consent and a connected service |

The two reviewers' second pass found the main paths clearer. The small follow-up
issues they identified—empty-state resets, unconfirmed-availability wording,
freshness warnings, and saved-record durability—were addressed before completion.

## Validation

Automated checks cover sentence/comma parsing, AI-versus-aid word boundaries,
past-round filtering, custom society/institution routes, basic versus skill-mode
authorization, shortlist content and durability, public-field allowlisting and
freshness warnings. Existing real Worker/local-D1 integration checks still cover
contribution review, deduplication, privacy boundaries and quotas.

Browser walkthroughs cover the ecology profile, helpful zero-result state, reset
recovery, ordinary assistant request, saving Sigma Xi as a lead to verify, shortlist
copy/download and a separate computing faculty profile. None of these checks claim
that a funding window is currently open or that a researcher is eligible.

## Remaining priorities

1. Broaden reviewed coverage using real researcher requests, especially non-medical,
   non-computing, non-U.S. fields. The snapshot has 86 government imports among 109
   records; a nicer interface does not resolve this coverage imbalance.
2. Test with 3–5 actual researchers unfamiliar with Fundlark. Observe whether they
   can find a credible lead or a useful recovery action within three minutes,
   interpret “unconfirmed” correctly, and save or export their result without help.
   These are proposed success criteria, not measured results.
3. Improve multilingual/topic extraction and organization aliases. Current sentence
   parsing uses local English-oriented heuristics, not semantic understanding;
   institution names embedded in prose can still become noisy topic words.
4. Measure catalog coverage, official-source freshness and contribution review
   turnaround before investing in broader automation. No analytics collecting
   private research descriptions were added for this review.

Cloudflare production deployment still requires the owner's sign-in and database
configuration. This iteration adds no paid model or search backend.
