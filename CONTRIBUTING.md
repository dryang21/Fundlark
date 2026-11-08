# Contributing to Fundlark

Thank you for helping researchers find funding. Contributions are welcome, especially additions of **official industry and foundation funding sources**.

## Reporting a funding opportunity

For a new curated catalog record, include:

1. Official application or funding-program URL (not a third-party aggregator).
2. Funding organization, program name, research topics and funding type.
3. **Verified** deadline or `null` if rolling / unknown. Never guess.
4. Clearly cited official eligibility wording, especially whether the applicant must be faculty or an institutional PI.
5. Last-verified date in ISO format (`YYYY-MM-DD`).
6. Current status: `open`, `rolling`, `closed`, `forecast`, or `verify`. Use `verify` when uncertain.

Submit new entries as a pull request to `app/catalog.json` and/or new source entries to `app/sources.json`. The catalog loader inserts new IDs but does not overwrite existing records. To edit existing production records, add a reviewed migration path or use a controlled curation workflow; do not silently reset previously verified data.

For monitored sources, use **Review changes** to compare retained page snapshots and record what you checked. Shortlisting a candidate link or acknowledging a page change is not approval to publish it as a verified opportunity. New catalog records still require official evidence for their status, dates and eligibility. Use `content_selector` only when it selects stable funding content; use `redirect_hosts` only for reviewed official HTTPS redirect destinations. The monitor never crawls discovered candidate pages automatically.

## Development

1. Create a local virtual environment and install `requirements.txt` and `pytest`.
2. Run `pytest -q` and `node --check app/static/app.js` before proposing changes.
3. Keep grant eligibility assessment conservative and documented.
4. Do not include user CVs, secrets, proprietary grant database content, or API credentials in commits.
5. Respect website terms, `robots.txt`, and reasonable source rate limits. Only official pages are suitable for the source monitor.

## Security issues

For production deployments, add authentication and rate limits to write/sync endpoints, use sandboxed parsers for uploaded PDFs/DOCX, and implement a security disclosure process. The prototype is currently designed for local development, not unattended public administration.
