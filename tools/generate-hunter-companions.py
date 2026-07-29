#!/usr/bin/env python3
"""Generate Bane of Azeroth Hunter companion Actor source files."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-hunter-companions.py"
ROOT_CONTENT_KEY = "actors.folder.bane-of-azeroth"
COMMON_ANIMALS_CONTENT_KEY = "actors.folder.common-animals"
LETHAL_POISON_REFERENCE_KEY = (
    "dragonbane-core:journal-page.combat-damage.poison"
)
EXTERNAL_REFERENCES_PATH = (
    Path(__file__).resolve().parents[1]
    / "foundry"
    / "content"
    / "references"
    / "external-references.json"
)


def load_external_reference_uuid(
    key: str,
) -> str:
    try:
        data = json.loads(
            EXTERNAL_REFERENCES_PATH.read_text(
                encoding="utf-8",
            )
        )
    except FileNotFoundError as error:
        raise RuntimeError(
            "Missing external-reference registry: "
            f"{EXTERNAL_REFERENCES_PATH}"
        ) from error
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "Invalid external-reference registry: "
            f"{error}"
        ) from error

    reference = (
        data.get("references", {})
        .get(key)
    )
    if not isinstance(reference, dict):
        raise RuntimeError(
            f"Missing external reference: {key}"
        )

    uuid = reference.get("uuid")
    if (
        not isinstance(uuid, str)
        or not uuid.strip()
    ):
        raise RuntimeError(
            f"External reference {key} has no UUID."
        )

    return uuid


LETHAL_POISON_UUID = (
    load_external_reference_uuid(
        LETHAL_POISON_REFERENCE_KEY
    )
)

LEGACY_COMPANIONS_FOLDER_ID = "2dkrC4gndsTQ383p"
LEGACY_COMPANIONS_FOLDER_NAME = "Companions"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Generate Foundry Hunter companion Actor documents."
    )
    parser.add_argument(
        "--content",
        type=Path,
        default=repo_root / "foundry" / "content" / "hunter-companions.json",
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


def require_optional_integer(
    value: Any,
    context: str,
    *,
    minimum: int = 0,
) -> int | None:
    if value is None:
        return None
    return require_integer(value, context, minimum=minimum)


def safe_stem(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "Document"


def folder_dirname(name: str, folder_id: str) -> str:
    return f"{safe_stem(name)}_{folder_id}"


def document_filename(name: str, document_id: str) -> str:
    return f"{safe_stem(name)}_{document_id}.json"


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


def generated_actor_flags(
    content_key: str,
    movement_rates: dict[str, int],
) -> dict[str, Any]:
    flags = generated_flags(content_key)
    alternate_rates = {
        key: value
        for key, value in movement_rates.items()
        if key != "base"
    }
    if alternate_rates:
        flags[MODULE_ID]["movementRates"] = alternate_rates
    return flags


def build_folder(
    *,
    name: str,
    folder_id: str,
    parent_id: str,
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


def build_weapon_skill(
    *,
    attack: dict[str, Any],
    content_key: str,
    sort: int,
) -> dict[str, Any]:
    return {
        "folder": None,
        "name": attack["name"],
        "type": "skill",
        "img": "icons/svg/item-bag.svg",
        "system": {
            "skillType": "weapon",
            "attribute": "str",
            "value": attack["skillLevel"],
            "advance": 0,
            "hideTrained": True,
            "gmDescription": "",
            "itemDescription": "",
            "taught": False,
        },
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"{content_key}.skill"),
        "_stats": base_stats(),
        "_id": attack["skillId"],
        "ownership": {"default": 0},
    }


def attack_effects(attack: dict[str, Any]) -> list[dict[str, Any]]:
    effects: list[dict[str, Any]] = []

    if attack.get("lethalPoison") is not None:
        effects.append(
            {
                "type": "lethalPoison",
                "potency": attack["lethalPoison"],
                "ruleUuid": LETHAL_POISON_UUID,
            }
        )

    if attack.get("restrain") is not None:
        effects.append(
            {
                "type": "restrain",
                "strength": attack["restrain"],
            }
        )

    return effects


def attack_flags(
    *,
    attack: dict[str, Any],
    content_key: str,
) -> dict[str, Any]:
    flags = generated_flags(content_key)
    effects = attack_effects(attack)

    if effects:
        flags[MODULE_ID]["attackEffects"] = effects

    if attack["damage"] is None and effects:
        flags[MODULE_ID]["effectOnly"] = True
    return flags


def build_weapon(
    *,
    attack: dict[str, Any],
    content_key: str,
    sort: int,
) -> dict[str, Any]:
    return {
        "type": "weapon",
        "name": attack["name"],
        "system": {
            "weight": None,
            "quantity": 1,
            "cost": "–",
            "supply": "common",
            "worn": True,
            "memento": False,
            "boons": "",
            "banes": "",
            "grip": {"value": "none"},
            "str": None,
            "range": str(attack["range"]),
            "damage": attack["damage"] or "",
            "durability": None,
            "skill": {"name": attack["name"], "value": 0},
            "features": [],
            "broken": False,
            "mainHand": False,
            "offHand": False,
            "gmDescription": "",
            "itemDescription": "",
            "storage": False,
        },
        "img": "icons/svg/item-bag.svg",
        "effects": [],
        "folder": None,
        "sort": sort,
        "flags": attack_flags(
            attack=attack,
            content_key=f"{content_key}.weapon",
        ),
        "_stats": base_stats(),
        "_id": attack["weaponId"],
        "ownership": {"default": 0},
    }


CORE_SKILL_ATTRIBUTES = {
    "Acrobatics": "agl",
    "Awareness": "int",
    "Evade": "agl",
    "Stealth": "agl",
}


def build_core_skill(
    *,
    skill: dict[str, Any],
    content_key: str,
    sort: int,
) -> dict[str, Any]:
    return {
        "folder": None,
        "name": skill["name"],
        "type": "skill",
        "img": "modules/dragonbane-coreset/assets/icons/gear/book.webp",
        "system": {
            "skillType": "core",
            "attribute": CORE_SKILL_ATTRIBUTES[skill["name"]],
            "value": skill["value"],
            "advance": 0,
            "hideTrained": False,
            "gmDescription": "",
            "itemDescription": "",
            "taught": False,
        },
        "effects": [],
        "sort": sort,
        "flags": generated_flags(f"{content_key}.skill.{skill['name'].lower()}"),
        "_stats": base_stats(),
        "_id": skill["id"],
        "ownership": {"default": 0},
    }


def build_armor(
    *,
    armor_id: str,
    rating: int,
    content_key: str,
    sort: int,
) -> dict[str, Any]:
    return {
        "type": "armor",
        "name": "Natural Armor",
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
            "itemDescription": "<p>Natural armor.</p>",
            "storage": False,
        },
        "img": "modules/dragonbane-coreset/assets/icons/gear/armor.webp",
        "effects": [],
        "folder": None,
        "sort": sort,
        "flags": generated_flags(f"{content_key}.armor"),
        "_stats": base_stats(),
        "_id": armor_id,
        "ownership": {"default": 0},
    }


def animal_traits(companion: dict[str, Any]) -> str:
    paragraphs: list[str] = []
    animal_name = companion["name"].lower()
    movement = companion["movement"]

    if "fly" in movement:
        paragraphs.append(
            "<p><strong>Fly:</strong> "
            f"The {animal_name} moves freely through the air. "
            "While flying, it has a movement rate of "
            f"{movement['fly']}. "
            "Its movement rate on the ground is "
            f"{movement['base']}.</p>"
        )

    if "swim" in movement:
        paragraphs.append(
            "<p><strong>Swim:</strong> "
            f"The {animal_name} moves without penalties while swimming "
            "and automatically succeeds on SWIMMING rolls. "
            "While swimming, it has a movement rate of "
            f"{movement['swim']}. "
            "Its movement rate on land is "
            f"{movement['base']}.</p>"
        )

    for attack in companion["attacks"]:
        if attack.get("lethalPoison") is not None:
            paragraphs.append(
                "<p><strong>Lethal Poison:</strong> "
                f"If the {animal_name} hits a creature with its "
                f"{attack['name']} attack, the creature is exposed to "
                f"@UUID[{LETHAL_POISON_UUID}]{{lethal poison}} with a "
                f"potency of {attack['lethalPoison']}, as if the poison "
                "had been ingested.</p>"
            )

        if attack.get("restrain") is not None:
            paragraphs.append(
                "<p><strong>Restrain:</strong> "
                f"If the {animal_name} hits a creature with its "
                f"{attack['name']} attack, the creature is unable to move "
                "or take actions other than trying to escape with an open "
                f"opposed STR roll against {attack['restrain']}. "
                "The creature can still parry while restrained, but "
                "cannot evade.</p>"
            )

    return "".join(paragraphs)


def build_actor(
    *,
    companion: dict[str, Any],
    defaults: dict[str, Any],
    folder_id: str,
    sort: int,
) -> dict[str, Any]:
    key = companion["key"]
    content_key = f"actors.common-animals.{key}"
    image = companion.get("image", defaults["image"])
    token_image = companion.get("tokenImage", image)
    items: list[dict[str, Any]] = []
    item_sort = 100000

    for attack in companion["attacks"]:
        attack_key = re.sub(r"[^a-z0-9]+", "-", attack["name"].lower()).strip("-")
        items.append(
            build_weapon_skill(
                attack=attack,
                content_key=f"{content_key}.attack.{attack_key}",
                sort=item_sort,
            )
        )
        item_sort += 100000
        items.append(
            build_weapon(
                attack=attack,
                content_key=f"{content_key}.attack.{attack_key}",
                sort=item_sort,
            )
        )
        item_sort += 100000

    for skill in companion["skills"]:
        items.append(
            build_core_skill(
                skill=skill,
                content_key=content_key,
                sort=item_sort,
            )
        )
        item_sort += 100000

    if companion["armorRating"] > 0:
        items.append(
            build_armor(
                armor_id=companion["armorId"],
                rating=companion["armorRating"],
                content_key=content_key,
                sort=item_sort,
            )
        )

    base_movement = companion["movement"]["base"]
    hit_points = companion["hitPoints"]

    return {
        "folder": folder_id,
        "name": companion["name"],
        "type": "npc",
        "_id": companion["id"],
        "img": image,
        "system": {
            "description": defaults["descriptionHtml"],
            "movement": {"base": base_movement, "value": base_movement},
            "hitPoints": {
                "value": hit_points,
                "max": hit_points,
                "base": hit_points,
            },
            "willPoints": {"value": 0, "max": 0, "base": 0},
            "damageBonus": {
                "agl": {"base": "none", "value": "none"},
                "str": {"base": "none", "value": "none"},
            },
            "traits": animal_traits(companion),
            "currency": {"gc": None, "sc": None, "cc": None},
            "encumbrance": {"value": 0},
            "kin": "",
            "age": "",
            "profession": "",
            "motivation": "",
        },
        "prototypeToken": {
            "name": companion["name"],
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
            "bar1": {"attribute": "hitPoints"},
            "bar2": {"attribute": None},
            "light": build_light(),
            "sight": build_sight(),
            "detectionModes": {},
            "flags": {},
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
        "items": items,
        "effects": [],
        "sort": sort,
        "flags": generated_actor_flags(
            content_key,
            companion["movement"],
        ),
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def validate_folder(folder: Any, context: str) -> dict[str, Any]:
    if not isinstance(folder, dict):
        raise GenerationError(f"{context} must be an object.")
    require_key(folder.get("key"), f"{context}.key")
    require_id(folder.get("id"), f"{context}.id")
    require_string(folder.get("name"), f"{context}.name")
    color = folder.get("color")
    if color is not None:
        require_string(color, f"{context}.color")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
            raise GenerationError(f"{context}.color must be a hex color or null.")
    sorting = require_string(folder.get("sorting"), f"{context}.sorting")
    if sorting not in {"a", "m"}:
        raise GenerationError(f"{context}.sorting must be 'a' or 'm'.")
    require_integer(folder.get("sort"), f"{context}.sort")
    return folder


def validate_content(
    content: dict[str, Any],
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    list[dict[str, Any]],
]:
    if content.get("schemaVersion") != 1:
        raise GenerationError("hunter-companions.json schemaVersion must be 1.")

    expected_count = require_integer(
        content.get("expectedCount"),
        "hunter-companions.json expectedCount",
        minimum=1,
    )

    folders = content.get("folders")
    if not isinstance(folders, dict):
        raise GenerationError("hunter-companions.json folders must be an object.")

    if set(folders) != {"root", "commonAnimals"}:
        raise GenerationError(
            "hunter-companions.json folders must contain exactly "
            "root and commonAnimals."
        )

    root = validate_folder(folders.get("root"), "folders.root")
    common_animals_folder = validate_folder(
        folders.get("commonAnimals"), "folders.commonAnimals"
    )

    if common_animals_folder["key"] != "common-animals":
        raise GenerationError(
            "folders.commonAnimals.key must be 'common-animals'."
        )
    if common_animals_folder["name"] != "Common Animals":
        raise GenerationError(
            "folders.commonAnimals.name must be 'Common Animals'."
        )

    defaults = content.get("defaults")
    if not isinstance(defaults, dict):
        raise GenerationError("hunter-companions.json defaults must be an object.")
    require_string(defaults.get("image"), "defaults.image")
    require_string(
        defaults.get("descriptionHtml"),
        "defaults.descriptionHtml",
        allow_empty=True,
    )
    require_integer(defaults.get("tokenWidth"), "defaults.tokenWidth", minimum=1)
    require_integer(defaults.get("tokenHeight"), "defaults.tokenHeight", minimum=1)
    if defaults.get("tokenDisposition") not in {-1, 0, 1}:
        raise GenerationError("defaults.tokenDisposition must be -1, 0, or 1.")

    raw_companions = content.get("companions")
    if not isinstance(raw_companions, list):
        raise GenerationError("hunter-companions.json companions must be an array.")
    if len(raw_companions) != expected_count:
        raise GenerationError(
            f"Expected {expected_count} companions, found {len(raw_companions)}."
        )

    ids: set[str] = {
        root["id"],
        common_animals_folder["id"],
    }
    keys: set[str] = set()
    names: set[str] = set()
    validated: list[dict[str, Any]] = []

    for index, raw in enumerate(raw_companions):
        if not isinstance(raw, dict):
            raise GenerationError(f"companions[{index}] must be an object.")

        key = require_key(raw.get("key"), f"companions[{index}].key")
        name = require_string(raw.get("name"), f"companion {key!r}.name")
        actor_id = require_id(raw.get("id"), f"companion {key!r}.id")
        hit_points = require_integer(
            raw.get("hitPoints"), f"companion {key!r}.hitPoints", minimum=1
        )
        armor_rating = require_integer(
            raw.get("armorRating"), f"companion {key!r}.armorRating"
        )
        armor_id = raw.get("armorId")
        if armor_rating > 0:
            armor_id = require_id(armor_id, f"companion {key!r}.armorId")
        elif armor_id is not None:
            raise GenerationError(
                f"companion {key!r}.armorId must be null when armorRating is 0."
            )

        movement = raw.get("movement")
        if not isinstance(movement, dict):
            raise GenerationError(f"companion {key!r}.movement must be an object.")
        normalized_movement = {
            "base": require_integer(
                movement.get("base"), f"companion {key!r}.movement.base"
            )
        }
        for field in ("fly", "swim"):
            value = require_optional_integer(
                movement.get(field),
                f"companion {key!r}.movement.{field}",
                minimum=1,
            )
            if value is not None:
                normalized_movement[field] = value

        raw_attacks = raw.get("attacks")
        if not isinstance(raw_attacks, list) or not raw_attacks:
            raise GenerationError(
                f"companion {key!r}.attacks must be a non-empty array."
            )
        attacks: list[dict[str, Any]] = []
        for attack_index, raw_attack in enumerate(raw_attacks):
            if not isinstance(raw_attack, dict):
                raise GenerationError(
                    f"companion {key!r}.attacks[{attack_index}] must be an object."
                )
            attack_name = require_string(
                raw_attack.get("name"),
                f"companion {key!r}.attacks[{attack_index}].name",
            )
            attack = {
                "name": attack_name,
                "skillId": require_id(
                    raw_attack.get("skillId"),
                    f"companion {key!r} attack {attack_name!r}.skillId",
                ),
                "weaponId": require_id(
                    raw_attack.get("weaponId"),
                    f"companion {key!r} attack {attack_name!r}.weaponId",
                ),
                "skillLevel": require_integer(
                    raw_attack.get("skillLevel"),
                    f"companion {key!r} attack {attack_name!r}.skillLevel",
                    minimum=1,
                ),
                "damage": raw_attack.get("damage"),
                "range": require_integer(
                    raw_attack.get("range"),
                    f"companion {key!r} attack {attack_name!r}.range",
                    minimum=1,
                ),
            }
            if attack["damage"] is not None:
                require_string(
                    attack["damage"],
                    f"companion {key!r} attack {attack_name!r}.damage",
                )
            for field in ("lethalPoison", "restrain"):
                value = require_optional_integer(
                    raw_attack.get(field),
                    f"companion {key!r} attack {attack_name!r}.{field}",
                    minimum=1,
                )
                if value is not None:
                    attack[field] = value
            attacks.append(attack)

        raw_skills = raw.get("skills")
        if not isinstance(raw_skills, list):
            raise GenerationError(f"companion {key!r}.skills must be an array.")
        skills: list[dict[str, Any]] = []
        for skill_index, raw_skill in enumerate(raw_skills):
            if not isinstance(raw_skill, dict):
                raise GenerationError(
                    f"companion {key!r}.skills[{skill_index}] must be an object."
                )
            skill_name = require_string(
                raw_skill.get("name"),
                f"companion {key!r}.skills[{skill_index}].name",
            )
            if skill_name not in CORE_SKILL_ATTRIBUTES:
                raise GenerationError(
                    f"Unsupported core skill for companion {key!r}: {skill_name}"
                )
            skills.append(
                {
                    "id": require_id(
                        raw_skill.get("id"),
                        f"companion {key!r} skill {skill_name!r}.id",
                    ),
                    "name": skill_name,
                    "value": require_integer(
                        raw_skill.get("value"),
                        f"companion {key!r} skill {skill_name!r}.value",
                        minimum=1,
                    ),
                }
            )

        if key in keys:
            raise GenerationError(f"Duplicate companion key: {key}")
        if name in names:
            raise GenerationError(f"Duplicate companion name: {name}")
        keys.add(key)
        names.add(name)

        companion_ids = [actor_id]
        if armor_id is not None:
            companion_ids.append(armor_id)
        for attack in attacks:
            companion_ids.extend([attack["skillId"], attack["weaponId"]])
        for skill in skills:
            companion_ids.append(skill["id"])
        for document_id in companion_ids:
            if document_id in ids:
                raise GenerationError(f"Duplicate Foundry ID: {document_id}")
            ids.add(document_id)

        normalized = dict(raw)
        normalized.update(
            {
                "id": actor_id,
                "name": name,
                "movement": normalized_movement,
                "hitPoints": hit_points,
                "armorRating": armor_rating,
                "armorId": armor_id,
                "attacks": attacks,
                "skills": skills,
            }
        )
        validated.append(normalized)

    return root, common_animals_folder, defaults, validated


def find_single_file(root: Path, filename: str) -> Path:
    matches = sorted(root.rglob(filename))
    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one {filename} below {root}, found {len(matches)}."
        )
    return matches[0]


def find_root_folder(actor_root: Path, root: dict[str, Any]) -> Path:
    matches: list[Path] = []
    for path in actor_root.rglob("_Folder.json"):
        document = load_json(path)
        flags = document.get("flags", {}).get(MODULE_ID, {})
        if (
            document.get("_id") == root["id"]
            and document.get("name") == root["name"]
            and flags.get("contentKey") == ROOT_CONTENT_KEY
        ):
            matches.append(path)
    if len(matches) != 1:
        raise GenerationError(
            "Expected exactly one existing Bane of Azeroth Actor root folder, "
            f"found {len(matches)}."
        )
    return matches[0]


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

    managed_indexes = [index for index, path in enumerate(paths) if is_managed(path)]
    unmanaged = [path for path in paths if not is_managed(path)]
    insert_at = managed_indexes[0] if managed_indexes else len(unmanaged)
    return unmanaged[:insert_at] + list(generated_paths) + unmanaged[insert_at:]


def collect_generated_json(root: Path) -> list[Path]:
    if not root.exists():
        return []
    if not root.is_dir():
        raise GenerationError(f"Expected a directory: {root}")

    generated: list[Path] = []

    for path in sorted(root.rglob("*")):
        if path.is_dir():
            continue
        if path.suffix != ".json":
            raise GenerationError(
                f"Refusing to remove unexpected non-JSON file: {path}"
            )

        document = load_json(path)
        flags = document.get("flags", {}).get(MODULE_ID, {})
        if flags.get("generatedBy") != GENERATOR_NAME:
            raise GenerationError(
                "Refusing to remove a legacy-path document not owned by "
                f"the Hunter generator: {path}"
            )

        generated.append(path)

    return generated


def validate_id_collisions(
    actor_root: Path,
    generated_ids: set[str],
    allowed_paths: set[Path],
) -> None:
    if not actor_root.is_dir():
        return

    for path in actor_root.rglob("*.json"):
        data = load_json(path)
        existing_id = data.get("_id")

        if existing_id not in generated_ids:
            continue
        if path.resolve() in allowed_paths:
            continue

        raise GenerationError(
            f"Generated Foundry ID {existing_id} collides with {path}."
        )


def remove_empty_tree(root: Path) -> None:
    if not root.exists():
        return

    for directory in sorted(
        (path for path in root.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    ):
        directory.rmdir()

    root.rmdir()


def main() -> int:
    args = parse_args()

    try:
        content = load_json(args.content)
        root, common_animals_folder, defaults, companions = validate_content(
            content
        )

        adventure_file = find_single_file(args.pack_root, "_Adventure.json")
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)
        actor_root = adventure_dir / "Actor"
        root_folder_path = find_root_folder(actor_root, root)
        root_dir = root_folder_path.parent

        common_animals_dir = root_dir / folder_dirname(
            common_animals_folder["name"],
            common_animals_folder["id"],
        )
        legacy_companions_dir = root_dir / folder_dirname(
            LEGACY_COMPANIONS_FOLDER_NAME,
            LEGACY_COMPANIONS_FOLDER_ID,
        )
        legacy_paths = collect_generated_json(legacy_companions_dir)

        common_animals_document = build_folder(
            name=common_animals_folder["name"],
            folder_id=common_animals_folder["id"],
            parent_id=root["id"],
            color=common_animals_folder["color"],
            sorting=common_animals_folder["sorting"],
            sort=common_animals_folder["sort"],
            content_key=COMMON_ANIMALS_CONTENT_KEY,
        )

        generated_documents: list[tuple[Path, dict[str, Any]]] = []
        generated_actor_paths: list[str] = []
        generated_ids: set[str] = {
            common_animals_folder["id"],
        }

        for index, companion in enumerate(companions):
            actor = build_actor(
                companion=companion,
                defaults=defaults,
                folder_id=common_animals_folder["id"],
                sort=(index + 1) * 100000,
            )
            actor_path = common_animals_dir / document_filename(
                actor["name"],
                actor["_id"],
            )
            generated_documents.append((actor_path, actor))
            generated_actor_paths.append(
                actor_path.relative_to(adventure_dir).as_posix()
            )
            generated_ids.add(actor["_id"])

            if companion["armorId"] is not None:
                generated_ids.add(companion["armorId"])

            for attack in companion["attacks"]:
                generated_ids.add(attack["skillId"])
                generated_ids.add(attack["weaponId"])

            for skill in companion["skills"]:
                generated_ids.add(skill["id"])

        common_animals_folder_path = common_animals_dir / "_Folder.json"
        generated_folder_paths = [
            common_animals_folder_path.relative_to(adventure_dir).as_posix(),
        ]
        expected_files: list[tuple[Path, dict[str, Any]]] = [
            (common_animals_folder_path, common_animals_document),
            *generated_documents,
        ]
        expected_paths = {
            path.resolve()
            for path, _ in expected_files
        }
        allowed_paths = expected_paths | {
            path.resolve()
            for path in legacy_paths
        }

        validate_id_collisions(
            actor_root,
            generated_ids,
            allowed_paths,
        )

        common_animals_prefix = (
            common_animals_dir.relative_to(adventure_dir).as_posix() + "/"
        )
        legacy_companions_prefix = (
            legacy_companions_dir.relative_to(adventure_dir).as_posix() + "/"
        )
        managed_prefixes = (
            common_animals_prefix,
            legacy_companions_prefix,
        )

        expected_adventure = dict(adventure)
        expected_adventure["actors"] = update_adventure_paths(
            adventure.get("actors", []),
            field_name="actors",
            generated_paths=generated_actor_paths,
            managed_prefixes=managed_prefixes,
        )
        expected_adventure["folders"] = update_adventure_paths(
            adventure.get("folders", []),
            field_name="folders",
            generated_paths=generated_folder_paths,
            managed_prefixes=managed_prefixes,
        )

        stale_paths = list(legacy_paths)

        if common_animals_dir.is_dir():
            stale_paths.extend(
                sorted(
                    path
                    for path in common_animals_dir.glob("*.json")
                    if path.resolve() not in expected_paths
                )
            )

        problems: list[str] = []

        if args.check:
            for stale in stale_paths:
                problems.append(f"Stale generated document: {stale}")

            for path, expected in expected_files:
                if not compare_json(path, expected):
                    problems.append(
                        f"Out-of-date generated document: {path}"
                    )

            if not compare_json(adventure_file, expected_adventure):
                problems.append(
                    f"Out-of-date Adventure manifest: {adventure_file}"
                )

            if problems:
                print(
                    "Generated common-animal content is not up to date:",
                    file=sys.stderr,
                )
                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)
                return 1

            print(
                "Common-animal content is up to date: "
                f"{len(companions)} actors."
            )
            return 0

        common_animals_dir.mkdir(parents=True, exist_ok=True)

        for stale in stale_paths:
            stale.unlink()

        if legacy_companions_dir.exists():
            remove_empty_tree(legacy_companions_dir)

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
            f"Generated {len(companions)} common-animal actors."
        )
        print(f"Updated {adventure_file}")
        return 0
    except GenerationError as exc:
        print(
            f"generate-hunter-companions.py: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
