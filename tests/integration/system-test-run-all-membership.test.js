import {
  describe,
  expect,
  test,
} from "vitest";
import {
  readFileSync,
} from "node:fs";

const generator = readFileSync(
  new URL(
    "../../tools/generate-system-test-macros.py",
    import.meta.url,
  ),
  "utf8",
);

const runAll = readFileSync(
  new URL(
    "../system/macros/run-all.js",
    import.meta.url,
  ),
  "utf8",
);

describe(
  "system-test Run All suite membership",
  () => {
    test(
      "uses the Macro generator as the single suite-membership source",
      () => {
        expect(
          generator,
        ).toContain(
          "SYSTEM_TEST_SUITE_MEMBERS_PLACEHOLDER",
        );
        expect(
          generator,
        ).toContain(
          "def system_test_suite_member_keys()",
        );
        expect(
          generator,
        ).toContain(
          'macro.get("suiteMember") is True',
        );
        expect(
          generator,
        ).toContain(
          'key=lambda macro: int(macro["suiteOrder"])',
        );
        expect(
          generator,
        ).toContain(
          "suite_members",
        );
        expect(
          generator,
        ).toContain(
          "system_test_suite_member_keys()",
        );
        expect(
          generator,
        ).toContain(
          "validate_system_test_suite_metadata",
        );

        expect(
          runAll,
        ).toContain(
          "__BOA_SYSTEM_TEST_SUITE_MEMBERS__",
        );
        expect(
          runAll,
        ).not.toContain(
          "const orderedKeys = [",
        );
      },
    );

    test(
      "verifies generated suite membership against the imported compendium",
      () => {
        expect(
          runAll,
        ).toContain(
          "suiteMemberPath",
        );
        expect(
          runAll,
        ).toContain(
          "actualSuiteKeys",
        );
        expect(
          runAll,
        ).toContain(
          "expectedSuiteKeys",
        );
        expect(
          runAll,
        ).toContain(
          "Developer-test pack suite membership matches generated Run All contract",
        );
      },
    );
  },
);
