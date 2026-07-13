#!/usr/bin/env python3
"""Generate Bane of Azeroth gear Adventure source files.

The generator owns every Item JSON file directly inside these Adventure
folders, except each folder's _Folder.json:

- Gear/Melee Weapons
- Gear/Ranged Weapons
- Gear/Trade Goods

It preserves all other Adventure content.

Run from any directory:

    python3 tools/generate-gear.py

Verify that committed files are up to date without changing them:

    python3 tools/generate-gear.py --check
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-gear.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")
VALID_DOCUMENT_TYPES = {"weapon", "item"}
VALID_GRIPS = {"grip1h", "grip2h"}


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


@dataclass(frozen=True)
class GeneratedFile:
    path: Path
    data: dict[str, Any]


@dataclass(frozen=True)
class Category:
    key: str
    folder_name: str
    document_type: str
    default_image: str
    items: list[dict[str, Any]]


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Generate Foundry gear source documents."
    )
    parser.add_argument(
        "--content",
        type=Path,
        default=repo_root / "foundry" / "content" / "gear.json",
        help="Structured gear content JSON.",
    )
    parser.add_argument(
        "--pack-root",
        type=Path,
        default=repo_root / "foundry" / "pack-src" / "bane-of-azeroth",
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
            f"Invalid JSON in {path}: line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
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


def require_number(
    value: Any,
    context: str,
    *,
    minimum: float = 0,
) -> int | float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or value < minimum
    ):
        raise GenerationError(
            f"{context} must be a number greater than or equal to {minimum}."
        )
    return value


def require_integer(
    value: Any,
    context: str,
    *,
    minimum: int = 0,
) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < minimum
    ):
        raise GenerationError(
            f"{context} must be an integer greater than or equal to {minimum}."
        )
    return value


def require_string_array(value: Any, context: str) -> list[str]:
    if not isinstance(value, list):
        raise GenerationError(f"{context} must be an array of strings.")

    result: list[str] = []
    for index, entry in enumerate(value):
        result.append(
            require_string(entry, f"{context}[{index}]")
        )
    return result


def require_paragraphs(
    value: Any,
    context: str,
    *,
    allow_empty: bool = True,
) -> list[str]:
    if value is None and allow_empty:
        return []
    if not isinstance(value, list):
        raise GenerationError(f"{context} must be an array of strings.")
    if not value and not allow_empty:
        raise GenerationError(f"{context} must not be empty.")

    paragraphs: list[str] = []
    for index, paragraph in enumerate(value):
        paragraphs.append(
            require_string(
                paragraph,
                f"{context}[{index}]",
            ).strip()
        )
    return paragraphs


def paragraphs_to_html(paragraphs: Sequence[str]) -> str:
    return "".join(
        f"<p>{html.escape(paragraph, quote=False)}</p>"
        for paragraph in paragraphs
    )


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


def find_item_folder(
    root: Path,
    name: str,
    *,
    parent_id: str | None = None,
) -> tuple[Path, str]:
    matches: list[tuple[Path, str]] = []

    for folder_file in root.rglob("_Folder.json"):
        folder = load_json(folder_file)
        if folder.get("type") != "Item" or folder.get("name") != name:
            continue
        if parent_id is not None and folder.get("folder") != parent_id:
            continue

        folder_id = folder.get("_id")
        if not isinstance(folder_id, str) or not ID_PATTERN.fullmatch(folder_id):
            raise GenerationError(
                f"Folder {name!r} has an invalid Foundry ID "
                f"in {folder_file}."
            )
        matches.append((folder_file.parent, folder_id))

    if len(matches) != 1:
        parent_text = (
            f" below parent folder {parent_id!r}"
            if parent_id is not None
            else ""
        )
        raise GenerationError(
            f"Expected exactly one Item folder named {name!r}"
            f"{parent_text}, found {len(matches)}."
        )

    return matches[0]


def validate_content(
    content: dict[str, Any],
) -> list[Category]:
    if content.get("schemaVersion") != 1:
        raise GenerationError("gear.json schemaVersion must be 1.")

    expected = content.get("expectedCounts")
    if not isinstance(expected, dict):
        raise GenerationError(
            "gear.json expectedCounts must be a JSON object."
        )

    raw_categories = content.get("categories")
    if not isinstance(raw_categories, list) or not raw_categories:
        raise GenerationError(
            "gear.json categories must be a non-empty array."
        )

    categories: list[Category] = []
    category_keys: set[str] = set()
    folder_names: set[str] = set()
    item_keys: set[str] = set()
    item_names: set[str] = set()
    ids: set[str] = set()

    for category_index, raw_category in enumerate(raw_categories):
        if not isinstance(raw_category, dict):
            raise GenerationError(
                f"categories[{category_index}] must be a JSON object."
            )

        key = require_string(
            raw_category.get("key"),
            f"categories[{category_index}].key",
        )
        folder_name = require_string(
            raw_category.get("folder"),
            f"category {key!r}.folder",
        )
        document_type = require_string(
            raw_category.get("documentType"),
            f"category {key!r}.documentType",
        )
        default_image = require_string(
            raw_category.get("defaultImage"),
            f"category {key!r}.defaultImage",
        )

        if key in category_keys:
            raise GenerationError(f"Duplicate category key: {key}")
        if folder_name in folder_names:
            raise GenerationError(
                f"Duplicate category folder name: {folder_name}"
            )
        if document_type not in VALID_DOCUMENT_TYPES:
            raise GenerationError(
                f"category {key!r}.documentType must be one of "
                f"{sorted(VALID_DOCUMENT_TYPES)}."
            )

        raw_items = raw_category.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise GenerationError(
                f"category {key!r}.items must be a non-empty array."
            )

        validated_items: list[dict[str, Any]] = []
        for item_index, raw_item in enumerate(raw_items):
            if not isinstance(raw_item, dict):
                raise GenerationError(
                    f"category {key!r} item[{item_index}] "
                    "must be a JSON object."
                )

            item_key = require_string(
                raw_item.get("key"),
                f"category {key!r} item[{item_index}].key",
            )
            item_id = require_id(
                raw_item.get("id"),
                f"gear item {item_key!r}.id",
            )
            item_name = require_string(
                raw_item.get("name"),
                f"gear item {item_key!r}.name",
            )

            if item_key in item_keys:
                raise GenerationError(
                    f"Duplicate gear item key: {item_key}"
                )
            if item_name in item_names:
                raise GenerationError(
                    f"Duplicate gear item name: {item_name}"
                )
            if item_id in ids:
                raise GenerationError(
                    f"Duplicate Foundry ID: {item_id}"
                )

            item_keys.add(item_key)
            item_names.add(item_name)
            ids.add(item_id)

            require_number(
                raw_item.get("weight"),
                f"gear item {item_name!r}.weight",
            )
            require_string(
                raw_item.get("cost"),
                f"gear item {item_name!r}.cost",
            )
            require_string(
                raw_item.get("supply"),
                f"gear item {item_name!r}.supply",
            )
            require_paragraphs(
                raw_item.get("description"),
                f"gear item {item_name!r}.description",
            )

            if document_type == "weapon":
                grip = require_string(
                    raw_item.get("grip"),
                    f"weapon {item_name!r}.grip",
                )
                if grip not in VALID_GRIPS:
                    raise GenerationError(
                        f"weapon {item_name!r}.grip must be one of "
                        f"{sorted(VALID_GRIPS)}."
                    )
                require_integer(
                    raw_item.get("str"),
                    f"weapon {item_name!r}.str",
                )
                require_string(
                    raw_item.get("range"),
                    f"weapon {item_name!r}.range",
                )
                require_string(
                    raw_item.get("damage"),
                    f"weapon {item_name!r}.damage",
                )
                require_integer(
                    raw_item.get("durability"),
                    f"weapon {item_name!r}.durability",
                    minimum=1,
                )
                require_string(
                    raw_item.get("skill"),
                    f"weapon {item_name!r}.skill",
                )
                require_string_array(
                    raw_item.get("features"),
                    f"weapon {item_name!r}.features",
                )

            validated_items.append(raw_item)

        category_keys.add(key)
        folder_names.add(folder_name)
        categories.append(
            Category(
                key=key,
                folder_name=folder_name,
                document_type=document_type,
                default_image=default_image,
                items=validated_items,
            )
        )

    expected_by_key = {
        "melee-weapons": "meleeWeapons",
        "ranged-weapons": "rangedWeapons",
        "trade-goods": "tradeGoods",
    }
    actual_by_key = {
        category.key: len(category.items)
        for category in categories
    }

    for category_key, expected_key in expected_by_key.items():
        expected_count = expected.get(expected_key)
        actual_count = actual_by_key.get(category_key)
        if expected_count is None:
            raise GenerationError(
                f"expectedCounts.{expected_key} is required."
            )
        if actual_count is None:
            raise GenerationError(
                f"Missing required category: {category_key}"
            )
        if expected_count != actual_count:
            raise GenerationError(
                f"Expected {expected_count} items in {category_key}, "
                f"found {actual_count}."
            )

    if set(actual_by_key) != set(expected_by_key):
        unexpected = sorted(set(actual_by_key) - set(expected_by_key))
        raise GenerationError(
            "gear.json contains unexpected categories: "
            + ", ".join(unexpected)
        )

    return categories


def common_system_fields(item: dict[str, Any]) -> dict[str, Any]:
    description = require_paragraphs(
        item.get("description"),
        f"gear item {item['name']!r}.description",
    )
    return {
        "weight": item["weight"],
        "quantity": 1,
        "cost": item["cost"],
        "supply": item["supply"],
        "worn": False,
        "memento": False,
        "boons": "",
        "banes": "",
        "gmDescription": "",
        "itemDescription": paragraphs_to_html(description),
        "storage": False,
    }


def build_weapon_document(
    item: dict[str, Any],
    folder_id: str,
    default_image: str,
    sort: int,
) -> dict[str, Any]:
    key = require_string(item.get("key"), "weapon.key")
    document_id = require_id(item.get("id"), f"weapon {key!r}.id")
    name = require_string(item.get("name"), f"weapon {key!r}.name")
    image = require_string(
        item.get("image", default_image),
        f"weapon {name!r}.image",
    )

    system = common_system_fields(item)
    system.update(
        {
            "grip": {"value": item["grip"]},
            "str": item["str"],
            "range": item["range"],
            "damage": item["damage"],
            "durability": item["durability"],
            "skill": {
                "name": item["skill"],
                "value": 0,
            },
            "features": list(item["features"]),
            "broken": False,
            "mainHand": False,
            "offHand": False,
        }
    )

    return {
        "folder": folder_id,
        "name": name,
        "type": "weapon",
        "_id": document_id,
        "img": image,
        "system": system,
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"gear.{key}"),
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def build_item_document(
    item: dict[str, Any],
    folder_id: str,
    default_image: str,
    sort: int,
) -> dict[str, Any]:
    key = require_string(item.get("key"), "item.key")
    document_id = require_id(item.get("id"), f"item {key!r}.id")
    name = require_string(item.get("name"), f"item {key!r}.name")
    image = require_string(
        item.get("image", default_image),
        f"item {name!r}.image",
    )

    system = common_system_fields(item)
    system["type"] = "item"

    return {
        "folder": folder_id,
        "name": name,
        "type": "item",
        "_id": document_id,
        "img": image,
        "system": system,
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"gear.{key}"),
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def is_managed_item_path(
    item_path: str,
    managed_prefixes: Sequence[str],
) -> bool:
    return any(
        item_path.startswith(prefix)
        for prefix in managed_prefixes
    )


def find_external_id_collisions(
    adventure_dir: Path,
    managed_dirs: Sequence[Path],
    generated_ids: set[str],
) -> list[tuple[str, Path]]:
    managed_roots = {
        directory.resolve()
        for directory in managed_dirs
    }
    collisions: list[tuple[str, Path]] = []

    for path in adventure_dir.joinpath("Item").rglob("*.json"):
        if path.name == "_Folder.json":
            continue
        if any(
            root in path.resolve().parents
            for root in managed_roots
        ):
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
    expected_paths = {
        entry.path.resolve()
        for entry in generated
    }
    existing_paths = {
        path.resolve()
        for directory in managed_dirs
        for path in directory.glob("*.json")
        if path.name != "_Folder.json"
    }
    stale_paths = sorted(existing_paths - expected_paths)

    if check:
        for stale in stale_paths:
            problems.append(
                f"Stale generated document: {stale}"
            )
        for entry in generated:
            if not compare_json(entry.path, entry.data):
                problems.append(
                    f"Out-of-date generated document: {entry.path}"
                )
        return problems

    for stale in stale_paths:
        stale.unlink()

    for entry in generated:
        entry.path.parent.mkdir(parents=True, exist_ok=True)
        entry.path.write_text(
            dump_json(entry.data),
            encoding="utf-8",
        )

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


def count_summary(
    categories: Sequence[Category],
) -> tuple[int, int, int]:
    by_key = {
        category.key: len(category.items)
        for category in categories
    }
    return (
        by_key["melee-weapons"],
        by_key["ranged-weapons"],
        by_key["trade-goods"],
    )


def main() -> int:
    args = parse_args()

    try:
        content = load_json(args.content)
        categories = validate_content(content)

        adventure_file = find_single_file(
            args.pack_root,
            "_Adventure.json",
        )
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)

        item_root = adventure_dir / "Item"
        gear_dir, gear_folder_id = find_item_folder(
            item_root,
            "Gear",
        )

        category_locations: dict[str, tuple[Path, str]] = {}
        for category in categories:
            category_locations[category.key] = find_item_folder(
                gear_dir,
                category.folder_name,
                parent_id=gear_folder_id,
            )

        generated: list[GeneratedFile] = []
        generated_ids: set[str] = set()
        generated_paths: list[str] = []
        managed_dirs: list[Path] = []
        managed_prefixes: list[str] = []

        for category in categories:
            category_dir, folder_id = category_locations[
                category.key
            ]
            managed_dirs.append(category_dir)
            managed_prefixes.append(
                category_dir.relative_to(adventure_dir).as_posix()
                + "/"
            )

            for item_index, item in enumerate(category.items):
                sort = (item_index + 1) * 100000

                if category.document_type == "weapon":
                    document = build_weapon_document(
                        item,
                        folder_id,
                        category.default_image,
                        sort,
                    )
                else:
                    document = build_item_document(
                        item,
                        folder_id,
                        category.default_image,
                        sort,
                    )

                output_path = category_dir / safe_filename(
                    document["name"],
                    document["_id"],
                )
                generated.append(
                    GeneratedFile(output_path, document)
                )
                generated_ids.add(document["_id"])
                generated_paths.append(
                    output_path.relative_to(adventure_dir).as_posix()
                )

        collisions = find_external_id_collisions(
            adventure_dir,
            managed_dirs,
            generated_ids,
        )
        if collisions:
            details = "\n".join(
                f"  {document_id}: {path}"
                for document_id, path in collisions
            )
            raise GenerationError(
                "Generated Foundry IDs collide with non-gear "
                f"Adventure documents:\n{details}"
            )

        expected_adventure = dict(adventure)
        expected_adventure["items"] = updated_adventure_items(
            adventure.get("items", []),
            managed_prefixes,
            generated_paths,
        )

        problems = write_generated_files(
            generated,
            managed_dirs,
            args.check,
        )

        melee_count, ranged_count, trade_count = count_summary(
            categories
        )

        if args.check:
            if not compare_json(
                adventure_file,
                expected_adventure,
            ):
                problems.append(
                    f"Out-of-date Adventure manifest: {adventure_file}"
                )

            if problems:
                print(
                    "Generated gear content is not up to date:",
                    file=sys.stderr,
                )
                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)
                return 1

            print(
                "Gear content is up to date: "
                f"{melee_count} melee weapons, "
                f"{ranged_count} ranged weapons, and "
                f"{trade_count} trade good."
            )
            return 0

        adventure_file.write_text(
            dump_json(expected_adventure),
            encoding="utf-8",
        )
        print(
            "Generated "
            f"{melee_count} melee weapons, "
            f"{ranged_count} ranged weapons, and "
            f"{trade_count} trade good."
        )
        print(f"Updated {adventure_file}")
        return 0

    except GenerationError as exc:
        print(f"generate-gear.py: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
