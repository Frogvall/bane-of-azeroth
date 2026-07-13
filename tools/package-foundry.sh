#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

MODULE_DIR="${ROOT_DIR}/foundry"
PACK_NAME="bane-of-azeroth"
PACK_SOURCE="${MODULE_DIR}/pack-src/${PACK_NAME}"
DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR="${DIST_DIR}/stage/${PACK_NAME}"

for command in fvtt jq tar zip unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

MODULE_JSON="${MODULE_DIR}/module.json"

if [[ ! -f "$MODULE_JSON" ]]; then
  echo "Missing module manifest: $MODULE_JSON" >&2
  exit 1
fi

if [[ ! -d "$PACK_SOURCE" ]]; then
  echo "Missing pack source: $PACK_SOURCE" >&2
  exit 1
fi

MODULE_ID="$(jq -er '.id' "$MODULE_JSON")"
VERSION="$(jq -er '.version' "$MODULE_JSON")"

ZIP_FILE="${DIST_DIR}/${MODULE_ID}-${VERSION}.zip"
PACK_DIR="${STAGE_DIR}/packs/${PACK_NAME}"

echo "Building ${MODULE_ID} ${VERSION}"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/packs" "$DIST_DIR"

# Copy the installable module files, excluding source data and old builds.
tar \
  -C "$MODULE_DIR" \
  --exclude='./pack-src' \
  --exclude='./packs' \
  -cf - . |
tar -C "$STAGE_DIR" -xf -

echo "Building Foundry compendium..."

fvtt package pack "$PACK_NAME" \
  --inputDirectory "$PACK_SOURCE" \
  --outputDirectory "${STAGE_DIR}/packs" \
  --recursive

if [[ ! -f "${PACK_DIR}/CURRENT" ]]; then
  echo "Built pack is missing CURRENT." >&2
  exit 1
fi

# Remove LevelDB runtime and diagnostic files.
rm -f \
  "${PACK_DIR}/LOCK" \
  "${PACK_DIR}/LOG" \
  "${PACK_DIR}/LOG.old"

find "$PACK_DIR" \
  -maxdepth 1 \
  -type f \
  -name '*.dbtmp' \
  -delete

echo "Creating module zip..."

rm -f "$ZIP_FILE"

(
  cd "$STAGE_DIR"
  zip -qr "$ZIP_FILE" .
)

echo "Validating module zip..."

if ! unzip -Z1 "$ZIP_FILE" | grep -qx 'module.json'; then
  echo "module.json is not at the root of the zip." >&2
  exit 1
fi

if unzip -Z1 "$ZIP_FILE" |
  grep -Eq '(^|/)pack-src/|(^|/)(LOCK|LOG|LOG\.old)$|\.dbtmp$'; then
  echo "The zip contains source or LevelDB runtime files." >&2
  exit 1
fi

if ! unzip -p "$ZIP_FILE" module.json |
  jq -e --arg version "$VERSION" '.version == $version' >/dev/null; then
  echo "The packaged module version is incorrect." >&2
  exit 1
fi

echo
echo "Built successfully:"
echo "  $ZIP_FILE"
