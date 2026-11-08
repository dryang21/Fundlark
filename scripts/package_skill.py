#!/usr/bin/env python3
"""Package the standalone Fundlark skill, without the web app or local data."""
import argparse
import zipfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]


def package(output):
    source = PROJECT / "skills" / "fundlark"
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                archive.write(path, Path("fundlark") / path.relative_to(source))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=PROJECT / "docs/demo/Fundlark-skill.zip")
    args = parser.parse_args()
    print(package(args.output))
