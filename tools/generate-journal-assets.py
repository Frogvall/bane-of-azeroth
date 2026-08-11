#!/usr/bin/env python3
"""Generate lossless WebP assets from checked-in Homebrewery PNG masters.

Usage:
    python3 tools/generate-journal-assets.py
    python3 tools/generate-journal-assets.py \
        --source homebrewery/images/classes/paladin.png
    python3 tools/generate-journal-assets.py --check

Source:
    homebrewery/images/**/*.png

Output:
    foundry/assets/journals/**/*.webp

The relative directory and filename are preserved; only .png becomes .webp.
Normal generation is performed in a pinned Docker/Pillow environment.
The --check mode uses only the Python standard library so it can run in CI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import shlex
import struct
import subprocess
import sys
import tempfile
import zlib


SCHEMA_VERSION = 1
PILLOW_VERSION = "12.3.0"
PYTHON_IMAGE = "python:3.13-slim-bookworm"
SOURCE_ROOT = Path("homebrewery/images")
OUTPUT_ROOT = Path("foundry/assets/journals")
MANIFEST_PATH = Path(
    "foundry/config/journal-assets.json"
)
MODULE_PREFIX = (
    "modules/bane-of-azeroth/assets/journals"
)
CURATED_ASSET_SUBDIRECTORIES = (
    Path("foundry-guide"),
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class GenerationError(RuntimeError):
    pass


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(
            lambda: handle.read(1024 * 1024),
            b"",
        ):
            digest.update(chunk)
    return digest.hexdigest()


def discover_sources(root: Path) -> list[Path]:
    source_root = root / SOURCE_ROOT
    if not source_root.is_dir():
        raise GenerationError(
            f"Missing source directory: {SOURCE_ROOT}"
        )

    symlinks = sorted(
        path
        for path in source_root.rglob("*")
        if path.is_symlink()
    )
    if symlinks:
        raise GenerationError(
            "Journal image sources must not contain "
            "symlinks:\n  "
            + "\n  ".join(
                str(path.relative_to(root))
                for path in symlinks
            )
        )

    sources = sorted(
        (
            path
            for path in source_root.rglob("*")
            if (
                path.is_file()
                and path.suffix.casefold() == ".png"
            )
        ),
        key=lambda path: (
            path.relative_to(source_root)
            .as_posix()
            .casefold(),
            path.relative_to(source_root)
            .as_posix(),
        ),
    )
    if not sources:
        raise GenerationError(
            f"No PNG files found below {SOURCE_ROOT}."
        )

    destinations: dict[str, Path] = {}
    for source in sources:
        relative = (
            source.relative_to(source_root)
            .with_suffix(".webp")
        )
        collision_key = relative.as_posix().casefold()
        previous = destinations.get(collision_key)
        if previous is not None:
            raise GenerationError(
                "Case-insensitive output collision:\n"
                f"  {previous.relative_to(root)}\n"
                f"  {source.relative_to(root)}"
            )
        destinations[collision_key] = source

    return sources


def relative_source_path(
    root: Path,
    source: Path,
) -> str:
    return source.relative_to(root).as_posix()


def relative_asset_path(
    root: Path,
    source: Path,
) -> str:
    relative = (
        source.relative_to(root / SOURCE_ROOT)
        .with_suffix(".webp")
    )
    return (
        OUTPUT_ROOT / relative
    ).as_posix()


def module_asset_path(
    root: Path,
    source: Path,
) -> str:
    relative = (
        source.relative_to(root / SOURCE_ROOT)
        .with_suffix(".webp")
        .as_posix()
    )
    return f"{MODULE_PREFIX}/{relative}"


def is_curated_asset(
    root: Path,
    path: Path,
) -> bool:
    output_root = root / OUTPUT_ROOT
    return any(
        path.is_relative_to(
            output_root / relative
        )
        for relative
        in CURATED_ASSET_SUBDIRECTORIES
    )


def copy_curated_assets(
    root: Path,
    destination_root: Path,
) -> None:
    source_root = root / OUTPUT_ROOT
    for relative in CURATED_ASSET_SUBDIRECTORIES:
        source = source_root / relative
        if not source.exists():
            continue
        if not source.is_dir():
            raise GenerationError(
                "Curated Journal asset path must "
                f"be a directory: {source}"
            )
        destination = (
            destination_root / relative
        )
        if destination.exists():
            raise GenerationError(
                "Generated Journal assets collide "
                "with curated assets: "
                f"{relative}"
            )
        shutil.copytree(
            source,
            destination,
        )


def parse_png(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise GenerationError(
            f"Not a PNG file: {path}"
        )

    offset = len(PNG_SIGNATURE)
    width = None
    height = None
    color_type = None
    has_trns = False
    animated = False
    saw_iend = False

    while offset + 12 <= len(data):
        length = struct.unpack(
            ">I",
            data[offset:offset + 4],
        )[0]
        chunk_type = data[
            offset + 4:offset + 8
        ]
        payload_start = offset + 8
        payload_end = payload_start + length
        crc_end = payload_end + 4

        if crc_end > len(data):
            raise GenerationError(
                f"Truncated PNG chunk in {path}"
            )

        payload = data[
            payload_start:payload_end
        ]
        expected_crc = struct.unpack(
            ">I",
            data[payload_end:crc_end],
        )[0]
        actual_crc = zlib.crc32(
            chunk_type
        )
        actual_crc = zlib.crc32(
            payload,
            actual_crc,
        ) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise GenerationError(
                f"PNG CRC mismatch in {path}"
            )

        if chunk_type == b"IHDR":
            if (
                width is not None
                or length != 13
            ):
                raise GenerationError(
                    f"Invalid PNG IHDR in {path}"
                )
            width, height = struct.unpack(
                ">II",
                payload[:8],
            )
            color_type = payload[9]
        elif chunk_type == b"tRNS":
            has_trns = True
        elif chunk_type == b"acTL":
            animated = True
        elif chunk_type == b"IEND":
            saw_iend = True
            break

        offset = crc_end

    if (
        width is None
        or height is None
        or color_type is None
        or not saw_iend
    ):
        raise GenerationError(
            f"Incomplete PNG structure: {path}"
        )
    if width <= 0 or height <= 0:
        raise GenerationError(
            f"Invalid PNG dimensions: {path}"
        )
    if animated:
        raise GenerationError(
            f"Animated PNG is not supported: {path}"
        )

    return {
        "width": width,
        "height": height,
        "hasAlphaChannel": (
            color_type in (4, 6)
            or has_trns
        ),
    }


def parse_webp(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    if (
        len(data) < 20
        or data[:4] != b"RIFF"
        or data[8:12] != b"WEBP"
    ):
        raise GenerationError(
            f"Not a WebP file: {path}"
        )

    declared_size = struct.unpack(
        "<I",
        data[4:8],
    )[0] + 8
    if declared_size > len(data):
        raise GenerationError(
            f"Truncated WebP file: {path}"
        )

    offset = 12
    width = None
    height = None
    has_alpha = False
    lossless = False

    while offset + 8 <= len(data):
        chunk_type = data[offset:offset + 4]
        length = struct.unpack(
            "<I",
            data[offset + 4:offset + 8],
        )[0]
        payload_start = offset + 8
        payload_end = payload_start + length
        if payload_end > len(data):
            raise GenerationError(
                f"Truncated WebP chunk in {path}"
            )

        payload = data[
            payload_start:payload_end
        ]

        if chunk_type == b"VP8X":
            if len(payload) < 10:
                raise GenerationError(
                    f"Invalid VP8X chunk in {path}"
                )
            flags = payload[0]
            has_alpha = bool(flags & 0x10)
            width = (
                int.from_bytes(
                    payload[4:7],
                    "little",
                )
                + 1
            )
            height = (
                int.from_bytes(
                    payload[7:10],
                    "little",
                )
                + 1
            )
        elif chunk_type == b"VP8L":
            if (
                len(payload) < 5
                or payload[0] != 0x2F
            ):
                raise GenerationError(
                    f"Invalid VP8L chunk in {path}"
                )
            bits = int.from_bytes(
                payload[1:5],
                "little",
            )
            width = (
                bits & 0x3FFF
            ) + 1
            height = (
                (bits >> 14) & 0x3FFF
            ) + 1
            has_alpha = (
                has_alpha
                or bool(
                    (bits >> 28) & 0x1
                )
            )
            lossless = True
        elif chunk_type == b"ALPH":
            has_alpha = True
        elif chunk_type == b"VP8 ":
            lossless = False

        offset = payload_end + (length & 1)

    if width is None or height is None:
        raise GenerationError(
            f"WebP dimensions could not be read: {path}"
        )

    return {
        "width": width,
        "height": height,
        "hasAlpha": has_alpha,
        "lossless": lossless,
    }


def expected_manifest_header() -> dict[str, object]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "sourceRoot": SOURCE_ROOT.as_posix(),
        "assetRoot": OUTPUT_ROOT.as_posix(),
        "moduleRoot": MODULE_PREFIX,
        "conversion": {
            "format": "webp",
            "lossless": True,
            "method": 6,
            "exact": True,
            "metadata": "stripped",
            "pillowVersion": PILLOW_VERSION,
            "pythonImage": PYTHON_IMAGE,
        },
    }


def read_manifest(root: Path) -> dict[str, object]:
    path = root / MANIFEST_PATH
    try:
        value = json.loads(
            path.read_text(encoding="utf-8")
        )
    except FileNotFoundError as error:
        raise GenerationError(
            f"Missing asset manifest: {MANIFEST_PATH}"
        ) from error
    except json.JSONDecodeError as error:
        raise GenerationError(
            f"Invalid JSON in {MANIFEST_PATH}: {error}"
        ) from error

    if not isinstance(value, dict):
        raise GenerationError(
            f"{MANIFEST_PATH} must contain an object."
        )
    return value


def check_generated(root: Path) -> None:
    sources = discover_sources(root)
    manifest = read_manifest(root)

    for key, value in (
        expected_manifest_header().items()
    ):
        if manifest.get(key) != value:
            raise GenerationError(
                f"{MANIFEST_PATH}: unexpected {key}."
            )

    entries = manifest.get("assets")
    if not isinstance(entries, list):
        raise GenerationError(
            f"{MANIFEST_PATH}: assets must be a list."
        )

    entries_by_source: dict[str, dict[str, object]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise GenerationError(
                "Asset manifest entry must be an object."
            )
        source_path = entry.get("source")
        if (
            not isinstance(source_path, str)
            or not source_path
        ):
            raise GenerationError(
                "Asset manifest entry has no source."
            )
        if source_path in entries_by_source:
            raise GenerationError(
                f"Duplicate manifest source: {source_path}"
            )
        entries_by_source[source_path] = entry

    expected_sources = {
        relative_source_path(root, source)
        for source in sources
    }
    actual_sources = set(entries_by_source)
    if actual_sources != expected_sources:
        missing = sorted(
            expected_sources - actual_sources
        )
        extra = sorted(
            actual_sources - expected_sources
        )
        message = []
        if missing:
            message.append(
                "Missing manifest entries:\n  "
                + "\n  ".join(missing)
            )
        if extra:
            message.append(
                "Stale manifest entries:\n  "
                + "\n  ".join(extra)
            )
        raise GenerationError(
            "\n".join(message)
        )

    expected_assets: set[str] = set()

    for source in sources:
        source_relative = relative_source_path(
            root,
            source,
        )
        entry = entries_by_source[
            source_relative
        ]
        expected_asset = relative_asset_path(
            root,
            source,
        )
        expected_module = module_asset_path(
            root,
            source,
        )

        if entry.get("asset") != expected_asset:
            raise GenerationError(
                f"{source_relative}: unexpected asset path."
            )
        if (
            entry.get("modulePath")
            != expected_module
        ):
            raise GenerationError(
                f"{source_relative}: unexpected module path."
            )

        asset = root / expected_asset
        if not asset.is_file():
            raise GenerationError(
                f"Missing generated asset: {expected_asset}"
            )

        source_info = parse_png(source)
        asset_info = parse_webp(asset)

        if (
            asset_info["width"]
            != source_info["width"]
            or asset_info["height"]
            != source_info["height"]
        ):
            raise GenerationError(
                f"Dimension mismatch for {source_relative}"
            )
        if asset_info["lossless"] is not True:
            raise GenerationError(
                f"Asset is not lossless WebP: {expected_asset}"
            )

        checks = {
            "sourceSha256": sha256(source),
            "assetSha256": sha256(asset),
            "sourceBytes": source.stat().st_size,
            "assetBytes": asset.stat().st_size,
            "width": source_info["width"],
            "height": source_info["height"],
            "sourceHasAlphaChannel": (
                source_info["hasAlphaChannel"]
            ),
            "assetHasAlpha": (
                asset_info["hasAlpha"]
            ),
        }
        for key, value in checks.items():
            if entry.get(key) != value:
                raise GenerationError(
                    f"{source_relative}: manifest "
                    f"{key} is out of sync."
                )

        if (
            entry.get("hasTransparency") is True
            and asset_info["hasAlpha"] is not True
        ):
            raise GenerationError(
                f"Transparency was lost: {expected_asset}"
            )

        expected_assets.add(expected_asset)

    output_root = root / OUTPUT_ROOT
    actual_asset_files = {
        path.relative_to(root).as_posix()
        for path in output_root.rglob("*")
        if (
            path.is_file()
            and not is_curated_asset(
                root,
                path,
            )
        )
    }
    if actual_asset_files != expected_assets:
        extra = sorted(
            actual_asset_files - expected_assets
        )
        missing = sorted(
            expected_assets - actual_asset_files
        )
        message = []
        if missing:
            message.append(
                "Missing generated assets:\n  "
                + "\n  ".join(missing)
            )
        if extra:
            message.append(
                "Stale generated assets:\n  "
                + "\n  ".join(extra)
            )
        raise GenerationError(
            "\n".join(message)
        )

    print(
        f"Verified {len(sources)} lossless "
        "Journal WebP assets."
    )


def atomic_write_json(
    path: Path,
    value: object,
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    temporary = path.with_name(
        f".{path.name}.{os.getpid()}.tmp"
    )
    temporary.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def resolve_selected_sources(
    root: Path,
    requested: list[Path],
) -> list[Path]:
    all_sources = discover_sources(root)
    sources_by_relative = {
        relative_source_path(root, source):
            source
        for source in all_sources
    }
    selected: dict[str, Path] = {}

    for requested_path in requested:
        candidate = (
            requested_path
            if requested_path.is_absolute()
            else root / requested_path
        )

        if candidate.is_symlink():
            raise GenerationError(
                "Selected Journal image source "
                "must not be a symlink: "
                f"{requested_path}"
            )

        try:
            resolved = candidate.resolve(
                strict=True
            )
            relative = resolved.relative_to(
                root.resolve()
            ).as_posix()
        except (
            FileNotFoundError,
            ValueError,
        ) as error:
            raise GenerationError(
                "Selected Journal image source "
                "must be an existing PNG below "
                f"{SOURCE_ROOT}: {requested_path}"
            ) from error

        source = sources_by_relative.get(
            relative
        )
        if source is None:
            raise GenerationError(
                "Selected Journal image source "
                "must be a checked-in PNG below "
                f"{SOURCE_ROOT}: {requested_path}"
            )

        selected[relative] = source

    return [
        selected[key]
        for key in sorted(
            selected,
            key=lambda value: (
                value.casefold(),
                value,
            ),
        )
    ]


def require_pillow():
    try:
        import PIL
        from PIL import Image
        from PIL import features
    except ImportError as error:
        raise GenerationError(
            "Pillow is required in worker mode."
        ) from error

    if PIL.__version__ != PILLOW_VERSION:
        raise GenerationError(
            "Expected Pillow "
            f"{PILLOW_VERSION}, found "
            f"{PIL.__version__}."
        )

    if not features.check("webp"):
        raise GenerationError(
            "Pillow has no WebP encoder support."
        )

    return Image


def convert_source(
    root: Path,
    source: Path,
    destination: Path,
    Image,
) -> dict[str, object]:
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    png_info = parse_png(source)

    with Image.open(source) as image:
        image.load()

        if getattr(image, "n_frames", 1) != 1:
            raise GenerationError(
                "Animated PNG is not supported: "
                f"{source.relative_to(root)}"
            )

        has_alpha_channel = (
            "A" in image.getbands()
            or "transparency" in image.info
        )
        converted = (
            image.convert("RGBA")
            if has_alpha_channel
            else image.convert("RGB")
        )

        has_transparency = False
        if "A" in converted.getbands():
            alpha_min, _ = (
                converted
                .getchannel("A")
                .getextrema()
            )
            has_transparency = (
                alpha_min < 255
            )

        converted.save(
            destination,
            format="WEBP",
            lossless=True,
            quality=100,
            method=6,
            exact=True,
        )

        source_mode = image.mode

    webp_info = parse_webp(destination)

    if (
        webp_info["width"]
        != png_info["width"]
        or webp_info["height"]
        != png_info["height"]
    ):
        raise GenerationError(
            "Converted image dimensions changed: "
            f"{source.relative_to(root)}"
        )

    if webp_info["lossless"] is not True:
        raise GenerationError(
            "Converted asset is not lossless: "
            f"{destination.relative_to(root)}"
        )

    if (
        has_transparency
        and webp_info["hasAlpha"] is not True
    ):
        raise GenerationError(
            "Converted asset lost transparency: "
            f"{destination.relative_to(root)}"
        )

    relative = (
        source.relative_to(root / SOURCE_ROOT)
        .with_suffix(".webp")
    )
    source_relative = relative_source_path(
        root,
        source,
    )
    asset_relative = (
        OUTPUT_ROOT / relative
    ).as_posix()

    return {
        "source": source_relative,
        "asset": asset_relative,
        "modulePath": (
            f"{MODULE_PREFIX}/"
            f"{relative.as_posix()}"
        ),
        "sourceSha256": sha256(source),
        "assetSha256": sha256(destination),
        "sourceBytes": source.stat().st_size,
        "assetBytes":
            destination.stat().st_size,
        "width": png_info["width"],
        "height": png_info["height"],
        "sourceMode": source_mode,
        "sourceHasAlphaChannel": (
            png_info["hasAlphaChannel"]
        ),
        "hasTransparency": has_transparency,
        "assetHasAlpha": (
            webp_info["hasAlpha"]
        ),
    }


def validate_manifest_for_update(
    manifest: dict[str, object],
) -> list[dict[str, object]]:
    for key, value in (
        expected_manifest_header().items()
    ):
        if manifest.get(key) != value:
            raise GenerationError(
                f"{MANIFEST_PATH}: unexpected "
                f"{key}."
            )

    entries = manifest.get("assets")
    if not isinstance(entries, list):
        raise GenerationError(
            f"{MANIFEST_PATH}: assets must be "
            "a list."
        )

    for entry in entries:
        if not isinstance(entry, dict):
            raise GenerationError(
                "Asset manifest entry must be "
                "an object."
            )

    return entries


def merge_manifest_entries(
    manifest: dict[str, object],
    replacements: list[dict[str, object]],
) -> dict[str, object]:
    entries = validate_manifest_for_update(
        manifest
    )
    entries_by_source = {}

    for entry in entries:
        source = entry.get("source")
        if not isinstance(source, str):
            raise GenerationError(
                "Asset manifest entry has no "
                "source."
            )
        if source in entries_by_source:
            raise GenerationError(
                "Duplicate manifest source: "
                f"{source}"
            )
        entries_by_source[source] = dict(
            entry
        )

    for replacement in replacements:
        source = replacement.get("source")
        if not isinstance(source, str):
            raise GenerationError(
                "Generated manifest entry has "
                "no source."
            )
        entries_by_source[source] = (
            replacement
        )

    changed = dict(manifest)
    changed["assets"] = [
        entries_by_source[source]
        for source in sorted(
            entries_by_source,
            key=lambda value: (
                value.casefold(),
                value,
            ),
        )
    ]
    return changed


def backup_file(
    path: Path,
) -> tuple[bytes, int] | None:
    if not path.exists():
        return None

    if not path.is_file():
        raise GenerationError(
            f"Cannot back up non-file: {path}"
        )

    return (
        path.read_bytes(),
        path.stat().st_mode,
    )


def restore_file(
    path: Path,
    backup: tuple[bytes, int] | None,
) -> None:
    if backup is None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        return

    data, mode = backup
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    path.write_bytes(data)
    os.chmod(path, mode)


def convert_selected_with_pillow(
    root: Path,
    sources: list[Path],
) -> None:
    if not sources:
        raise GenerationError(
            "Focused Journal asset generation "
            "requires at least one --source."
        )

    Image = require_pillow()
    output_root = root / OUTPUT_ROOT
    output_root.mkdir(
        parents=True,
        exist_ok=True,
    )
    manifest_path = root / MANIFEST_PATH
    manifest = read_manifest(root)

    with tempfile.TemporaryDirectory(
        prefix=".journals-focused-",
        dir=output_root.parent,
    ) as temporary:
        temporary_root = Path(temporary)
        replacements = []
        destinations = []

        for source in sources:
            relative = (
                source.relative_to(
                    root / SOURCE_ROOT
                )
                .with_suffix(".webp")
            )
            temporary_asset = (
                temporary_root / relative
            )
            replacements.append(
                convert_source(
                    root,
                    source,
                    temporary_asset,
                    Image,
                )
            )
            destinations.append(
                (
                    temporary_asset,
                    output_root / relative,
                )
            )

        changed_manifest = (
            merge_manifest_entries(
                manifest,
                replacements,
            )
        )
        backups = {
            destination: backup_file(
                destination
            )
            for _, destination
            in destinations
        }
        manifest_backup = backup_file(
            manifest_path
        )

        try:
            for (
                temporary_asset,
                destination,
            ) in destinations:
                destination.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )
                os.replace(
                    temporary_asset,
                    destination,
                )

            atomic_write_json(
                manifest_path,
                changed_manifest,
            )
            check_generated(root)

        except BaseException:
            for destination, backup in (
                backups.items()
            ):
                restore_file(
                    destination,
                    backup,
                )
            restore_file(
                manifest_path,
                manifest_backup,
            )
            raise

    print(
        f"Generated {len(sources)} focused "
        "Journal WebP asset"
        + ("" if len(sources) == 1 else "s")
        + "."
    )


def convert_with_pillow(root: Path) -> None:
    Image = require_pillow()
    sources = discover_sources(root)
    output_root = root / OUTPUT_ROOT
    output_parent = output_root.parent
    output_parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    temporary = Path(
        tempfile.mkdtemp(
            prefix=".journals-webp-",
            dir=output_parent,
        )
    )
    backup = output_parent / (
        f".journals-backup-{os.getpid()}"
    )
    manifest_backup = None
    manifest_path = root / MANIFEST_PATH

    entries: list[dict[str, object]] = []

    try:
        for source in sources:
            relative = (
                source.relative_to(
                    root / SOURCE_ROOT
                )
                .with_suffix(".webp")
            )
            destination = temporary / relative
            entries.append(
                convert_source(
                    root,
                    source,
                    destination,
                    Image,
                )
            )

        copy_curated_assets(
            root,
            temporary,
        )
        manifest = expected_manifest_header()
        manifest["assets"] = entries
        temporary_manifest = (
            manifest_path.parent
            / (
                f".{manifest_path.name}."
                f"{os.getpid()}.tmp"
            )
        )
        temporary_manifest.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        temporary_manifest.write_text(
            json.dumps(
                manifest,
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        if backup.exists():
            shutil.rmtree(backup)

        if output_root.exists():
            os.replace(
                output_root,
                backup,
            )

        try:
            os.replace(
                temporary,
                output_root,
            )
            temporary = None

            if manifest_path.exists():
                manifest_backup = (
                    manifest_path.parent
                    / (
                        f".{manifest_path.name}."
                        f"{os.getpid()}.backup"
                    )
                )
                os.replace(
                    manifest_path,
                    manifest_backup,
                )

            os.replace(
                temporary_manifest,
                manifest_path,
            )

        except BaseException:
            if output_root.exists():
                shutil.rmtree(output_root)
            if backup.exists():
                os.replace(
                    backup,
                    output_root,
                )
            if manifest_backup is not None:
                if manifest_path.exists():
                    manifest_path.unlink()
                os.replace(
                    manifest_backup,
                    manifest_path,
                )
            raise

        if backup.exists():
            shutil.rmtree(backup)

        if (
            manifest_backup is not None
            and manifest_backup.exists()
        ):
            manifest_backup.unlink()

        check_generated(root)

    finally:
        if temporary and temporary.exists():
            shutil.rmtree(temporary)

        if backup.exists():
            if not output_root.exists():
                os.replace(
                    backup,
                    output_root,
                )
            else:
                shutil.rmtree(backup)


def run_docker_worker(
    root: Path,
    sources: list[Path] | None = None,
) -> None:
    docker = shutil.which("docker")
    if docker is None:
        raise GenerationError(
            "Docker is required to generate "
            "Journal WebP assets. The --check "
            "mode does not require Docker."
        )

    uid = os.getuid()
    gid = os.getgid()
    worker_arguments = [
        "--source "
        + shlex.quote(
            relative_source_path(
                root,
                source,
            )
        )
        for source in (sources or [])
    ]
    worker_command = (
        "python tools/"
        "generate-journal-assets.py "
        "--pillow-worker"
    )
    if worker_arguments:
        worker_command += (
            " "
            + " ".join(worker_arguments)
        )

    command = [
        docker,
        "run",
        "--rm",
        "--user",
        f"{uid}:{gid}",
        "-e",
        "HOME=/tmp/home",
        "-v",
        f"{root}:/workspace",
        "-w",
        "/workspace",
        PYTHON_IMAGE,
        "sh",
        "-lc",
        (
            'mkdir -p "$HOME" /tmp/pillow '
            "&& python -m pip install "
            "--disable-pip-version-check "
            "--no-cache-dir "
            "--target /tmp/pillow "
            f"Pillow=={PILLOW_VERSION} "
            "&& PYTHONPATH=/tmp/pillow "
            + worker_command
        ),
    ]

    result = subprocess.run(
        command,
        cwd=root,
    )
    if result.returncode != 0:
        raise GenerationError(
            "Docker/Pillow Journal asset "
            "generation failed."
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "Verify source, manifest, hashes, "
            "dimensions, lossless encoding, and "
            "output coverage without converting."
        ),
    )
    parser.add_argument(
        "--source",
        action="append",
        type=Path,
        default=[],
        help=(
            "Convert only this repository-relative "
            "PNG source and update only its WebP "
            "and manifest entry. Repeat for "
            "multiple sources. Without this "
            "option, regenerate all Journal "
            "assets."
        ),
    )
    parser.add_argument(
        "--pillow-worker",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()

    root = repo_root()

    if args.check and args.pillow_worker:
        raise GenerationError(
            "--check and --pillow-worker are "
            "mutually exclusive."
        )

    if args.check and args.source:
        raise GenerationError(
            "--source cannot be combined with "
            "--check. The check always verifies "
            "the complete Journal asset set."
        )

    selected_sources = (
        resolve_selected_sources(
            root,
            args.source,
        )
        if args.source
        else []
    )

    if args.check:
        check_generated(root)
    elif args.pillow_worker:
        if selected_sources:
            convert_selected_with_pillow(
                root,
                selected_sources,
            )
        else:
            convert_with_pillow(root)
    else:
        run_docker_worker(
            root,
            selected_sources or None,
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except GenerationError as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr,
        )
        raise SystemExit(1)
