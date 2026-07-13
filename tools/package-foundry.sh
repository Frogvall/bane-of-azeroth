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

MODULE_JSON="${MODULE_DIR}/module.json"

for command in fvtt jq tar zip unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

if [[ ! -f "$MODULE_JSON" ]]; then
  echo "Missing module manifest: $MODULE_JSON" >&2
  exit 1
fi

if [[ ! -d "$PACK_SOURCE" ]]; then
  echo "Missing pack source: $PACK_SOURCE" >&2
  exit 1
fi

MODULE_ID="$(jq -er '.id' "$MODULE_JSON")"
SOURCE_VERSION="$(jq -er '.version' "$MODULE_JSON")"

BUILD_VERSION="${BOA_BUILD_VERSION:-$SOURCE_VERSION}"
MANIFEST_URL="${BOA_MANIFEST_URL:-}"
DOWNLOAD_URL="${BOA_DOWNLOAD_URL:-}"

ZIP_NAME="${BOA_ZIP_NAME:-${MODULE_ID}-${BUILD_VERSION}.zip}"
ZIP_FILE="${DIST_DIR}/${ZIP_NAME}"

if [[ ! "$BUILD_VERSION" =~ ^[0-9A-Za-z._+-]+$ ]]; then
  echo "Unsafe build version: $BUILD_VERSION" >&2
  exit 1
fi

if [[ "$ZIP_NAME" == */* || "$ZIP_NAME" == "." || "$ZIP_NAME" == ".." ]]; then
  echo "Unsafe zip filename: $ZIP_NAME" >&2
  exit 1
fi

echo "Building ${MODULE_ID} ${BUILD_VERSION}"
echo "Source version: ${SOURCE_VERSION}"

if [[ -n "$MANIFEST_URL" ]]; then
  echo "Manifest URL:  ${MANIFEST_URL}"
fi

if [[ -n "$DOWNLOAD_URL" ]]; then
  echo "Download URL:  ${DOWNLOAD_URL}"
fi

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/packs" "$DIST_DIR"

# Copy installable module files, excluding source data and old LevelDB builds.
tar \
  -C "$MODULE_DIR" \
  --exclude='./pack-src' \
  --exclude='./packs' \
  -cf - . |
tar -C "$STAGE_DIR" -xf -

echo "Generating delivery manifest..."

jq \
  --arg version "$BUILD_VERSION" \
  --arg manifest "$MANIFEST_URL" \
  --arg download "$DOWNLOAD_URL" \
  '
    .version = $version
    | if $manifest == ""
        then del(.manifest)
        else .manifest = $manifest
      end
    | if $download == ""
        then del(.download)
        else .download = $download
      end
  ' \
  "$MODULE_JSON" \
  > "${STAGE_DIR}/module.json.tmp"

mv \
  "${STAGE_DIR}/module.json.tmp" \
  "${STAGE_DIR}/module.json"

echo "Building Foundry compendium..."

fvtt package pack "$PACK_NAME" \
  --inputDirectory "$PACK_SOURCE" \
  --outputDirectory "${STAGE_DIR}/packs" \
  --recursive

PACK_DIR="${STAGE_DIR}/packs/${PACK_NAME}"

if [[ ! -f "${PACK_DIR}/CURRENT" ]]; then
  echo "Built pack is missing CURRENT." >&2
  exit 1
fi

# Remove LevelDB runtime and diagnostic files from the deliverable.
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
  jq -e \
    --arg version "$BUILD_VERSION" \
    '.version == $version' >/dev/null; then
  echo "The packaged module version is incorrect." >&2
  exit 1
fi

if [[ -n "$MANIFEST_URL" ]]; then
  if ! unzip -p "$ZIP_FILE" module.json |
    jq -e \
      --arg manifest "$MANIFEST_URL" \
      '.manifest == $manifest' >/dev/null; then
    echo "The packaged manifest URL is incorrect." >&2
    exit 1
  fi
else
  if ! unzip -p "$ZIP_FILE" module.json |
    jq -e 'has("manifest") | not' >/dev/null; then
    echo "The packaged manifest unexpectedly contains a manifest URL." >&2
    exit 1
  fi
fi

if [[ -n "$DOWNLOAD_URL" ]]; then
  if ! unzip -p "$ZIP_FILE" module.json |
    jq -e \
      --arg download "$DOWNLOAD_URL" \
      '.download == $download' >/dev/null; then
    echo "The packaged download URL is incorrect." >&2
    exit 1
  fi
else
  if ! unzip -p "$ZIP_FILE" module.json |
    jq -e 'has("download") | not' >/dev/null; then
    echo "The packaged manifest unexpectedly contains a download URL." >&2
    exit 1
  fi
fi

echo
echo "Built successfully:"
echo "  $ZIP_FILE"
