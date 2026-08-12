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

function read(
  path,
) {
  return readFileSync(
    resolve(
      path,
    ),
    "utf8",
  );
}

describe(
  "development package JSON rebrand",
  () => {
    test(
      "rebrand tool handles semantic JSON keys, scalar ids, and embedded Macro source",
      () => {
        const source =
          read(
            "tools/rebrand-foundry-package.py",
          );

        expect(
          source,
        ).toContain(
          "def transform_json_key(",
        );
        expect(
          source,
        ).toContain(
          "def transform_json_string(",
        );
        expect(
          source,
        ).toContain(
          "def transform_json_value(",
        );
        expect(
          source,
        ).toContain(
          "Exact JSON scalar module id was not rebranded.",
        );
        expect(
          source,
        ).toContain(
          "JSON object key namespace was not rebranded.",
        );
        expect(
          source,
        ).toContain(
          'const BOA_TEST_MODULE_ID = "bane-of-azeroth-dev";',
        );
        expect(
          source,
        ).toContain(
          "// BOA_REBRAND_PRESERVE",
        );
      },
    );

    test(
      "packaging self-tests and rebrands generated developer-test JSON before packing",
      () => {
        const source =
          read(
            "tools/package-foundry.sh",
          );

        const selfTest =
          source.indexOf(
            'python3 "$REBRAND_TOOL" --self-test',
          );
        const generate =
          source.indexOf(
            '"${ROOT_DIR}/tools/generate-system-test-macros.py"',
          );
        const rebrand =
          source.indexOf(
            '--root "$DEV_TEST_SOURCE"',
            generate,
          );
        const pack =
          source.indexOf(
            'fvtt package pack "$DEV_TEST_PACK_NAME"',
            generate,
          );

        expect(
          selfTest,
        ).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          generate,
        ).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          rebrand,
        ).toBeGreaterThan(
          generate,
        );
        expect(
          pack,
        ).toBeGreaterThan(
          rebrand,
        );
      },
    );
  },
);
