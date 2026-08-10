#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

MODULE_DIR="${ROOT_DIR}/foundry"
PACK_NAME="bane-of-azeroth"
DEV_TEST_PACK_NAME="bane-of-azeroth-dev-tests"
INCLUDE_DEV_TESTS="${BOA_INCLUDE_DEV_TESTS:-false}"
PACK_SOURCE="${MODULE_DIR}/pack-src/${PACK_NAME}"

DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR="${DIST_DIR}/stage/${PACK_NAME}"

MODULE_JSON="${MODULE_DIR}/module.json"

for command in fvtt jq tar zip unzip python3; do
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

echo "Verifying generated Foundry content..."
python3 \
  "${ROOT_DIR}/tools/check-foundry-generators.py"


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

if [[ "$INCLUDE_DEV_TESTS" == "true" ]]; then
  echo "Building prerelease developer-test Macro pack..."

  DEV_TEST_SOURCE_ROOT="${DIST_DIR}/dev-test-pack-src"
  DEV_TEST_SOURCE="${DEV_TEST_SOURCE_ROOT}/${DEV_TEST_PACK_NAME}"

  rm -rf "$DEV_TEST_SOURCE_ROOT"

  python3 \
    "${ROOT_DIR}/tools/generate-system-test-macros.py" \
    --output-directory "$DEV_TEST_SOURCE"

  DEV_TEST_SOURCE_COUNT="$(
    find "$DEV_TEST_SOURCE" \
      -maxdepth 1 \
      -type f \
      -name '*.json' \
      -print |
    wc -l |
    tr -d '[:space:]'
  )"

  if [[ "$DEV_TEST_SOURCE_COUNT" == "0" ]]; then
    echo "No developer-test Macro documents were generated." >&2
    exit 1
  fi

  fvtt package pack "$DEV_TEST_PACK_NAME" \
    --inputDirectory "$DEV_TEST_SOURCE" \
    --outputDirectory "${STAGE_DIR}/packs" \
    --recursive

  DEV_TEST_VERIFY="${DEV_TEST_SOURCE_ROOT}/verify"

  rm -rf "$DEV_TEST_VERIFY"

  fvtt package unpack "$DEV_TEST_PACK_NAME" \
    --inputDirectory "${STAGE_DIR}/packs" \
    --outputDirectory "$DEV_TEST_VERIFY" \
    --clean

  DEV_TEST_PACKED_COUNT="$(
    find "$DEV_TEST_VERIFY" \
      -type f \
      -name '*.json' \
      -print |
    wc -l |
    tr -d '[:space:]'
  )"

  if [[ "$DEV_TEST_PACKED_COUNT" != "$DEV_TEST_SOURCE_COUNT" ]]; then
    echo \
      "Developer-test Macro pack verification failed: " \
      "generated ${DEV_TEST_SOURCE_COUNT}, " \
      "packed ${DEV_TEST_PACKED_COUNT}." >&2
    exit 1
  fi

  echo \
    "Verified ${DEV_TEST_PACKED_COUNT} developer-test " \
    "Macros in the compiled pack."

  DEV_PACK_DIR="${STAGE_DIR}/packs/${DEV_TEST_PACK_NAME}"

  if [[ ! -f "${DEV_PACK_DIR}/CURRENT" ]]; then
    echo "Built developer-test pack is missing CURRENT." >&2
    exit 1
  fi

  rm -f \
    "${DEV_PACK_DIR}/LOCK" \
    "${DEV_PACK_DIR}/LOG" \
    "${DEV_PACK_DIR}/LOG.old"

  find "$DEV_PACK_DIR" \
    -maxdepth 1 \
    -type f \
    -name '*.dbtmp' \
    -delete

  install \
    -D \
    -m 0644 \
    "${ROOT_DIR}/tests/system/runtime/import-system-test-macros.js" \
    "${STAGE_DIR}/scripts/boa-dev-system-tests.js"

  jq \
    --arg packName "$DEV_TEST_PACK_NAME" \
    '
      .flags["bane-of-azeroth"].developmentBuild = true
      |
      .scripts = (
        (((.scripts // []) |
          map(select(. != "scripts/boa-dev-system-tests.js")))
        + ["scripts/boa-dev-system-tests.js"])
      )
      |
      .packs = (
        ((.packs // []) |
          map(select(.name != $packName)))
        + [
          {
            "name": $packName,
            "label": "Bane of Azeroth – Developer Tests",
            "path": ("packs/" + $packName),
            "type": "Macro",
            "system": "dragonbane",
            "ownership": {
              "PLAYER": "NONE",
              "ASSISTANT": "OWNER"
            },
            "flags": {
              "bane-of-azeroth": {
                "developmentOnly": true
              }
            }
          }
        ]
      )
    ' \
    "${STAGE_DIR}/module.json" \
    > "${STAGE_DIR}/module.json.tmp"

  mv \
    "${STAGE_DIR}/module.json.tmp" \
    "${STAGE_DIR}/module.json"
else
  rm -rf "${STAGE_DIR}/packs/${DEV_TEST_PACK_NAME}"
  rm -f "${STAGE_DIR}/scripts/boa-dev-system-tests.js"

  jq \
    --arg packName "$DEV_TEST_PACK_NAME" \
    '
      del(.flags["bane-of-azeroth"].developmentBuild)
      |
      .scripts = (
        (.scripts // []) |
        map(select(. != "scripts/boa-dev-system-tests.js"))
      )
      |
      .packs = (
        (.packs // []) |
        map(select(.name != $packName))
      )
    ' \
    "${STAGE_DIR}/module.json" \
    > "${STAGE_DIR}/module.json.tmp"

  mv \
    "${STAGE_DIR}/module.json.tmp" \
    "${STAGE_DIR}/module.json"
fi

echo "Creating module zip..."

rm -f "$ZIP_FILE"

(
  cd "$STAGE_DIR"
  mapfile -d '' zip_entries < <(
    find . \
      -mindepth 1 \
      -maxdepth 1 \
      -printf '%P\0' \
      | sort -z
  )

  if (( ${#zip_entries[@]} == 0 )); then
    echo "The staging directory is empty." >&2
    exit 1
  fi

  zip -qr "$ZIP_FILE" "${zip_entries[@]}"
)

echo "Validating module zip..."

# Read the complete archive listing before searching it. With pipefail,
# grep -q can otherwise close a live unzip pipeline after an early match,
# causing unzip to exit with SIGPIPE and making a valid archive look invalid.
ZIP_CONTENTS="$(
  unzip -Z1 "$ZIP_FILE"
)"

if ! grep -Fxq 'module.json' <<< "$ZIP_CONTENTS"; then
  echo "module.json is not at the root of the zip." >&2
  exit 1
fi

if grep -Eq \
  '(^|/)pack-src/|(^|/)(LOCK|LOG|LOG\.old)$|\.dbtmp$' \
  <<< "$ZIP_CONTENTS"; then
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
