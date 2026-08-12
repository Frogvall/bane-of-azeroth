#!/usr/bin/env python3
"""Shared symbolic-reference validation and resolution helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import re
from typing import Mapping


REFERENCE_PATTERN = re.compile(
    r"@Ref\[(?P<key>[^\]]+)\]\{(?P<label>[^}]*)\}"
)
DISPLAY_REFERENCE_PATTERN = re.compile(
    r"@DisplayRef\[(?P<key>[^\]]+)\]\{(?P<label>[^}]*)\}"
)
FOUNDRY_UUID_PATTERN = re.compile(
    r"^(?P<document_type>[A-Za-z][A-Za-z0-9]*)"
    r"\.[A-Za-z0-9]{16}"
    r"(?:\.[A-Za-z][A-Za-z0-9]*\.[A-Za-z0-9]{16})?"
    r"(?:#[^\s\]]+)?$"
)


class ReferenceError(ValueError):
    """Raised when reference source data is invalid or unresolved."""


@dataclass(frozen=True)
class ReferenceTarget:
    key: str
    uuid: str
    document_type: str
    source: str | None = None


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ReferenceError(f"Missing reference source file: {path}") from error
    except json.JSONDecodeError as error:
        raise ReferenceError(
            f"Invalid JSON in {path}: {error}"
        ) from error


def _expect_object(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ReferenceError(f"{label} must be a JSON object.")
    return value


def resolved_document_type(
    uuid: str,
) -> str:
    document_uuid = uuid.split(
        "#",
        1,
    )[0]
    parts = document_uuid.split(".")
    if (
        len(parts) < 2
        or len(parts) % 2 != 0
    ):
        raise ReferenceError(
            f"Invalid Foundry document UUID: {uuid}"
        )
    return parts[-2]


def validate_reference_sources(
    compatibility: object,
    external_sources: object,
    external_references: object,
) -> dict[str, ReferenceTarget]:
    compatibility_root = _expect_object(
        compatibility,
        "Compatibility manifest",
    )
    source_root = _expect_object(
        external_sources,
        "External source registry",
    )
    reference_root = _expect_object(
        external_references,
        "External reference registry",
    )

    if compatibility_root.get("schemaVersion") != 1:
        raise ReferenceError(
            "Compatibility manifest schemaVersion must be 1."
        )
    if source_root.get("schemaVersion") != 1:
        raise ReferenceError(
            "External source registry schemaVersion must be 1."
        )
    if reference_root.get("schemaVersion") != 1:
        raise ReferenceError(
            "External reference registry schemaVersion must be 1."
        )

    verified = _expect_object(
        compatibility_root.get("verifiedEnvironment"),
        "verifiedEnvironment",
    )
    modules = _expect_object(
        verified.get("modules"),
        "verifiedEnvironment.modules",
    )
    sources = _expect_object(
        source_root.get("sources"),
        "sources",
    )
    references = _expect_object(
        reference_root.get("references"),
        "references",
    )

    for forbidden_key in ("testedVersion", "verifiedVersion", "version"):
        if forbidden_key in source_root:
            raise ReferenceError(
                f"External source registry must not define {forbidden_key}; "
                "verified versions belong in compatibility.json."
            )
        if forbidden_key in reference_root:
            raise ReferenceError(
                f"External reference registry must not define {forbidden_key}; "
                "verified versions belong in compatibility.json."
            )

    for source_key, raw_source in sources.items():
        if not isinstance(source_key, str) or not source_key:
            raise ReferenceError(
                "External source keys must be non-empty strings."
            )
        source = _expect_object(
            raw_source,
            f"External source {source_key}",
        )
        package_id = source.get("packageId")
        package_type = source.get("packageType")
        if not isinstance(package_id, str) or not package_id:
            raise ReferenceError(
                f"External source {source_key} must define packageId."
            )
        if package_type not in {"module", "system"}:
            raise ReferenceError(
                f"External source {source_key} has invalid packageType."
            )
        if package_type == "module" and package_id not in modules:
            raise ReferenceError(
                f"External source {source_key} uses module {package_id}, "
                "which is absent from compatibility.json."
            )
        for forbidden_key in (
            "testedVersion",
            "verifiedVersion",
            "version",
        ):
            if forbidden_key in source:
                raise ReferenceError(
                    f"External source {source_key} must not define "
                    f"{forbidden_key}; use compatibility.json."
                )

    resolved: dict[str, ReferenceTarget] = {}
    seen_uuids: dict[str, str] = {}

    for key, raw_reference in references.items():
        if not isinstance(key, str) or not key:
            raise ReferenceError(
                "External reference keys must be non-empty strings."
            )
        reference = _expect_object(
            raw_reference,
            f"External reference {key}",
        )
        source_key = reference.get("source")
        uuid = reference.get("uuid")
        document_type = reference.get("documentType")

        if source_key not in sources:
            raise ReferenceError(
                f"External reference {key} uses unknown source "
                f"{source_key!r}."
            )
        if not isinstance(uuid, str) or not FOUNDRY_UUID_PATTERN.fullmatch(uuid):
            raise ReferenceError(
                f"External reference {key} has invalid Foundry UUID {uuid!r}."
            )
        if not isinstance(document_type, str) or not document_type:
            raise ReferenceError(
                f"External reference {key} must define documentType."
            )

        resolved_type = resolved_document_type(
            uuid
        )
        if resolved_type != document_type:
            raise ReferenceError(
                f"External reference {key} declares "
                f"{document_type}, but its UUID resolves "
                f"to {resolved_type}."
            )

        for forbidden_key in (
            "testedVersion",
            "verifiedVersion",
            "version",
        ):
            if forbidden_key in reference:
                raise ReferenceError(
                    f"External reference {key} must not define "
                    f"{forbidden_key}; use compatibility.json."
                )

        duplicate_key = seen_uuids.get(uuid)
        if duplicate_key is not None:
            raise ReferenceError(
                f"External references {duplicate_key} and {key} "
                f"share UUID {uuid}."
            )
        seen_uuids[uuid] = key

        resolved[key] = ReferenceTarget(
            key=key,
            uuid=uuid,
            document_type=document_type,
            source=str(source_key),
        )

    return resolved



def load_internal_adventure_reference_targets(
    adventure_directory: Path,
) -> dict[str, ReferenceTarget]:
    """Build symbolic Actor/Item/RollTable targets from managed Adventure content keys."""
    resolved: dict[str, ReferenceTarget] = {}
    seen_uuids: dict[str, str] = {}

    for document_type, prefix in (
        ("Actor", "boa:actor."),
        ("Item", "boa:item."),
        ("RollTable", "boa:table."),
    ):
        directory = (
            adventure_directory
            / document_type
        )

        if not directory.is_dir():
            continue

        for path in sorted(
            directory.rglob(
                "*.json"
            )
        ):
            if path.name == "_Folder.json":
                continue

            raw = load_json(
                path
            )

            if not isinstance(
                raw,
                dict,
            ):
                continue

            document_id = raw.get(
                "_id"
            )
            flags = raw.get(
                "flags"
            )
            module_flags = (
                flags.get(
                    "bane-of-azeroth"
                )
                if isinstance(
                    flags,
                    dict,
                )
                else None
            )
            content_key = (
                module_flags.get(
                    "contentKey"
                )
                if isinstance(
                    module_flags,
                    dict,
                )
                else None
            )

            if (
                not isinstance(
                    document_id,
                    str,
                )
                or not isinstance(
                    content_key,
                    str,
                )
                or not content_key
            ):
                continue

            key = (
                prefix
                + content_key
            )
            uuid = (
                f"{document_type}."
                f"{document_id}"
            )

            if key in resolved:
                raise ReferenceError(
                    "Duplicate internal Adventure reference key: "
                    f"{key}"
                )

            duplicate_key = (
                seen_uuids.get(
                    uuid
                )
            )

            if duplicate_key is not None:
                raise ReferenceError(
                    "Internal Adventure references "
                    f"{duplicate_key} and {key} share UUID {uuid}."
                )

            resolved[
                key
            ] = ReferenceTarget(
                key=key,
                uuid=uuid,
                document_type=
                    document_type,
            )
            seen_uuids[
                uuid
            ] = key

    return resolved


def load_internal_journal_reference_targets(
    repo_root: Path,
) -> dict[str, ReferenceTarget]:
    """Build JournalEntry/Page targets from curated source IDs and keys."""
    source_root = (
        repo_root
        / "foundry"
        / "content"
        / "journals"
    )
    resolved: dict[str, ReferenceTarget] = {}

    for journal_path in sorted(
        source_root.glob(
            "*/journal.json"
        )
    ):
        journal = load_json(
            journal_path
        )

        if not isinstance(
            journal,
            dict,
        ):
            continue

        journal_key = journal.get(
            "key"
        )
        journal_id = journal.get(
            "id"
        )

        if (
            not isinstance(
                journal_key,
                str,
            )
            or not isinstance(
                journal_id,
                str,
            )
        ):
            continue

        journal_reference_key = (
            f"boa:journal."
            f"{journal_key}"
        )

        resolved[
            journal_reference_key
        ] = ReferenceTarget(
            key=
                journal_reference_key,
            uuid=(
                f"JournalEntry."
                f"{journal_id}"
            ),
            document_type=
                "JournalEntry",
        )

        for page_path in sorted(
            candidate
            for candidate
            in journal_path.parent.glob(
                "*.json"
            )
            if candidate.name
            != "journal.json"
        ):
            page = load_json(
                page_path
            )

            if not isinstance(
                page,
                dict,
            ):
                continue

            page_key = page.get(
                "key"
            )
            page_id = page.get(
                "id"
            )

            if (
                not isinstance(
                    page_key,
                    str,
                )
                or not isinstance(
                    page_id,
                    str,
                )
            ):
                continue

            reference_key = (
                "boa:journal-page."
                f"{journal_key}."
                f"{page_key}"
            )

            if reference_key in resolved:
                raise ReferenceError(
                    "Duplicate internal Journal reference key: "
                    f"{reference_key}"
                )

            resolved[
                reference_key
            ] = ReferenceTarget(
                key=reference_key,
                uuid=(
                    f"JournalEntry."
                    f"{journal_id}."
                    "JournalEntryPage."
                    f"{page_id}"
                ),
                document_type=
                    "JournalEntryPage",
            )

    return resolved


def split_reference_key(
    key: str,
) -> tuple[str, str | None]:
    base_key, separator, anchor = (
        key.partition(
            "#"
        )
    )

    if not separator:
        return key, None

    if not base_key or not anchor:
        raise ReferenceError(
            f"Invalid anchored symbolic reference key: {key}"
        )

    return (
        base_key,
        anchor,
    )


def resolved_reference_uuid(
    target: ReferenceTarget,
    anchor: str | None,
) -> str:
    if anchor is None:
        return target.uuid

    if "#" in target.uuid:
        raise ReferenceError(
            "Cannot append an anchor to an already anchored "
            f"reference target: {target.key}"
        )

    return (
        target.uuid
        + "#"
        + anchor
    )


def combined_reference_targets(
    internal_references: Mapping[str, ReferenceTarget],
    external_references: Mapping[str, ReferenceTarget],
) -> dict[str, ReferenceTarget]:
    duplicate_keys = set(internal_references) & set(external_references)
    if duplicate_keys:
        raise ReferenceError(
            "Reference keys exist in both internal and external registries: "
            + ", ".join(sorted(duplicate_keys))
        )

    return {
        **dict(internal_references),
        **dict(external_references),
    }


def resolve_symbolic_references(
    text: str,
    *,
    internal_references: Mapping[str, ReferenceTarget],
    external_references: Mapping[str, ReferenceTarget],
) -> str:
    targets = combined_reference_targets(
        internal_references,
        external_references,
    )

    def resolve_uuid(
        match: re.Match[str],
    ) -> str:
        key = match.group(
            "key"
        )
        label = match.group(
            "label"
        )
        base_key, anchor = (
            split_reference_key(
                key
            )
        )
        target = targets.get(
            base_key
        )

        if target is None:
            raise ReferenceError(
                f"Unknown symbolic reference key: {key}"
            )

        uuid = resolved_reference_uuid(
            target,
            anchor,
        )

        return (
            f"@UUID[{uuid}]"
            f"{{{label}}}"
        )

    def resolve_table(
        match: re.Match[str],
    ) -> str:
        key = match.group(
            "key"
        )
        label = match.group(
            "label"
        )
        base_key, anchor = (
            split_reference_key(
                key
            )
        )

        if anchor is not None:
            raise ReferenceError(
                "@DisplayRef does not support anchors: "
                f"{key}"
            )

        target = targets.get(
            base_key
        )

        if target is None:
            raise ReferenceError(
                "Unknown symbolic display-table reference key: "
                f"{key}"
            )

        if (
            target.document_type
            != "RollTable"
        ):
            raise ReferenceError(
                f"Display reference {key} targets "
                f"{target.document_type}, not RollTable."
            )

        return (
            f"@DisplayTable[{target.uuid}]"
            f"{{{label}}}"
        )

    resolved = (
        DISPLAY_REFERENCE_PATTERN.sub(
            resolve_table,
            text,
        )
    )

    return REFERENCE_PATTERN.sub(
        resolve_uuid,
        resolved,
    )


def resolve_external_symbolic_references(
    text: str,
    external_references: Mapping[str, ReferenceTarget],
) -> str:
    # Resolve @Ref entries using only the validated external registry.
    return resolve_symbolic_references(
        text,
        internal_references={},
        external_references=external_references,
    )


def load_external_reference_targets(
    repo_root: Path,
) -> dict[str, ReferenceTarget]:
    config_root = (
        repo_root
        / "foundry"
        / "config"
    )
    compatibility = load_json(
        config_root / "compatibility.json"
    )
    sources = load_json(
        config_root
        / "references"
        / "external-sources.json"
    )
    references = load_json(
        config_root
        / "references"
        / "external-references.json"
    )
    return validate_reference_sources(
        compatibility,
        sources,
        references,
    )
