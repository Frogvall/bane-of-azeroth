#!/usr/bin/env python3
"""Generate a deterministic inventory of Foundry reference usage."""

from __future__ import annotations

import argparse
from difflib import unified_diff
import json
from pathlib import Path
import re
import sys


GENERATOR_NAME = "tools/generate-reference-inventory.py"
DEFAULT_OUTPUT = (
    Path("generated")
    / "reference-inventory.json"
)

SCAN_ROOTS = (
    Path("homebrewery"),
    Path("foundry/config"),
    Path("foundry/content"),
    Path("foundry/scripts"),
    Path("tests/system/macros"),
    Path("tools"),
)

TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".txt",
}

EXCLUDED_PARTS = {
    ".git",
    "coverage",
    "dist",
    "node_modules",
    "packs",
}

INLINE_PATTERNS = (
    (
        "uuid-link",
        re.compile(
            r"@UUID\[(?P<target>[^\]]+)\]"
            r"(?:\{(?P<label>[^}]*)\})?"
        ),
    ),
    (
        "display-table",
        re.compile(
            r"@DisplayTable\[(?P<target>[^\]]+)\]"
            r"(?:\{(?P<label>[^}]*)\})?"
        ),
    ),
    (
        "symbolic-reference",
        re.compile(
            r"@Ref\[(?P<target>[^\]]+)\]"
            r"(?:\{(?P<label>[^}]*)\})?"
        ),
    ),
    (
        "symbolic-display-reference",
        re.compile(
            r"@DisplayRef\[(?P<target>[^\]]+)\]"
            r"(?:\{(?P<label>[^}]*)\})?"
        ),
    ),
)

RUNTIME_PATTERN = re.compile(
    r"\b(?P<function>fromUuidSync|fromUuid)\s*\("
)
UUID_LITERAL_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_${])"
    r"(?P<target>"
    r"[A-Z][A-Za-z0-9]*\.[A-Za-z0-9]{16}"
    r"(?:\.[A-Z][A-Za-z0-9]*\.[A-Za-z0-9]{16})*"
    r"(?:#[A-Za-z0-9._:-]+)?"
    r")"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
    )
    parser.add_argument(
        "--check",
        action="store_true",
    )
    return parser.parse_args()



def load_registered_external_uuids(
    repo_root: Path,
) -> set[str]:
    path = (
        repo_root
        / "foundry"
        / "config"
        / "references"
        / "external-references.json"
    )

    data = json.loads(
        path.read_text(
            encoding="utf-8",
        )
    )

    references = data.get(
        "references"
    )

    if not isinstance(
        references,
        dict,
    ):
        raise RuntimeError(
            "External reference registry has no references object."
        )

    return {
        str(reference["uuid"])
        for reference in references.values()
        if isinstance(
            reference,
            dict,
        )
        and isinstance(
            reference.get("uuid"),
            str,
        )
    }


def assert_no_registered_external_uuid_leaks(
    repo_root: Path,
    entries: list[dict[str, object]],
) -> None:
    registered = load_registered_external_uuids(
        repo_root
    )

    authoritative_roots = (
        "foundry/content/",
        "foundry/scripts/",
        "tools/",
    )

    leaks = [
        entry
        for entry in entries
        if entry.get("kind")
        in {
            "uuid-link",
            "uuid-literal",
        }
        and entry.get("target")
        in registered
        and str(
            entry.get(
                "path",
                "",
            )
        ).startswith(
            authoritative_roots
        )
    ]

    if not leaks:
        return

    details = "\n".join(
        "  "
        + str(entry.get("path"))
        + ":"
        + str(entry.get("line"))
        + " -> "
        + str(entry.get("target"))
        for entry in leaks
    )

    raise RuntimeError(
        "Registered external UUID literals leaked into authoritative source; "
        "use @Ref[...] or generated externalReferenceUuid():\n"
        + details
    )


def source_files(repo_root: Path) -> list[Path]:
    files: list[Path] = []

    for relative_root in SCAN_ROOTS:
        root = repo_root / relative_root
        if not root.exists():
            continue

        candidates = (
            [root]
            if root.is_file()
            else root.rglob("*")
        )
        for path in candidates:
            if not path.is_file():
                continue
            relative = path.relative_to(repo_root)
            if any(part in EXCLUDED_PARTS for part in relative.parts):
                continue
            if relative == DEFAULT_OUTPUT:
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            files.append(path)

    return sorted(
        set(files),
        key=lambda path: path.relative_to(repo_root).as_posix(),
    )


def line_and_column(
    text: str,
    offset: int,
) -> tuple[int, int]:
    line = text.count("\n", 0, offset) + 1
    previous_newline = text.rfind("\n", 0, offset)
    column = offset + 1 if previous_newline < 0 else offset - previous_newline
    return line, column


def snippet_for(
    text: str,
    offset: int,
) -> str:
    line_start = text.rfind("\n", 0, offset) + 1
    line_end = text.find("\n", offset)
    if line_end < 0:
        line_end = len(text)
    return text[line_start:line_end].strip()[:240]


def inventory_entries(
    repo_root: Path,
) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []

    for path in source_files(repo_root):
        relative = path.relative_to(repo_root).as_posix()
        text = path.read_text(
            encoding="utf-8",
            errors="replace",
        )

        occupied_spans: list[
            tuple[int, int]
        ] = []

        for kind, pattern in INLINE_PATTERNS:
            for match in pattern.finditer(text):
                occupied_spans.append(
                    match.span()
                )
                line, column = line_and_column(
                    text,
                    match.start(),
                )
                entry: dict[str, object] = {
                    "kind": kind,
                    "path": relative,
                    "line": line,
                    "column": column,
                    "target": match.group("target"),
                    "classification": "unclassified",
                    "snippet": snippet_for(
                        text,
                        match.start(),
                    ),
                }
                label = match.groupdict().get("label")
                if label is not None:
                    entry["label"] = label
                entries.append(entry)

        for match in UUID_LITERAL_PATTERN.finditer(text):
            if any(
                start <= match.start() < end
                for start, end in occupied_spans
            ):
                continue

            line, column = line_and_column(
                text,
                match.start(),
            )
            entries.append({
                "kind": "uuid-literal",
                "path": relative,
                "line": line,
                "column": column,
                "target": match.group("target"),
                "classification":
                    (
                        "external-registry"
                        if relative.endswith(
                            "external-references.json"
                        )
                        else "unclassified"
                    ),
                "snippet": snippet_for(
                    text,
                    match.start(),
                ),
            })

        for match in RUNTIME_PATTERN.finditer(text):
            line, column = line_and_column(
                text,
                match.start(),
            )
            entries.append({
                "kind": "runtime-uuid-lookup",
                "path": relative,
                "line": line,
                "column": column,
                "function": match.group("function"),
                "classification": "runtime",
                "snippet": snippet_for(
                    text,
                    match.start(),
                ),
            })

    return sorted(
        entries,
        key=lambda entry: (
            str(entry["path"]),
            int(entry["line"]),
            int(entry["column"]),
            str(entry["kind"]),
            str(entry.get("target", "")),
        ),
    )


def build_inventory(
    repo_root: Path,
) -> dict[str, object]:
    entries = inventory_entries(repo_root)
    assert_no_registered_external_uuid_leaks(
        repo_root,
        entries,
    )
    counts: dict[str, int] = {}
    for entry in entries:
        kind = str(entry["kind"])
        counts[kind] = counts.get(kind, 0) + 1

    return {
        "schemaVersion": 1,
        "generatedBy": GENERATOR_NAME,
        "scanRoots": [
            path.as_posix()
            for path in SCAN_ROOTS
        ],
        "counts": dict(sorted(counts.items())),
        "entries": entries,
    }


def rendered_inventory(
    repo_root: Path,
) -> str:
    return (
        json.dumps(
            build_inventory(repo_root),
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    output = (
        args.output
        if args.output.is_absolute()
        else repo_root / args.output
    )
    expected = rendered_inventory(repo_root)

    if args.check:
        if not output.is_file():
            print(
                f"Missing generated reference inventory: {output}",
                file=sys.stderr,
            )
            return 1

        actual = output.read_text(encoding="utf-8")
        if actual != expected:
            print(
                "Generated reference inventory is out of sync.",
                file=sys.stderr,
            )
            diff = unified_diff(
                actual.splitlines(),
                expected.splitlines(),
                fromfile=str(output),
                tofile="expected reference inventory",
                lineterm="",
            )
            for line in diff:
                print(line, file=sys.stderr)
            return 1

        data = json.loads(actual)
        print(
            "Verified reference inventory with "
            f"{len(data['entries'])} entries."
        )
        return 0

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    output.write_text(
        expected,
        encoding="utf-8",
    )
    data = json.loads(expected)
    print(
        f"Generated {len(data['entries'])} reference inventory entries "
        f"in {output.relative_to(repo_root)}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
