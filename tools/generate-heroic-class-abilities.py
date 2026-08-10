#!/usr/bin/env python3
"""Generate Bane of Azeroth Heroic Class Ability Adventure source files.

The generator owns all JSON files and generated class subdirectories below
the Adventure's "Heroic Class Abilities" Item folder, except the parent
folder's own _Folder.json. It preserves all content outside that folder.

Run from any directory:

    python3 tools/generate-heroic-class-abilities.py

Verify that committed files are up to date without changing them:

    python3 tools/generate-heroic-class-abilities.py --check
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
from typing import Any, Callable, Sequence

MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-heroic-class-abilities.py"
ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")
REF_PATTERN = re.compile(
    r"@Ref\[(?P<key>[^\]]+)\]"
    r"\{(?P<label>[^{}]+)\}"
)


class GenerationError(RuntimeError):
    """Raised when source data or the Adventure structure is invalid."""


@dataclass(frozen=True)
class GeneratedFile:
    path: Path
    data: dict[str, Any]


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(
        description="Generate Foundry Heroic Class Ability source documents."
    )
    parser.add_argument(
        "--content",
        type=Path,
        default=(
            repo_root
            / "foundry"
            / "content"
            / "heroic-class-abilities.json"
        ),
        help="Structured Heroic Class Ability content JSON.",
    )
    parser.add_argument(
        "--spells-content",
        type=Path,
        default=(
            repo_root
            / "foundry"
            / "content"
            / "spells.json"
        ),
        help="Structured Spell content JSON.",
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


def find_item_folder(adventure_dir: Path, name: str) -> tuple[Path, str]:
    matches: list[tuple[Path, str]] = []

    for folder_file in adventure_dir.joinpath("Item").rglob("_Folder.json"):
        folder = load_json(folder_file)

        if folder.get("type") == "Item" and folder.get("name") == name:
            folder_id = folder.get("_id")

            if (
                not isinstance(folder_id, str)
                or not ID_PATTERN.fullmatch(folder_id)
            ):
                raise GenerationError(
                    f"Folder {name!r} has an invalid Foundry ID "
                    f"in {folder_file}."
                )

            matches.append((folder_file.parent, folder_id))

    if len(matches) != 1:
        raise GenerationError(
            f"Expected exactly one Item folder named {name!r}, "
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


def require_paragraphs(value: Any, context: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise GenerationError(
            f"{context} must be a non-empty array of strings."
        )

    paragraphs: list[str] = []

    for index, paragraph in enumerate(value):
        text = require_string(
            paragraph,
            f"{context}[{index}]",
        ).strip()
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

def load_spell_references(
    path: Path,
) -> dict[str, dict[str, str]]:
    content = load_json(path)
    spells = content.get("spells")

    if not isinstance(spells, list):
        raise GenerationError(
            "spells.json spells must be an array."
        )

    references: dict[str, dict[str, str]] = {}
    ids: set[str] = set()

    for index, spell in enumerate(spells):
        if not isinstance(spell, dict):
            raise GenerationError(
                f"spells[{index}] must be a JSON object."
            )

        key = require_string(
            spell.get("key"),
            f"spells[{index}].key",
        )
        document_id = require_id(
            spell.get("id"),
            f"spell {key!r}.id",
        )
        name = require_string(
            spell.get("name"),
            f"spell {key!r}.name",
        )
        reference_key = (
            f"boa:item.spells.{key}"
        )

        if reference_key in references:
            raise GenerationError(
                "Duplicate Spell reference: "
                f"{reference_key}"
            )
        if document_id in ids:
            raise GenerationError(
                "Duplicate Spell Foundry ID: "
                f"{document_id}"
            )

        references[reference_key] = {
            "uuid": f"Item.{document_id}",
            "name": name,
        }
        ids.add(document_id)

    return references


def resolve_spell_references(
    content: str,
    references: dict[str, dict[str, str]],
) -> str:
    def replacement(
        match: re.Match[str],
    ) -> str:
        key = match.group("key")
        label = match.group("label")
        if not key.startswith("boa:item.spells."):
            return match.group(0)
        reference = references.get(key)

        if reference is None:
            raise GenerationError(
                "Unknown Spell reference in Heroic "
                f"Class Ability description: {key}"
            )

        return (
            f"@UUID[{reference['uuid']}]"
            f"{{{label}}}"
        )

    rendered = REF_PATTERN.sub(
        replacement,
        content,
    )

    if "@Ref[boa:item.spells." in rendered:
        raise GenerationError(
            "Unresolved internal Spell reference remains "
            "in Heroic Class Ability description."
        )

    return rendered


def resolve_granted_spell_description(
    ability: dict[str, Any],
    description_html: str,
    references: dict[str, dict[str, str]],
) -> str:
    grants_spell = ability.get("grantsSpell")
    matches = [
        match
        for match in REF_PATTERN.finditer(
            description_html
        )
        if match.group("key").startswith(
            "boa:item.spells."
        )
    ]

    if grants_spell is None:
        return description_html

    spell_key = require_string(
        grants_spell,
        f"ability {ability.get('name')!r}.grantsSpell",
    )
    expected_reference = (
        f"boa:item.spells.{spell_key}"
    )

    if expected_reference not in references:
        raise GenerationError(
            f"ability {ability.get('name')!r} "
            f"grants unknown Spell {spell_key!r}."
        )

    matching = [
        match
        for match in matches
        if match.group("key")
        == expected_reference
    ]

    if (
        len(matches) != 1
        or len(matching) != 1
    ):
        raise GenerationError(
            f"ability {ability.get('name')!r} "
            "must contain exactly one symbolic "
            f"reference to {expected_reference}."
        )

    return resolve_spell_references(
        description_html,
        references,
    )


def safe_stem(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
    return stem or "Document"


def document_filename(name: str, document_id: str) -> str:
    return f"{safe_stem(name)}_{document_id}.json"


def folder_directory_name(name: str, folder_id: str) -> str:
    return f"{safe_stem(name)}_{folder_id}"


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


def build_class_folder(
    class_entry: dict[str, Any],
    parent_folder_id: str,
    sort: int,
) -> dict[str, Any]:
    key = require_string(class_entry.get("key"), "class.key")
    folder_id = require_id(
        class_entry.get("id"),
        f"class {key!r}.id",
    )
    name = require_string(
        class_entry.get("name"),
        f"class {key!r}.name",
    )

    return {
        "type": "Item",
        "folder": parent_folder_id,
        "name": name,
        "color": None,
        "sorting": "m",
        "_id": folder_id,
        "description": "",
        "sort": sort,
        "flags": generated_flags(f"class-folder.{key}"),
        "_stats": base_stats(),
    }


def build_ability_document(
    class_entry: dict[str, Any],
    ability: dict[str, Any],
    folder_id: str,
    default_image: str,
    spell_references: dict[
        str,
        dict[str, str],
    ],
    sort: int,
    external_references: dict[str, Any],
    reference_helpers: Any,
) -> dict[str, Any]:
    class_key = require_string(class_entry.get("key"), "class.key")
    ability_key = require_string(
        ability.get("key"),
        f"class {class_key!r} ability.key",
    )
    document_id = require_id(
        ability.get("id"),
        f"ability {ability_key!r}.id",
    )
    name = require_string(
        ability.get("name"),
        f"ability {ability_key!r}.name",
    )
    requirement = require_string(
        ability.get("requirement"),
        f"ability {name!r}.requirement",
    )
    wp = require_string(
        ability.get("wp", ""),
        f"ability {name!r}.wp",
        allow_empty=True,
    )
    has_paragraphs = "description" in ability
    has_html = "descriptionHtml" in ability

    if has_paragraphs == has_html:
        raise GenerationError(
            f"ability {name!r} must define exactly one of "
            "'description' or 'descriptionHtml'."
        )

    if has_html:
        description_html = require_string(
            ability.get("descriptionHtml"),
            f"ability {name!r}.descriptionHtml",
        )
    else:
        paragraphs = require_paragraphs(
            ability.get("description"),
            f"ability {name!r}.description",
        )
        description_html = paragraphs_to_html(paragraphs)

    description_html = (
        resolve_granted_spell_description(
            ability,
            description_html,
            spell_references,
        )
    )
    try:
        description_html = (
            reference_helpers.resolve_external_symbolic_references(
                description_html,
                external_references,
            )
        )
    except reference_helpers.ReferenceError as error:
        raise GenerationError(str(error)) from error

    image = require_string(
        ability.get("image", default_image),
        f"ability {name!r}.image",
    )

    flags = generated_flags(
        f"heroic-class-ability.{class_key}.{ability_key}"
    )
    grants_spell = ability.get("grantsSpell")
    if grants_spell is not None:
        grants_spell = require_string(
            grants_spell,
            f"ability {name!r}.grantsSpell",
        )
        if not re.fullmatch(
            r"[a-z0-9]+(?:-[a-z0-9]+)*",
            grants_spell,
        ):
            raise GenerationError(
                f"ability {name!r}.grantsSpell must be a "
                "lowercase kebab-case key."
            )
        flags[MODULE_ID]["grantsSpell"] = (
            f"spells.{grants_spell}"
        )

    return {
        "folder": folder_id,
        "name": name,
        "type": "ability",
        "_id": document_id,
        "img": image,
        "system": {
            "itemDescription": description_html,
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
        "flags": flags,
        "_stats": base_stats(),
        "ownership": {"default": 0},
    }


def validate_content(
    content: dict[str, Any],
) -> tuple[list[dict[str, Any]], str]:
    if content.get("schemaVersion") != 1:
        raise GenerationError(
            "heroic-class-abilities.json schemaVersion must be 1."
        )

    defaults = content.get("defaults")

    if not isinstance(defaults, dict):
        raise GenerationError(
            "heroic-class-abilities.json defaults must be a JSON object."
        )

    ability_image = require_string(
        defaults.get("abilityImage"),
        "defaults.abilityImage",
    )
    classes = content.get("classes")

    if not isinstance(classes, list) or not classes:
        raise GenerationError(
            "heroic-class-abilities.json classes must be "
            "a non-empty array."
        )

    expected = content.get("expectedCounts", {})

    if not isinstance(expected, dict):
        raise GenerationError("expectedCounts must be a JSON object.")

    ids: set[str] = set()
    class_keys: set[str] = set()
    class_names: set[str] = set()
    ability_keys: set[str] = set()
    ability_names: set[str] = set()
    ability_count = 0
    source_stub_count = 0

    for class_index, class_entry in enumerate(classes):
        if not isinstance(class_entry, dict):
            raise GenerationError(
                f"classes[{class_index}] must be a JSON object."
            )

        key = require_string(
            class_entry.get("key"),
            f"classes[{class_index}].key",
        )
        folder_id = require_id(
            class_entry.get("id"),
            f"class {key!r}.id",
        )
        name = require_string(
            class_entry.get("name"),
            f"class {key!r}.name",
        )
        status = require_string(
            class_entry.get("status"),
            f"class {name!r}.status",
        )

        if status not in {"complete", "stub"}:
            raise GenerationError(
                f"class {name!r}.status must be 'complete' or 'stub'."
            )

        if key in class_keys:
            raise GenerationError(f"Duplicate class key: {key}")
        if name in class_names:
            raise GenerationError(f"Duplicate class name: {name}")
        if folder_id in ids:
            raise GenerationError(f"Duplicate Foundry ID: {folder_id}")

        class_keys.add(key)
        class_names.add(name)
        ids.add(folder_id)

        abilities = class_entry.get("abilities")

        if not isinstance(abilities, list):
            raise GenerationError(
                f"class {name!r}.abilities must be an array."
            )

        if status == "complete" and not abilities:
            raise GenerationError(
                f"complete class {name!r} must contain abilities."
            )

        if status == "stub":
            source_stub_count += 1
            require_string(
                class_entry.get("sourceNote"),
                f"stub class {name!r}.sourceNote",
            )

            if abilities:
                raise GenerationError(
                    f"stub class {name!r} must not contain abilities."
                )

        for ability_index, ability in enumerate(abilities):
            if not isinstance(ability, dict):
                raise GenerationError(
                    f"class {name!r} ability[{ability_index}] "
                    "must be a JSON object."
                )

            ability_key = require_string(
                ability.get("key"),
                (
                    f"class {name!r} "
                    f"ability[{ability_index}].key"
                ),
            )
            ability_id = require_id(
                ability.get("id"),
                f"ability {ability_key!r}.id",
            )
            ability_name = require_string(
                ability.get("name"),
                f"ability {ability_key!r}.name",
            )
            require_string(
                ability.get("requirement"),
                f"ability {ability_name!r}.requirement",
            )
            require_string(
                ability.get("wp", ""),
                f"ability {ability_name!r}.wp",
                allow_empty=True,
            )
            has_paragraphs = "description" in ability
            has_html = "descriptionHtml" in ability

            if has_paragraphs == has_html:
                raise GenerationError(
                    f"ability {ability_name!r} must define exactly "
                    "one of 'description' or 'descriptionHtml'."
                )

            if has_html:
                require_string(
                    ability.get("descriptionHtml"),
                    f"ability {ability_name!r}.descriptionHtml",
                )
            else:
                require_paragraphs(
                    ability.get("description"),
                    f"ability {ability_name!r}.description",
                )

            if ability_key in ability_keys:
                raise GenerationError(
                    f"Duplicate ability key: {ability_key}"
                )
            if ability_name in ability_names:
                raise GenerationError(
                    f"Duplicate ability name: {ability_name}"
                )
            if ability_id in ids:
                raise GenerationError(
                    f"Duplicate Foundry ID: {ability_id}"
                )

            ability_keys.add(ability_key)
            ability_names.add(ability_name)
            ids.add(ability_id)
            ability_count += 1

    expected_classes = expected.get("classes")

    if (
        expected_classes is not None
        and expected_classes != len(classes)
    ):
        raise GenerationError(
            f"Expected {expected_classes} classes, "
            f"found {len(classes)}."
        )

    expected_abilities = expected.get("abilities")

    if (
        expected_abilities is not None
        and expected_abilities != ability_count
    ):
        raise GenerationError(
            f"Expected {expected_abilities} abilities, "
            f"found {ability_count}."
        )

    expected_stubs = expected.get("sourceStubs")

    if (
        expected_stubs is not None
        and expected_stubs != source_stub_count
    ):
        raise GenerationError(
            f"Expected {expected_stubs} source stubs, "
            f"found {source_stub_count}."
        )

    return classes, ability_image


def compare_json(path: Path, expected: dict[str, Any]) -> bool:
    if not path.is_file():
        return False

    try:
        actual = load_json(path)
    except GenerationError:
        return False

    return actual == expected


def path_is_within(path: Path, directory: Path) -> bool:
    resolved_path = path.resolve()
    resolved_directory = directory.resolve()

    return (
        resolved_path == resolved_directory
        or resolved_directory in resolved_path.parents
    )


def find_external_id_collisions(
    adventure_dir: Path,
    managed_root: Path,
    generated_ids: set[str],
) -> list[tuple[str, Path]]:
    collisions: list[tuple[str, Path]] = []

    for path in adventure_dir.joinpath("Item").rglob("*.json"):
        if path_is_within(path, managed_root):
            continue

        data = load_json(path)
        document_id = data.get("_id")

        if document_id in generated_ids:
            collisions.append((str(document_id), path))

    return collisions


def existing_managed_files(managed_root: Path) -> set[Path]:
    root_folder_file = managed_root / "_Folder.json"

    return {
        path.resolve()
        for path in managed_root.rglob("*.json")
        if path.resolve() != root_folder_file.resolve()
    }


def write_generated_files(
    generated: Sequence[GeneratedFile],
    managed_root: Path,
    check: bool,
) -> list[str]:
    problems: list[str] = []
    expected_paths = {
        entry.path.resolve()
        for entry in generated
    }
    existing_paths = existing_managed_files(managed_root)
    stale_paths = sorted(existing_paths - expected_paths)

    if check:
        for stale in stale_paths:
            problems.append(
                f"Stale generated document or folder: {stale}"
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

    directories = sorted(
        (
            path
            for path in managed_root.rglob("*")
            if path.is_dir()
        ),
        key=lambda path: len(path.parts),
        reverse=True,
    )

    for directory in directories:
        try:
            directory.rmdir()
        except OSError:
            pass

    return problems


def replace_managed_paths(
    existing_values: Sequence[Any],
    is_managed: Callable[[str], bool],
    generated_values: Sequence[str],
    *,
    default_insertion_index: int | None = None,
) -> list[str]:
    values: list[str] = []

    for index, value in enumerate(existing_values):
        if not isinstance(value, str):
            raise GenerationError(
                f"Adventure path array value [{index}] "
                "must be a string."
            )
        values.append(value)

    first_managed = next(
        (
            index
            for index, value in enumerate(values)
            if is_managed(value)
        ),
        None,
    )

    unmanaged = [
        value
        for value in values
        if not is_managed(value)
    ]

    if first_managed is None:
        insertion_index = (
            len(unmanaged)
            if default_insertion_index is None
            else default_insertion_index
        )
    else:
        insertion_index = sum(
            1
            for value in values[:first_managed]
            if not is_managed(value)
        )

    insertion_index = max(
        0,
        min(insertion_index, len(unmanaged)),
    )

    return (
        unmanaged[:insertion_index]
        + list(generated_values)
        + unmanaged[insertion_index:]
    )


def main() -> int:
    args = parse_args()

    try:
        content = load_json(args.content)
        classes, ability_image = validate_content(content)
        spell_references = load_spell_references(
            args.spells_content
        )
        repo_root = Path(__file__).resolve().parents[1]
        reference_helpers = load_reference_helpers(
            repo_root
        )
        external_references = (
            reference_helpers.load_external_reference_targets(
                repo_root
            )
        )

        adventure_file = find_single_file(
            args.pack_root,
            "_Adventure.json",
        )
        adventure_dir = adventure_file.parent
        adventure = load_json(adventure_file)

        heroic_dir, heroic_folder_id = find_item_folder(
            adventure_dir,
            "Heroic Class Abilities",
        )

        generated: list[GeneratedFile] = []
        generated_ids: set[str] = set()
        class_folder_paths: list[str] = []
        ability_paths: list[str] = []

        for class_index, class_entry in enumerate(classes):
            class_folder = build_class_folder(
                class_entry,
                heroic_folder_id,
                (class_index + 1) * 100000,
            )
            class_dir = heroic_dir / folder_directory_name(
                class_folder["name"],
                class_folder["_id"],
            )
            class_folder_path = class_dir / "_Folder.json"

            generated.append(
                GeneratedFile(
                    class_folder_path,
                    class_folder,
                )
            )
            generated_ids.add(class_folder["_id"])
            class_folder_paths.append(
                class_folder_path
                .relative_to(adventure_dir)
                .as_posix()
            )

            for ability_index, ability in enumerate(
                class_entry["abilities"]
            ):
                ability_document = build_ability_document(
                    class_entry,
                    ability,
                    class_folder["_id"],
                    ability_image,
                    spell_references,
                    (ability_index + 1) * 100000,
                    external_references=external_references,
                    reference_helpers=reference_helpers,
                )
                ability_path = class_dir / document_filename(
                    ability_document["name"],
                    ability_document["_id"],
                )

                generated.append(
                    GeneratedFile(
                        ability_path,
                        ability_document,
                    )
                )
                generated_ids.add(ability_document["_id"])
                ability_paths.append(
                    ability_path
                    .relative_to(adventure_dir)
                    .as_posix()
                )

        collisions = find_external_id_collisions(
            adventure_dir,
            heroic_dir,
            generated_ids,
        )

        if collisions:
            details = "\n".join(
                f"  {document_id}: {path}"
                for document_id, path in collisions
            )
            raise GenerationError(
                "Generated Foundry IDs collide with documents "
                f"outside Heroic Class Abilities:\n{details}"
            )

        heroic_relative = (
            heroic_dir.relative_to(adventure_dir).as_posix()
        )
        heroic_prefix = heroic_relative + "/"
        parent_folder_path = (
            heroic_dir
            .joinpath("_Folder.json")
            .relative_to(adventure_dir)
            .as_posix()
        )

        def managed_item_path(value: str) -> bool:
            return value.startswith(heroic_prefix)

        def managed_nested_folder_path(value: str) -> bool:
            return (
                value.startswith(heroic_prefix)
                and value != parent_folder_path
            )

        existing_folders = adventure.get("folders", [])

        if not isinstance(existing_folders, list):
            raise GenerationError(
                "_Adventure.json folders must be an array."
            )

        try:
            parent_folder_index = existing_folders.index(
                parent_folder_path
            )
        except ValueError as exc:
            raise GenerationError(
                "The Heroic Class Abilities parent folder is not "
                "referenced by _Adventure.json."
            ) from exc

        expected_adventure = dict(adventure)
        expected_adventure["items"] = replace_managed_paths(
            adventure.get("items", []),
            managed_item_path,
            ability_paths,
        )
        expected_adventure["folders"] = replace_managed_paths(
            existing_folders,
            managed_nested_folder_path,
            class_folder_paths,
            default_insertion_index=parent_folder_index + 1,
        )

        problems = write_generated_files(
            generated,
            heroic_dir,
            args.check,
        )

        if args.check:
            if not compare_json(
                adventure_file,
                expected_adventure,
            ):
                problems.append(
                    f"Out-of-date Adventure manifest: "
                    f"{adventure_file}"
                )

            if problems:
                print(
                    "Generated Heroic Class Ability content "
                    "is not up to date:",
                    file=sys.stderr,
                )

                for problem in problems:
                    print(f"- {problem}", file=sys.stderr)

                return 1

            stub_count = sum(
                1
                for class_entry in classes
                if class_entry["status"] == "stub"
            )
            print(
                "Heroic Class Ability content is up to date: "
                f"{len(classes)} class folders, "
                f"{len(ability_paths)} abilities, "
                f"{stub_count} source stubs."
            )
            return 0

        adventure_file.write_text(
            dump_json(expected_adventure),
            encoding="utf-8",
        )

        stub_count = sum(
            1
            for class_entry in classes
            if class_entry["status"] == "stub"
        )
        print(
            "Generated "
            f"{len(classes)} Heroic Class Ability folders and "
            f"{len(ability_paths)} abilities."
        )
        if stub_count:
            print(
                f"Skipped {stub_count} incomplete source classes; "
                "their class folders were still generated."
            )
        print(f"Updated {adventure_file}")
        return 0

    except GenerationError as exc:
        print(
            f"generate-heroic-class-abilities.py: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
