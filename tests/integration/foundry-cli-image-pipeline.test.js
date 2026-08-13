import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const IMAGE_WORKFLOW = ".github/workflows/publish-fvtt-cli-image.yml";
const BUILD_WORKFLOW = ".github/workflows/build-foundry.yml";
const RC_WORKFLOW = ".github/workflows/release-foundry-rc.yml";

function read(path) {
  return readFileSync(path, "utf8");
}

describe("Foundry CLI image lifecycle", () => {
  test("publishes branch and immutable SHA images on branch creation", () => {
    const source = read(IMAGE_WORKFLOW);
    for (const marker of [
      "create:",
      "github.event_name != 'create' || github.ref_type == 'branch'",
      "type=ref,event=branch,prefix=${{ env.IMAGE_VERSION }}-",
      "type=sha,format=long,prefix=${{ env.IMAGE_VERSION }}-sha-",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("waits for the exact branch image when first/new/image-affecting", () => {
    const source = read(BUILD_WORKFLOW);
    for (const marker of [
      "Detect whether an exact SHA image is required",
      "Select expected build image",
      "Wait for selected build image",
      'sha_image="${IMAGE_NAME}:${IMAGE_VERSION}-sha-${GITHUB_SHA}"',
      "tools/foundryvtt-cli/Dockerfile",
      ".github/workflows/publish-fvtt-cli-image.yml",
      "docker manifest inspect",
      "steps.select.outputs.image",
    ]) {
      expect(source).toContain(marker);
    }
    expect(source).toContain(
      "image: ${{ needs.resolve-image.outputs.image }}",
    );
  });

  test("waits for an exact RC image when main changes image inputs", () => {
    const source = read(RC_WORKFLOW);
    for (const marker of [
      "resolve-image:",
      "Detect whether an exact RC image is required",
      "Select release-candidate build image",
      "Wait for release-candidate build image",
      'sha_image="${IMAGE_NAME}:${IMAGE_VERSION}-sha-${GITHUB_SHA}"',
      "docker manifest inspect",
      "needs.resolve-image.outputs.image",
    ]) {
      expect(source).toContain(marker);
    }
  });
});
