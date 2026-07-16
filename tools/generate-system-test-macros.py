#!/usr/bin/env python3
"""Generate the prerelease-only Bane of Azeroth system-test Macro pack."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-system-test-macros.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")


MACROS = [
    {
        "key": "run-all",
        "id": "BoaDevRunAll0001",
        "name": "BOA DEV – Run All System Tests",
        "file": "run-all.js",
        "order": 1,
        "suiteMember": False,
        "img": "icons/svg/dice-target.svg",
    },
    {
        "key": "smoke",
        "id": "BoaDevSmoke00001",
        "name": "BOA DEV – Smoke Test",
        "file": "smoke-test.js",
        "order": 2,
        "suiteMember": True,
        "img": "icons/svg/upgrade.svg",
    },
    {
        "key": "generated-content",
        "id": "BoaDevContent001",
        "name": "BOA DEV – Verify Generated Content",
        "file": "verify-generated-content.js",
        "order": 3,
        "suiteMember": True,
        "img": "icons/svg/book.svg",
    },
    {
        "key": "spell-grants",
        "id": "BoaDevSpells0001",
        "name": "BOA DEV – Verify Spell Grants",
        "file": "verify-spell-grants.js",
        "order": 4,
        "suiteMember": True,
        "img": "icons/svg/lightning.svg",
    },
    {
        "key": "elemental-totems",
        "id": "BoaDevTotems0001",
        "name": "BOA DEV – Verify Elemental Totems",
        "file": "verify-elemental-totems.js",
        "order": 5,
        "suiteMember": True,
        "img": "icons/svg/aura.svg",
    },
    {
        "key": "cleanup",
        "id": "BoaDevCleanup001",
        "name": "BOA DEV – Cleanup Test Data",
        "file": "cleanup-test-data.js",
        "order": 6,
        "suiteMember": False,
        "img": "icons/svg/trash.svg",
    },
]


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--library",
        type=Path,
        default=(
            repo_root
            / "tests"
            / "system"
            / "lib"
            / "boa-system-test-lib.js"
        ),
    )
    parser.add_argument(
        "--macros-directory",
        type=Path,
        default=repo_root / "tests" / "system" / "macros",
    )
    parser.add_argument(
        "--output-directory",
        type=Path,
        required=True,
    )
    return parser.parse_args()


def safe_filename(name: str, document_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
    return f"{stem}_{document_id}.json"


def base_stats() -> dict[str, object]:
    return {
        "coreVersion": "14.364",
        "systemId": "dragonbane",
        "systemVersion": "4.0.1",
        "createdTime": None,
        "modifiedTime": None,
        "lastModifiedBy": None,
        "compendiumSource": None,
        "duplicateSource": None,
        "exportSource": None,
    }


def main() -> int:
    args = parse_args()

    if not args.library.is_file():
        raise SystemExit(
            f"Missing system-test library: {args.library}"
        )

    library = args.library.read_text(encoding="utf-8").rstrip()

    shutil.rmtree(args.output_directory, ignore_errors=True)
    args.output_directory.mkdir(parents=True, exist_ok=True)

    seen_ids: set[str] = set()

    for macro in MACROS:
        document_id = macro["id"]

        if not ID_PATTERN.fullmatch(document_id):
            raise SystemExit(
                "Macro ID must be 16 alphanumeric characters: "
                f"{document_id}"
            )

        if document_id in seen_ids:
            raise SystemExit(f"Duplicate Macro ID: {document_id}")

        seen_ids.add(document_id)

        source_path = args.macros_directory / macro["file"]

        if not source_path.is_file():
            raise SystemExit(f"Missing Macro source: {source_path}")

        body = source_path.read_text(encoding="utf-8").strip()
        command = (
            f"{library}\n\n"
            f"/* System test: {macro['key']} */\n"
            f"{body}\n"
        )

        document = {
            "_key": f"!macros!{document_id}",
            "_id": document_id,
            "name": macro["name"],
            "type": "script",
            "scope": "global",
            "command": command,
            "img": macro["img"],
            "author": None,
            "folder": None,
            "sort": macro["order"] * 100000,
            "ownership": {
                "default": 0,
            },
            "flags": {
                MODULE_ID: {
                    "generatedBy": GENERATOR_NAME,
                    "systemTestKey": macro["key"],
                    "suiteMember": macro["suiteMember"],
                },
            },
            "_stats": base_stats(),
        }

        output_path = (
            args.output_directory
            / safe_filename(macro["name"], document_id)
        )

        output_path.write_text(
            json.dumps(
                document,
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    print(
        f"Generated {len(MACROS)} developer-test Macros in "
        f"{args.output_directory}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
