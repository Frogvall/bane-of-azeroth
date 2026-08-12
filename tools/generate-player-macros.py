#!/usr/bin/env python3
"""Generate player convenience Macros into the Bane of Azeroth Adventure."""

from __future__ import annotations

import argparse
from difflib import unified_diff
import json
from pathlib import Path
import re
import shutil
import sys

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-player-macros.py"
MACRO_FOLDER_ID = "BoAMacros0000001"
MACRO_FOLDER_NAME = "Bane of Azeroth"
MACRO_FOLDER_COLOR = "#0000ff"
MACRO_FOLDER_DIRECTORY_NAME = (
    f"Bane_of_Azeroth_{MACRO_FOLDER_ID}"
)
SOURCE_PATH = Path(
    "foundry/content/macros/player-convenience.json"
)
ADVENTURE_DIRECTORY_NAME = (
    "Bane_of_Azeroth_ZoNOXZjdkOjV56e3"
)
ID_PATTERN = re.compile(
    r"^[A-Za-z0-9]{16}$"
)


class GenerationError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=root / SOURCE_PATH,
    )
    parser.add_argument(
        "--adventure-directory",
        type=Path,
        default=(
            root
            / "foundry"
            / "pack-src"
            / "bane-of-azeroth"
            / ADVENTURE_DIRECTORY_NAME
        ),
    )
    parser.add_argument(
        "--check",
        action="store_true",
    )
    return parser.parse_args()


def read_json(path: Path) -> object:
    try:
        return json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )
    except FileNotFoundError as error:
        raise GenerationError(
            f"Missing JSON source: {path}"
        ) from error
    except json.JSONDecodeError as error:
        raise GenerationError(
            f"Invalid JSON in {path}: {error}"
        ) from error


def dump_json(value: object) -> str:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


def require_string(
    value: object,
    label: str,
) -> str:
    if (
        not isinstance(value, str)
        or not value
    ):
        raise GenerationError(
            f"{label} must be a non-empty string."
        )
    return value


def safe_filename(
    name: str,
    document_id: str,
) -> str:
    stem = re.sub(
        r"[^A-Za-z0-9]+",
        "_",
        name,
    ).strip("_")
    return f"{stem}_{document_id}.json"


def validate_source(
    source: object,
) -> list[dict[str, object]]:
    if not isinstance(source, dict):
        raise GenerationError(
            "Player Macro source must be an object."
        )

    if source.get("schemaVersion") != 1:
        raise GenerationError(
            "Player Macro schemaVersion must be 1."
        )

    raw_macros = source.get("macros")
    if (
        not isinstance(raw_macros, list)
        or len(raw_macros) != 2
    ):
        raise GenerationError(
            "Player Macro source must contain exactly two macros."
        )

    ids: set[str] = set()
    keys: set[str] = set()
    macros: list[dict[str, object]] = []

    for index, raw_macro in enumerate(
        raw_macros
    ):
        if not isinstance(
            raw_macro,
            dict,
        ):
            raise GenerationError(
                f"macros[{index}] must be an object."
            )

        macro = dict(raw_macro)
        key = require_string(
            macro.get("key"),
            f"macros[{index}].key",
        )
        if key in keys:
            raise GenerationError(
                f"Duplicate Macro key: {key}"
            )
        keys.add(key)

        document_id = require_string(
            macro.get("id"),
            f"macro {key}.id",
        )
        if not ID_PATTERN.fullmatch(
            document_id
        ):
            raise GenerationError(
                f"Macro {key}.id must be a 16-character "
                "alphanumeric Foundry ID."
            )
        if document_id in ids:
            raise GenerationError(
                f"Duplicate Macro ID: {document_id}"
            )
        ids.add(document_id)

        require_string(
            macro.get("name"),
            f"macro {key}.name",
        )
        require_string(
            macro.get("img"),
            f"macro {key}.img",
        )
        require_string(
            macro.get("apiMethod"),
            f"macro {key}.apiMethod",
        )

        sort = macro.get("sort")
        if (
            isinstance(sort, bool)
            or not isinstance(sort, int)
        ):
            raise GenerationError(
                f"macro {key}.sort must be an integer."
            )

        ownership_default = macro.get(
            "ownershipDefault"
        )
        if ownership_default not in {
            0,
            1,
            2,
            3,
        }:
            raise GenerationError(
                f"macro {key}.ownershipDefault must be "
                "a Foundry ownership level."
            )

        macros.append(macro)

    expected = {
        "change-druid-form": (
            "icons/svg/pawprint.svg",
            "runChangeDruidFormMacro",
        ),
        "end-effects": (
            "icons/svg/cancel.svg",
            "runEndEffectsMacro",
        ),
    }

    for macro in macros:
        pair = expected.get(
            str(macro["key"])
        )
        if pair is None:
            raise GenerationError(
                f"Unexpected Player Macro key: {macro['key']}"
            )
        if (
            macro["img"],
            macro["apiMethod"],
        ) != pair:
            raise GenerationError(
                f"Player Macro {macro['key']} does not match "
                "its required icon/API contract."
            )

    return macros


def macro_command(
    api_method: str,
) -> str:
    return (
        'const boa = game.modules.get("bane-of-azeroth")?.api;\n'
        f'if (typeof boa?.{api_method} !== "function") {{\n'
        '  ui.notifications?.error?.(\n'
        '    "Bane of Azeroth macro support is unavailable.",\n'
        '  );\n'
        '  return;\n'
        '}\n'
        f'await boa.{api_method}();\n'
    )


def base_stats() -> dict[str, object]:
    return {
        "coreVersion": "14.365",
        "systemId": "dragonbane",
        "systemVersion": "4.0.1",
        "createdTime": None,
        "modifiedTime": None,
        "lastModifiedBy": None,
        "compendiumSource": None,
        "duplicateSource": None,
        "exportSource": None,
    }


def build_macro_folder() -> dict[str, object]:
    stats = base_stats()
    stats["duplicateSource"] = (
        f"Folder.{MACRO_FOLDER_ID}"
    )

    return {
        "type": "Macro",
        "folder": None,
        "name": MACRO_FOLDER_NAME,
        "color": MACRO_FOLDER_COLOR,
        "sorting": "m",
        "_id": MACRO_FOLDER_ID,
        "description": "",
        "sort": 0,
        "flags": {
            MODULE_ID: {
                "generatedBy": GENERATOR_NAME,
                "contentKey": "macros.folder.bane-of-azeroth",
            },
        },
        "_stats": stats,
    }


def build_macro(
    macro: dict[str, object],
) -> dict[str, object]:
    document_id = str(macro["id"])
    key = str(macro["key"])

    return {
        "name": str(macro["name"]),
        "type": "script",
        "scope": "global",
        "command": macro_command(
            str(macro["apiMethod"])
        ),
        "img": str(macro["img"]),
        "author": None,
        "folder": MACRO_FOLDER_ID,
        "sort": int(macro["sort"]),
        "ownership": {
            "default": int(
                macro["ownershipDefault"]
            ),
        },
        "flags": {
            MODULE_ID: {
                "generatedBy":
                    GENERATOR_NAME,
                "contentKey":
                    f"macros.{key}",
            },
        },
        "_stats": base_stats(),
        "_id": document_id,
    }


def locate_json_array(
    source: str,
    key: str,
) -> tuple[int, int, str]:
    match = re.search(
        rf'(?m)^(?P<indent>\s*)'
        rf'"{re.escape(key)}"\s*:\s*\[',
        source,
    )
    if match is None:
        raise GenerationError(
            f"Adventure has no {key!r} array."
        )

    open_index = source.find(
        "[",
        match.start(),
    )
    depth = 0
    in_string = False
    escaped = False

    for index in range(
        open_index,
        len(source),
    ):
        character = source[index]

        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue

        if character == '"':
            in_string = True
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return (
                    open_index,
                    index + 1,
                    match.group(
                        "indent"
                    ),
                )

    raise GenerationError(
        f"Adventure {key!r} array is not closed."
    )


def replace_json_array(
    source: str,
    key: str,
    values: list[str],
) -> str:
    start, end, indent = (
        locate_json_array(
            source,
            key,
        )
    )
    child_indent = indent + "  "

    if values:
        rendered = (
            "[\n"
            + ",\n".join(
                child_indent
                + json.dumps(
                    value,
                    ensure_ascii=False,
                )
                for value in values
            )
            + "\n"
            + indent
            + "]"
        )
    else:
        rendered = "[]"

    return (
        source[:start]
        + rendered
        + source[end:]
    )


def merge_managed_paths(
    *,
    existing: list[str],
    replacements: list[str],
    managed_ids: set[str],
) -> list[str]:
    def is_managed(
        value: str,
    ) -> bool:
        return any(
            value.endswith(
                f"_{document_id}.json"
            )
            for document_id
            in managed_ids
        )

    merged: list[str] = []
    inserted = False

    for value in existing:
        if is_managed(value):
            if not inserted:
                merged.extend(
                    replacements
                )
                inserted = True
            continue

        merged.append(value)

    if not inserted:
        merged.extend(
            replacements
        )

    return merged


def merge_exact_managed_path(
    *,
    existing: list[str],
    managed_path: str,
    include: bool,
) -> list[str]:
    """Preserve one managed path in place without moving unrelated paths."""
    merged: list[str] = []
    inserted = False

    for value in existing:
        if value == managed_path:
            if include and not inserted:
                merged.append(managed_path)
                inserted = True
            continue

        merged.append(value)

    if include and not inserted:
        merged.append(managed_path)

    return merged


def expected_outputs(
    *,
    source_path: Path,
    adventure_directory: Path,
) -> tuple[
    dict[Path, str],
    str,
    set[Path],
]:
    source = read_json(source_path)
    macros = validate_source(source)

    macro_root_directory = (
        adventure_directory
        / "Macro"
    )
    macro_directory = (
        macro_root_directory
        / MACRO_FOLDER_DIRECTORY_NAME
    )
    outputs: dict[
        Path,
        str,
    ] = {}
    macro_paths: list[str] = []
    managed_ids: set[str] = set()
    expected_files: set[Path] = set()

    folder_path = (
        macro_directory
        / "_Folder.json"
    )
    outputs[folder_path] = dump_json(
        build_macro_folder()
    )
    expected_files.add(folder_path)

    for macro in sorted(
        macros,
        key=lambda value: (
            int(value["sort"]),
            str(value["key"]),
        ),
    ):
        document_id = str(
            macro["id"]
        )
        managed_ids.add(
            document_id
        )
        filename = safe_filename(
            str(macro["name"]),
            document_id,
        )
        path = (
            macro_directory
            / filename
        )
        outputs[path] = dump_json(
            build_macro(
                macro
            )
        )
        expected_files.add(
            path
        )
        macro_paths.append(
            path.relative_to(
                adventure_directory
            ).as_posix()
        )

    adventure_path = (
        adventure_directory
        / "_Adventure.json"
    )
    try:
        adventure_source = (
            adventure_path
            .read_text(
                encoding="utf-8"
            )
        )
    except FileNotFoundError as error:
        raise GenerationError(
            "Adventure source is missing."
        ) from error

    adventure = json.loads(
        adventure_source
    )
    existing_macros = adventure.get(
        "macros"
    )
    if not isinstance(
        existing_macros,
        list,
    ):
        raise GenerationError(
            "Adventure macros must be an array."
        )

    merged_paths = merge_managed_paths(
        existing=[
            str(value)
            for value
            in existing_macros
        ],
        replacements=macro_paths,
        managed_ids=managed_ids,
    )
    expected_adventure = (
        replace_json_array(
            adventure_source,
            "macros",
            merged_paths,
        )
    )

    existing_folders = adventure.get(
        "folders"
    )
    if not isinstance(
        existing_folders,
        list,
    ):
        raise GenerationError(
            "Adventure folders must be an array."
        )

    folder_relative = (
        folder_path
        .relative_to(adventure_directory)
        .as_posix()
    )
    merged_folders = merge_exact_managed_path(
        existing=[
            str(value)
            for value in existing_folders
        ],
        managed_path=folder_relative,
        include=True,
    )

    expected_adventure = (
        replace_json_array(
            expected_adventure,
            "folders",
            merged_folders,
        )
    )

    return (
        outputs,
        expected_adventure,
        expected_files,
    )


def generated_macro_files(
    macro_directory: Path,
) -> set[Path]:
    if not macro_directory.is_dir():
        return set()

    managed: set[Path] = set()

    for path in macro_directory.rglob(
        "*.json"
    ):
        try:
            document = read_json(
                path
            )
        except GenerationError:
            continue

        if not isinstance(
            document,
            dict,
        ):
            continue

        flags = document.get(
            "flags"
        )
        module_flags = (
            flags.get(
                MODULE_ID
            )
            if isinstance(
                flags,
                dict,
            )
            else None
        )

        if (
            isinstance(
                module_flags,
                dict,
            )
            and module_flags.get(
                "generatedBy"
            ) == GENERATOR_NAME
        ):
            managed.add(
                path
            )

    return managed


def check_outputs(
    *,
    outputs: dict[Path, str],
    expected_adventure: str,
    expected_files: set[Path],
    adventure_directory: Path,
) -> None:
    failures: list[str] = []

    for path, expected in outputs.items():
        actual = (
            path.read_text(
                encoding="utf-8"
            )
            if path.is_file()
            else None
        )

        if actual != expected:
            failures.append(
                str(path)
            )

    adventure_path = (
        adventure_directory
        / "_Adventure.json"
    )
    actual_adventure = (
        adventure_path.read_text(
            encoding="utf-8"
        )
    )
    if (
        actual_adventure !=
        expected_adventure
    ):
        failures.append(
            str(adventure_path)
        )

    stale = sorted(
        generated_macro_files(
            adventure_directory
            / "Macro"
        )
        - expected_files
    )
    failures.extend(
        str(path)
        for path in stale
    )

    if failures:
        raise GenerationError(
            "Generated Player Macros are out of sync:\n  "
            + "\n  ".join(
                failures
            )
        )


def write_outputs(
    *,
    outputs: dict[Path, str],
    expected_adventure: str,
    expected_files: set[Path],
    adventure_directory: Path,
) -> None:
    macro_directory = (
        adventure_directory
        / "Macro"
    )
    macro_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    for stale in (
        generated_macro_files(
            macro_directory
        )
        - expected_files
    ):
        stale.unlink()

    for path, content in outputs.items():
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        path.write_text(
            content,
            encoding="utf-8",
        )

    (
        adventure_directory
        / "_Adventure.json"
    ).write_text(
        expected_adventure,
        encoding="utf-8",
    )


def main() -> int:
    args = parse_args()

    try:
        (
            outputs,
            expected_adventure,
            expected_files,
        ) = expected_outputs(
            source_path=
                args.source,
            adventure_directory=
                args.adventure_directory,
        )

        if args.check:
            check_outputs(
                outputs=
                    outputs,
                expected_adventure=
                    expected_adventure,
                expected_files=
                    expected_files,
                adventure_directory=
                    args.adventure_directory,
            )
            print(
                "Checked 2 Player Macros."
            )
            return 0

        write_outputs(
            outputs=
                outputs,
            expected_adventure=
                expected_adventure,
            expected_files=
                expected_files,
            adventure_directory=
                args.adventure_directory,
        )
        print(
            "Generated 2 Player Macros."
        )
        return 0

    except GenerationError as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
