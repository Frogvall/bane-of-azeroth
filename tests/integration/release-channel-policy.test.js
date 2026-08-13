import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  test,
} from "vitest";

const STABLE_WORKFLOW =
  ".github/workflows/release-foundry.yml";
const RC_WORKFLOW =
  ".github/workflows/release-foundry-rc.yml";
const BUILD_WORKFLOW =
  ".github/workflows/build-foundry.yml";
const MODULE_JSON =
  "foundry/module.json";
const README =
  "README.md";

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "Foundry stable and release-candidate channels",
  () => {
    test(
      "keeps the stable manifest URL permanent while downloads stay versioned",
      () => {
        const source =
          read(
            STABLE_WORKFLOW,
          );

        expect(source).toContain(
          'manifest_url="${repository_url}/releases/latest/download/module.json"',
        );
        expect(source).toContain(
          'download_url="${repository_url}/releases/download/${GITHUB_REF_NAME}/bane-of-azeroth.zip"',
        );
        expect(source).not.toContain(
          'manifest_url="${repository_url}/releases/download/${GITHUB_REF_NAME}/module.json"',
        );
        expect(source).toContain(
          "--latest",
        );
        expect(source).not.toContain(
          "--prerelease",
        );
      },
    );

    test(
      "publishes an opt-in rolling production release candidate as a prerelease",
      () => {
        expect(
          existsSync(
            RC_WORKFLOW,
          ),
        ).toBe(true);

        const source =
          read(
            RC_WORKFLOW,
          );

        for (const marker of [
          "push:",
          "branches:",
          "- main",
          'release_tag="release-candidate"',
          'prefix="v${source_version}-rc."',
          'build_version="${source_version}-rc.${rc_number}"',
          'immutable_tag="v${build_version}"',
          "Create immutable release-candidate tag",
          'manifest_url="${repository_url}/releases/download/${release_tag}/module.json"',
          'download_url="${repository_url}/releases/download/${release_tag}/bane-of-azeroth.zip"',
          "BOA_INCLUDE_DEV_TESTS=false",
          '.id == "bane-of-azeroth"',
          '.title == "Bane of Azeroth"',
          "--prerelease",
          "--latest=false",
          ".isPrerelease == true",
        ]) {
          expect(source).toContain(
            marker,
          );
        }
      },
    );

    test(
      "treats a missing immutable RC tag as absent rather than as an error-body SHA",
      () => {
        const source =
          read(
            RC_WORKFLOW,
          );

        expect(source).toContain(
          'if existing_sha="$(',
        );
        expect(source).toContain(
          'existing_sha=""',
        );
        expect(source).not.toContain(
          '2>/dev/null ||\n            true',
        );
      },
    );

    test(
      "leaves main exclusively to the release-candidate pipeline",
      () => {
        const source =
          read(
            BUILD_WORKFLOW,
          );

        expect(source).toContain(
          "branches-ignore:",
        );
        expect(source).toContain(
          "- main",
        );
        expect(source).not.toContain(
          'branches:\n      - "**"',
        );
      },
    );

    test(
      "verifies the same public endpoints that Foundry testers use",
      () => {
        const rc =
          read(
            RC_WORKFLOW,
          );
        const stable =
          read(
            STABLE_WORKFLOW,
          );

        expect(rc).toContain(
          '"$MANIFEST_URL"',
        );
        expect(rc).toContain(
          '"$DOWNLOAD_URL"',
        );
        expect(rc).toContain(
          "--retry-all-errors",
        );

        expect(stable).toContain(
          "channel-module.json",
        );
        expect(stable).toContain(
          '"$MANIFEST_URL"',
        );
      },
    );

    test(
      "keeps source metadata channel-neutral and watches RC workflow changes",
      () => {
        const manifest =
          JSON.parse(
            read(
              MODULE_JSON,
            ),
          );
        expect(
          manifest.manifest,
        ).toBeUndefined();
        expect(
          manifest.download,
        ).toBeUndefined();

        const build =
          read(
            BUILD_WORKFLOW,
          );
        expect(build).toContain(
          '- ".github/workflows/release-foundry-rc.yml"',
        );
      },
    );

    test(
      "documents separate stable and opt-in candidate manifest channels",
      () => {
        const source =
          read(
            README,
          );

        for (const marker of [
          "releases/latest/download/module.json",
          "releases/download/release-candidate/module.json",
          "Publish Foundry release candidate",
          "every push to `main` automatically runs",
          "Install the candidate through its manifest URL",
          "does not replace the stable",
          "immutable `vMAJOR.MINOR.PATCH-rc.N` tags",
        ]) {
          expect(source).toContain(
            marker,
          );
        }
      },
    );
  },
);
