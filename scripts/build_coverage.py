"""Validate the editorial source directory and generate static coverage data."""
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/coverage"


def https(url):
    parts = urlsplit(url)
    return parts.scheme == "https" and bool(parts.hostname) and not parts.username and not parts.password


def build():
    sources = []
    aliases = set()
    for line in (INPUT / "sources.tsv").read_text().splitlines():
        kind, name, alias, url, raw_fields = line.split("|")
        if kind not in {"society", "conference"} or not all((name, alias, https(url), raw_fields)):
            raise ValueError(line)
        key = alias.casefold()
        if key in aliases:
            raise ValueError(f"Duplicate alias: {alias}")
        aliases.add(key)
        sources.append(dict(id=re.sub(r"[^a-z0-9]+", "-", key).strip("-"), kind=kind, name=name,
                            alias=alias, url=url, fields=raw_fields.split(";")))
    by_alias = {row["alias"]: row for row in sources}
    if len({row["id"] for row in sources}) != len(sources):
        raise ValueError("Duplicate source ID")
    rows = json.loads((INPUT / "programs.json").read_text())
    if len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Duplicate opportunity ID")
    programs = []
    for row in rows:
        row = row.copy()
        source = by_alias[row.pop("source")]
        if not https(row["url"]) or not row["eligibility"] or not row["topics"]:
            raise ValueError(row["id"])
        if row["status"] not in {"open", "forecast", "verify", "closed"}:
            raise ValueError(row["id"])
        reviewed = date.fromisoformat(row["source_date"])
        deadline = row.get("deadline")
        if deadline:
            date.fromisoformat(deadline)
        if row["status"] in {"open", "forecast"} and (not deadline or date.fromisoformat(deadline) < reviewed):
            raise ValueError(f"Unconfirmed application window: {row['id']}")
        row.update(id="coverage:" + row["id"], category="Society", funder=source["name"],
                   origin="curated", last_verified_at=reviewed.isoformat())
        related = row.get("affiliation_tags", {})
        linked = {source["alias"], *related.get("societies", []), *related.get("conferences", [])}
        for alias in linked:
            if alias in by_alias:
                by_alias[alias].setdefault("program_ids", []).append(row["id"])
        programs.append(row)
    return dict(schema_version=1, fields=sorted({field for row in sources for field in row["fields"]}),
                sources=sources, opportunities=programs)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    directory = build()
    for relative, payload in (("docs/demo/coverage.json", directory),
                              ("app/coverage_catalog.json", directory["opportunities"])):
        output = ROOT / relative
        encoded = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            if not output.exists() or output.read_text() != encoded:
                raise SystemExit(f"{relative}: run python scripts/build_coverage.py")
        else:
            output.write_text(encoded)
    print(f"{len(directory['fields'])} fields; {len(directory['sources'])} routes; {len(directory['opportunities'])} reviewed records")
