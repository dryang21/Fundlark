# Fundlark personal workspace proposal

Use the public demo to let someone try matching and the tracker quickly. Show the snapshot date, source coverage, and the number of current versus past rounds. If a search has no strong results, show what was searched, which keywords were recognized, and a direct next step to continue the search with the skill. A blank or weak shortlist should not imply there is no funding.

Use the Fundlark skill for the deeper, personal search. It should start with a small list of public sources relevant to the researcher's field, career stage, host institution and society memberships. The agent can populate a personal library from exact official calls, check saved calls and watched sources on request, and report new calls, amendments and deadlines that changed. A scheduled refresh is optional and runs in the user's own environment after they enable it. The public demo and personal tracker need no account or always-on Fundlark backend for this workflow.

The browser is the organizer. The current tracker already stores leads, statuses, notes and target dates in the browser and exports CSV and calendars. The skill and tracker now use a portable, versioned JSON format for this workflow:

1. **Find and open.** Ask the skill to find funding for a project. It returns three to five priorities with the sponsor’s official links, conditions and deadlines, and writes one library file that the user can open in Fundlark. No manual copying of individual grants.
2. **Organize and back up.** Import the library in the browser and use the existing tracker. A round’s source facts and the researcher’s notes, target date and application status stay separate. Export a restorable private backup; browsing and editing do not send the file to a Fundlark server.
3. **Refresh and review.** Refresh only watched sources and relevant calls by default. Reimport the updated library and show which calls are new, closed, amended or could not be checked. Merge by stable sponsor identifier and round, without overwriting private tracker fields. Preserve the last known facts when an official source is unavailable.

A small JSON library is the first interchange format. A power user can keep the backing collection in SQLite later; browser users do not need to install SQL. Keep the CV, chat history and private notes out of public snapshots and optional public contributions. A cloud assistant may still process the profile the user shares with it.

Test this handoff with users before building optional folder synchronization or adding hosting. Success means someone can go from a skill result to a usable tracker in one import, then reimport a changed deadline without losing their application state. Separately, use the diverse profile suite to reduce empty searches and raise the number of first-page opportunities with both specific topic evidence and a viable application route.
