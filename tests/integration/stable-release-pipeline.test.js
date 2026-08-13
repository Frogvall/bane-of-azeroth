import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  test,
} from "vitest";

const RELEASE_WORKFLOW =
  ".github/workflows/release-foundry.yml";
const BUILD_WORKFLOW =
  ".github/workflows/build-foundry.yml";
const RELEASE_TOOL =
  "tools/foundry-stable-release.py";
const README =
  "README.md";

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "stable Foundry release pipeline",
  () => {
    test(
      "has a dedicated production-only version-tag workflow",
      () => {
        expect(
          existsSync(
            RELEASE_WORKFLOW,
          ),
        ).toBe(true);

        const source =
          read(
            RELEASE_WORKFLOW,
          );

        for (const marker of [
          "tags:",
          '"v*.*.*"',
          '"!v*.*.*-rc.*"',
          "tools/foundry-stable-release.py",
          "Verify stable tag matches published release candidate",
          "refs/tags/release-candidate",
          'repository_url="https://github.com/${GITHUB_REPOSITORY}.git"',
          '"$repository_url"',
          "No immutable release-candidate tag points to the stable commit",
          "BOA_INCLUDE_DEV_TESTS=false",
          "BOA_ZIP_NAME=bane-of-azeroth.zip",
          '.id == "bane-of-azeroth"',
          'index("bane-of-azeroth-dev-tests")',
          "--verify-tag",
          "--latest",
          ".isPrerelease == false",
          "bane-of-azeroth.zip.sha256",
        ]) {
          expect(source).toContain(
            marker,
          );
        }

        expect(source).not.toContain(
          "--prerelease",
        );
      },
    );

    test(
      "guards stable publication with version and changelog contracts",
      () => {
        expect(
          existsSync(
            RELEASE_TOOL,
          ),
        ).toBe(true);

        const source =
          read(
            RELEASE_TOOL,
          );

        for (const marker of [
          "Stable Foundry releases are disabled before 1.0.0.",
          "expected_tag =",
          'f"v{version}"',
          "README Foundry version does not match",
          "Changelog Unreleased must be empty",
          "Changelog is missing a dated release section",
          "Source manifest must remain channel-neutral",
          "def extract_notes(",
          "def command_self_test(",
        ]) {
          expect(source).toContain(
            marker,
          );
        }
      },
    );

    test(
      "keeps stable release files inside normal branch CI coverage",
      () => {
        const source =
          read(
            BUILD_WORKFLOW,
          );

        expect(source).toContain(
          '- ".github/workflows/release-foundry.yml"',
        );
        expect(source).toContain(
          '- "tools/foundry-stable-release.py"',
        );
      },
    );

    test(
      "documents the future tag-driven production release path",
      () => {
        const source =
          read(
            README,
          );

        expect(source).toContain(
          "Stable production releases are published from "
          + "version tags",
        );
        expect(source).toContain(
          "`vMAJOR.MINOR.PATCH`",
        );
        expect(source).toContain(
          "1.0.0",
        );
      },
    );
  },
);
