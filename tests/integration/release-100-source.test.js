import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  test,
} from "vitest";

const MODULE =
  "foundry/module.json";
const README =
  "README.md";
const CHANGELOG =
  "foundry/CHANGELOG.md";
const RC_WORKFLOW =
  ".github/workflows/release-foundry-rc.yml";
const STABLE_WORKFLOW =
  ".github/workflows/release-foundry.yml";

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "release source and main-driven RC pipeline",
  () => {
    test(
      "keeps release source metadata coherent before RC testing",
      () => {
        const manifest = JSON.parse(read(MODULE));
        const readme = read(README);
        const changelog = read(CHANGELOG);

        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(manifest.manifest).toBeUndefined();
        expect(manifest.download).toBeUndefined();
        expect(readme).toContain(
          `**Current Foundry module version:** ${manifest.version}`,
        );
        expect(readme).toContain(
          "**Current status:** Foundry VTT 1.0 release line",
        );
        expect(readme).not.toContain(
          "Active development / prerelease testing",
        );
        expect(readme).not.toContain(
          "Bane of Azeroth remains an alpha project.",
        );
        expect(changelog).toMatch(
          /^## \[Unreleased\]/m,
        );
      },
    );

    test(
      "creates the next immutable RC automatically from pushes to main",
      () => {
        const rc = read(RC_WORKFLOW);
        for (const marker of [
          "push:",
          "branches:",
          "- main",
          'prefix="v${source_version}-rc."',
          'git ls-remote \\',
          'refs/tags/${prefix}*',
          'same_sha_number=""',
          'rc_number="$same_sha_number"',
          'rc_number="$((latest + 1))"',
          'build_version="${source_version}-rc.${rc_number}"',
          'immutable_tag="v${build_version}"',
          "Create immutable release-candidate tag",
          'ref="refs/tags/${IMMUTABLE_TAG}"',
          'sha="$GITHUB_SHA"',
          'release_tag="release-candidate"',
        ]) {
          expect(rc).toContain(marker);
        }
        expect(rc).not.toContain("workflow_dispatch:");
        expect(rc).not.toContain("GITHUB_RUN_NUMBER");
        expect(rc).not.toContain("GITHUB_RUN_ATTEMPT");
      },
    );

    test(
      "validates stable release metadata before building an RC",
      () => {
        const rc = read(RC_WORKFLOW);
        const preflight =
          rc.indexOf(
            "Verify stable release contract before RC",
          );
        const build =
          rc.indexOf(
            "      - name: Build production release candidate",
          );

        expect(preflight).toBeGreaterThan(-1);
        expect(build).toBeGreaterThan(-1);
        expect(preflight).toBeLessThan(build);

        for (const marker of [
          "python3 tools/foundry-stable-release.py",
          "check \\",
          '--tag "v${source_version}"',
        ]) {
          expect(rc).toContain(marker);
        }
      },
    );
    test(
      "stable publication requires the exact published RC commit",
      () => {
        const stable = read(STABLE_WORKFLOW);
        for (const marker of [
          "Verify stable tag matches published release candidate",
          "refs/tags/release-candidate",
          'rc_commit="$(',
          'refs/tags/release-candidate',
          'stable_commit="$GITHUB_SHA"',
          'refs/tags/v${source_version}-rc.*',
          "Stable tag commit does not match the published release candidate",
          "No immutable release-candidate tag points to the stable commit",
        ]) {
          expect(stable).toContain(marker);
        }
      },
    );
  },
);
