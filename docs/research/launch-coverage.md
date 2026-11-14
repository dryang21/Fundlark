# Launch coverage prototype

This extends the existing static site, FastAPI/SQLite catalog and contribution workflow after reading the November 13 handoff. It does not change the MIT license, deploy a service, or start an academic jobs product.

- **Breadth:** 114 field/topic labels, 88 societies or professional groups, 31 conference series. Directory rows are editorial starting points with organizer URLs, not checked inventories of award availability. Individual directory URLs still need a link and identity audit before launch. Conference entries are series-level, not claims about a particular edition.
- **Depth:** 17 added public funding records. As of November 13, 2026, the seed includes eight listed open, one announced future round, six with a window to confirm and two historical rounds. Program records link directly to the funder or event page. Dates and restrictions come from those pages; no universal eligibility verdict is inferred. A past deadline is automatically hidden by the default availability filter.
- **Experience:** Browse by field, conference/society or name, filter opportunities by support type, and see nearby organizer routes when matching returns no awards. The base catalog and the new curated batch remain separate so the 109 existing records keep their own observation dates. The collector is unchanged and makes no requests on directory-only entries.

## Maintain and verify

Edit `data/coverage/sources.tsv` and `data/coverage/programs.json`, then run:

```bash
python scripts/build_coverage.py
python scripts/build_coverage.py --check
python scripts/coverage_report.py --as-of 2026-11-13 --gaps
python -m pytest -q
npm test
python -m http.server 8010 --bind 127.0.0.1 --directory docs/demo
```

The generator produces the static directory and the FastAPI seed file. The SQLite
initializer adds new seed IDs without overwriting existing database records; use a
new round ID for a new edition. For changed information on an existing ID, the
browser copy follows the generated file, while existing SQLite installations
still need an explicit reviewed update. A browser reload reads the regenerated
data. The directory report is a gap list for the new seed, not a live check or an
assertion that other sources lack funding.

## Launch gates and next passes

1. Audit organizer links and label verified funding pages separately from
   directories. Start with physics, mechanical/electrical engineering, CS,
   software engineering and robotics. Prioritize permanent funder/program pages;
   record edition-specific travel awards only when a real call exists.
2. Use the gap report to add a small set of actionable, independently checked
   opportunities for each launch audience. Aim for at least one dated actionable
   call or an explicitly labeled recurring route per priority field. Expand the
   shortlist beyond the United States. Directory counts are not launch readiness.
3. Exercise permitted source checks and reviewed corrections end to end. Add
   source-level success/failure/unchecked indicators before claiming freshness.
4. Test discovery and return visits with researchers outside computing, using
   fictional profile fixtures for automated tests. Validate coverage and repeat
   use before investing in accounts, alerts or a new stack.

The directory is useful keylessly today. The handoff's scheduled niche collectors,
field-level eligibility evidence, broader verified inventory and public deployment
remain launch work.
