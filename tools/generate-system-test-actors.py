#!/usr/bin/env python3
"""Generate prerelease-only Bane of Azeroth manual system-test Actors."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import tempfile
from pathlib import Path


MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-system-test-actors.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")
EXPECTED_ACTOR_COUNT = 12


def fixture_item(
    key: str,
    name: str,
    item_type: str,
    content_key: str | None = None,
) -> dict[str, str]:
    data = {
        "key": key,
        "name": name,
        "type": item_type,
    }
    if content_key is not None:
        data["contentKey"] = content_key
    return data


ACTORS = [
    {
        "key": "death-knight",
        "id": "BoaTstDeathK0001",
        "name": "BOA TEST – Death Knight",
        "img": "modules/bane-of-azeroth/assets/icons/classes/death-knight.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "rebirth",
                "Death Knight's Rebirth",
                "ability",
                "heroic-class-ability.death-knight.death-knights-rebirth",
            ),
            fixture_item(
                "frostreaper",
                "Frostreaper",
                "ability",
                "heroic-class-ability.death-knight.frostreaper",
            ),
            fixture_item(
                "raise-ghoul",
                "Raise Ghoul",
                "ability",
                "heroic-class-ability.death-knight.summon-ghoul",
            ),
            fixture_item(
                "warglaive",
                "Warglaive",
                "weapon",
            ),
        ],
    },
    {
        "key": "demon-hunter",
        "id": "BoaTstDemonH0001",
        "name": "BOA TEST – Demon Hunter",
        "img": "modules/bane-of-azeroth/assets/icons/classes/demon-hunter.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "initiation",
                "Demon Hunter Initiation",
                "ability",
                "heroic-class-ability.demon-hunter.demon-hunter-initiation",
            ),
            fixture_item(
                "eye-beam",
                "Eye Beam",
                "ability",
                "heroic-class-ability.demon-hunter.eye-beam",
            ),
        ],
    },
    {
        "key": "druid",
        "id": "BoaTstDruid00001",
        "name": "BOA TEST – Druid",
        "img": "modules/bane-of-azeroth/assets/icons/classes/druid.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "awakening",
                "Druidic Awakening",
                "ability",
                "heroic-class-ability.druid.druidic-awakening",
            ),
            fixture_item(
                "chosen-of-elune",
                "Chosen of Elune",
                "ability",
                "heroic-class-ability.druid.chosen-of-elune",
            ),
            fixture_item(
                "king-of-the-jungle",
                "King of the Jungle",
                "ability",
                "heroic-class-ability.druid.king-of-the-jungle",
            ),
            fixture_item(
                "tree-of-life",
                "Tree of Life",
                "ability",
                "heroic-class-ability.druid.tree-of-life",
            ),
        ],
    },
    {
        "key": "shaman",
        "id": "BoaTstShaman0001",
        "name": "BOA TEST – Shaman",
        "img": "modules/bane-of-azeroth/assets/icons/classes/shaman.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "shamanic-calling",
                "Shamanic Calling",
                "ability",
                "heroic-class-ability.shaman.shamanic-calling",
            ),
        ],
    },
    {
        "key": "warlock",
        "id": "BoaTstWarlock001",
        "name": "BOA TEST – Warlock",
        "img": "modules/bane-of-azeroth/assets/icons/classes/warlock.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "warlocks-ambition",
                "Warlock's Ambition",
                "ability",
                "heroic-class-ability.warlock.warlocks-ambition",
            ),
            fixture_item(
                "demonologist",
                "Demonologist",
                "ability",
                "heroic-class-ability.warlock.demonologist",
            ),
        ],
    },
    {
        "key": "mage",
        "id": "BoaTstMage000001",
        "name": "BOA TEST – Mage",
        "img": "modules/bane-of-azeroth/assets/icons/classes/mage.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "mages-brilliance",
                "Mage's Brilliance",
                "ability",
                "heroic-class-ability.mage.mages-brilliance",
            ),
        ],
    },
    {
        "key": "monk",
        "id": "BoaTstMonk000001",
        "name": "BOA TEST – Monk",
        "img": "modules/bane-of-azeroth/assets/icons/classes/monk.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "serenity",
                "Monk's Serenity",
                "ability",
                "heroic-class-ability.monk.monks-serenity",
            ),
            fixture_item(
                "unarmed",
                "Unarmed",
                "weapon",
            ),
            fixture_item(
                "iron-fist",
                "Iron Fist",
                "ability",
            ),
        ],
    },
    {
        "key": "evoker",
        "id": "BoaTstEvoker0001",
        "name": "BOA TEST – Evoker",
        "img": "modules/bane-of-azeroth/assets/icons/classes/evoker.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "evokers-legacy",
                "Evoker's Legacy",
                "ability",
                "heroic-class-ability.evoker.evokers-legacy",
            ),
        ],
    },
    {
        "key": "shadow-priest",
        "id": "BoaTstPriest0001",
        "name": "BOA TEST – Shadow Priest",
        "img": "modules/bane-of-azeroth/assets/icons/classes/priest.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "priests-zeal",
                "Priest's Zeal",
                "ability",
                "heroic-class-ability.priest.priests-zeal",
            ),
            fixture_item(
                "darkness",
                "Darkness",
                "ability",
                "heroic-class-ability.priest.darkness",
            ),
        ],
    },
    {
        "key": "tauren",
        "id": "BoaTstTauren0001",
        "name": "BOA TEST – Tauren",
        "img": "icons/svg/mystery-man.svg",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "war-stomp",
                "War Stomp",
                "ability",
                "kin-ability.tauren.war-stomp",
            ),
        ],
    },
    {
        "key": "hunter",
        "id": "BoaTstHunter0001",
        "name": "BOA TEST – Hunter",
        "img": "modules/bane-of-azeroth/assets/icons/classes/hunter.webp",
        "hp": 30,
        "wp": 30,
        "items": [
            fixture_item(
                "hunters-instincts",
                "Hunter's Instincts",
                "ability",
                "heroic-class-ability.hunter.hunters-instincts",
            ),
        ],
    },
    {
        "key": "target",
        "id": "BoaTstTarget0001",
        "name": "BOA TEST – Target",
        "img": "icons/svg/dice-target.svg",
        "hp": 60,
        "wp": 0,
        "items": [],
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-directory",
        type=Path,
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "Validate Actor generation in a temporary directory "
            "without writing repo files."
        ),
    )
    args = parser.parse_args()
    if not args.check and args.output_directory is None:
        parser.error(
            "--output-directory is required unless --check is used"
        )
    return args


def safe_filename(name: str, document_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
    return f"{stem}_{document_id}.json"


def validate_definitions() -> None:
    if len(ACTORS) != EXPECTED_ACTOR_COUNT:
        raise SystemExit(
            "Expected "
            f"{EXPECTED_ACTOR_COUNT} system-test Actors, got {len(ACTORS)}."
        )

    ids: set[str] = set()
    keys: set[str] = set()
    names: set[str] = set()

    for actor in ACTORS:
        document_id = str(actor["id"])
        key = str(actor["key"])
        name = str(actor["name"])

        if not ID_PATTERN.fullmatch(document_id):
            raise SystemExit(
                f"System-test Actor id must be 16 alphanumeric characters: "
                f"{key}={document_id!r}"
            )
        if document_id in ids:
            raise SystemExit(f"Duplicate system-test Actor id: {document_id}")
        if key in keys:
            raise SystemExit(f"Duplicate system-test Actor key: {key}")
        if name in names:
            raise SystemExit(f"Duplicate system-test Actor name: {name}")

        ids.add(document_id)
        keys.add(key)
        names.add(name)

        item_keys: set[str] = set()
        for item in actor.get("items", []):
            item_key = str(item["key"])
            if item_key in item_keys:
                raise SystemExit(
                    f"Duplicate fixture item key for {key}: {item_key}"
                )
            item_keys.add(item_key)

            if not str(item.get("name", "")).strip():
                raise SystemExit(
                    f"Fixture item requires a name: {key}/{item_key}"
                )
            if not str(item.get("type", "")).strip():
                raise SystemExit(
                    f"Fixture item requires a type: {key}/{item_key}"
                )


def actor_document(definition: dict[str, object]) -> dict[str, object]:
    document_id = str(definition["id"])
    hp = int(definition["hp"])
    wp = int(definition["wp"])

    return {
        "_key": f"!actors!{document_id}",
        "_id": document_id,
        "name": definition["name"],
        "type": "character",
        "img": definition["img"],
        "items": [],
        "effects": [],
        "folder": None,
        "sort": 100000,
        "ownership": {
            "default": 0,
        },
        "flags": {
            MODULE_ID: {
                "generatedBy": GENERATOR_NAME,
                "systemTestActorKey": definition["key"],
                "fixtureStats": {
                    "hp": hp,
                    "wp": wp,
                },
                "fixtureItems": definition.get("items", []),
            },
        },
        "system": {},
        "prototypeToken": {
            "name": definition["name"],
            "displayName": 20,
            "actorLink": True,
            "texture": {
                "src": definition["img"],
            },
        },
        "_stats": {
            "compendiumSource": None,
            "duplicateSource": None,
            "coreVersion": "14.365",
            "systemId": "dragonbane",
            "systemVersion": "4.0.1",
            "createdTime": None,
            "modifiedTime": None,
            "lastModifiedBy": None,
            "exportSource": None,
        },
    }


def generate(output_directory: Path) -> None:
    validate_definitions()

    if output_directory.exists():
        shutil.rmtree(output_directory)
    output_directory.mkdir(parents=True, exist_ok=True)

    for definition in ACTORS:
        document = actor_document(definition)
        path = output_directory / safe_filename(
            str(definition["name"]),
            str(definition["id"]),
        )
        path.write_text(
            json.dumps(
                document,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

    generated = sorted(output_directory.glob("*.json"))
    if len(generated) != EXPECTED_ACTOR_COUNT:
        raise SystemExit(
            "Generated Actor count mismatch: "
            f"expected {EXPECTED_ACTOR_COUNT}, got {len(generated)}."
        )


def main() -> int:
    args = parse_args()

    if args.check:
        with tempfile.TemporaryDirectory(
            prefix="boa-system-test-actors-"
        ) as temporary:
            generate(Path(temporary))
        print(
            "Checked prerelease system-test Actor generation "
            f"({EXPECTED_ACTOR_COUNT} Actors)."
        )
        return 0

    assert args.output_directory is not None
    generate(args.output_directory)
    print(
        f"Generated {EXPECTED_ACTOR_COUNT} prerelease system-test Actors in "
        f"{args.output_directory}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
