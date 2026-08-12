import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  test,
} from "vitest";

const PACKAGE_JSON =
  "package.json";
const PACKAGE_LOCK =
  "package-lock.json";

function readJson(path) {
  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  );
}

function versionTuple(version) {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
      .exec(
        version,
      );

  expect(
    match,
    `expected plain semver, got ${version}`,
  ).not.toBeNull();

  return match
    .slice(1)
    .map(Number);
}

function isAtLeast(
  actual,
  minimum,
) {
  for (
    let index = 0;
    index < 3;
    index += 1
  ) {
    if (
      actual[index]
      > minimum[index]
    ) {
      return true;
    }
    if (
      actual[index]
      < minimum[index]
    ) {
      return false;
    }
  }
  return true;
}

describe(
  "npm dependency security baseline",
  () => {
    test(
      "keeps npm packages test/build-only",
      () => {
        const manifest =
          readJson(
            PACKAGE_JSON,
          );

        expect(
          manifest.dependencies,
        ).toBeUndefined();

        expect(
          manifest.devDependencies,
        ).toMatchObject({
          vitest: "4.1.10",
          "@vitest/coverage-v8":
            "4.1.10",
        });
      },
    );

    test(
      "locks patched Nanoid and PostCSS transitive versions",
      () => {
        const lock =
          readJson(
            PACKAGE_LOCK,
          );

        const nanoid =
          lock.packages[
            "node_modules/nanoid"
          ];
        const postcss =
          lock.packages[
            "node_modules/postcss"
          ];

        expect(
          nanoid,
        ).toBeDefined();
        expect(
          postcss,
        ).toBeDefined();

        // GHSA-2v37-7h3g-55p8:
        // nanoid < 3.3.17 is affected.
        expect(
          isAtLeast(
            versionTuple(
              nanoid.version,
            ),
            [3, 3, 17],
          ),
        ).toBe(true);

        expect(
          versionTuple(
            nanoid.version,
          )[0],
        ).toBe(3);

        // GHSA-fxqj-rqcc-2cmp:
        // postcss <= 8.5.22 is affected.
        expect(
          isAtLeast(
            versionTuple(
              postcss.version,
            ),
            [8, 5, 23],
          ),
        ).toBe(true);

        expect(
          versionTuple(
            postcss.version,
          )[0],
        ).toBe(8);

        expect(
          nanoid.dev,
        ).toBe(true);
        expect(
          postcss.dev,
        ).toBe(true);
      },
    );
  },
);
