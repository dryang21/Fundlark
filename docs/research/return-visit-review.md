# First and return visits — November 13, 2026

Three fictional researchers exercised different paths: computing faculty, an ecology PhD student, and a medical physics postdoc. The installed Qwen 3.8 27B model generated baseline and follow-up feedback through local Ollama; no paid inference API or real public CV was used. The model received workflow descriptions, not browser access. Its broad claims about coverage and usability are hypotheses, not measured outcomes. The before/after prompts differ, so the outputs do not measure a causal improvement.

- **First try:** examples use the actual catalog and an in-memory profile and shortlist. They never read or change a personal saved profile. One example has computing matches; the other shows recovery when ecology coverage is limited.
- **CV setup:** labeled topics, current appointments, and memberships can be suggested from paste or TXT. Suggestions start unchecked, and raw CV text is cleared after processing. Publication mentions, past education, and explicitly former memberships are excluded. This is a limited text heuristic; PDFs and Word documents require pasting text.
- **Return visit:** open the shortlist directly, see whether catalog details have changed, and add a private next-step note. The panel shows the earliest listed deadline in the next 30 days for saved open/rolling calls when present. It does not send reminders or verify dates live.
- **Coverage:** added the [ESA awards directory](https://esa.org/about/awards/) and [Bristol Biological Sciences postgraduate funding directory](https://www.bristol.ac.uk/biology/courses/postgraduate/phdstudentships/) as fallback sources. Bristol lists opportunities for prospective research students; an existing student must check applicability. These additions are directories, not new grant records or verified eligibility.

Browser QA used a separate localhost origin and a fictional medical-physics CV. It confirmed review before adding, isolated example saves, access to the returning-user panel, and note persistence after a reload. Automated tests cover fixture extraction, example results and recovery, and deadline filtering.

Rerun the qualitative review from the repo with `python scripts/simulate_users.py --phase after`. Recorded responses are under `evals/results/`. Next priorities: validate live source freshness, test document intake with messy CV layouts, and ask real researchers whether their saved leads were useful enough to return.

In the follow-up, all three simulated reviewers described a reason to reopen the shortlist, conditional on checking the official calls themselves. They repeatedly flagged PDF/Word paste friction and the lack of live deadline verification. This is qualitative feedback from one model, not a retention statistic.
