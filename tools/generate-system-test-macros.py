#!/usr/bin/env python3
"""Generate the prerelease-only Bane of Azeroth system-test Macro pack."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import tempfile
from pathlib import Path


MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-system-test-macros.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")

EXTERNAL_UUID_CONFIGURATION_PLACEHOLDER = (
    "__BOA_EXTERNAL_UUID_CONFIGURATION__"
)



MACROS = [
    {
        "key": "run-all",
        "id": "BoaDevRunAll0001",
        "name": "BOA DEV – Run All System Tests",
        "file": "run-all.js",
        "order": 1,
        "suiteMember": False,
        "img": "icons/svg/dice-target.svg",
    },
    {
        "key": "smoke",
        "id": "BoaDevSmoke00001",
        "name": "BOA DEV – Smoke Test",
        "file": "smoke-test.js",
        "order": 2,
        "suiteMember": True,
        "img": "icons/svg/upgrade.svg",
    },
    {
        "key": "generated-content",
        "id": "BoaDevContent001",
        "name": "BOA DEV – Verify Generated Content",
        "file": "verify-generated-content.js",
        "order": 3,
        "suiteMember": True,
        "img": "icons/svg/book.svg",
    },
    {
        "key": "spell-grants",
        "id": "BoaDevSpells0001",
        "name": "BOA DEV – Verify Spell Grants",
        "file": "verify-spell-grants.js",
        "order": 4,
        "suiteMember": True,
        "img": "icons/svg/lightning.svg",
    },
    {
        "key": "elemental-totems",
        "id": "BoaDevTotems0001",
        "name": "BOA DEV – Verify Elemental Totems",
        "file": "verify-elemental-totems.js",
        "order": 5,
        "suiteMember": True,
        "img": "icons/svg/aura.svg",
    },
    {
        "key": "adventure-ownership",
        "id": "BoaDevAdvOwn0001",
        "name": "BOA DEV – Verify Adventure Ownership",
        "file": "verify-adventure-ownership.js",
        "order": 6,
        "suiteMember": True,
        "img": "icons/svg/castle.svg",
    },
    {
        "key": "common-animals",
        "id": "BoaDevAnimals001",
        "name": "BOA DEV – Verify Common Animals",
        "file": "verify-common-animals.js",
        "order": 7,
        "suiteMember": True,
        "img": "icons/svg/pawprint.svg",
    },
    {
        "key": "common-animal-attack-messages",
        "id": "BoaDevAtkMsg0001",
        "name": "BOA DEV – Verify Common Animal Attack Messages",
        "file": "verify-common-animal-attack-messages.js",
        "order": 8,
        "suiteMember": True,
        "img": "icons/svg/combat.svg",
    },
    {
        "key": "common-animal-movement",
        "id": "BoaDevAnimalMove",
        "name": "BOA DEV – Verify Common Animal Movement",
        "file": "verify-common-animal-movement.js",
        "order": 9,
        "suiteMember": True,
        "img": "icons/svg/wing.svg",
    },
        {
        "key": "ghoul",
        "id": "BoaDevGhoul00001",
        "name": "BOA DEV – Verify Ghoul",
        "file": "verify-ghoul.js",
        "order": 10,
        "suiteMember": True,
        "img": "icons/svg/bones.svg",
    },
    {
        "key": "warlock-demons",
        "id": "BoaDevDemons0001",
        "name": "BOA DEV – Verify Warlock Demons",
        "file": "verify-warlock-demons.js",
        "order": 11,
        "suiteMember": True,
        "img": "icons/svg/fire.svg",
    },
    {
        "key": "mages-brilliance",
        "id": "BoaDevMageBril01",
        "name": "BOA DEV – Verify Mage's Brilliance",
        "file": "verify-mages-brilliance.js",
        "order": 18,
        "suiteMember": True,
        "img": "icons/svg/lightning.svg",
    },
    {
        "key": "evokers-legacy",
        "id": "BoaDevEvoker0011",
        "name": "BOA DEV – Verify Evoker's Legacy",
        "file": "verify-evokers-legacy.js",
        "order": 19,
        "suiteMember": True,
        "img": "icons/svg/lightning.svg",
    },
    {
        "key": "ability-actions",
        "id": "BoaDevAttack0012",
        "name": "BOA DEV – Verify Ability Attacks",
        "file": "verify-ability-actions.js",
        "order": 20,
        "suiteMember": True,
        "img": "icons/svg/explosion.svg",
    },
    {
        "key": "serenity",
        "id": "BoaDevSerenity13",
        "name": "BOA DEV – Verify Monk's Serenity",
        "file": "verify-serenity.js",
        "order": 21,
        "suiteMember": True,
        "img": "modules/bane-of-azeroth/assets/icons/classes/monk.webp",
    },
    {
        "key": "demon-hunter-initiation",
        "id": "BoaDevDHInit0014",
        "name": "BOA DEV – Verify Demon Hunter Initiation",
        "file": "verify-demon-hunter-initiation.js",
        "order": 22,
        "suiteMember": True,
        "img": "modules/bane-of-azeroth/assets/icons/classes/demon-hunter.webp",
    },
    {
        "key": "frostreaper",
        "id": "BoaDevFrost00015",
        "name": "BOA DEV – Verify Frostreaper",
        "file": "verify-frostreaper.js",
        "order": 23,
        "suiteMember": True,
        "img": "modules/bane-of-azeroth/assets/icons/classes/death-knight.webp",
    },
    {
        "key": "death-knight-runes",
        "id": "BoaDevRunes00016",
        "name": "BOA DEV – Verify Death Knight Runes",
        "file": "verify-death-knight-runes.js",
        "order": 24,
        "suiteMember": True,
        "img": "modules/bane-of-azeroth/assets/icons/classes/death-knight.webp",
    },
    {
        "key": "prepare-player-tests",
        "id": "BoaDevPlyPrep001",
        "name": "BOA DEV – Prepare Player Tests",
        "file": "prepare-player-tests.js",
        "order": 12,
        "suiteMember": False,
        "img": "icons/svg/door-exit.svg",
    },
    {
        "key": "player-tests",
        "id": "BoaDevPlyRun0001",
        "name": "BOA DEV – Run Player Tests",
        "file": "run-player-tests.js",
        "order": 13,
        "suiteMember": False,
        "img": "icons/svg/mystery-man.svg",
        "ownershipDefault": 3,
    },
    {
        "key": "cleanup-player-tests",
        "id": "BoaDevPlyClean01",
        "name": "BOA DEV – Cleanup Player Tests",
        "file": "cleanup-player-tests.js",
        "order": 14,
        "suiteMember": False,
        "img": "icons/svg/biohazard.svg",
    },
{
        "key": "cleanup",
        "id": "BoaDevCleanup001",
        "name": "BOA DEV – Cleanup Test Data",
        "file": "cleanup-test-data.js",
        "order": 15,
        "suiteMember": False,
        "img": "icons/svg/biohazard.svg",
    },
    {
        "key": "external-uuids",
        "id": "BoaDevExtUuid001",
        "name": "BOA DEV – Verify External UUIDs",
        "file": "verify-external-uuids.js",
        "order": 16,
        "suiteMember": True,
        "img": "icons/svg/book.svg",
    },

    {
        "key": "assets-journals",
        "id": "BoaDevAssetsJrnl",
        "name": "BOA DEV – Verify Assets and Journals",
        "file": "verify-assets-and-journals.js",
        "order": 17,
        "suiteMember": True,
        "img": "icons/svg/book.svg",
    },
]


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--library",
        type=Path,
        default=(
            repo_root
            / "tests"
            / "system"
            / "lib"
            / "boa-system-test-lib.js"
        ),
    )
    parser.add_argument(
        "--macros-directory",
        type=Path,
        default=repo_root / "tests" / "system" / "macros",
    )
    parser.add_argument(
        "--output-directory",
        type=Path,
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "Validate Macro generation in a "
            "temporary directory without writing repo files."
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


def load_json_object(
    path: Path,
) -> dict[str, object]:
    try:
        value = json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )
    except FileNotFoundError as error:
        raise SystemExit(
            f"Missing system-test source data: {path}"
        ) from error
    except json.JSONDecodeError as error:
        raise SystemExit(
            f"Invalid JSON in {path}: {error}"
        ) from error

    if not isinstance(value, dict):
        raise SystemExit(
            f"Expected a JSON object in {path}."
        )
    return value


def load_external_uuid_configuration(
    repo_root: Path,
) -> dict[str, object]:
    config_root = (
        repo_root
        / "foundry"
        / "config"
    )
    compatibility = load_json_object(
        config_root
        / "compatibility.json"
    )
    sources = load_json_object(
        config_root
        / "references"
        / "external-sources.json"
    )
    references = load_json_object(
        config_root
        / "references"
        / "external-references.json"
    )

    configuration = {
        "verifiedEnvironment":
            compatibility.get(
                "verifiedEnvironment",
                {},
            ),
        "sources":
            sources.get(
                "sources",
                {},
            ),
        "references":
            references.get(
                "references",
                {},
            ),
    }

    if not configuration["references"]:
        raise SystemExit(
            "External UUID verification requires "
            "at least one registered reference."
        )

    return configuration


def render_macro_body(
    body: str,
    *,
    external_configuration:
        dict[str, object],
) -> str:
    count = body.count(
        EXTERNAL_UUID_CONFIGURATION_PLACEHOLDER
    )
    if count == 0:
        return body

    rendered = body.replace(
        EXTERNAL_UUID_CONFIGURATION_PLACEHOLDER,
        json.dumps(
            external_configuration,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ),
    )

    if (
        EXTERNAL_UUID_CONFIGURATION_PLACEHOLDER
        in rendered
    ):
        raise SystemExit(
            "External UUID configuration placeholder "
            "was not fully rendered."
        )

    return rendered


def base_stats() -> dict[str, object]:
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


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    temporary_output = None
    if args.check:
        temporary_output = tempfile.TemporaryDirectory(
            prefix="boa-system-test-macros-check-"
        )
        args.output_directory = Path(
            temporary_output.name
        )

    if not args.library.is_file():
        raise SystemExit(
            f"Missing system-test library: {args.library}"
        )

    library = args.library.read_text(encoding="utf-8").rstrip()
    external_configuration = (
        load_external_uuid_configuration(
            repo_root
        )
    )


    shutil.rmtree(args.output_directory, ignore_errors=True)
    args.output_directory.mkdir(parents=True, exist_ok=True)

    seen_ids: set[str] = set()

    for macro in MACROS:
        document_id = macro["id"]

        if not ID_PATTERN.fullmatch(document_id):
            raise SystemExit(
                "Macro ID must be 16 alphanumeric characters: "
                f"{document_id}"
            )

        if document_id in seen_ids:
            raise SystemExit(f"Duplicate Macro ID: {document_id}")

        seen_ids.add(document_id)

        source_path = args.macros_directory / macro["file"]

        if not source_path.is_file():
            raise SystemExit(f"Missing Macro source: {source_path}")

        body = source_path.read_text(encoding="utf-8").strip()
        body = render_macro_body(
            body,
            external_configuration=
                external_configuration,
        )

        command = (
            f"{library}\n\n"
            f"/* System test: {macro['key']} */\n"
            f"{body}\n"
        )

        document = {
            "_key": f"!macros!{document_id}",
            "_id": document_id,
            "name": macro["name"],
            "type": "script",
            "scope": "global",
            "command": command,
            "img": macro["img"],
            "author": None,
            "folder": None,
            "sort": macro["order"] * 100000,
            "ownership": {
                "default": macro.get("ownershipDefault", 0),
            },
            "flags": {
                MODULE_ID: {
                    "generatedBy": GENERATOR_NAME,
                    "systemTestKey": macro["key"],
                    "suiteMember": macro["suiteMember"],
                },
            },
            "_stats": base_stats(),
        }

        output_path = (
            args.output_directory
            / safe_filename(macro["name"], document_id)
        )

        output_path.write_text(
            json.dumps(
                document,
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    if args.check:
        print(
            f"Checked {len(MACROS)} developer-test Macros."
        )
        temporary_output.cleanup()
    else:
        print(
            f"Generated {len(MACROS)} developer-test Macros in "
            f"{args.output_directory}."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
