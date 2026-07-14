#!/usr/bin/env python3
"""Generate Bane of Azeroth spell Adventure source files."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-spells.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")
VALID_RANGE_TYPES = {"personal", "touch", "range"}
VALID_CASTING_TIMES = {"action"}
VALID_AREAS = {"none"}
VALID_DURATIONS = {"instant", "round", "stretch", "shift"}


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Generate Foundry spell source documents.")
    parser.add_argument(
        "--content",
        type=Path,
        default=repo_root / "foundry" / "content" / "spells.json",
    )
    parser.add_argument(
        "--pack-root",
        type=Path,
        default=repo_root / "foundry" / "pack-src" / "bane-of-azeroth",
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
            f"Invalid JSON in {path}: line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(data, dict):
        raise GenerationError(f"Expected a JSON object in {path}")
    return data


def dump_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def require_string(
    value: Any,
    context: str,
    *,
    allow_empty: bool = False,
) -> str:
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


def require_integer(value: Any, context: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise GenerationError(
            f"{context} must be an integer greater than or equal to {minimum}."
        )
    return value


def find_single_file(root: Path, filename: str) -> Path:
    matches = sorted(root.rglob(filename))
    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one {filename} below {root}, found {len(matches)}."
        )
    return matches[0]


def find_item_folder(root: Path, name: str) -> tuple[Path, str]:
    matches: list[tuple[Path, str]] = []
    for folder_file in root.rglob("_Folder.json"):
        folder = load_json(folder_file)
        if folder.get("type") != "Item" or folder.get("name") != name:
            continue
        folder_id = folder.get("_id")
        if not isinstance(folder_id, str) or not ID_PATTERN.fullmatch(folder_id):
            raise GenerationError(
                f"Folder {name!r} has an invalid Foundry ID in {folder_file}."
            )
        matches.append((folder_file.parent, folder_id))
    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one Item folder named {name!r}, found {len(matches)}."
        )
    return matches[0]


def base_stats(*, duplicate_source: str | None = None) -> dict[str, Any]:
    return {
        "coreVersion": "14.364",
        "systemId": "dragonbane",
        "systemVersion": "4.0.1",
        "createdTime": None,
        "modifiedTime": None,
        "lastModifiedBy": None,
        "compendiumSource": None,
        "duplicateSource": duplicate_source,
        "exportSource": None,
    }


def generated_flags(content_key: str) -> dict[str, Any]:
    return {
        MODULE_ID: {
            "generatedBy": GENERATOR_NAME,
            "contentKey": content_key,
        }
    }


def safe_filename(name: str, document_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "Document"
    return f"{stem}_{document_id}.json"


def folder_filename(name: str, folder_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "Folder"
    return f"{stem}_{folder_id}"


def build_folder(
    *,
    name: str,
    folder_id: str,
    parent_id: str,
    sort: int,
    sorting: str,
    color: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "Item",
        "folder": parent_id,
        "name": name,
        "color": color,
        "sorting": sorting,
        "_id": folder_id,
        "description": "",
        "sort": sort,
        "flags": generated_flags(f"spells.folder.{name.lower().replace(' ', '-')}"),
        "_stats": base_stats(duplicate_source=f"Folder.{folder_id}"),
    }


def validate_content(content: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if content.get("schemaVersion") != 1:
        raise GenerationError("spells.json schemaVersion must be 1.")

    expected_count = require_integer(
        content.get("expectedCount"),
        "spells.json expectedCount",
        minimum=1,
    )

    folder = content.get("folder")
    if not isinstance(folder, dict):
        raise GenerationError("spells.json folder must be an object.")
    require_id(folder.get("id"), "folder.id")
    require_string(folder.get("name"), "folder.name")

    child = folder.get("child")
    if not isinstance(child, dict):
        raise GenerationError("spells.json folder.child must be an object.")
    require_id(child.get("id"), "folder.child.id")
    require_string(child.get("name"), "folder.child.name")

    raw_spells = content.get("spells")
    if not isinstance(raw_spells, list):
        raise GenerationError("spells.json spells must be an array.")
    if len(raw_spells) != expected_count:
        raise GenerationError(
            f"Expected {expected_count} spells, found {len(raw_spells)}."
        )

    keys: set[str] = set()
    names: set[str] = set()
    ids: set[str] = {folder["id"], child["id"]}
    validated: list[dict[str, Any]] = []

    for index, raw_spell in enumerate(raw_spells):
        if not isinstance(raw_spell, dict):
            raise GenerationError(f"spells[{index}] must be an object.")

        key = require_string(raw_spell.get("key"), f"spells[{index}].key")
        document_id = require_id(raw_spell.get("id"), f"spell {key!r}.id")
        name = require_string(raw_spell.get("name"), f"spell {key!r}.name")

        if key in keys:
            raise GenerationError(f"Duplicate spell key: {key}")
        if name in names:
            raise GenerationError(f"Duplicate spell name: {name}")
        if document_id in ids:
            raise GenerationError(f"Duplicate Foundry ID: {document_id}")

        keys.add(key)
        names.add(name)
        ids.add(document_id)

        require_string(raw_spell.get("school"), f"spell {name!r}.school")
        require_integer(raw_spell.get("rank"), f"spell {name!r}.rank", minimum=1)
        require_string(
            raw_spell.get("prerequisite"),
            f"spell {name!r}.prerequisite",
        )
        require_string(
            raw_spell.get("requirement"),
            f"spell {name!r}.requirement",
        )

        casting_time = require_string(
            raw_spell.get("castingTime"),
            f"spell {name!r}.castingTime",
        )
        if casting_time not in VALID_CASTING_TIMES:
            raise GenerationError(
                f"spell {name!r}.castingTime must be one of "
                f"{sorted(VALID_CASTING_TIMES)}."
            )

        range_type = require_string(
            raw_spell.get("rangeType"),
            f"spell {name!r}.rangeType",
        )
        if range_type not in VALID_RANGE_TYPES:
            raise GenerationError(
                f"spell {name!r}.rangeType must be one of "
                f"{sorted(VALID_RANGE_TYPES)}."
            )

        spell_range = require_integer(
            raw_spell.get("range"),
            f"spell {name!r}.range",
        )
        if range_type != "range" and spell_range != 0:
            raise GenerationError(
                f"spell {name!r}.range must be 0 for {range_type!r}."
            )
        if range_type == "range" and spell_range < 1:
            raise GenerationError(
                f"spell {name!r}.range must be at least 1 for ranged spells."
            )

        area = require_string(
            raw_spell.get("areaOfEffect"),
            f"spell {name!r}.areaOfEffect",
        )
        if area not in VALID_AREAS:
            raise GenerationError(
                f"spell {name!r}.areaOfEffect must be one of "
                f"{sorted(VALID_AREAS)}."
            )

        duration = require_string(
            raw_spell.get("duration"),
            f"spell {name!r}.duration",
        )
        if duration not in VALID_DURATIONS:
            raise GenerationError(
                f"spell {name!r}.duration must be one of "
                f"{sorted(VALID_DURATIONS)}."
            )

        require_string(
            raw_spell.get("damage"),
            f"spell {name!r}.damage",
            allow_empty=True,
        )
        require_string(
            raw_spell.get("damagePerPowerlevel"),
            f"spell {name!r}.damagePerPowerlevel",
            allow_empty=True,
        )
        require_string(
            raw_spell.get("descriptionHtml"),
            f"spell {name!r}.descriptionHtml",
        )
        validated.append(raw_spell)

    return folder, validated


def build_spell_document(
    spell: dict[str, Any],
    folder_id: str,
    default_image: str,
    sort: int,
) -> dict[str, Any]:
    key = spell["key"]
    name = spell["name"]
    return {
        "folder": folder_id,
        "name": name,
        "type": "spell",
        "_id": spell["id"],
        "img": spell.get("image", default_image),
        "system": {
            "school": spell["school"],
            "rank": spell["rank"],
            "prerequisite": spell["prerequisite"],
            "requirement": spell["requirement"],
            "castingTime": spell["castingTime"],
            "rangeType": spell["rangeType"],
            "range": spell["range"],
            "areaOfEffect": spell["areaOfEffect"],
            "duration": spell["duration"],
            "damage": spell["damage"],
            "damagePerPowerlevel": spell["damagePerPowerlevel"],
            "memorized": False,
            "gmDescription": "",
            "itemDescription": spell["descriptionHtml"],
        },
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"spells.{key}"),
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def compare_json(path: Path, expected: dict[str, Any]) -> bool:
    if not path.is_file():
        return False
    try:
        return load_json(path) == expected
    except GenerationError:
        return False


def update_adventure_paths(
    existing_paths: Sequence[Any],
    *,
    field_name: str,
    managed_prefix: str,
    generated_paths: Sequence[str],
) -> list[str]:
    paths: list[str] = []
    for index, value in enumerate(existing_paths):
        if not isinstance(value, str):
            raise GenerationError(
                f"_Adventure.json {field_name}[{index}] must be a string."
            )
        paths.append(value)

    unmanaged = [
        path for path in paths if not path.startswith(managed_prefix)
    ]
    return unmanaged + list(generated_paths)


def main() -> int:
    args = parse_args()
    try:
        content = load_json(args.content)
        folder_config, spells = validate_content(content)
        default_image = require_string(
            content.get("defaultImage"),
            "spells.json defaultImage",
        )

        adventure_file = find_single_file(args.pack_root, "_Adventure.json")
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)

        item_root = adventure_dir / "Item"
        root_dir, root_folder_id = find_item_folder(item_root, "Bane of Azeroth")

        spells_folder_id = folder_config["id"]
        spells_folder_name = folder_config["name"]
        general = folder_config["child"]
        general_folder_id = general["id"]
        general_folder_name = general["name"]

        spells_dir = root_dir / folder_filename(
            spells_folder_name,
            spells_folder_id,
        )
        general_dir = spells_dir / folder_filename(
            general_folder_name,
            general_folder_id,
        )

        spells_folder = build_folder(
            name=spells_folder_name,
            folder_id=spells_folder_id,
            parent_id=root_folder_id,
            sort=400000,
            sorting="a",
            color=None,
        )
        general_folder = build_folder(
            name=general_folder_name,
            folder_id=general_folder_id,
            parent_id=spells_folder_id,
            sort=100000,
            sorting="m",
            color=None,
        )

        generated_documents: list[tuple[Path, dict[str, Any]]] = []
        generated_paths: list[str] = []
        generated_ids: set[str] = {spells_folder_id, general_folder_id}

        for index, spell in enumerate(spells):
            document = build_spell_document(
                spell,
                general_folder_id,
                default_image,
                (index + 1) * 100000,
            )
            output_path = general_dir / safe_filename(
                document["name"],
                document["_id"],
            )
            generated_documents.append((output_path, document))
            generated_paths.append(
                output_path.relative_to(adventure_dir).as_posix()
            )
            generated_ids.add(document["_id"])

        for path in item_root.rglob("*.json"):
            if path.name == "_Folder.json":
                data = load_json(path)
                existing_id = data.get("_id")
            else:
                data = load_json(path)
                existing_id = data.get("_id")
            if existing_id not in generated_ids:
                continue
            if path.resolve() in {
                (spells_dir / "_Folder.json").resolve(),
                (general_dir / "_Folder.json").resolve(),
                *[generated_path.resolve() for generated_path, _ in generated_documents],
            }:
                continue
            raise GenerationError(
                f"Generated Foundry ID {existing_id} collides with {path}."
            )

        spells_prefix = spells_dir.relative_to(adventure_dir).as_posix() + "/"
        general_prefix = (
            general_dir.relative_to(adventure_dir).as_posix() + "/"
        )
        generated_folder_paths = [
            (spells_dir / "_Folder.json")
            .relative_to(adventure_dir)
            .as_posix(),
            (general_dir / "_Folder.json")
            .relative_to(adventure_dir)
            .as_posix(),
        ]

        expected_adventure = dict(adventure)
        expected_adventure["folders"] = update_adventure_paths(
            adventure.get("folders", []),
            field_name="folders",
            managed_prefix=spells_prefix,
            generated_paths=generated_folder_paths,
        )
        expected_adventure["items"] = update_adventure_paths(
            adventure.get("items", []),
            field_name="items",
            managed_prefix=general_prefix,
            generated_paths=generated_paths,
        )

        expected_files: list[tuple[Path, dict[str, Any]]] = [
            (spells_dir / "_Folder.json", spells_folder),
            (general_dir / "_Folder.json", general_folder),
            *generated_documents,
        ]

        expected_paths = {path.resolve() for path, _ in expected_files}
        stale_paths = []
        if general_dir.is_dir():
            stale_paths = sorted(
                path
                for path in general_dir.glob("*.json")
                if path.resolve() not in expected_paths
            )

        problems: list[str] = []
        if args.check:
            for stale in stale_paths:
                problems.append(f"Stale generated document: {stale}")
            for path, expected in expected_files:
                if not compare_json(path, expected):
                    problems.append(f"Out-of-date generated document: {path}")
            if not compare_json(adventure_file, expected_adventure):
                problems.append(
                    f"Out-of-date Adventure manifest: {adventure_file}"
                )
            if problems:
                print(
                    "Generated spell content is not up to date:",
                    file=sys.stderr,
                )
                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)
                return 1
            print(f"Spell content is up to date: {len(spells)} spells.")
            return 0

        general_dir.mkdir(parents=True, exist_ok=True)
        for stale in stale_paths:
            stale.unlink()
        for path, data in expected_files:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump_json(data), encoding="utf-8")
        adventure_file.write_text(
            dump_json(expected_adventure),
            encoding="utf-8",
        )

        print(f"Generated {len(spells)} spells.")
        print(f"Updated {adventure_file}")
        return 0
    except GenerationError as exc:
        print(f"generate-spells.py: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
