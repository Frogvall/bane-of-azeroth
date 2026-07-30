#!/usr/bin/env python3
"""Generate the Player Options RollTables used by curated Journals."""

from __future__ import annotations

import argparse
from difflib import unified_diff
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile


MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = (
    "tools/generate-kin-roll-tables.py"
)
SOURCE_PATH = Path(
    "foundry/content/roll-tables/"
    "player-options/kin.json"
)
ADVENTURE_DIRECTORY_NAME = (
    "Bane_of_Azeroth_ZoNOXZjdkOjV56e3"
)
TABLE_ROOT_DIRECTORY = (
    "Bane_of_Azeroth_BoATables7pQ2mX9"
)
TABLE_ROOT_ID = "BoATables7pQ2mX9"
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


def require_id(
    value: object,
    label: str,
) -> str:
    if (
        not isinstance(value, str)
        or not ID_PATTERN.fullmatch(value)
    ):
        raise GenerationError(
            f"{label} must be a 16-character "
            "alphanumeric Foundry ID."
        )
    return value


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


def base_stats(
    *,
    duplicate_source: str | None = None,
) -> dict[str, object]:
    return {
        "coreVersion": "14.365",
        "systemId": "dragonbane",
        "systemVersion": "4.0.1",
        "createdTime": None,
        "modifiedTime": None,
        "lastModifiedBy": None,
        "compendiumSource": None,
        "duplicateSource": duplicate_source,
        "exportSource": None,
    }


def generated_flags(
    content_key: str,
) -> dict[str, object]:
    return {
        MODULE_ID: {
            "generatedBy": GENERATOR_NAME,
            "contentKey": content_key,
        },
    }


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


def folder_directory(
    name: str,
    folder_id: str,
) -> str:
    return safe_filename(
        name,
        folder_id,
    )[:-5]


def validate_source(
    source: object,
) -> tuple[
    dict[str, object],
    list[dict[str, object]],
]:
    if not isinstance(source, dict):
        raise GenerationError(
            "Kin RollTable source must be an object."
        )
    if source.get("schemaVersion") != 1:
        raise GenerationError(
            "Kin RollTable schemaVersion must be 1."
        )

    folder = source.get("folder")
    if not isinstance(folder, dict):
        raise GenerationError(
            "Kin RollTable source has no folder."
        )
    folder_id = require_id(
        folder.get("id"),
        "folder.id",
    )
    require_string(
        folder.get("key"),
        "folder.key",
    )
    require_string(
        folder.get("name"),
        "folder.name",
    )
    if folder.get("parentId") != TABLE_ROOT_ID:
        raise GenerationError(
            f"folder.parentId must be {TABLE_ROOT_ID}."
        )
    if folder.get("color") is not None:
        raise GenerationError(
            "folder.color must be null."
        )
    if folder.get("sorting") not in {"a", "m"}:
        raise GenerationError(
            "folder.sorting must be a or m."
        )
    if (
        isinstance(
            folder.get("sort"),
            bool,
        )
        or not isinstance(
            folder.get("sort"),
            int,
        )
    ):
        raise GenerationError(
            "folder.sort must be an integer."
        )

    raw_tables = source.get("tables")
    if (
        not isinstance(raw_tables, list)
        or len(raw_tables) != 19
    ):
        raise GenerationError(
            "Kin RollTable source must contain "
            "exactly 19 tables."
        )

    ids = {folder_id}
    keys: set[str] = set()
    tables: list[dict[str, object]] = []

    for table_index, raw_table in enumerate(
        raw_tables
    ):
        if not isinstance(
            raw_table,
            dict,
        ):
            raise GenerationError(
                f"tables[{table_index}] must be "
                "an object."
            )
        table = dict(raw_table)
        key = require_string(
            table.get("key"),
            f"tables[{table_index}].key",
        )
        if not re.fullmatch(
            r"[a-z0-9]+"
            r"(?:[.-][a-z0-9]+)*",
            key,
        ):
            raise GenerationError(
                f"Invalid RollTable key: {key}"
            )
        if key in keys:
            raise GenerationError(
                f"Duplicate RollTable key: {key}"
            )
        keys.add(key)

        table_id = require_id(
            table.get("id"),
            f"table {key}.id",
        )
        if table_id in ids:
            raise GenerationError(
                f"Duplicate Foundry ID: {table_id}"
            )
        ids.add(table_id)

        require_string(
            table.get("name"),
            f"table {key}.name",
        )
        require_string(
            table.get("displayName"),
            f"table {key}.displayName",
        )
        formula = require_string(
            table.get("formula"),
            f"table {key}.formula",
        )
        formula_match = re.fullmatch(
            r"1d(\d+)",
            formula,
            re.IGNORECASE,
        )
        if formula_match is None:
            raise GenerationError(
                f"table {key}.formula must be 1dN."
            )
        sides = int(formula_match.group(1))

        if (
            isinstance(
                table.get("sort"),
                bool,
            )
            or not isinstance(
                table.get("sort"),
                int,
            )
        ):
            raise GenerationError(
                f"table {key}.sort must be an "
                "integer."
            )

        raw_results = table.get("results")
        if (
            not isinstance(raw_results, list)
            or not raw_results
        ):
            raise GenerationError(
                f"table {key} has no results."
            )

        expected = 1
        results: list[dict[str, object]] = []
        for result_index, raw_result in enumerate(
            raw_results
        ):
            if not isinstance(
                raw_result,
                dict,
            ):
                raise GenerationError(
                    f"table {key} result "
                    f"{result_index} is not an object."
                )
            result = dict(raw_result)
            result_id = require_id(
                result.get("id"),
                (
                    f"table {key} result "
                    f"{result_index}.id"
                ),
            )
            if result_id in ids:
                raise GenerationError(
                    f"Duplicate Foundry ID: "
                    f"{result_id}"
                )
            ids.add(result_id)

            result_range = result.get("range")
            if (
                not isinstance(
                    result_range,
                    list,
                )
                or len(result_range) != 2
                or any(
                    isinstance(value, bool)
                    or not isinstance(value, int)
                    for value in result_range
                )
            ):
                raise GenerationError(
                    f"table {key} result range "
                    "must contain two integers."
                )
            start, end = result_range
            if start != expected or end < start:
                raise GenerationError(
                    f"table {key} result ranges "
                    "must be contiguous."
                )
            expected = end + 1
            require_string(
                result.get("name"),
                (
                    f"table {key} result "
                    f"{result_index}.name"
                ),
            )
            results.append(result)

        if expected - 1 != sides:
            raise GenerationError(
                f"table {key} does not cover "
                f"1 through {sides}."
            )

        table["results"] = results
        tables.append(table)

    return folder, tables


def build_folder(
    folder: dict[str, object],
) -> dict[str, object]:
    folder_id = str(folder["id"])
    return {
        "type": "RollTable",
        "folder": folder["parentId"],
        "name": folder["name"],
        "color": folder["color"],
        "sorting": folder["sorting"],
        "_id": folder_id,
        "description": "",
        "sort": folder["sort"],
        "flags": generated_flags(
            "tables.folder.player-options"
        ),
        "_stats": base_stats(
            duplicate_source=(
                f"Folder.{folder_id}"
            ),
        ),
    }


def build_result(
    *,
    table_id: str,
    table_key: str,
    result: dict[str, object],
) -> dict[str, object]:
    del table_id

    return {
        "type": "text",
        "weight": 1,
        "range": result["range"],
        "drawn": False,
        "_id": result["id"],
        "img": "icons/svg/d20-grey.svg",
        "flags": generated_flags(
            "tables."
            f"{table_key}."
            f"result.{result['id']}"
        ),
        "_stats": base_stats(),
        "description": "",
        "name": result["name"],
    }


def build_table(
    *,
    table: dict[str, object],
    folder_id: str,
) -> dict[str, object]:
    table_id = str(table["id"])
    table_key = str(table["key"])
    return {
        "name": table["name"],
        "img": "icons/svg/d20-grey.svg",
        "description": "",
        "results": [
            build_result(
                table_id=table_id,
                table_key=table_key,
                result=result,
            )
            for result in table["results"]
        ],
        "formula": table["formula"],
        "replacement": True,
        "displayRoll": True,
        "folder": folder_id,
        "ownership": {
            "default": 0,
        },
        "flags": {
            "core": {},
            **generated_flags(
                f"tables.{table_key}"
            ),
        },
        "_stats": base_stats(
            duplicate_source=(
                f"RollTable.{table_id}"
            ),
        ),
        "_id": table_id,
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
                    match.group("indent"),
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
    is_managed,
) -> list[str]:
    """Replace managed paths without reordering unrelated entries.

    The current managed block is inserted where its first existing entry
    appeared. If the block did not exist yet, it is appended. Duplicate and
    stale managed entries are removed.
    """

    merged: list[str] = []
    inserted = False

    for value in existing:
        if is_managed(value):
            if not inserted:
                merged.extend(replacements)
                inserted = True
            continue

        merged.append(value)

    if not inserted:
        merged.extend(replacements)

    return merged


def expected_outputs(
    *,
    source_path: Path,
    adventure_directory: Path,
) -> tuple[
    dict[Path, str],
    str,
]:
    source = read_json(source_path)
    folder, tables = validate_source(source)

    root = (
        adventure_directory
        / "RollTable"
        / TABLE_ROOT_DIRECTORY
    )
    if not (
        root / "_Folder.json"
    ).is_file():
        raise GenerationError(
            "Bane of Azeroth RollTable root folder "
            "is missing."
        )

    folder_name = folder_directory(
        str(folder["name"]),
        str(folder["id"]),
    )
    output_directory = root / folder_name

    outputs: dict[Path, str] = {
        output_directory / "_Folder.json":
            dump_json(
                build_folder(folder)
            ),
    }

    table_paths: list[str] = []
    for table in sorted(
        tables,
        key=lambda value: (
            int(value["sort"]),
            str(value["key"]),
        ),
    ):
        filename = safe_filename(
            str(table["name"]),
            str(table["id"]),
        )
        path = (
            output_directory
            / filename
        )
        outputs[path] = dump_json(
            build_table(
                table=table,
                folder_id=str(folder["id"]),
            )
        )
        table_paths.append(
            path.relative_to(
                adventure_directory
            ).as_posix()
        )

    folder_path = (
        output_directory
        / "_Folder.json"
    ).relative_to(
        adventure_directory
    ).as_posix()

    adventure_path = (
        adventure_directory
        / "_Adventure.json"
    )
    try:
        adventure_source = (
            adventure_path.read_text(
                encoding="utf-8",
            )
        )
    except FileNotFoundError as error:
        raise GenerationError(
            f"Missing Adventure: {adventure_path}"
        ) from error

    adventure = json.loads(
        adventure_source
    )
    raw_tables = adventure.get("tables")
    raw_folders = adventure.get("folders")
    if (
        not isinstance(raw_tables, list)
        or not all(
            isinstance(value, str)
            for value in raw_tables
        )
        or not isinstance(raw_folders, list)
        or not all(
            isinstance(value, str)
            for value in raw_folders
        )
    ):
        raise GenerationError(
            "Adventure tables/folders arrays are "
            "invalid."
        )

    managed_prefix = (
        "RollTable/"
        f"{TABLE_ROOT_DIRECTORY}/"
        f"{folder_name}/"
    )

    expected_tables = merge_managed_paths(
        existing=raw_tables,
        replacements=table_paths,
        is_managed=lambda value: (
            value.startswith(
                managed_prefix
            )
        ),
    )

    expected_folders = merge_managed_paths(
        existing=raw_folders,
        replacements=[
            folder_path,
        ],
        is_managed=lambda value: (
            value == folder_path
        ),
    )

    expected_adventure = (
        replace_json_array(
            adventure_source,
            "tables",
            expected_tables,
        )
    )
    expected_adventure = (
        replace_json_array(
            expected_adventure,
            "folders",
            expected_folders,
        )
    )

    json.loads(
        expected_adventure
    )
    return outputs, expected_adventure


def check(
    *,
    outputs: dict[Path, str],
    adventure_path: Path,
    expected_adventure: str,
) -> None:
    failures: list[str] = []

    for path, expected in outputs.items():
        try:
            actual = path.read_text(
                encoding="utf-8",
            )
        except FileNotFoundError:
            failures.append(
                f"Missing generated file: {path}"
            )
            continue
        if actual != expected:
            diff = "".join(
                unified_diff(
                    actual.splitlines(
                        keepends=True
                    ),
                    expected.splitlines(
                        keepends=True
                    ),
                    fromfile=str(path),
                    tofile=(
                        f"{path} (expected)"
                    ),
                )
            )
            failures.append(diff)

    output_directories = {
        path.parent
        for path in outputs
    }
    expected_paths = set(outputs)
    for directory in output_directories:
        if not directory.is_dir():
            continue
        actual_paths = {
            path
            for path in directory.glob(
                "*.json"
            )
        }
        stale = sorted(
            actual_paths - expected_paths
        )
        for path in stale:
            failures.append(
                f"Stale generated file: {path}"
            )

    try:
        actual_adventure = (
            adventure_path.read_text(
                encoding="utf-8",
            )
        )
    except FileNotFoundError:
        failures.append(
            f"Missing Adventure: {adventure_path}"
        )
    else:
        if (
            actual_adventure
            != expected_adventure
        ):
            failures.append(
                "".join(
                    unified_diff(
                        actual_adventure.splitlines(
                            keepends=True
                        ),
                        expected_adventure.splitlines(
                            keepends=True
                        ),
                        fromfile=str(
                            adventure_path
                        ),
                        tofile=(
                            f"{adventure_path} "
                            "(expected)"
                        ),
                    )
                )
            )

    if failures:
        raise GenerationError(
            "Kin RollTables are out of sync:\n"
            + "\n".join(failures)
        )


def write_outputs(
    *,
    outputs: dict[Path, str],
    adventure_path: Path,
    expected_adventure: str,
) -> None:
    directories = {
        path.parent
        for path in outputs
    }
    if len(directories) != 1:
        raise GenerationError(
            "Expected one generated output "
            "directory."
        )
    destination = next(
        iter(directories)
    )
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with tempfile.TemporaryDirectory(
        prefix="boa-kin-tables-",
        dir=destination.parent,
    ) as temporary:
        temporary_root = Path(temporary)
        staged = (
            temporary_root
            / destination.name
        )
        staged.mkdir()

        for path, content in outputs.items():
            (
                staged / path.name
            ).write_text(
                content,
                encoding="utf-8",
            )

        backup = (
            temporary_root
            / "previous"
        )
        if destination.exists():
            shutil.copytree(
                destination,
                backup,
            )

        adventure_original = (
            adventure_path.read_bytes()
        )

        try:
            if destination.exists():
                shutil.rmtree(destination)
            shutil.copytree(
                staged,
                destination,
            )

            temporary_adventure = (
                adventure_path.with_name(
                    f".{adventure_path.name}.tmp"
                )
            )
            temporary_adventure.write_text(
                expected_adventure,
                encoding="utf-8",
            )
            temporary_adventure.replace(
                adventure_path
            )

        except Exception:
            if destination.exists():
                shutil.rmtree(destination)
            if backup.exists():
                shutil.copytree(
                    backup,
                    destination,
                )
            adventure_path.write_bytes(
                adventure_original
            )
            raise


def main() -> int:
    args = parse_args()
    outputs, expected_adventure = (
        expected_outputs(
            source_path=args.source,
            adventure_directory=(
                args.adventure_directory
            ),
        )
    )
    adventure_path = (
        args.adventure_directory
        / "_Adventure.json"
    )

    if args.check:
        check(
            outputs=outputs,
            adventure_path=adventure_path,
            expected_adventure=(
                expected_adventure
            ),
        )
        print(
            "Checked 19 generated Kin "
            "RollTables."
        )
    else:
        write_outputs(
            outputs=outputs,
            adventure_path=adventure_path,
            expected_adventure=(
                expected_adventure
            ),
        )
        check(
            outputs=outputs,
            adventure_path=adventure_path,
            expected_adventure=(
                expected_adventure
            ),
        )
        print(
            "Generated 19 Kin RollTables."
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except GenerationError as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr,
        )
        raise SystemExit(1)
