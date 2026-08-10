import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

function read(path) {
  return readFileSync(
    resolve(path),
    "utf8",
  );
}

describe(
  "development / production package identity",
  () => {
    test(
      "source manifest remains production-canonical",
      () => {
        const manifest =
          JSON.parse(
            read(
              "foundry/module.json",
            ),
          );

        expect(manifest.id).toBe(
          "bane-of-azeroth",
        );
        expect(manifest.title).toBe(
          "Bane of Azeroth",
        );
      },
    );

    test(
      "Adventure pack name is stable while package namespace is dynamic",
      () => {
        const source =
          read(
            "foundry/scripts/core/constants.js",
          );

        expect(source).toContain(
          'export const ADVENTURE_PACK_NAME = "bane-of-azeroth"; // BOA_REBRAND_PRESERVE',
        );
        expect(source).toContain(
          "`${MODULE_ID}.${ADVENTURE_PACK_NAME}`",
        );
      },
    );

    test(
      "packaging derives and validates development identity",
      () => {
        const source =
          read(
            "tools/package-foundry.sh",
          );

        expect(source).toContain(
          'DEVELOPMENT_MODULE_ID="bane-of-azeroth-dev"',
        );
        expect(source).toContain(
          'DEVELOPMENT_MODULE_TITLE="Bane of Azeroth - Development"',
        );
        expect(source).toContain(
          'PACK_BUILD_SOURCE="$PACK_SOURCE"',
        );
        expect(source).toContain(
          '--target-id "$MODULE_ID"',
        );
        expect(source).toContain(
          '.id = $moduleId',
        );
        expect(source).toContain(
          '.title = $moduleTitle',
        );
      },
    );

    test(
      "workflow validates id and title at build and prerelease boundaries",
      () => {
        const source =
          read(
            ".github/workflows/build-foundry.yml",
          );

        expect(source).toContain(
          'expected_module_id="bane-of-azeroth-dev"',
        );
        expect(source).toContain(
          'expected_module_title="Bane of Azeroth - Development"',
        );

        expect(
          source.match(
            /\.id == \$moduleId/g,
          )?.length ??
            0,
        ).toBeGreaterThanOrEqual(
          3,
        );

        expect(
          source.match(
            /\.title == \$moduleTitle/g,
          )?.length ??
            0,
        ).toBeGreaterThanOrEqual(
          3,
        );
      },
    );

    test(
      "system test covers installed development identity",
      () => {
        const macro =
          read(
            "tests/system/macros/verify-package-identity.js",
          );
        const generator =
          read(
            "tools/generate-system-test-macros.py",
          );

        expect(macro).toContain(
          '"bane-of-azeroth-dev"',
        );
        expect(macro).toContain(
          '"bane-of-azeroth"; // BOA_REBRAND_PRESERVE',
        );
        expect(macro).toContain(
          '"bane-of-azeroth-dev.bane-of-azeroth"',
        );
        expect(generator).toContain(
          '"key": "package-identity"',
        );
      },
    );
  },
);
