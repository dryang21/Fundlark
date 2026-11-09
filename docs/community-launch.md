# Browser matching and shared discoveries

The public webpage now ranks the published funding snapshot locally using
a short research description (using visible keyword heuristics), career stage,
confirmed memberships and current institutions. Custom
organizations work in every field. A saved browser profile contains only those
selected fields, the typed research description and a public-facts sharing preference. It is not sent to the
community API. Use **Clear my profile** to remove it. No CV upload is required;
PDF/DOCX extraction still belongs to the full Python application or the user's
assistant, not this static page.

**Find funding** filters and sorts the snapshot. Profile changes update locally;
commas, semicolons, newlines and short sentences are accepted. **Copy my funding search request**
passes the chosen profile to the user's assistant when they paste it. The basic
request works without installing a skill; an assistant needs browsing to verify
current calls. The optional skill and installed-skill checkbox enable the
contribution workflow. Deep web
discovery runs through their own agent and account; the page itself does not run
an AI model or claim to crawl the web. The profile is sent to that AI provider only
when the user pastes it there.

When the community service is connected and the researcher selects the installed-skill
option and enables sharing, the brief authorizes the installed Fundlark skill to submit new public funding facts
without forms, GitHub accounts or pull requests. The preference applies to newly
copied briefs; changing it cannot revoke a brief already pasted into an independent
agent. Contribution success never gates the user's results.

The Worker keeps new records pending. A maintainer checks official evidence and
approves or rejects them. Approved records are immediately available to future
visitors at `/api/catalog` (up to a 60-second cache delay), layered over the snapshot.
This is automatic collection, with reviewed publication. It does not automate
judgment about whether a contributed claim is true. Duplicate identical payloads
are idempotent; approved updates replace earlier community records for the same
normalized official URL, program title and round. Use the deadline year or `recurring` consistently.
The static catalog and API overlay deduplicate by URL, title and round; different URL
aliases or renamed programs still require maintainer judgment. The reviewed overlay is capped at 5,000
records; export/compact older records into the static snapshot before reaching it.

## Saved shortlists

Users can save public records, view their shortlist, and copy or download it as
plain text with official links. The browser keeps a public-record snapshot so a
catalog removal or renamed program does not silently erase a saved lead. Archived
snapshots are clearly labeled; changed current details are flagged. These saved
facts do not establish that a call is still open. Clear my profile removes the
research description and affiliations while preserving the separate shortlist.

## Local end-to-end preview

Node 22+ and Python 3.11+:

```bash
npm ci
cp services/community/.dev.vars.example services/community/.dev.vars
npm run db:local
python scripts/package_skill.py
npm run dev:community
```

Open the local URL printed by Wrangler (usually `http://localhost:8787`). Both
matching and the service work here. Static-only hosting remains usable and shows
sharing as unavailable, rather than claiming submissions succeeded.

```bash
npm test
python -m pytest -q
```

The JavaScript integration tests run the actual Worker and local D1 in an isolated
temporary directory. They do not call production services or paid AI APIs.

## Deploy to the owner's Cloudflare account

No Cloudflare account or credentials are stored in this repository. These steps
need the owner's account; do not substitute Sites hosting or sign up for paid AI.

1. Run `npx wrangler login` and `npx wrangler d1 create fundlark-community`.
2. Put the returned database ID in `services/community/wrangler.jsonc`.
3. Run `npx wrangler d1 execute DB --remote --config services/community/wrangler.jsonc --file services/community/schema.sql`.
4. Set two different strong secrets using `npx wrangler secret put ADMIN_TOKEN --config services/community/wrangler.jsonc` and then `INGEST_SALT` the same way. Store the admin token securely for review; never put it in browser configuration or GitHub.
5. Run `python scripts/package_skill.py` and `npm run deploy:community`.

The same Worker serves the website and API, so no custom domain or CORS setup is
required. For a separate static host, set `apiBase` in `docs/demo/config.js` to the
Worker's HTTPS origin and set `ALLOWED_ORIGINS` on the Worker to the exact static
site origins, comma-separated. Never put credentials in `config.js`.

Expected early hosting cost: $0 within free allowances; reserve $5/month for a
future paid Workers plan. AI usage belongs to the user's account. Existing Python
collectors can continue on the maintainer's machine; no central crawler is deployed.
This service does not collect raw CVs or run an LLM. Cloudflare processes network
metadata when serving requests. The app stores only a salted, day-specific IP hash
for quota enforcement, cleaned on the next contribution day; it does not store IP
addresses in D1. Provider-level logs are governed by the owner's account settings.

## Maintainer review

Set `FUNDLARK_ADMIN_TOKEN` in your shell environment without writing it into tracked
files. List pending records:

```bash
python scripts/review_community.py --service https://YOUR-WORKER.workers.dev
```

Read the official URL and supporting excerpt; verify identity, deadline, round,
status, public availability and eligibility. Reject private/restricted material or
unsupported claims. This API never fetches user-provided URLs. Approval records
your acknowledgment that you checked the source; it cannot verify that for you.

```bash
python scripts/review_community.py --service https://YOUR-WORKER.workers.dev --id CONTRIBUTION_ID --decision approved --official-source-checked
python scripts/review_community.py --service https://YOUR-WORKER.workers.dev --id CONTRIBUTION_ID --decision rejected
python scripts/review_community.py --service https://YOUR-WORKER.workers.dev --export reviewed-community.json
```

Export contains only reviewed public records and can be incorporated into a future
GitHub snapshot. No automatic GitHub write credentials are needed at runtime.

## Limits and budget controls

Requests are capped at 48 KB and ten records per submission. Unknown fields are
rejected, including top-level CV/profile fields. Free-text funding claims still
need review for accidental personal content. Limits default to 1,000 contribution
attempts/day across the service and 30/day per network address. Counters use atomic
conditional database updates. Users on a shared institutional network share the
per-address limit. These are application quotas, not a guaranteed provider spending
cap: rejected traffic still invokes the Worker. Keep the free plan initially and
monitor provider usage; if attacked, disable submissions or apply Cloudflare edge
rules. Read-only catalog matching keeps working. Anonymous agent submissions do
not require accounts or captchas, so human review remains necessary.

Official configuration references:
[Worker assets/configuration](https://developers.cloudflare.com/workers/wrangler/configuration/),
[D1 prepared queries](https://developers.cloudflare.com/d1/worker-api/prepared-statements/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
