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

const CHECKER = resolve(
  "tools",
  "check-foundry-generators.py",
);
const SYSTEM_GENERATOR = resolve(
  "tools",
  "generate-system-test-macros.py",
);
const WORKFLOW = resolve(
  ".github",
  "workflows",
  "build-foundry.yml",
);
const PACKAGE_SCRIPT = resolve(
  "tools",
  "package-foundry.sh",
);
const PACKAGE_JSON = resolve(
  "package.json",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

describe("Foundry generator checks", () => {
  test("discovers generators dynamically and invokes --check", () => {
    const checker = read(CHECKER);

    expect(checker)
      .toContain('glob("generate-*.py")');
    expect(checker)
      .toContain('"--check"');
  });

  test("system-test Macro generation has a non-writing check mode", () => {
    const source = read(
      SYSTEM_GENERATOR,
    );

    for (const marker of [
      '"--check"',
      "tempfile.TemporaryDirectory",
      "Checked",
      "developer-test Macros",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("CI, packaging, and npm use the same central checker", () => {
    expect(read(WORKFLOW))
      .toContain(
        "python3 tools/check-foundry-generators.py",
      );
    expect(read(PACKAGE_SCRIPT))
      .toContain(
        '"${ROOT_DIR}/tools/check-foundry-generators.py"',
      );

    const packageJson = JSON.parse(
      read(PACKAGE_JSON),
    );
    expect(
      packageJson.scripts[
        "check:generated"
      ],
    ).toBe(
      "python3 tools/check-foundry-generators.py",
    );
  });
});
