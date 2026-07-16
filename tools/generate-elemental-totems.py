#!/usr/bin/env python3
"""Generate Bane of Azeroth Elemental Totem Actor source files.

The generator creates and owns:

- Actor/Bane of Azeroth/_Folder.json
- Actor/Bane of Azeroth/Elemental Totems/_Folder.json
- The four Actor JSON files directly inside Elemental Totems

It preserves any other Actor folders and documents.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-elemental-totems.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Generate Foundry Elemental Totem Actor source documents."
    )
    parser.add_argument(
        "--content",
        type=Path,
        default=(
            repo_root
            / "foundry"
            / "content"
            / "elemental-totems.json"
        ),
    )
    parser.add_argument(
        "--pack-root",
        type=Path,
        default=(
            repo_root
            / "foundry"
            / "pack-src"
            / "bane-of-azeroth"
        ),
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
            f"{context} must be an integer greater than or equal to "
            f"{minimum}."
        )
    return value


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
            f"{context} must be a number greater than or equal to "
            f"{minimum}."
        )
    return value


def require_color(
    value: Any,
    context: str,
    *,
    allow_null: bool = False,
) -> str | None:
    if value is None and allow_null:
        return None

    color = require_string(value, context)
    if not HEX_COLOR_PATTERN.fullmatch(color):
        raise GenerationError(
            f"{context} must be a six-digit hexadecimal color."
        )
    return color.lower()


def require_key(value: Any, context: str) -> str:
    key = require_string(value, context)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", key):
        raise GenerationError(
            f"{context} must be a lowercase kebab-case key."
        )
    return key


def find_single_file(root: Path, filename: str) -> Path:
    matches = sorted(root.rglob(filename))
    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one {filename} below {root}, "
            f"found {len(matches)}."
        )
    return matches[0]


def safe_stem(name: str) -> str:
    return (
        re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
        or "Document"
    )


def folder_dirname(name: str, folder_id: str) -> str:
    return f"{safe_stem(name)}_{folder_id}"


def document_filename(name: str, document_id: str) -> str:
    return f"{safe_stem(name)}_{document_id}.json"


def base_stats(
    *,
    duplicate_source: str | None = None,
) -> dict[str, Any]:
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


def build_folder(
    *,
    name: str,
    folder_id: str,
    parent_id: str | None,
    color: str | None,
    sorting: str,
    sort: int,
    content_key: str,
) -> dict[str, Any]:
    return {
        "type": "Actor",
        "folder": parent_id,
        "name": name,
        "color": color,
        "sorting": sorting,
        "_id": folder_id,
        "description": "",
        "sort": sort,
        "flags": generated_flags(content_key),
        "_stats": base_stats(
            duplicate_source=f"Folder.{folder_id}"
        ),
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
        "darkness": {
            "min": 0,
            "max": 1,
        },
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


def build_armor_item(
    *,
    armor_id: str,
    rating: int,
    content_key: str,
) -> dict[str, Any]:
    return {
        "type": "armor",
        "name": "Totem Armor",
        "system": {
            "weight": 0,
            "quantity": 1,
            "cost": "–",
            "supply": "common",
            "worn": True,
            "memento": False,
            "boons": "",
            "banes": "",
            "rating": rating,
            "bonuses": [],
            "gmDescription": "",
            "itemDescription": (
                "<p>Intrinsic armor provided by the totem's "
                "elemental form.</p>"
            ),
            "storage": False,
        },
        "img": (
            "modules/dragonbane-coreset/assets/icons/gear/"
            "armor.webp"
        ),
        "effects": [],
        "folder": None,
        "sort": 100000,
        "flags": generated_flags(f"{content_key}.armor"),
        "_stats": base_stats(),
        "_id": armor_id,
        "ownership": {
            "default": 0,
        },
    }


def build_actor(
    *,
    totem: dict[str, Any],
    defaults: dict[str, Any],
    folder_id: str,
    sort: int,
) -> dict[str, Any]:
    key = totem["key"]
    actor_id = totem["id"]
    name = totem["name"]
    image = totem.get("image", defaults["image"])
    token_image = totem.get("tokenImage", image)
    content_key = f"actors.elemental-totems.{key}"
    aura_alpha = totem.get(
        "auraAlpha",
        defaults["auraAlpha"],
    )

    aura_flags = {
        "summonType": "elementalTotem",
        "sourceActorContentKey": content_key,
        "totemType": key,
        "element": totem["element"],
        "auraRange": defaults["auraRange"],
        "auraColor": totem["auraColor"],
        "auraAlpha": aura_alpha,
    }

    actor_flags = generated_flags(content_key)
    actor_flags[MODULE_ID].update(aura_flags)

    token_flags = {
        MODULE_ID: dict(aura_flags),
    }

    movement = defaults["movement"]
    hit_points = defaults["hitPoints"]
    will_points = defaults["willPoints"]

    return {
        "folder": folder_id,
        "name": name,
        "type": "npc",
        "_id": actor_id,
        "img": image,
        "system": {
            "description": defaults["descriptionHtml"],
            "movement": {
                "base": movement,
                "value": movement,
            },
            "hitPoints": {
                "value": hit_points,
                "max": hit_points,
                "base": hit_points,
            },
            "willPoints": {
                "value": will_points,
                "max": will_points,
                "base": will_points,
            },
            "damageBonus": {
                "agl": {
                    "base": "none",
                    "value": "none",
                },
                "str": {
                    "base": "none",
                    "value": "none",
                },
            },
            "traits": totem["effectHtml"],
            "currency": {
                "gc": None,
                "sc": None,
                "cc": None,
            },
            "encumbrance": {
                "value": 0,
            },
            "kin": "",
            "age": "",
            "profession": "",
            "motivation": "",
        },
        "prototypeToken": {
            "name": name,
            "displayName": 0,
            "actorLink": False,
            "texture": {
                "src": token_image,
                "scaleX": 1,
                "scaleY": 1,
                "tint": "#ffffff",
                "anchorX": 0.5,
                "anchorY": 0.5,
                "fit": "contain",
                "alphaThreshold": 0.75,
            },
            "width": defaults["tokenWidth"],
            "height": defaults["tokenHeight"],
            "lockRotation": True,
            "rotation": 0,
            "alpha": 1,
            "disposition": defaults["tokenDisposition"],
            "displayBars": 20,
            "bar1": {
                "attribute": "hitPoints",
            },
            "bar2": {
                "attribute": None,
            },
            "light": build_light(),
            "sight": build_sight(),
            "detectionModes": {},
            "flags": token_flags,
            "randomImg": False,
            "appendNumber": False,
            "prependAdjective": False,
            "depth": 1,
            "occludable": {
                "radius": 0,
            },
            "ring": {
                "enabled": False,
                "colors": {
                    "ring": None,
                    "background": None,
                },
                "effects": 1,
                "subject": {
                    "scale": 1,
                    "texture": None,
                },
            },
            "turnMarker": {
                "mode": 1,
                "animation": None,
                "src": None,
                "disposition": False,
            },
            "movementAction": None,
        },
        "items": [
            build_armor_item(
                armor_id=totem["armorId"],
                rating=defaults["armorRating"],
                content_key=content_key,
            )
        ],
        "effects": [],
        "sort": sort,
        "flags": actor_flags,
        "_stats": base_stats(),
        "ownership": {
            "default": 0,
        },
    }


def validate_content(
    content: dict[str, Any],
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    list[dict[str, Any]],
]:
    if content.get("schemaVersion") != 1:
        raise GenerationError(
            "elemental-totems.json schemaVersion must be 1."
        )

    expected_count = require_integer(
        content.get("expectedCount"),
        "elemental-totems.json expectedCount",
        minimum=1,
    )

    folders = content.get("folders")
    if not isinstance(folders, dict):
        raise GenerationError(
            "elemental-totems.json folders must be an object."
        )

    root = folders.get("root")
    child = folders.get("elementalTotems")
    if not isinstance(root, dict) or not isinstance(child, dict):
        raise GenerationError(
            "folders.root and folders.elementalTotems must be "
            "objects."
        )

    for label, folder in (
        ("folders.root", root),
        ("folders.elementalTotems", child),
    ):
        require_key(folder.get("key"), f"{label}.key")
        require_id(folder.get("id"), f"{label}.id")
        require_string(folder.get("name"), f"{label}.name")
        require_color(
            folder.get("color"),
            f"{label}.color",
            allow_null=True,
        )
        sorting = require_string(
            folder.get("sorting"),
            f"{label}.sorting",
        )
        if sorting not in {"a", "m"}:
            raise GenerationError(
                f"{label}.sorting must be 'a' or 'm'."
            )
        require_integer(folder.get("sort"), f"{label}.sort")

    defaults = content.get("defaults")
    if not isinstance(defaults, dict):
        raise GenerationError(
            "elemental-totems.json defaults must be an object."
        )

    require_string(defaults.get("image"), "defaults.image")
    require_string(
        defaults.get("descriptionHtml"),
        "defaults.descriptionHtml",
    )
    require_integer(defaults.get("movement"), "defaults.movement")
    require_integer(
        defaults.get("hitPoints"),
        "defaults.hitPoints",
        minimum=1,
    )
    require_integer(
        defaults.get("willPoints"),
        "defaults.willPoints",
    )
    require_integer(
        defaults.get("armorRating"),
        "defaults.armorRating",
    )
    require_number(
        defaults.get("tokenWidth"),
        "defaults.tokenWidth",
        minimum=0.5,
    )
    require_number(
        defaults.get("tokenHeight"),
        "defaults.tokenHeight",
        minimum=0.5,
    )
    token_disposition = defaults.get("tokenDisposition")
    if token_disposition not in {-1, 0, 1}:
        raise GenerationError(
            "defaults.tokenDisposition must be -1, 0, or 1."
        )
    require_integer(
        defaults.get("auraRange"),
        "defaults.auraRange",
        minimum=1,
    )
    aura_alpha = require_number(
        defaults.get("auraAlpha"),
        "defaults.auraAlpha",
    )
    if aura_alpha > 1:
        raise GenerationError(
            "defaults.auraAlpha must not be greater than 1."
        )

    raw_totems = content.get("totems")
    if not isinstance(raw_totems, list):
        raise GenerationError(
            "elemental-totems.json totems must be an array."
        )
    if len(raw_totems) != expected_count:
        raise GenerationError(
            f"Expected {expected_count} totems, "
            f"found {len(raw_totems)}."
        )

    keys: set[str] = set()
    names: set[str] = set()
    elements: set[str] = set()
    ids: set[str] = {
        root["id"],
        child["id"],
    }
    validated: list[dict[str, Any]] = []

    for index, raw_totem in enumerate(raw_totems):
        if not isinstance(raw_totem, dict):
            raise GenerationError(
                f"totems[{index}] must be an object."
            )

        key = require_key(
            raw_totem.get("key"),
            f"totems[{index}].key",
        )
        actor_id = require_id(
            raw_totem.get("id"),
            f"totem {key!r}.id",
        )
        armor_id = require_id(
            raw_totem.get("armorId"),
            f"totem {key!r}.armorId",
        )
        name = require_string(
            raw_totem.get("name"),
            f"totem {key!r}.name",
        )
        element = require_key(
            raw_totem.get("element"),
            f"totem {key!r}.element",
        )
        aura_color = require_color(
            raw_totem.get("auraColor"),
            f"totem {key!r}.auraColor",
        )
        aura_alpha = require_number(
            raw_totem.get(
                "auraAlpha",
                defaults["auraAlpha"],
            ),
            f"totem {key!r}.auraAlpha",
        )
        if aura_alpha > 1:
            raise GenerationError(
                f"totem {key!r}.auraAlpha must not be "
                "greater than 1."
            )
        effect_html = require_string(
            raw_totem.get("effectHtml"),
            f"totem {key!r}.effectHtml",
        )

        if key in keys:
            raise GenerationError(f"Duplicate totem key: {key}")
        if name in names:
            raise GenerationError(f"Duplicate totem name: {name}")
        if element in elements:
            raise GenerationError(
                f"Duplicate totem element: {element}"
            )
        if actor_id in ids:
            raise GenerationError(
                f"Duplicate Foundry ID: {actor_id}"
            )
        ids.add(actor_id)
        if armor_id in ids:
            raise GenerationError(
                f"Duplicate Foundry ID: {armor_id}"
            )
        ids.add(armor_id)

        keys.add(key)
        names.add(name)
        elements.add(element)

        normalized = dict(raw_totem)
        normalized["auraColor"] = aura_color
        normalized["auraAlpha"] = aura_alpha
        normalized["effectHtml"] = effect_html
        validated.append(normalized)

    return root, child, defaults, validated


def compare_json(
    path: Path,
    expected: dict[str, Any],
) -> bool:
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
                f"_Adventure.json {field_name}[{index}] "
                "must be a string."
            )
        paths.append(value)

    exact = exact_managed_paths or set()

    def is_managed(path: str) -> bool:
        return (
            path in exact
            or any(
                path.startswith(prefix)
                for prefix in managed_prefixes
            )
        )

    managed_indexes = [
        index
        for index, path in enumerate(paths)
        if is_managed(path)
    ]
    unmanaged = [
        path
        for path in paths
        if not is_managed(path)
    ]
    insert_at = (
        managed_indexes[0]
        if managed_indexes
        else len(unmanaged)
    )
    return (
        unmanaged[:insert_at]
        + list(generated_paths)
        + unmanaged[insert_at:]
    )


def validate_id_collisions(
    actor_root: Path,
    generated_ids: set[str],
    expected_paths: set[Path],
) -> None:
    if not actor_root.is_dir():
        return

    for path in actor_root.rglob("*.json"):
        data = load_json(path)
        existing_id = data.get("_id")
        if existing_id not in generated_ids:
            continue
        if path.resolve() in expected_paths:
            continue
        raise GenerationError(
            f"Generated Foundry ID {existing_id} "
            f"collides with {path}."
        )


def main() -> int:
    args = parse_args()

    try:
        content = load_json(args.content)
        root, child, defaults, totems = validate_content(content)

        adventure_file = find_single_file(
            args.pack_root,
            "_Adventure.json",
        )
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)

        actor_root = adventure_dir / "Actor"
        root_dir = actor_root / folder_dirname(
            root["name"],
            root["id"],
        )
        child_dir = root_dir / folder_dirname(
            child["name"],
            child["id"],
        )

        root_folder = build_folder(
            name=root["name"],
            folder_id=root["id"],
            parent_id=None,
            color=root["color"],
            sorting=root["sorting"],
            sort=root["sort"],
            content_key="actors.folder.bane-of-azeroth",
        )
        child_folder = build_folder(
            name=child["name"],
            folder_id=child["id"],
            parent_id=root["id"],
            color=child["color"],
            sorting=child["sorting"],
            sort=child["sort"],
            content_key="actors.folder.elemental-totems",
        )

        generated_documents: list[
            tuple[Path, dict[str, Any]]
        ] = []
        generated_actor_paths: list[str] = []
        generated_ids: set[str] = {
            root["id"],
            child["id"],
        }

        for index, totem in enumerate(totems):
            actor = build_actor(
                totem=totem,
                defaults=defaults,
                folder_id=child["id"],
                sort=(index + 1) * 100000,
            )
            actor_path = child_dir / document_filename(
                actor["name"],
                actor["_id"],
            )
            generated_documents.append((actor_path, actor))
            generated_actor_paths.append(
                actor_path.relative_to(adventure_dir).as_posix()
            )
            generated_ids.add(actor["_id"])

        root_folder_path = root_dir / "_Folder.json"
        child_folder_path = child_dir / "_Folder.json"
        generated_folder_paths = [
            root_folder_path
            .relative_to(adventure_dir)
            .as_posix(),
            child_folder_path
            .relative_to(adventure_dir)
            .as_posix(),
        ]

        expected_files: list[
            tuple[Path, dict[str, Any]]
        ] = [
            (root_folder_path, root_folder),
            (child_folder_path, child_folder),
            *generated_documents,
        ]
        expected_paths = {
            path.resolve()
            for path, _ in expected_files
        }

        validate_id_collisions(
            actor_root,
            generated_ids,
            expected_paths,
        )

        child_prefix = (
            child_dir.relative_to(adventure_dir).as_posix()
            + "/"
        )
        exact_folder_paths = set(generated_folder_paths)

        expected_adventure = dict(adventure)
        expected_adventure["actors"] = update_adventure_paths(
            adventure.get("actors", []),
            field_name="actors",
            generated_paths=generated_actor_paths,
            managed_prefixes=(child_prefix,),
        )
        expected_adventure["folders"] = update_adventure_paths(
            adventure.get("folders", []),
            field_name="folders",
            generated_paths=generated_folder_paths,
            exact_managed_paths=exact_folder_paths,
            managed_prefixes=(child_prefix,),
        )

        stale_paths: list[Path] = []
        if child_dir.is_dir():
            stale_paths = sorted(
                path
                for path in child_dir.glob("*.json")
                if path.resolve() not in expected_paths
            )

        problems: list[str] = []
        if args.check:
            for stale in stale_paths:
                problems.append(
                    f"Stale generated document: {stale}"
                )
            for path, expected in expected_files:
                if not compare_json(path, expected):
                    problems.append(
                        f"Out-of-date generated document: {path}"
                    )
            if not compare_json(
                adventure_file,
                expected_adventure,
            ):
                problems.append(
                    "Out-of-date Adventure manifest: "
                    f"{adventure_file}"
                )

            if problems:
                print(
                    "Generated Elemental Totem content "
                    "is not up to date:",
                    file=sys.stderr,
                )
                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)
                return 1

            print(
                "Elemental Totem content is up to date: "
                f"{len(totems)} actors."
            )
            return 0

        child_dir.mkdir(parents=True, exist_ok=True)

        for stale in stale_paths:
            stale.unlink()

        for path, data in expected_files:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                dump_json(data),
                encoding="utf-8",
            )

        adventure_file.write_text(
            dump_json(expected_adventure),
            encoding="utf-8",
        )

        print(
            f"Generated {len(totems)} Elemental Totem actors."
        )
        print(f"Updated {adventure_file}")
        return 0

    except GenerationError as exc:
        print(
            f"generate-elemental-totems.py: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
