#!/usr/bin/env python3
"""Generate Bane of Azeroth summoned-monster Actors and attack tables."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-summoned-monsters.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Generate Foundry summoned-monster source documents."
    )
    parser.add_argument(
        "--content",
        type=Path,
        default=repo_root / "foundry" / "content" / "summoned-monsters.json",
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


def require_key(value: Any, context: str) -> str:
    key = require_string(value, context)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", key):
        raise GenerationError(f"{context} must be a lowercase kebab-case key.")
    return key


def require_integer(value: Any, context: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise GenerationError(
            f"{context} must be an integer greater than or equal to {minimum}."
        )
    return value


def require_color(value: Any, context: str, *, allow_null: bool = False) -> str | None:
    if value is None and allow_null:
        return None
    color = require_string(value, context)
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
        raise GenerationError(f"{context} must be a six-digit hexadecimal color.")
    return color.lower()


def safe_stem(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "Document"


def folder_dirname(name: str, folder_id: str) -> str:
    return f"{safe_stem(name)}_{folder_id}"


def document_filename(name: str, document_id: str) -> str:
    return f"{safe_stem(name)}_{document_id}.json"


def find_single_file(root: Path, filename: str) -> Path:
    matches = sorted(root.rglob(filename))
    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one {filename} below {root}, found {len(matches)}."
        )
    return matches[0]


def base_stats(*, duplicate_source: str | None = None) -> dict[str, Any]:
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


def generated_flags(content_key: str) -> dict[str, Any]:
    return {
        MODULE_ID: {
            "generatedBy": GENERATOR_NAME,
            "contentKey": content_key,
        }
    }


def build_folder(
    *,
    document_type: str,
    name: str,
    folder_id: str,
    parent_id: str | None,
    color: str | None,
    sorting: str,
    sort: int,
    content_key: str,
) -> dict[str, Any]:
    return {
        "type": document_type,
        "folder": parent_id,
        "name": name,
        "color": color,
        "sorting": sorting,
        "_id": folder_id,
        "description": "",
        "sort": sort,
        "flags": generated_flags(content_key),
        "_stats": base_stats(duplicate_source=f"Folder.{folder_id}"),
    }


def build_light() -> dict[str, Any]:
    return {
        "alpha": 0.5,
        "angle": 360,
        "bright": 0,
        "color": None,
        "coloration": 1,
        "dim": 0,
        "attenuation": 0.5,
        "luminosity": 0.5,
        "saturation": 0,
        "contrast": 0,
        "shadows": 0,
        "animation": {
            "type": None,
            "speed": 5,
            "intensity": 5,
            "reverse": False,
        },
        "darkness": {"min": 0, "max": 1},
        "negative": False,
        "priority": 0,
    }


def build_sight() -> dict[str, Any]:
    return {
        "enabled": False,
        "range": 0,
        "angle": 360,
        "visionMode": "basic",
        "color": None,
        "attenuation": 0.1,
        "brightness": 0,
        "saturation": 0,
        "contrast": 0,
    }


def build_actor(
    *, monster: dict[str, Any], folder_id: str, sort: int
) -> dict[str, Any]:
    content_key = f"actors.summoned-monsters.{monster['key']}"
    actor_flags = generated_flags(content_key)
    actor_flags[MODULE_ID]["summonType"] = monster["summonType"]
    token_flags = {
        MODULE_ID: {
            "summonType": monster["summonType"],
            "sourceActorContentKey": content_key,
        }
    }
    return {
        "folder": folder_id,
        "name": monster["name"],
        "type": "monster",
        "_id": monster["id"],
        "img": monster["image"],
        "system": {
            "description": monster["descriptionHtml"],
            "movement": {
                "base": monster["movement"],
                "value": monster["movement"],
            },
            "hitPoints": {
                "value": monster["hitPoints"],
                "max": monster["hitPoints"],
                "base": monster["hitPoints"],
            },
            "armor": monster["armor"],
            "ferocity": {
                "base": monster["ferocity"],
                "value": monster["ferocity"],
            },
            "size": monster["size"],
            "traits": monster["traitsHtml"],
            "attackTable": f"RollTable.{monster['attackTable']['id']}",
            "currency": {"gc": None, "sc": None, "cc": None},
            "encumbrance": {"value": 0},
            "previousMonsterAttack": "",
        },
        "prototypeToken": {
            "name": monster["name"],
            "displayName": 0,
            "actorLink": False,
            "texture": {
                "src": monster["tokenImage"],
                "scaleX": 1,
                "scaleY": 1,
                "tint": "#ffffff",
                "anchorX": 0.5,
                "anchorY": 0.5,
                "fit": "contain",
                "alphaThreshold": 0.75,
            },
            "width": monster["tokenWidth"],
            "height": monster["tokenHeight"],
            "lockRotation": True,
            "rotation": 0,
            "alpha": 1,
            "disposition": monster["tokenDisposition"],
            "displayBars": 20,
            "bar1": {"attribute": "hitPoints"},
            "bar2": {"attribute": "willPoints"},
            "light": build_light(),
            "sight": build_sight(),
            "detectionModes": {},
            "flags": token_flags,
            "randomImg": False,
            "appendNumber": False,
            "prependAdjective": False,
            "depth": 1,
            "occludable": {"radius": 0},
            "ring": {
                "enabled": False,
                "colors": {"ring": None, "background": None},
                "effects": 1,
                "subject": {"scale": 1, "texture": None},
            },
            "turnMarker": {
                "mode": 1,
                "animation": None,
                "src": None,
                "disposition": False,
            },
            "movementAction": None,
        },
        "items": [],
        "effects": [],
        "sort": sort,
        "flags": actor_flags,
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def build_table_result(
    *, result: dict[str, Any]
) -> dict[str, Any]:
    return {
        "type": "text",
        "weight": result["weight"],
        "range": result["range"],
        "drawn": False,
        "_id": result["id"],
        "img": "systems/dragonbane/art/icons/monster-attack.webp",
        "flags": {},
        "_stats": base_stats(),
        "description": result["description"],
        "name": "",
    }


def build_attack_table(
    *, monster: dict[str, Any], folder_id: str
) -> dict[str, Any]:
    table = monster["attackTable"]
    content_key = f"tables.monster-attacks.{monster['key']}"
    return {
        "name": table["name"],
        "img": "systems/dragonbane/art/icons/monster-attack.webp",
        "description": "",
        "results": [
            build_table_result(result=result)
            for result in table["results"]
        ],
        "formula": table["formula"],
        "replacement": True,
        "displayRoll": False,
        "folder": folder_id,
        "ownership": {"default": 0},
        "flags": {
            "core": {},
            **generated_flags(content_key),
        },
        "_stats": base_stats(),
        "_id": table["id"],
    }


def validate_folder(
    folder: Any,
    context: str,
    *,
    allow_null_color: bool = True,
) -> dict[str, Any]:
    if not isinstance(folder, dict):
        raise GenerationError(f"{context} must be an object.")
    require_key(folder.get("key"), f"{context}.key")
    require_id(folder.get("id"), f"{context}.id")
    require_string(folder.get("name"), f"{context}.name")
    require_color(
        folder.get("color"),
        f"{context}.color",
        allow_null=allow_null_color,
    )
    sorting = require_string(folder.get("sorting"), f"{context}.sorting")
    if sorting not in {"a", "m"}:
        raise GenerationError(f"{context}.sorting must be 'a' or 'm'.")
    require_integer(folder.get("sort"), f"{context}.sort")
    return folder


def validate_content(
    content: dict[str, Any],
) -> tuple[
    dict[str, Any],
    dict[str, dict[str, Any]],
    dict[str, Any],
    dict[str, Any],
    list[dict[str, Any]],
]:
    if content.get("schemaVersion") != 1:
        raise GenerationError("summoned-monsters.json schemaVersion must be 1.")
    actor_root = validate_folder(
        content.get("actorRoot"), "actorRoot", allow_null_color=False
    )
    if actor_root["color"].lower() != "#0000ff":
        raise GenerationError("actorRoot.color must be #0000ff.")

    raw_actor_folders = content.get("actorFolders")
    if not isinstance(raw_actor_folders, dict) or not raw_actor_folders:
        raise GenerationError("actorFolders must be a non-empty object.")
    actor_folders: dict[str, dict[str, Any]] = {}
    for category, raw_folder in raw_actor_folders.items():
        require_key(category, f"actorFolders key {category!r}")
        folder = validate_folder(raw_folder, f"actorFolders.{category}")
        actor_folders[category] = folder

    table_folders = content.get("tableFolders")
    if not isinstance(table_folders, dict):
        raise GenerationError("tableFolders must be an object.")
    table_root = validate_folder(
        table_folders.get("root"),
        "tableFolders.root",
        allow_null_color=False,
    )
    monster_attacks = validate_folder(
        table_folders.get("monsterAttacks"),
        "tableFolders.monsterAttacks",
    )
    if table_root["color"].lower() != "#0000ff":
        raise GenerationError("tableFolders.root.color must be #0000ff.")

    expected_count = require_integer(
        content.get("expectedCount"),
        "expectedCount",
        minimum=1,
    )
    raw_monsters = content.get("monsters")
    if not isinstance(raw_monsters, list):
        raise GenerationError("monsters must be an array.")
    if len(raw_monsters) != expected_count:
        raise GenerationError(
            f"Expected {expected_count} summoned monsters, "
            f"found {len(raw_monsters)}."
        )

    ids: set[str] = {
        actor_root["id"],
        table_root["id"],
        monster_attacks["id"],
        *(folder["id"] for folder in actor_folders.values()),
    }
    keys: set[str] = set()
    names: set[str] = set()
    validated: list[dict[str, Any]] = []

    for index, raw_monster in enumerate(raw_monsters):
        if not isinstance(raw_monster, dict):
            raise GenerationError(f"monsters[{index}] must be an object.")
        monster = dict(raw_monster)
        key = require_key(monster.get("key"), f"monsters[{index}].key")
        name = require_string(monster.get("name"), f"monster {key!r}.name")
        actor_id = require_id(monster.get("id"), f"monster {key!r}.id")
        category = require_key(
            monster.get("category"), f"monster {key!r}.category"
        )
        if category not in actor_folders:
            raise GenerationError(
                f"monster {key!r}.category references unknown actor folder "
                f"{category!r}."
            )
        require_string(monster.get("summonType"), f"monster {key!r}.summonType")
        require_string(monster.get("image"), f"monster {key!r}.image")
        require_string(monster.get("tokenImage"), f"monster {key!r}.tokenImage")
        require_string(
            monster.get("descriptionHtml"),
            f"monster {key!r}.descriptionHtml",
            allow_empty=True,
        )
        require_integer(monster.get("movement"), f"monster {key!r}.movement")
        require_integer(
            monster.get("hitPoints"),
            f"monster {key!r}.hitPoints",
            minimum=1,
        )
        require_integer(monster.get("armor"), f"monster {key!r}.armor")
        require_integer(
            monster.get("ferocity"),
            f"monster {key!r}.ferocity",
            minimum=1,
        )
        size = require_string(monster.get("size"), f"monster {key!r}.size")
        if size not in {"tiny", "small", "normal", "large", "huge"}:
            raise GenerationError(f"monster {key!r}.size is invalid.")
        require_string(monster.get("traitsHtml"), f"monster {key!r}.traitsHtml")
        token_disposition = monster.get("tokenDisposition")
        if token_disposition not in {-1, 0, 1}:
            raise GenerationError(
                f"monster {key!r}.tokenDisposition must be -1, 0, or 1."
            )
        for dimension in ("tokenWidth", "tokenHeight"):
            value = monster.get(dimension)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
                raise GenerationError(
                    f"monster {key!r}.{dimension} must be a positive number."
                )

        table = monster.get("attackTable")
        if not isinstance(table, dict):
            raise GenerationError(f"monster {key!r}.attackTable must be an object.")
        table_id = require_id(table.get("id"), f"monster {key!r}.attackTable.id")
        require_string(table.get("name"), f"monster {key!r}.attackTable.name")
        require_string(table.get("formula"), f"monster {key!r}.attackTable.formula")
        results = table.get("results")
        if not isinstance(results, list) or not results:
            raise GenerationError(
                f"monster {key!r}.attackTable.results must be a non-empty array."
            )
        normalized_results: list[dict[str, Any]] = []
        for result_index, raw_result in enumerate(results):
            if not isinstance(raw_result, dict):
                raise GenerationError(
                    f"monster {key!r} result {result_index} must be an object."
                )
            result = dict(raw_result)
            result_id = require_id(
                result.get("id"),
                f"monster {key!r} result {result_index}.id",
            )
            raw_range = result.get("range")
            if (
                not isinstance(raw_range, list)
                or len(raw_range) != 2
                or any(
                    isinstance(value, bool) or not isinstance(value, int)
                    for value in raw_range
                )
                or raw_range[0] > raw_range[1]
            ):
                raise GenerationError(
                    f"monster {key!r} result {result_index}.range must "
                    "contain two ascending integers."
                )
            result["weight"] = require_integer(
                result.get("weight", 1),
                f"monster {key!r} result {result_index}.weight",
                minimum=1,
            )
            require_string(
                result.get("description"),
                f"monster {key!r} result {result_index}.description",
            )
            if result_id in ids:
                raise GenerationError(f"Duplicate Foundry ID: {result_id}")
            ids.add(result_id)
            normalized_results.append(result)
        table["results"] = normalized_results
        monster["attackTable"] = table

        for document_id in (actor_id, table_id):
            if document_id in ids:
                raise GenerationError(f"Duplicate Foundry ID: {document_id}")
            ids.add(document_id)
        if key in keys:
            raise GenerationError(f"Duplicate monster key: {key}")
        if name in names:
            raise GenerationError(f"Duplicate monster name: {name}")
        keys.add(key)
        names.add(name)
        validated.append(monster)

    return actor_root, actor_folders, table_root, monster_attacks, validated


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
    generated_paths: Sequence[str],
    exact_managed_paths: set[str] | None = None,
    managed_prefixes: Sequence[str] = (),
) -> list[str]:
    paths: list[str] = []
    for index, value in enumerate(existing_paths):
        if not isinstance(value, str):
            raise GenerationError(
                f"_Adventure.json {field_name}[{index}] must be a string."
            )
        paths.append(value)
    exact = exact_managed_paths or set()

    def is_managed(path: str) -> bool:
        return path in exact or any(path.startswith(prefix) for prefix in managed_prefixes)

    managed_indexes = [
        index for index, path in enumerate(paths) if is_managed(path)
    ]
    unmanaged = [path for path in paths if not is_managed(path)]
    insert_at = managed_indexes[0] if managed_indexes else len(unmanaged)
    return unmanaged[:insert_at] + list(generated_paths) + unmanaged[insert_at:]


def validate_id_collisions(
    adventure_dir: Path,
    generated_ids: set[str],
    expected_paths: set[Path],
) -> None:
    for path in adventure_dir.rglob("*.json"):
        data = load_json(path)
        existing_ids: list[Any] = [data.get("_id")]
        if isinstance(data.get("results"), list):
            existing_ids.extend(
                result.get("_id")
                for result in data["results"]
                if isinstance(result, dict)
            )
        for existing_id in existing_ids:
            if existing_id not in generated_ids:
                continue
            if path.resolve() in expected_paths:
                continue
            raise GenerationError(
                f"Generated Foundry ID {existing_id} collides with {path}."
            )


def main() -> int:
    args = parse_args()
    try:
        content = load_json(args.content)
        (
            actor_root_source,
            actor_folder_sources,
            table_root_source,
            monster_attacks_source,
            monsters,
        ) = validate_content(content)

        adventure_file = find_single_file(args.pack_root, "_Adventure.json")
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)

        actor_root_dir = (
            adventure_dir
            / "Actor"
            / folder_dirname(
                actor_root_source["name"], actor_root_source["id"]
            )
        )
        actor_root_path = actor_root_dir / "_Folder.json"
        actor_root = load_json(actor_root_path)
        if (
            actor_root.get("type") != "Actor"
            or actor_root.get("_id") != actor_root_source["id"]
            or actor_root.get("name") != actor_root_source["name"]
            or str(actor_root.get("color", "")).lower()
            != actor_root_source["color"].lower()
        ):
            raise GenerationError(
                "The existing blue Actor/Bane of Azeroth folder does not "
                "match summoned-monsters.json."
            )

        table_root_dir = (
            adventure_dir
            / "RollTable"
            / folder_dirname(
                table_root_source["name"], table_root_source["id"]
            )
        )
        monster_attacks_dir = table_root_dir / folder_dirname(
            monster_attacks_source["name"],
            monster_attacks_source["id"],
        )

        generated_files: list[tuple[Path, dict[str, Any]]] = []
        generated_actor_paths: list[str] = []
        generated_table_paths: list[str] = []
        generated_folder_paths: list[str] = []
        generated_ids: set[str] = {
            *(folder["id"] for folder in actor_folder_sources.values()),
            table_root_source["id"],
            monster_attacks_source["id"],
        }
        actor_category_dirs: dict[str, Path] = {}

        for category, folder_source in actor_folder_sources.items():
            folder_dir = actor_root_dir / folder_dirname(
                folder_source["name"], folder_source["id"]
            )
            actor_category_dirs[category] = folder_dir
            folder_path = folder_dir / "_Folder.json"
            folder_document = build_folder(
                document_type="Actor",
                name=folder_source["name"],
                folder_id=folder_source["id"],
                parent_id=actor_root_source["id"],
                color=folder_source["color"],
                sorting=folder_source["sorting"],
                sort=folder_source["sort"],
                content_key=f"actors.folder.{folder_source['key']}",
            )
            generated_files.append((folder_path, folder_document))
            generated_folder_paths.append(
                folder_path.relative_to(adventure_dir).as_posix()
            )

        table_root_path = table_root_dir / "_Folder.json"
        monster_attacks_folder_path = monster_attacks_dir / "_Folder.json"
        generated_files.extend(
            [
                (
                    table_root_path,
                    build_folder(
                        document_type="RollTable",
                        name=table_root_source["name"],
                        folder_id=table_root_source["id"],
                        parent_id=None,
                        color=table_root_source["color"],
                        sorting=table_root_source["sorting"],
                        sort=table_root_source["sort"],
                        content_key="tables.folder.bane-of-azeroth",
                    ),
                ),
                (
                    monster_attacks_folder_path,
                    build_folder(
                        document_type="RollTable",
                        name=monster_attacks_source["name"],
                        folder_id=monster_attacks_source["id"],
                        parent_id=table_root_source["id"],
                        color=monster_attacks_source["color"],
                        sorting=monster_attacks_source["sorting"],
                        sort=monster_attacks_source["sort"],
                        content_key="tables.folder.monster-attacks",
                    ),
                ),
            ]
        )
        generated_folder_paths.extend(
            [
                table_root_path.relative_to(adventure_dir).as_posix(),
                monster_attacks_folder_path.relative_to(adventure_dir).as_posix(),
            ]
        )

        for index, monster in enumerate(monsters):
            category_dir = actor_category_dirs[monster["category"]]
            actor = build_actor(
                monster=monster,
                folder_id=actor_folder_sources[monster["category"]]["id"],
                sort=(index + 1) * 100000,
            )
            actor_path = category_dir / document_filename(
                actor["name"], actor["_id"]
            )
            table = build_attack_table(
                monster=monster,
                folder_id=monster_attacks_source["id"],
            )
            table_path = monster_attacks_dir / document_filename(
                table["name"], table["_id"]
            )
            generated_files.extend([(actor_path, actor), (table_path, table)])
            generated_actor_paths.append(
                actor_path.relative_to(adventure_dir).as_posix()
            )
            generated_table_paths.append(
                table_path.relative_to(adventure_dir).as_posix()
            )
            generated_ids.update(
                {
                    actor["_id"],
                    table["_id"],
                    *(result["_id"] for result in table["results"]),
                }
            )

        expected_paths = {path.resolve() for path, _ in generated_files}
        validate_id_collisions(adventure_dir, generated_ids, expected_paths)

        actor_prefixes = tuple(
            directory.relative_to(adventure_dir).as_posix() + "/"
            for directory in actor_category_dirs.values()
        )
        table_prefix = monster_attacks_dir.relative_to(adventure_dir).as_posix() + "/"
        exact_folder_paths = set(generated_folder_paths)

        expected_adventure = dict(adventure)
        expected_adventure["actors"] = update_adventure_paths(
            adventure.get("actors", []),
            field_name="actors",
            generated_paths=generated_actor_paths,
            managed_prefixes=actor_prefixes,
        )
        expected_adventure["tables"] = update_adventure_paths(
            adventure.get("tables", []),
            field_name="tables",
            generated_paths=generated_table_paths,
            managed_prefixes=(table_prefix,),
        )
        expected_adventure["folders"] = update_adventure_paths(
            adventure.get("folders", []),
            field_name="folders",
            generated_paths=generated_folder_paths,
            exact_managed_paths=exact_folder_paths,
            managed_prefixes=(*actor_prefixes, table_prefix),
        )

        stale_paths: list[Path] = []
        for directory in (*actor_category_dirs.values(), monster_attacks_dir):
            if not directory.is_dir():
                continue
            stale_paths.extend(
                path
                for path in directory.glob("*.json")
                if path.resolve() not in expected_paths
            )
        stale_paths = sorted(set(stale_paths))

        if args.check:
            problems: list[str] = []
            for stale_path in stale_paths:
                problems.append(f"Stale generated document: {stale_path}")
            for path, expected in generated_files:
                if not compare_json(path, expected):
                    problems.append(f"Out-of-date generated document: {path}")
            if not compare_json(adventure_file, expected_adventure):
                problems.append(
                    f"Out-of-date Adventure manifest: {adventure_file}"
                )
            if problems:
                print(
                    "Generated summoned-monster content is not up to date:",
                    file=sys.stderr,
                )
                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)
                return 1
            print(
                "Summoned-monster content is up to date: "
                f"{len(monsters)} monster actor(s) and attack table(s)."
            )
            return 0

        for stale_path in stale_paths:
            stale_path.unlink()
        for path, data in generated_files:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump_json(data), encoding="utf-8")
        adventure_file.write_text(dump_json(expected_adventure), encoding="utf-8")
        print(
            f"Generated {len(monsters)} summoned-monster actor(s) "
            "and attack table(s)."
        )
        print(f"Updated {adventure_file}")
        return 0
    except GenerationError as exc:
        print(f"generate-summoned-monsters.py: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
