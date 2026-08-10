#!/usr/bin/env python3
"""Generate Bane of Azeroth kin and kin ability Adventure source files.

The generator owns every Item JSON file directly inside the Adventure's
"Kin" and "Kin Abilities" folders, except each folder's _Folder.json.
It preserves all other Adventure content.

Run from any directory:

    python3 tools/generate-kin.py

Verify that committed files are up to date without changing them:

    python3 tools/generate-kin.py --check
"""

from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-kin.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


@dataclass(frozen=True)
class GeneratedFile:
    path: Path
    data: dict[str, Any]


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(
        description="Generate Foundry kin and kin ability source documents."
    )
    parser.add_argument(
        "--content",
        type=Path,
        default=repo_root / "foundry" / "content" / "kin.json",
        help="Structured kin content JSON.",
    )
    parser.add_argument(
        "--pack-root",
        type=Path,
        default=repo_root
        / "foundry"
        / "pack-src"
        / "bane-of-azeroth",
        help="Unpacked Adventure pack source directory.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify generated files without modifying them.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError as exc:
        raise GenerationError(f"Missing JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise GenerationError(
            f"Invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: "
            f"{exc.msg}"
        ) from exc

    if not isinstance(data, dict):
        raise GenerationError(f"Expected a JSON object in {path}")

    return data


def dump_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def find_single_file(root: Path, filename: str) -> Path:
    matches = sorted(root.rglob(filename))

    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one {filename} below {root}, "
            f"found {len(matches)}."
        )

    return matches[0]


def find_item_folder(adventure_dir: Path, name: str) -> tuple[Path, str]:
    matches: list[tuple[Path, str]] = []

    for folder_file in adventure_dir.joinpath("Item").rglob("_Folder.json"):
        folder = load_json(folder_file)

        if folder.get("type") == "Item" and folder.get("name") == name:
            folder_id = folder.get("_id")

            if not isinstance(folder_id, str) or not ID_PATTERN.fullmatch(folder_id):
                raise GenerationError(
                    f"Folder {name!r} has an invalid Foundry ID in {folder_file}."
                )

            matches.append((folder_file.parent, folder_id))

    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one Item folder named {name!r}, "
            f"found {len(matches)}."
        )

    return matches[0]


def require_string(value: Any, context: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise GenerationError(f"{context} must be a string.")

    if not allow_empty and not value.strip():
        raise GenerationError(f"{context} must not be empty.")

    return value


def require_id(value: Any, context: str) -> str:
    document_id = require_string(value, context)

    if not ID_PATTERN.fullmatch(document_id):
        raise GenerationError(
            f"{context} must contain exactly 16 ASCII letters or digits."
        )

    return document_id


def require_paragraphs(value: Any, context: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise GenerationError(f"{context} must be a non-empty array of strings.")

    paragraphs: list[str] = []

    for index, paragraph in enumerate(value):
        text = require_string(paragraph, f"{context}[{index}]").strip()
        paragraphs.append(text)

    return paragraphs


def paragraphs_to_html(paragraphs: Sequence[str]) -> str:
    return "".join(
        f"<p>{html.escape(paragraph, quote=False)}</p>"
        for paragraph in paragraphs
    )



def load_reference_helpers(
    repo_root: Path,
):
    path = (
        repo_root
        / "tools"
        / "boa-references.py"
    )

    spec = importlib.util.spec_from_file_location(
        "boa_references",
        path,
    )

    if (
        spec is None
        or spec.loader is None
    ):
        raise GenerationError(
            f"Could not load reference helpers from {path}."
        )

    module = importlib.util.module_from_spec(
        spec
    )
    sys.modules[
        spec.name
    ] = module
    spec.loader.exec_module(
        module
    )

    return module

def safe_filename(name: str, document_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")

    if not stem:
        stem = "Document"

    return f"{stem}_{document_id}.json"


def base_stats() -> dict[str, Any]:
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


def generated_flags(content_key: str) -> dict[str, Any]:
    return {
        MODULE_ID: {
            "generatedBy": GENERATOR_NAME,
            "contentKey": content_key,
        }
    }


def build_kin_document(
    kin: dict[str, Any],
    folder_id: str,
    default_image: str,
    sort: int,
    internal_references: dict[str, Any],
    external_references: dict[str, Any],
    reference_helpers: Any,
) -> dict[str, Any]:
    key = require_string(kin.get("key"), "kin.key")
    document_id = require_id(kin.get("id"), f"kin {key!r}.id")
    name = require_string(kin.get("name"), f"kin {key!r}.name")
    paragraphs = require_paragraphs(
        kin.get("description"),
        f"kin {name!r}.description",
    )

    movement = kin.get("movement")

    if not isinstance(movement, int) or isinstance(movement, bool) or movement < 0:
        raise GenerationError(
            f"kin {name!r}.movement must be a non-negative integer."
        )

    abilities = kin.get("abilities")

    if not isinstance(abilities, list) or not abilities:
        raise GenerationError(f"kin {name!r}.abilities must not be empty.")

    ability_names = [
        require_string(ability.get("name"), f"ability in kin {name!r}.name")
        for ability in abilities
        if isinstance(ability, dict)
    ]

    if len(ability_names) != len(abilities):
        raise GenerationError(
            f"Every ability in kin {name!r} must be a JSON object."
        )

    image = require_string(
        kin.get("image", default_image),
        f"kin {name!r}.image",
    )

    return {
        "folder": folder_id,
        "name": name,
        "type": "kin",
        "_id": document_id,
        "img": image,
        "system": {
            "itemDescription": reference_helpers.resolve_symbolic_references(
                paragraphs_to_html(paragraphs),
                internal_references=internal_references,
                external_references=external_references,
            ),
            "gmDescription": "",
            "abilities": ", ".join(ability_names),
            "movement": movement,
        },
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"kin.{key}"),
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def build_ability_document(
    ability: dict[str, Any],
    kin_name: str,
    folder_id: str,
    default_image: str,
    sort: int,
    internal_references: dict[str, Any],
    external_references: dict[str, Any],
    reference_helpers: Any,
) -> dict[str, Any]:
    key = require_string(ability.get("key"), f"ability for {kin_name}.key")
    document_id = require_id(
        ability.get("id"),
        f"ability {key!r}.id",
    )
    name = require_string(ability.get("name"), f"ability {key!r}.name")
    paragraphs = require_paragraphs(
        ability.get("description"),
        f"ability {name!r}.description",
    )
    wp = require_string(
        ability.get("wp", ""),
        f"ability {name!r}.wp",
        allow_empty=True,
    )
    image = require_string(
        ability.get("image", default_image),
        f"ability {name!r}.image",
    )
    requirement = require_string(
        ability.get("requirement", kin_name),
        f"ability {name!r}.requirement",
    )

    return {
        "folder": folder_id,
        "name": name,
        "type": "ability",
        "_id": document_id,
        "img": image,
        "system": {
            "itemDescription": reference_helpers.resolve_symbolic_references(
                paragraphs_to_html(paragraphs),
                internal_references=internal_references,
                external_references=external_references,
            ),
            "gmDescription": "",
            "abilityType": "",
            "requirement": requirement,
            "wp": wp,
            "boons": "",
            "secondaryAttribute": "none",
            "secondaryAttributeBonus": 0,
        },
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"ability.{key}"),
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def validate_content(content: dict[str, Any]) -> tuple[list[dict[str, Any]], str, str]:
    if content.get("schemaVersion") != 1:
        raise GenerationError("kin.json schemaVersion must be 1.")

    defaults = content.get("defaults")

    if not isinstance(defaults, dict):
        raise GenerationError("kin.json defaults must be a JSON object.")

    kin_image = require_string(
        defaults.get("kinImage"),
        "defaults.kinImage",
    )
    ability_image = require_string(
        defaults.get("abilityImage"),
        "defaults.abilityImage",
    )

    kin_entries = content.get("kin")

    if not isinstance(kin_entries, list) or not kin_entries:
        raise GenerationError("kin.json kin must be a non-empty array.")

    expected = content.get("expectedCounts", {})

    if not isinstance(expected, dict):
        raise GenerationError("expectedCounts must be a JSON object.")

    ability_count = 0
    ids: set[str] = set()
    kin_keys: set[str] = set()
    kin_names: set[str] = set()
    ability_keys: set[str] = set()
    ability_names: set[str] = set()

    for kin_index, kin in enumerate(kin_entries):
        if not isinstance(kin, dict):
            raise GenerationError(f"kin[{kin_index}] must be a JSON object.")

        key = require_string(kin.get("key"), f"kin[{kin_index}].key")
        document_id = require_id(kin.get("id"), f"kin {key!r}.id")
        name = require_string(kin.get("name"), f"kin {key!r}.name")

        if key in kin_keys:
            raise GenerationError(f"Duplicate kin key: {key}")
        if name in kin_names:
            raise GenerationError(f"Duplicate kin name: {name}")
        if document_id in ids:
            raise GenerationError(f"Duplicate Foundry ID: {document_id}")

        kin_keys.add(key)
        kin_names.add(name)
        ids.add(document_id)

        abilities = kin.get("abilities")

        if not isinstance(abilities, list) or not abilities:
            raise GenerationError(f"kin {name!r} must have at least one ability.")

        for ability_index, ability in enumerate(abilities):
            if not isinstance(ability, dict):
                raise GenerationError(
                    f"kin {name!r} ability[{ability_index}] "
                    "must be a JSON object."
                )

            ability_key = require_string(
                ability.get("key"),
                f"kin {name!r} ability[{ability_index}].key",
            )
            ability_id = require_id(
                ability.get("id"),
                f"ability {ability_key!r}.id",
            )
            ability_name = require_string(
                ability.get("name"),
                f"ability {ability_key!r}.name",
            )

            if ability_key in ability_keys:
                raise GenerationError(f"Duplicate ability key: {ability_key}")
            if ability_name in ability_names:
                raise GenerationError(f"Duplicate ability name: {ability_name}")
            if ability_id in ids:
                raise GenerationError(f"Duplicate Foundry ID: {ability_id}")

            ability_keys.add(ability_key)
            ability_names.add(ability_name)
            ids.add(ability_id)
            ability_count += 1

    expected_kin = expected.get("kin")

    if expected_kin is not None and expected_kin != len(kin_entries):
        raise GenerationError(
            f"Expected {expected_kin} kin, found {len(kin_entries)}."
        )

    expected_abilities = expected.get("abilities")

    if expected_abilities is not None and expected_abilities != ability_count:
        raise GenerationError(
            f"Expected {expected_abilities} abilities, found {ability_count}."
        )

    return kin_entries, kin_image, ability_image


def is_managed_item_path(
    item_path: str,
    managed_prefixes: Sequence[str],
) -> bool:
    return any(item_path.startswith(prefix) for prefix in managed_prefixes)


def find_external_id_collisions(
    adventure_dir: Path,
    managed_dirs: Sequence[Path],
    generated_ids: set[str],
) -> list[tuple[str, Path]]:
    managed_roots = {directory.resolve() for directory in managed_dirs}
    collisions: list[tuple[str, Path]] = []

    for path in adventure_dir.joinpath("Item").rglob("*.json"):
        if path.name == "_Folder.json":
            continue

        if any(root in path.resolve().parents for root in managed_roots):
            continue

        data = load_json(path)
        document_id = data.get("_id")

        if document_id in generated_ids:
            collisions.append((str(document_id), path))

    return collisions


def compare_json(path: Path, expected: dict[str, Any]) -> bool:
    if not path.is_file():
        return False

    try:
        actual = load_json(path)
    except GenerationError:
        return False

    return actual == expected


def write_generated_files(
    generated: Sequence[GeneratedFile],
    managed_dirs: Sequence[Path],
    check: bool,
) -> list[str]:
    problems: list[str] = []
    expected_paths = {entry.path.resolve() for entry in generated}

    existing_paths = {
        path.resolve()
        for directory in managed_dirs
        for path in directory.glob("*.json")
        if path.name != "_Folder.json"
    }

    stale_paths = sorted(existing_paths - expected_paths)

    if check:
        for stale in stale_paths:
            problems.append(f"Stale generated document: {stale}")

        for entry in generated:
            if not compare_json(entry.path, entry.data):
                problems.append(f"Out-of-date generated document: {entry.path}")

        return problems

    for stale in stale_paths:
        stale.unlink()

    for entry in generated:
        entry.path.parent.mkdir(parents=True, exist_ok=True)
        entry.path.write_text(dump_json(entry.data), encoding="utf-8")

    return problems


def updated_adventure_items(
    existing_items: Sequence[Any],
    managed_prefixes: Sequence[str],
    generated_paths: Sequence[str],
) -> list[str]:
    item_paths: list[str] = []

    for index, value in enumerate(existing_items):
        if not isinstance(value, str):
            raise GenerationError(
                f"_Adventure.json items[{index}] must be a string."
            )
        item_paths.append(value)

    first_managed_index = next(
        (
            index
            for index, path in enumerate(item_paths)
            if is_managed_item_path(path, managed_prefixes)
        ),
        0,
    )

    insertion_index = sum(
        1
        for path in item_paths[:first_managed_index]
        if not is_managed_item_path(path, managed_prefixes)
    )

    unmanaged = [
        path
        for path in item_paths
        if not is_managed_item_path(path, managed_prefixes)
    ]

    return (
        unmanaged[:insertion_index]
        + list(generated_paths)
        + unmanaged[insertion_index:]
    )


def main() -> int:
    args = parse_args()

    try:
        content = load_json(args.content)
        kin_entries, kin_image, ability_image = validate_content(content)
        repo_root = Path(__file__).resolve().parents[1]
        reference_helpers = load_reference_helpers(
            repo_root
        )
        external_references = (
            reference_helpers.load_external_reference_targets(
                repo_root
            )
        )
        internal_references = (
            reference_helpers.load_internal_journal_reference_targets(
                repo_root
            )
        )

        adventure_file = find_single_file(args.pack_root, "_Adventure.json")
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)

        kin_dir, kin_folder_id = find_item_folder(adventure_dir, "Kin")
        ability_dir, ability_folder_id = find_item_folder(
            adventure_dir,
            "Kin Abilities",
        )

        generated: list[GeneratedFile] = []
        generated_ids: set[str] = set()
        kin_paths: list[str] = []
        ability_paths: list[str] = []

        for kin_index, kin in enumerate(kin_entries):
            kin_document = build_kin_document(
                kin,
                kin_folder_id,
                kin_image,
                (kin_index + 1) * 100000,
                internal_references=internal_references,
                external_references=external_references,
                reference_helpers=reference_helpers,
            )
            kin_path = kin_dir / safe_filename(
                kin_document["name"],
                kin_document["_id"],
            )
            generated.append(GeneratedFile(kin_path, kin_document))
            generated_ids.add(kin_document["_id"])
            kin_paths.append(kin_path.relative_to(adventure_dir).as_posix())

            abilities = kin["abilities"]

            for ability in abilities:
                ability_document = build_ability_document(
                    ability,
                    kin_document["name"],
                    ability_folder_id,
                    ability_image,
                    (len(ability_paths) + 1) * 100000,
                    internal_references=internal_references,
                    external_references=external_references,
                    reference_helpers=reference_helpers,
                )
                ability_path = ability_dir / safe_filename(
                    ability_document["name"],
                    ability_document["_id"],
                )
                generated.append(
                    GeneratedFile(ability_path, ability_document)
                )
                generated_ids.add(ability_document["_id"])
                ability_paths.append(
                    ability_path.relative_to(adventure_dir).as_posix()
                )

        collisions = find_external_id_collisions(
            adventure_dir,
            [kin_dir, ability_dir],
            generated_ids,
        )

        if collisions:
            details = "\n".join(
                f"  {document_id}: {path}"
                for document_id, path in collisions
            )
            raise GenerationError(
                "Generated Foundry IDs collide with non-kin Adventure "
                f"documents:\n{details}"
            )

        kin_prefix = kin_dir.relative_to(adventure_dir).as_posix() + "/"
        ability_prefix = (
            ability_dir.relative_to(adventure_dir).as_posix() + "/"
        )
        managed_prefixes = [kin_prefix, ability_prefix]

        generated_paths = ability_paths + kin_paths
        expected_adventure = dict(adventure)
        expected_adventure["items"] = updated_adventure_items(
            adventure.get("items", []),
            managed_prefixes,
            generated_paths,
        )

        problems = write_generated_files(
            generated,
            [kin_dir, ability_dir],
            args.check,
        )

        if args.check:
            if not compare_json(adventure_file, expected_adventure):
                problems.append(
                    f"Out-of-date Adventure manifest: {adventure_file}"
                )

            if problems:
                print("Generated kin content is not up to date:", file=sys.stderr)
                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)
                return 1

            print(
                "Kin content is up to date: "
                f"{len(kin_paths)} kin and {len(ability_paths)} abilities."
            )
            return 0

        adventure_file.write_text(
            dump_json(expected_adventure),
            encoding="utf-8",
        )

        print(
            "Generated "
            f"{len(kin_paths)} kin and {len(ability_paths)} kin abilities."
        )
        print(f"Updated {adventure_file}")
        return 0

    except GenerationError as exc:
        print(f"generate-kin.py: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
