#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

MODULE_DIR="${ROOT_DIR}/foundry"
PACK_SOURCE="${MODULE_DIR}/pack-src/bane-of-azeroth"
DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR="${DIST_DIR}/stage/bane-of-azeroth"

FVTT_CLI_VERSION="3.0.4"
IMAGE="bane-of-azeroth-fvtt-cli:${FVTT_CLI_VERSION}"

for command in docker jq tar zip unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

if [[ ! -f "${MODULE_DIR}/module.json" ]]; then
  echo "Missing foundry/module.json" >&2
  exit 1
fi

if [[ ! -d "$PACK_SOURCE" ]]; then
  echo "Missing pack source: $PACK_SOURCE" >&2
  exit 1
fi

MODULE_ID="$(jq -r '.id // empty' "${MODULE_DIR}/module.json")"
VERSION="$(jq -r '.version // empty' "${MODULE_DIR}/module.json")"

if [[ -z "$MODULE_ID" || -z "$VERSION" ]]; then
  echo "Could not read module id or version." >&2
  exit 1
fi

ZIP_FILE="${DIST_DIR}/${MODULE_ID}-${VERSION}.zip"

echo "Building CLI image..."
docker build \
  --tag "$IMAGE" \
  "${ROOT_DIR}/tools/foundryvtt-cli"

echo "Preparing staging directory..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/packs"

# Copy module files, but not source JSON or an old LevelDB build.
tar \
  -C "$MODULE_DIR" \
  --exclude='./pack-src' \
  --exclude='./packs' \
  -cf - . |
tar -C "$STAGE_DIR" -xf -

echo "Building Adventure compendium..."

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  --mount type=bind,source="$ROOT_DIR",target=/work,readonly \
  --mount type=bind,source="$STAGE_DIR",target=/build \
  -w /work \
  "$IMAGE" \
  package pack bane-of-azeroth \
  --inputDirectory /work/foundry/pack-src/bane-of-azeroth \
  --outputDirectory /build/packs \
  --recursive

PACK_DIR="${STAGE_DIR}/packs/bane-of-azeroth"

if [[ ! -f "${PACK_DIR}/CURRENT" ]]; then
  echo "Built pack is missing CURRENT." >&2
  exit 1
fi

# These are runtime/diagnostic files, not release content.
rm -f \
  "${PACK_DIR}/LOCK" \
  "${PACK_DIR}/LOG" \
  "${PACK_DIR}/LOG.old"

find "$PACK_DIR" \
  -maxdepth 1 \
  -type f \
  -name '*.dbtmp' \
  -delete

echo "Creating ${ZIP_FILE}..."
rm -f "$ZIP_FILE"

(
  cd "$STAGE_DIR"
  zip -qr "$ZIP_FILE" .
)

echo "Validating package..."

if ! unzip -Z1 "$ZIP_FILE" | grep -qx 'module.json'; then
  echo "module.json is not at the root of the zip." >&2
  exit 1
fi

if unzip -Z1 "$ZIP_FILE" |
  grep -Eq '(^|/)pack-src/|(^|/)(LOCK|LOG|LOG\.old)$|\.dbtmp$'; then
  echo "The zip contains source or runtime files." >&2
  exit 1
fi

echo
echo "Built successfully:"
echo "  $ZIP_FILE"
echo
echo "Contents:"
unzip -l "$ZIP_FILE"
