"""Export public funding facts for a static demo or an agent skill.

This writes a local file only; it never commits, pushes, uploads, or schedules work.
"""
import argparse
import json
from pathlib import Path

from . import connectors, storage

PUBLIC_OPPORTUNITY_FIELDS = (
    "id", "title", "funder", "category", "funding_type", "amount", "deadline",
    "status", "description", "topics", "eligibility", "eligible_stages",
    "faculty_sponsor_possible", "url", "source_date", "origin", "last_checked_at",
    "last_verified_at", "review_needed", "stale",
    "affiliation_tags",
    *storage.DETAIL_FIELDS,
)
PUBLIC_SOURCE_FIELDS = ("id", "name", "category", "mode", "url", "description", "topics", "society", "institution", "source_reviewed_on", "availability", "geography_note", "access_note")
PUBLIC_CHECK_FIELDS = ("checked_at", "status", "last_changed_at", "review_needed")


def public_snapshot():
    """Allowlist fields instead of serializing databases or future user columns."""
    checks = storage.get_source_checks()
    sources = []
    for source in connectors.SOURCES:
        item = {key: source.get(key) for key in PUBLIC_SOURCE_FIELDS}
        if source["id"] in checks:
            item["check"] = {key: checks[source["id"]].get(key) for key in PUBLIC_CHECK_FIELDS}
        sources.append(item)
    return {
        "schema_version": 1,
        "generated_at": storage.now_iso(),
        "opportunities": [{key: row.get(key) for key in PUBLIC_OPPORTUNITY_FIELDS}
                          for row in storage.get_opportunities()],
        "sources": sources,
        "limitations": [
            "Export time is not a new verification of every opportunity.",
            "Curated records are dated snapshots; official API search hits can omit eligibility and other details.",
            "Official source-page reachability does not verify application availability.",
            "Federal searches sample the first page; this is not an exhaustive funding index.",
            "Confirm the current official call, amendments, deadline and applicant rules before applying.",
        ],
    }


def write_snapshot(output):
    snapshot = public_snapshot()
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    return len(snapshot["opportunities"])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("docs/demo/data.json"))
    args = parser.parse_args(argv)
    storage.init_db()
    count = write_snapshot(args.output)
    print(f"Exported {count} public funding records to {args.output}. Review before publishing.")


if __name__ == "__main__":
    main()
