# Lessons from openGym and prompts.chat

Reviewed November 13, 2026. This is a product comparison based on the projects’ published documentation, not an assessment of their adoption or operating costs.

| Observed pattern | Fundlark adaptation |
| --- | --- |
| [openGym](https://github.com/DuarteSantos8/openGym#why-opengym) offers the real app with examples in its browser demo. Starter routines become editable plans. | Offer **Try an example** using the current search and shortlist. Keep examples in a temporary profile so trying one cannot replace saved research details or mix sample actions into the real shortlist. Include a profile with catalog matches and one with a coverage gap. |
| [openGym](https://github.com/DuarteSantos8/openGym#features) supports data export and keeps AI coaching and assistant integration optional. | Keep search and saving usable without AI. Add profile export/import if people need to move between devices; use a private file and explain what it contains. Fundlark already exports a readable shortlist. |
| [prompts.chat](https://github.com/f/prompts.chat#what-is-this) makes contributions through its website and says they sync to GitHub. The library is also available in portable formats. | Use Fundlark’s existing review queue, then publish reviewed records to the GitHub snapshot. Add an optional way to suggest a public funding link without installing a skill. Keep ordinary search free of contribution chores. |
| [prompts.chat](https://github.com/f/prompts.chat#integrations) offers integrations alongside its library. | Keep the copied, no-install request as the main assistant route. Consider a read-only integration once users show they need direct catalog access from assistants. |

**Priority:** Ship the example journey first; it works with the static site and requires no additional service. After the contribution service is deployed, automate the reviewed snapshot export and validate it before publishing. Test whether people can find a lead, or understand what to do when there is no match, without creating a profile.

Funding records need a stronger publication boundary than reusable prompts: official source, current round, date checked, and review before publication. Automatic GitHub updates should carry approved public facts only; profile data and pending suggestions must stay out of the export.
