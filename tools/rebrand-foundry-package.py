#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

CANONICAL_ID = "bane-of-azeroth"
PRESERVE = "BOA_REBRAND_PRESERVE"
TEXT_SUFFIXES = {
    ".css",
    ".hbs",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".txt",
}


def transform_line(
    line: str,
    target_id: str,
) -> str:
    if PRESERVE in line:
        return line

    for old, new in (
        (
            f"modules/{CANONICAL_ID}/",
            f"modules/{target_id}/",
        ),
        (
            f"Compendium.{CANONICAL_ID}.",
            f"Compendium.{target_id}.",
        ),
        (
            f"module.{CANONICAL_ID}",
            f"module.{target_id}",
        ),
        (
            f"flags.{CANONICAL_ID}.",
            f"flags.{target_id}.",
        ),
        (
            f"{CANONICAL_ID}.AdventureImporterV2",
            f"{target_id}.AdventureImporterV2",
        ),
        (
            f"{CANONICAL_ID}.{CANONICAL_ID}-dev-tests",
            f"{target_id}.{CANONICAL_ID}-dev-tests",
        ),
        (
            f"{CANONICAL_ID}.{CANONICAL_ID}",
            f"{target_id}.{CANONICAL_ID}",
        ),
    ):
        line = line.replace(
            old,
            new,
        )

    line = line.replace(
        f'"{CANONICAL_ID}"',
        f'"{target_id}"',
    )
    line = line.replace(
        f"'{CANONICAL_ID}'",
        f"'{target_id}'",
    )

    return line


def transform_text(
    text: str,
    target_id: str,
) -> str:
    if target_id == CANONICAL_ID:
        return text

    return "".join(
        transform_line(
            line,
            target_id,
        )
        for line in text.splitlines(
            keepends=True,
        )
    )


def transform_json_string(
    value: str,
    target_id: str,
) -> str:
    # After json.loads(), a scalar module id no longer has source-code
    # quote characters around it. Handle that semantic JSON value directly.
    if value == CANONICAL_ID:
        return target_id

    return transform_text(
        value,
        target_id,
    )


def transform_json_key(
    key: str,
    target_id: str,
) -> str:
    # JSON object keys are also bare strings after parsing. This is required
    # for Foundry flag namespaces such as:
    #   "flags": { "bane-of-azeroth": { ... } }
    if key == CANONICAL_ID:
        return target_id

    return transform_text(
        key,
        target_id,
    )


def transform_json_value(
    value,
    target_id: str,
):
    if isinstance(
        value,
        str,
    ):
        return transform_json_string(
            value,
            target_id,
        )

    if isinstance(
        value,
        list,
    ):
        return [
            transform_json_value(
                item,
                target_id,
            )
            for item in value
        ]

    if isinstance(
        value,
        dict,
    ):
        transformed = {}

        for key, item in value.items():
            transformed_key = (
                transform_json_key(
                    key,
                    target_id,
                )
                if isinstance(
                    key,
                    str,
                )
                else key
            )

            if (
                transformed_key
                in transformed
            ):
                raise ValueError(
                    "Rebranding would create a duplicate JSON key: "
                    f"{transformed_key!r}"
                )

            transformed[
                transformed_key
            ] = transform_json_value(
                item,
                target_id,
            )

        return transformed

    return value


def transform_json_text(
    text: str,
    target_id: str,
) -> str:
    value = json.loads(
        text
    )

    transformed = transform_json_value(
        value,
        target_id,
    )

    return (
        json.dumps(
            transformed,
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


def iter_text_files(
    root: Path,
):
    if root.is_file():
        yield root
        return

    for path in root.rglob(
        "*"
    ):
        if (
            path.is_file()
            and path.suffix.lower()
            in TEXT_SUFFIXES
        ):
            yield path


def transform_file(
    path: Path,
    target_id: str,
) -> bool:
    original = path.read_text(
        encoding="utf-8",
    )

    if (
        path.suffix.lower()
        == ".json"
    ):
        transformed = transform_json_text(
            original,
            target_id,
        )
    else:
        transformed = transform_text(
            original,
            target_id,
        )

    if transformed == original:
        return False

    path.write_text(
        transformed,
        encoding="utf-8",
    )

    return True


def self_test() -> None:
    target_id = (
        "bane-of-azeroth-dev"
    )

    source = {
        "moduleId":
            "bane-of-azeroth",
        "flags": {
            "core": {
                "sheetClass":
                    "bane-of-azeroth.AdventureImporterV2",
            },
            "bane-of-azeroth": {
                "systemTestKey":
                    "smoke",
                "suiteMember":
                    True,
            }
        },
        "command": (
            'const BOA_TEST_MODULE_ID = "bane-of-azeroth";\n'
            'const BOA_TEST_PACK_ID = '
            '"bane-of-azeroth.bane-of-azeroth-dev-tests";\n'
            'const MODULE_PATH = '
            '"modules/bane-of-azeroth/templates/example.hbs";\n'
            'const PRODUCTION_ID = '
            '"bane-of-azeroth"; // BOA_REBRAND_PRESERVE\n'
        ),
    }

    serialized = (
        json.dumps(
            source,
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    if (
        r'\"bane-of-azeroth\"'
        not in serialized
    ):
        raise AssertionError(
            "Self-test fixture does not contain an escaped module id "
            "inside the serialized Macro command."
        )

    transformed_text = (
        transform_json_text(
            serialized,
            target_id,
        )
    )
    transformed = json.loads(
        transformed_text
    )

    if (
        transformed[
            "moduleId"
        ]
        != target_id
    ):
        raise AssertionError(
            "Exact JSON scalar module id was not rebranded."
        )

    flags = transformed[
        "flags"
    ]

    if (
        target_id
        not in flags
    ):
        raise AssertionError(
            "JSON object key namespace was not rebranded."
        )

    if (
        CANONICAL_ID
        in flags
    ):
        raise AssertionError(
            "Canonical JSON object key unexpectedly remained."
        )

    if (
        flags[
            "core"
        ][
            "sheetClass"
        ]
        != f"{target_id}.AdventureImporterV2"
    ):
        raise AssertionError(
            "Adventure sheet class id was not rebranded."
        )

    command = transformed[
        "command"
    ]

    required = (
        'const BOA_TEST_MODULE_ID = "bane-of-azeroth-dev";',
        'const BOA_TEST_PACK_ID = '
        '"bane-of-azeroth-dev.bane-of-azeroth-dev-tests";',
        '"modules/bane-of-azeroth-dev/templates/example.hbs"',
        'const PRODUCTION_ID = "bane-of-azeroth"; '
        '// BOA_REBRAND_PRESERVE',
    )

    missing = [
        item
        for item in required
        if item
        not in command
    ]

    if missing:
        raise AssertionError(
            "Semantic JSON rebrand self-test failed; missing "
            f"{missing!r}"
        )

    print(
        "Bane of Azeroth semantic package rebrand self-test passed."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        type=Path,
    )
    parser.add_argument(
        "--target-id",
    )
    parser.add_argument(
        "--exclude-relative",
        action="append",
        default=[],
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
    )
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0

    if (
        not args.root
        or not args.target_id
    ):
        raise SystemExit(
            "--root and --target-id are required."
        )

    if not re.fullmatch(
        r"[a-z0-9][a-z0-9-]*",
        args.target_id,
    ):
        raise SystemExit(
            f"Unsafe Foundry package id: {args.target_id!r}"
        )

    root = (
        args.root
        .resolve()
    )

    if not root.exists():
        raise SystemExit(
            f"Rebrand root does not exist: {root}"
        )

    excluded = {
        Path(
            value
        ).as_posix()
        for value in args.exclude_relative
    }

    checked = 0
    changed = 0

    for path in iter_text_files(
        root
    ):
        if root.is_dir():
            relative = (
                path.relative_to(
                    root
                ).as_posix()
            )

            if relative in excluded:
                continue

        checked += 1

        try:
            did_change = transform_file(
                path,
                args.target_id,
            )
        except Exception as error:
            raise SystemExit(
                f"Failed to rebrand {path}: {error}"
            ) from error

        if did_change:
            changed += 1

    print(
        f"Rebranded {changed} of {checked} text files "
        f"from {CANONICAL_ID} to {args.target_id}."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
