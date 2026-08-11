#!/usr/bin/env python3
# Validate and prepare stable Bane of Azeroth Foundry releases.

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
import tempfile


SEMVER_RE = re.compile(
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$"
)
RELEASE_HEADER_RE = re.compile(
    r"^## \[(?P<version>[0-9]+\.[0-9]+\.[0-9]+)\] - "
    r"(?P<date>[0-9]{4}-[0-9]{2}-[0-9]{2})$",
    re.MULTILINE,
)


class ReleaseError(RuntimeError):
    pass


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise ReleaseError(
            f"Missing expected release file: {path}"
        ) from error


def read_json(path: Path) -> object:
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError as error:
        raise ReleaseError(
            f"Invalid JSON in {path}: {error}"
        ) from error


def parse_version(version: str) -> tuple[int, int, int]:
    match = SEMVER_RE.fullmatch(version)
    if not match:
        raise ReleaseError(
            "Stable Foundry release version must use "
            f"MAJOR.MINOR.PATCH: {version!r}"
        )
    return tuple(int(value) for value in match.groups())


def changelog_sections(
    changelog: str,
) -> tuple[str, dict[str, str]]:
    header = "## [Unreleased]"
    if changelog.count(header) != 1:
        raise ReleaseError(
            "Changelog must contain exactly one "
            "## [Unreleased] section."
        )

    unreleased_start = changelog.index(header) + len(header)
    next_section = changelog.find(
        "\n## [",
        unreleased_start,
    )
    if next_section < 0:
        raise ReleaseError(
            "Changelog has no released section after Unreleased."
        )

    unreleased = changelog[
        unreleased_start:next_section
    ].strip()

    matches = list(RELEASE_HEADER_RE.finditer(changelog))
    sections: dict[str, str] = {}

    for index, match in enumerate(matches):
        start = match.end()
        end = (
            matches[index + 1].start()
            if index + 1 < len(matches)
            else len(changelog)
        )
        version = match.group("version")
        if version in sections:
            raise ReleaseError(
                f"Duplicate Changelog release section: {version}"
            )
        sections[version] = changelog[start:end].strip()

    return unreleased, sections


def validate_release(
    root: Path,
    tag: str,
) -> str:
    manifest = read_json(
        root / "foundry" / "module.json"
    )
    if not isinstance(manifest, dict):
        raise ReleaseError(
            "foundry/module.json must contain an object."
        )

    version = manifest.get("version")
    if not isinstance(version, str):
        raise ReleaseError(
            "foundry/module.json has no string version."
        )

    major, _, _ = parse_version(version)
    if major < 1:
        raise ReleaseError(
            "Stable Foundry releases are disabled before 1.0.0."
        )

    expected_tag = f"v{version}"
    if tag != expected_tag:
        raise ReleaseError(
            f"Release tag {tag!r} does not match "
            f"module version {version!r}; expected {expected_tag!r}."
        )

    if manifest.get("id") != "bane-of-azeroth":
        raise ReleaseError(
            "Stable source manifest must use id bane-of-azeroth."
        )
    if manifest.get("title") != "Bane of Azeroth":
        raise ReleaseError(
            "Stable source manifest must use title Bane of Azeroth."
        )

    for forbidden in ("manifest", "download"):
        if forbidden in manifest:
            raise ReleaseError(
                "Source manifest must remain channel-neutral; "
                f"remove {forbidden!r}."
            )

    readme = read_text(root / "README.md")
    expected_readme = (
        "**Current Foundry module version:** "
        f"{version}"
    )
    if expected_readme not in readme:
        raise ReleaseError(
            "README Foundry version does not match "
            f"module version {version}."
        )

    changelog = read_text(
        root / "foundry" / "CHANGELOG.md"
    )
    unreleased, sections = changelog_sections(changelog)
    if unreleased:
        raise ReleaseError(
            "Changelog Unreleased must be empty before "
            "publishing a stable Foundry release."
        )

    body = sections.get(version)
    if body is None:
        raise ReleaseError(
            "Changelog is missing a dated release section "
            f"for {version}."
        )
    if not body:
        raise ReleaseError(
            f"Changelog release section {version} is empty."
        )

    return version


def extract_notes(
    root: Path,
    version: str,
) -> str:
    parse_version(version)
    changelog = read_text(
        root / "foundry" / "CHANGELOG.md"
    )
    _, sections = changelog_sections(changelog)
    notes = sections.get(version)
    if notes is None:
        raise ReleaseError(
            f"Changelog has no release notes for {version}."
        )
    if not notes:
        raise ReleaseError(
            f"Changelog release notes for {version} are empty."
        )
    return notes + "\n"


def make_fixture(
    root: Path,
    *,
    version: str = "1.2.3",
    unreleased: str = "",
) -> None:
    (root / "foundry").mkdir(
        parents=True,
        exist_ok=True,
    )
    (
        root / "foundry" / "module.json"
    ).write_text(
        json.dumps(
            {
                "id": "bane-of-azeroth",
                "title": "Bane of Azeroth",
                "version": version,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (root / "README.md").write_text(
        "> **Current Foundry module version:** "
        f"{version}\n",
        encoding="utf-8",
    )
    (
        root / "foundry" / "CHANGELOG.md"
    ).write_text(
        "# Changelog\n\n"
        "## [Unreleased]\n"
        f"{unreleased}"
        f"## [{version}] - 2026-08-11\n"
        "### Added\n"
        "- Stable release fixture.\n",
        encoding="utf-8",
    )


def expect_failure(
    callback,
    expected: str,
) -> None:
    try:
        callback()
    except ReleaseError as error:
        if expected not in str(error):
            raise ReleaseError(
                "Self-test received unexpected error: "
                f"{error}"
            ) from error
        return
    raise ReleaseError(
        "Self-test expected ReleaseError containing "
        f"{expected!r}."
    )


def command_self_test() -> int:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        make_fixture(root)
        if validate_release(root, "v1.2.3") != "1.2.3":
            raise ReleaseError(
                "Self-test valid release did not return version."
            )
        if "Stable release fixture." not in extract_notes(
            root,
            "1.2.3",
        ):
            raise ReleaseError(
                "Self-test could not extract release notes."
            )

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        make_fixture(root, version="0.12.6")
        expect_failure(
            lambda: validate_release(
                root,
                "v0.12.6",
            ),
            "disabled before 1.0.0",
        )

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        make_fixture(root)
        expect_failure(
            lambda: validate_release(
                root,
                "v1.2.4",
            ),
            "does not match",
        )

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        make_fixture(
            root,
            unreleased=(
                "### Changed\n"
                "- Not closed yet.\n"
            ),
        )
        expect_failure(
            lambda: validate_release(
                root,
                "v1.2.3",
            ),
            "Unreleased must be empty",
        )

    print("Stable Foundry release self-test passed.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root.",
    )
    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
    )

    check = subparsers.add_parser("check")
    check.add_argument("--tag", required=True)

    notes = subparsers.add_parser("notes")
    notes.add_argument("--version", required=True)
    notes.add_argument("--output")

    subparsers.add_parser("self-test")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()

    if args.command == "check":
        version = validate_release(root, args.tag)
        print(
            f"Stable Foundry release contract verified for {version}."
        )
        return 0

    if args.command == "notes":
        notes = extract_notes(root, args.version)
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(
                parents=True,
                exist_ok=True,
            )
            output.write_text(
                notes,
                encoding="utf-8",
            )
            print(
                f"Wrote stable release notes: {output}"
            )
        else:
            sys.stdout.write(notes)
        return 0

    if args.command == "self-test":
        return command_self_test()

    raise ReleaseError(
        f"Unsupported command: {args.command}"
    )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ReleaseError as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr,
        )
        raise SystemExit(1)
