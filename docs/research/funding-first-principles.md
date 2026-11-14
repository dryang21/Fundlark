# Fundlark from first principles

The researcher’s job is to decide where to spend application time. A useful lead answers four questions independently: **Why is this relevant? Who can apply? Is this round actionable? What do I do next?** Evidence missing from one answer cannot be replaced by confidence in another.

| Reference | Observed design | Fundlark implication |
| --- | --- | --- |
| [SimplifyJobs contribution guide](https://github.com/SimplifyJobs/Summer2027-Internships/blob/dev/CONTRIBUTING.md) | New listings and corrections come in through structured issues; approved changes update listing data and generated tables. | Treat the catalog as structured public data. Make corrections identify the official URL and round. Generate the published snapshot from reviewed records, with review before publication. |
| [Resume Matcher](https://github.com/srbhr/Resume-Matcher#ats-score-ats-check--keyword-highlighting) | Shows the shared and missing keywords beside the job description and resume. | Show the term that actually matched, including vocabulary expansion. Keyword overlap is useful evidence for relevance, not a measure of eligibility or chance of funding. |
| [Reactive Resume](https://github.com/reactive-resume/reactive-resume#features) | Combines document import/export with an application tracker that holds notes and follow-ups. | Keep the private profile editable and separate from the public catalog. A shortlist should help the researcher take a next step. Prioritize readable PDF/Word intake and portable user data over adding an account system. |
| [JobSpy](https://github.com/speedyapply/JobSpy#frequently-asked-questions) | Normalizes records across sources and distinguishes failures and warnings from empty results. | Use adapters for permitted official APIs and directories. Track each adapter’s source URL, last successful check and outcome independently. Keep missing fields unknown; keep previously reviewed records if a fetch fails and show their age. |

This iteration exposes exact catalog terms and related terms separately on funding cards, with applicant rules in their own field. The ranking is still a local heuristic.

Next: make source coverage visible before adding more connectors. Distinguish **checked with results**, **checked with no results**, **could not check**, and **not covered**. A snapshot export date is not a verification date. Then use real searches across covered and underrepresented fields to decide which sources and CV formats to support next.
