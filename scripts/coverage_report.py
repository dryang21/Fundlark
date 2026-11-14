"""Print a launch-gap inventory from maintained directory fields and seed records."""
from collections import Counter
from datetime import date
from build_coverage import build
import argparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
parser.add_argument("--gaps", action="store_true", help="List fields without a dated active seed call")
args = parser.parse_args()
directory = build()
calls = directory["opportunities"]
live = [r for r in calls if r["status"] == "open" and r["deadline"] >= args.as_of.isoformat()]
fields = {topic.casefold() for row in live for topic in row["topics"]}
gaps = [field for field in directory["fields"] if field.casefold() not in fields]
print(f"As of {args.as_of}: {len(directory['fields'])} field/topic labels; {dict(Counter(s['kind'] for s in directory['sources']))}")
print(f"{len(calls)} new curated records; {len(live)} listed open in the seed; {len(gaps)} labels lack a directly tagged open seed call")
print("Inventory only. This does not refresh sources or measure all funding in a field.")
if args.gaps:
    print("\n".join(gaps))
