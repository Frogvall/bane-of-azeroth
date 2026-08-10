#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path

CANONICAL_ID = "bane-of-azeroth"
PRESERVE = "BOA_REBRAND_PRESERVE"
TEXT_SUFFIXES = {
    ".css", ".hbs", ".html", ".js", ".json", ".md", ".mjs", ".txt",
}


def transform_text(text: str, target_id: str) -> str:
    if target_id == CANONICAL_ID:
        return text

    for old, new in (
        (f"modules/{CANONICAL_ID}/", f"modules/{target_id}/"),
        (f"Compendium.{CANONICAL_ID}.", f"Compendium.{target_id}."),
        (f"module.{CANONICAL_ID}", f"module.{target_id}"),
        (f"flags.{CANONICAL_ID}.", f"flags.{target_id}."),
        (
            f"{CANONICAL_ID}.{CANONICAL_ID}-dev-tests",
            f"{target_id}.{CANONICAL_ID}-dev-tests",
        ),
        (
            f"{CANONICAL_ID}.{CANONICAL_ID}",
            f"{target_id}.{CANONICAL_ID}",
        ),
    ):
        text = text.replace(old, new)

    result = []
    for line in text.splitlines(keepends=True):
        if PRESERVE not in line:
            line = line.replace(
                f'"{CANONICAL_ID}"',
                f'"{target_id}"',
            )
            line = line.replace(
                f"'{CANONICAL_ID}'",
                f"'{target_id}'",
            )
        result.append(line)

    return "".join(result)


def iter_text_files(root: Path):
    if root.is_file():
        yield root
        return

    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            yield path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path)
    parser.add_argument("--target-id")
    parser.add_argument(
        "--exclude-relative",
        action="append",
        default=[],
    )
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        sample = (
            'export const MODULE_ID = "bane-of-azeroth";\n'
            'export const ADVENTURE_PACK_NAME = "bane-of-azeroth"; '
            '// BOA_REBRAND_PRESERVE\n'
            'const PROD = "bane-of-azeroth"; // BOA_REBRAND_PRESERVE\n'
            'const P = "modules/bane-of-azeroth/foo.js";\n'
            'const U = "Compendium.bane-of-azeroth.bane-of-azeroth.Item.X";\n'
        )
        actual = transform_text(
            sample,
            "bane-of-azeroth-dev",
        )
        required = (
            'MODULE_ID = "bane-of-azeroth-dev"',
            'ADVENTURE_PACK_NAME = "bane-of-azeroth"',
            'PROD = "bane-of-azeroth"',
            'modules/bane-of-azeroth-dev/foo.js',
            'Compendium.bane-of-azeroth-dev.bane-of-azeroth.Item.X',
        )
        missing = [value for value in required if value not in actual]
        if missing:
            raise SystemExit(
                f"rebrand self-test failed: {missing!r}"
            )
        print("rebrand self-test passed")
        return 0

    if not args.root or not args.target_id:
        raise SystemExit("--root and --target-id are required")

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", args.target_id):
        raise SystemExit(f"unsafe package id: {args.target_id!r}")

    root = args.root.resolve()
    excluded = {
        Path(value).as_posix()
        for value in args.exclude_relative
    }

    checked = 0
    changed = 0

    for path in iter_text_files(root):
        if root.is_dir():
            relative = path.relative_to(root).as_posix()
            if relative in excluded:
                continue

        checked += 1
        original = path.read_text(encoding="utf-8")
        transformed = transform_text(original, args.target_id)

        if transformed != original:
            path.write_text(transformed, encoding="utf-8")
            changed += 1

    print(
        f"rebranded {changed} of {checked} text files "
        f"to {args.target_id}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
