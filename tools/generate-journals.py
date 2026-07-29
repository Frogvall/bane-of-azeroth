#!/usr/bin/env python3
"""Generate Bane of Azeroth JournalEntries from structured source."""

from __future__ import annotations

import argparse
from difflib import unified_diff
import html
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile


MODULE_ID = "bane-of-azeroth"
GENERATOR_NAME = "tools/generate-journals.py"

JOURNAL_FOLDER_ID = "BoAJournals00001"
JOURNAL_FOLDER_NAME = "Bane of Azeroth"
JOURNAL_FOLDER_COLOR = "#0000ff"

ADVENTURE_DIRECTORY_NAME = (
    "Bane_of_Azeroth_ZoNOXZjdkOjV56e3"
)
JOURNAL_FOLDER_DIRECTORY = (
    f"Bane_of_Azeroth_{JOURNAL_FOLDER_ID}"
)

ID_PATTERN = re.compile(r"^[A-Za-z0-9]{16}$")
REF_PATTERN = re.compile(
    r"@(?P<display>Display)?Ref"
    r"\[(?P<key>[^\]]+)\]"
    r"\{(?P<label>[^}]*)\}"
)
MARKDOWN_LINK_PATTERN = re.compile(
    r"\[(?P<label>[^\]]+)\]"
    r"\((?P<href>[^)]+)\)"
)


class GenerationError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-directory",
        type=Path,
        default=(
            repo_root
            / "foundry"
            / "content"
            / "journals"
        ),
    )
    parser.add_argument(
        "--adventure-directory",
        type=Path,
        default=(
            repo_root
            / "foundry"
            / "pack-src"
            / "bane-of-azeroth"
            / ADVENTURE_DIRECTORY_NAME
        ),
    )
    parser.add_argument(
        "--check",
        action="store_true",
    )
    return parser.parse_args()


def read_json(path: Path) -> object:
    try:
        return json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )
    except FileNotFoundError as error:
        raise GenerationError(
            f"Missing JSON source: {path}"
        ) from error
    except json.JSONDecodeError as error:
        raise GenerationError(
            f"Invalid JSON in {path}: {error}"
        ) from error


def base_stats(
    *,
    duplicate_source: str | None = None,
) -> dict[str, object]:
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


def safe_filename(
    name: str,
    document_id: str,
) -> str:
    stem = re.sub(
        r"[^A-Za-z0-9]+",
        "_",
        name,
    ).strip("_")
    return f"{stem}_{document_id}.json"


def validate_id(
    value: object,
    label: str,
) -> str:
    if (
        not isinstance(value, str)
        or not ID_PATTERN.fullmatch(value)
    ):
        raise GenerationError(
            f"{label} must be a 16-character "
            "alphanumeric Foundry ID."
        )
    return value


def source_documents(
    source_directory: Path,
) -> list[dict[str, object]]:
    if not source_directory.is_dir():
        raise GenerationError(
            f"Missing journal source directory: "
            f"{source_directory}"
        )

    paths = sorted(
        source_directory.glob("*.json")
    )
    if not paths:
        raise GenerationError(
            "Journal source directory contains "
            "no JSON documents."
        )

    documents: list[dict[str, object]] = []
    seen_keys: set[str] = set()
    seen_ids: set[str] = set()
    seen_page_keys: set[str] = set()
    seen_page_ids: set[str] = set()

    for path in paths:
        source = read_json(path)
        if not isinstance(source, dict):
            raise GenerationError(
                f"Journal source must be an object: "
                f"{path}"
            )
        if source.get("schemaVersion") != 1:
            raise GenerationError(
                f"Unsupported journal schema in {path}."
            )

        key = source.get("key")
        name = source.get("name")
        document_id = validate_id(
            source.get("id"),
            f"{path}: id",
        )
        enabled = source.get("enabled")
        pages = source.get("pages")

        if not isinstance(key, str) or not key:
            raise GenerationError(
                f"{path}: key must be a non-empty string."
            )
        if not isinstance(name, str) or not name:
            raise GenerationError(
                f"{path}: name must be a non-empty string."
            )
        if not isinstance(enabled, bool):
            raise GenerationError(
                f"{path}: enabled must be boolean."
            )
        if not isinstance(pages, list):
            raise GenerationError(
                f"{path}: pages must be an array."
            )
        if key in seen_keys:
            raise GenerationError(
                f"Duplicate JournalEntry key: {key}"
            )
        if document_id in seen_ids:
            raise GenerationError(
                f"Duplicate JournalEntry ID: {document_id}"
            )

        seen_keys.add(key)
        seen_ids.add(document_id)

        for page in pages:
            if not isinstance(page, dict):
                raise GenerationError(
                    f"{path}: each page must be an object."
                )
            page_key = page.get("key")
            page_id = validate_id(
                page.get("id"),
                f"{path}: page id",
            )
            qualified_page_key = (
                f"{key}.{page_key}"
            )

            if (
                not isinstance(page_key, str)
                or not page_key
            ):
                raise GenerationError(
                    f"{path}: page key must be "
                    "a non-empty string."
                )
            if qualified_page_key in seen_page_keys:
                raise GenerationError(
                    "Duplicate JournalEntryPage key: "
                    f"{qualified_page_key}"
                )
            if page_id in seen_page_ids:
                raise GenerationError(
                    "Duplicate JournalEntryPage ID: "
                    f"{page_id}"
                )

            seen_page_keys.add(
                qualified_page_key
            )
            seen_page_ids.add(page_id)

        documents.append(source)

    required = {
        "credits",
        "player-options",
        "appendices",
        "foundry-vtt-guide",
    }
    actual = {
        str(document["key"])
        for document in documents
    }
    if actual != required:
        raise GenerationError(
            "Journal source keys must be exactly: "
            + ", ".join(sorted(required))
        )

    return sorted(
        documents,
        key=lambda document: (
            int(document.get("sort", 0)),
            str(document["key"]),
        ),
    )


def build_internal_references(
    documents: list[dict[str, object]],
) -> dict[str, dict[str, str]]:
    references: dict[str, dict[str, str]] = {}

    for document in documents:
        key = str(document["key"])
        document_id = str(document["id"])
        references[f"boa:journal.{key}"] = {
            "uuid": f"JournalEntry.{document_id}",
            "documentType": "JournalEntry",
        }

        for page in document["pages"]:
            page_key = str(page["key"])
            page_id = str(page["id"])
            references[
                f"boa:journal-page.{key}.{page_key}"
            ] = {
                "uuid": (
                    f"JournalEntry.{document_id}."
                    f"JournalEntryPage.{page_id}"
                ),
                "documentType": "JournalEntryPage",
            }

    return references


def load_external_references(
    repo_root: Path,
) -> dict[str, dict[str, str]]:
    path = (
        repo_root
        / "foundry"
        / "config"
        / "references"
        / "external-references.json"
    )
    source = read_json(path)
    if not isinstance(source, dict):
        raise GenerationError(
            f"External reference registry must "
            f"be an object: {path}"
        )
    references = source.get("references")
    if not isinstance(references, dict):
        raise GenerationError(
            f"External reference registry has no "
            f"references object: {path}"
        )

    validated: dict[str, dict[str, str]] = {}
    for key, value in references.items():
        if (
            not isinstance(key, str)
            or not isinstance(value, dict)
        ):
            raise GenerationError(
                f"Invalid external reference in {path}."
            )
        uuid = value.get("uuid")
        document_type = value.get("documentType")
        if (
            not isinstance(uuid, str)
            or not uuid
            or not isinstance(document_type, str)
            or not document_type
        ):
            raise GenerationError(
                f"External reference {key} is incomplete."
            )
        validated[key] = {
            "uuid": uuid,
            "documentType": document_type,
        }

    return validated


def resolve_references(
    content: str,
    references: dict[str, dict[str, str]],
) -> str:
    def replacement(
        match: re.Match[str],
    ) -> str:
        key = match.group("key")
        label = match.group("label")
        reference = references.get(key)
        if reference is None:
            raise GenerationError(
                f"Unknown symbolic reference: {key}"
            )

        uuid = reference["uuid"]
        if match.group("display"):
            if (
                reference["documentType"]
                != "RollTable"
            ):
                raise GenerationError(
                    "@DisplayRef requires a RollTable "
                    f"reference, but {key} is "
                    f"{reference['documentType']}."
                )
            return (
                f"@DisplayTable[{uuid}]"
                f"{{{label}}}"
            )

        return f"@UUID[{uuid}]{{{label}}}"

    rendered = REF_PATTERN.sub(
        replacement,
        content,
    )
    if "@Ref[" in rendered or "@DisplayRef[" in rendered:
        raise GenerationError(
            "Unresolved symbolic reference remains."
        )
    return rendered


def markdown_inline(text: str) -> str:
    result: list[str] = []
    cursor = 0

    for match in MARKDOWN_LINK_PATTERN.finditer(text):
        result.append(
            html.escape(
                text[cursor:match.start()]
            )
        )
        label = html.escape(
            match.group("label")
        )
        href = html.escape(
            match.group("href"),
            quote=True,
        )
        result.append(
            f'<a href="{href}">{label}</a>'
        )
        cursor = match.end()

    result.append(
        html.escape(text[cursor:])
    )
    return "".join(result)


def extract_homebrewery_section(
    repo_root: Path,
    source: dict[str, object],
) -> str:
    relative_path = source.get("path")
    start_marker = source.get("start")
    end_marker = source.get("end")
    prepend_html = source.get(
        "prependHtml",
        "",
    )

    if (
        not isinstance(relative_path, str)
        or not isinstance(start_marker, str)
        or not isinstance(end_marker, str)
        or not isinstance(prepend_html, str)
    ):
        raise GenerationError(
            "homebrewery-section source is incomplete."
        )

    path = repo_root / relative_path
    try:
        markdown = path.read_text(
            encoding="utf-8",
        )
    except FileNotFoundError as error:
        raise GenerationError(
            f"Missing Homebrewery source: {path}"
        ) from error

    start = markdown.find(start_marker)
    if start < 0:
        raise GenerationError(
            f"Start marker not found in {path}: "
            f"{start_marker}"
        )
    end = markdown.find(
        end_marker,
        start + len(start_marker),
    )
    if end < 0:
        raise GenerationError(
            f"End marker not found in {path}: "
            f"{end_marker}"
        )

    section = markdown[start:end]
    section = re.sub(
        r"<br\s*/?>",
        " ",
        section,
        flags=re.IGNORECASE,
    )
    lines = section.splitlines()

    output: list[str] = []
    if prepend_html:
        output.append(prepend_html)

    paragraph: list[str] = []

    def flush_paragraph() -> None:
        if not paragraph:
            return
        text = " ".join(
            part.strip()
            for part in paragraph
            if part.strip()
        )
        paragraph.clear()
        if text:
            output.append(
                f"<p>{markdown_inline(text)}</p>"
            )

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            flush_paragraph()
            continue

        if (
            line.startswith("{{")
            or line.startswith("{")
            or line == ":"
        ):
            flush_paragraph()
            continue

        heading = re.fullmatch(
            r"###\s+(.+?)\s*:?\s*",
            line,
        )
        if heading:
            flush_paragraph()
            title = heading.group(1).rstrip(":")
            output.append(
                f"<h4>{html.escape(title.upper())}</h4>"
            )
            continue

        paragraph.append(line)

    flush_paragraph()

    rendered = "".join(output)
    if "{{" in rendered or "\\page" in rendered:
        raise GenerationError(
            "Homebrewery directives leaked into "
            "generated Journal HTML."
        )
    return rendered


def render_page_content(
    repo_root: Path,
    page: dict[str, object],
    references: dict[str, dict[str, str]],
) -> str:
    source = page.get("source")
    if not isinstance(source, dict):
        raise GenerationError(
            f"Page {page.get('key')} has no source."
        )

    source_type = source.get("type")
    if source_type == "homebrewery-section":
        content = extract_homebrewery_section(
            repo_root,
            source,
        )
    elif source_type == "html":
        content = source.get("content")
        if not isinstance(content, str):
            raise GenerationError(
                "HTML page source must have "
                "string content."
            )
    else:
        raise GenerationError(
            f"Unsupported page source type: "
            f"{source_type!r}"
        )

    return resolve_references(
        content,
        references,
    )


def render_page(
    repo_root: Path,
    document: dict[str, object],
    page: dict[str, object],
    references: dict[str, dict[str, str]],
) -> dict[str, object]:
    title = page.get("title")
    if not isinstance(title, dict):
        raise GenerationError(
            f"Page {page.get('key')} has no title object."
        )
    show = title.get("show")
    level = title.get("level")
    if not isinstance(show, bool):
        raise GenerationError(
            "Page title.show must be boolean."
        )
    if not isinstance(level, int) or not 1 <= level <= 6:
        raise GenerationError(
            "Page title.level must be 1 through 6."
        )

    page_id = str(page["id"])
    content = render_page_content(
        repo_root,
        page,
        references,
    )

    return {
        "sort": int(page.get("sort", 0)),
        "name": str(page["name"]),
        "type": "text",
        "_id": page_id,
        "title": {
            "show": show,
            "level": level,
        },
        "image": {},
        "text": {
            "format": 1,
            "content": content,
            "markdown": "",
        },
        "video": {
            "controls": True,
            "volume": 0.5,
        },
        "src": None,
        "system": {},
        "ownership": {
            "default": -1,
        },
        "flags": {
            MODULE_ID: {
                "generatedBy": GENERATOR_NAME,
                "contentKey": (
                    "journal-page."
                    f"{document['key']}."
                    f"{page['key']}"
                ),
            },
        },
        "_stats": base_stats(),
        "category": None,
    }


def render_document(
    repo_root: Path,
    document: dict[str, object],
    references: dict[str, dict[str, str]],
) -> dict[str, object]:
    document_id = str(document["id"])

    pages = [
        render_page(
            repo_root,
            document,
            page,
            references,
        )
        for page in sorted(
            document["pages"],
            key=lambda page: (
                int(page.get("sort", 0)),
                str(page["key"]),
            ),
        )
    ]

    return {
        "_key": f"!journal!{document_id}",
        "_id": document_id,
        "folder": JOURNAL_FOLDER_ID,
        "name": str(document["name"]),
        "pages": pages,
        "ownership": {
            "default": 0,
        },
        "flags": {
            MODULE_ID: {
                "generatedBy": GENERATOR_NAME,
                "contentKey": (
                    f"journal.{document['key']}"
                ),
            },
        },
        "_stats": base_stats(
            duplicate_source=(
                f"JournalEntry.{document_id}"
            ),
        ),
        "categories": [],
    }


def render_folder() -> dict[str, object]:
    return {
        "type": "JournalEntry",
        "folder": None,
        "name": JOURNAL_FOLDER_NAME,
        "color": JOURNAL_FOLDER_COLOR,
        "sorting": "a",
        "_id": JOURNAL_FOLDER_ID,
        "description": "",
        "sort": 0,
        "flags": {
            MODULE_ID: {
                "generatedBy": GENERATOR_NAME,
                "contentKey": (
                    "journals.folder.bane-of-azeroth"
                ),
            },
        },
        "_stats": base_stats(
            duplicate_source=(
                f"Folder.{JOURNAL_FOLDER_ID}"
            ),
        ),
    }


def locate_json_array(
    source: str,
    key: str,
) -> tuple[int, int, str]:
    key_match = re.search(
        rf'(?m)^(?P<indent>\s*)'
        rf'"{re.escape(key)}"\s*:\s*\[',
        source,
    )
    if key_match is None:
        raise GenerationError(
            f"Adventure has no {key!r} array."
        )

    array_start = source.find(
        "[",
        key_match.start(),
    )
    if array_start < 0:
        raise GenerationError(
            f"Could not locate Adventure {key!r} array."
        )

    in_string = False
    escaped = False
    depth = 0

    for index in range(
        array_start,
        len(source),
    ):
        character = source[index]

        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue

        if character == '"':
            in_string = True
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return (
                    array_start,
                    index + 1,
                    key_match.group("indent"),
                )

    raise GenerationError(
        f"Adventure {key!r} array is unterminated."
    )


def render_array(
    values: list[str],
    indent: str,
) -> str:
    if not values:
        return "[]"

    item_indent = indent + "  "
    rendered = ",\n".join(
        f"{item_indent}"
        + json.dumps(
            value,
            ensure_ascii=False,
        )
        for value in values
    )
    return "[\n" + rendered + "\n" + indent + "]"


def replace_adventure_array(
    source: str,
    key: str,
    values: list[str],
) -> str:
    start, end, indent = locate_json_array(
        source,
        key,
    )
    return (
        source[:start]
        + render_array(values, indent)
        + source[end:]
    )


def journal_relative_path(
    document: dict[str, object],
) -> str:
    filename = safe_filename(
        str(document["name"]),
        str(document["id"]),
    )
    return (
        "JournalEntry/"
        f"{JOURNAL_FOLDER_DIRECTORY}/"
        f"{filename}"
    )


def folder_relative_path() -> str:
    return (
        "JournalEntry/"
        f"{JOURNAL_FOLDER_DIRECTORY}/"
        "_Folder.json"
    )


def render_adventure(
    adventure_path: Path,
    documents: list[dict[str, object]],
) -> str:
    try:
        original = adventure_path.read_text(
            encoding="utf-8",
        )
    except FileNotFoundError as error:
        raise GenerationError(
            f"Missing Adventure source: "
            f"{adventure_path}"
        ) from error

    parsed = read_json(adventure_path)
    if not isinstance(parsed, dict):
        raise GenerationError(
            "Adventure source must be a JSON object."
        )

    journals = parsed.get("journal")
    folders = parsed.get("folders")
    if not isinstance(journals, list):
        raise GenerationError(
            "Adventure journal field must be an array."
        )
    if not isinstance(folders, list):
        raise GenerationError(
            "Adventure folders field must be an array."
        )

    prefix = (
        "JournalEntry/"
        f"{JOURNAL_FOLDER_DIRECTORY}/"
    )
    expected_journals = [
        journal_relative_path(document)
        for document in documents
        if document["enabled"]
    ]
    updated_journals = [
        value
        for value in journals
        if not (
            isinstance(value, str)
            and value.startswith(prefix)
        )
    ]
    updated_journals.extend(
        expected_journals
    )

    expected_folder = folder_relative_path()
    updated_folders = [
        value
        for value in folders
        if value != expected_folder
    ]
    if expected_journals:
        updated_folders.append(
            expected_folder
        )

    rendered = replace_adventure_array(
        original,
        "journal",
        updated_journals,
    )
    rendered = replace_adventure_array(
        rendered,
        "folders",
        updated_folders,
    )

    try:
        json.loads(rendered)
    except json.JSONDecodeError as error:
        raise GenerationError(
            "Generated Adventure source is invalid JSON: "
            f"{error}"
        ) from error

    return rendered


def expected_outputs(
    repo_root: Path,
    source_directory: Path,
    adventure_directory: Path,
) -> dict[Path, str]:
    documents = source_documents(
        source_directory
    )
    references = build_internal_references(
        documents
    )
    references.update(
        load_external_references(
            repo_root
        )
    )

    outputs: dict[Path, str] = {}
    journal_directory = (
        adventure_directory
        / "JournalEntry"
        / JOURNAL_FOLDER_DIRECTORY
    )

    enabled = [
        document
        for document in documents
        if document["enabled"]
    ]

    if enabled:
        outputs[
            journal_directory / "_Folder.json"
        ] = (
            json.dumps(
                render_folder(),
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )

    for document in enabled:
        path = (
            journal_directory
            / safe_filename(
                str(document["name"]),
                str(document["id"]),
            )
        )
        outputs[path] = (
            json.dumps(
                render_document(
                    repo_root,
                    document,
                    references,
                ),
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )

    adventure_path = (
        adventure_directory
        / "_Adventure.json"
    )
    outputs[adventure_path] = render_adventure(
        adventure_path,
        documents,
    )

    return outputs


def generated_journal_files(
    adventure_directory: Path,
) -> set[Path]:
    directory = (
        adventure_directory
        / "JournalEntry"
        / JOURNAL_FOLDER_DIRECTORY
    )
    if not directory.is_dir():
        return set()

    generated: set[Path] = set()
    for path in directory.glob("*.json"):
        try:
            source = read_json(path)
        except GenerationError:
            continue
        if not isinstance(source, dict):
            continue
        flags = source.get("flags")
        if (
            isinstance(flags, dict)
            and isinstance(
                flags.get(MODULE_ID),
                dict,
            )
            and (
                flags[MODULE_ID].get("generatedBy")
                == GENERATOR_NAME
            )
        ):
            generated.add(path)

    return generated


def check_outputs(
    outputs: dict[Path, str],
    stale: set[Path],
) -> int:
    failed = False

    for path, expected in outputs.items():
        if not path.is_file():
            print(
                f"Missing generated file: {path}",
                file=sys.stderr,
            )
            failed = True
            continue

        actual = path.read_text(
            encoding="utf-8",
        )
        if actual == expected:
            continue

        failed = True
        print(
            f"Generated file is out of sync: {path}",
            file=sys.stderr,
        )
        for line in unified_diff(
            actual.splitlines(),
            expected.splitlines(),
            fromfile=str(path),
            tofile=f"expected {path}",
            lineterm="",
        ):
            print(
                line,
                file=sys.stderr,
            )

    for path in sorted(stale):
        print(
            f"Stale generated Journal file: {path}",
            file=sys.stderr,
        )
        failed = True

    if failed:
        return 1

    print(
        "Verified generated JournalEntries "
        "and Adventure references."
    )
    return 0


def write_outputs(
    outputs: dict[Path, str],
    stale: set[Path],
) -> None:
    for path in stale:
        path.unlink()

    for path, content in outputs.items():
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        path.write_text(
            content,
            encoding="utf-8",
        )

    journal_directory = next(
        (
            path.parent
            for path in outputs
            if path.name == "_Folder.json"
            and path.parent.name
                == JOURNAL_FOLDER_DIRECTORY
        ),
        None,
    )
    if journal_directory is None:
        candidate = (
            next(iter(outputs))
            .parent
            / "JournalEntry"
            / JOURNAL_FOLDER_DIRECTORY
        )
        if candidate.is_dir():
            shutil.rmtree(candidate)

    print(
        "Generated Bane of Azeroth JournalEntries "
        "and updated the Adventure source."
    )


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]

    outputs = expected_outputs(
        repo_root,
        args.source_directory,
        args.adventure_directory,
    )
    expected_paths = set(outputs)
    adventure_path = (
        args.adventure_directory
        / "_Adventure.json"
    )
    stale = (
        generated_journal_files(
            args.adventure_directory
        )
        - (
            expected_paths
            - {adventure_path}
        )
    )

    if args.check:
        return check_outputs(
            outputs,
            stale,
        )

    write_outputs(
        outputs,
        stale,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except GenerationError as error:
        print(
            f"generate-journals.py: {error}",
            file=sys.stderr,
        )
        raise SystemExit(1)
