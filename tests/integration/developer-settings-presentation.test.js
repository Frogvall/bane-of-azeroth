import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function read(path) {
  return readFileSync(resolve(path), "utf-8");
}

describe("developer diagnostics presentation and packaging", () => {
  test("branch packages set the development-build flag in the active package namespace and production removes its canonical flag", () => {
    const source = read("tools/package-foundry.sh");

    expect(source).toContain(
      '--arg activeModuleId "$MODULE_ID"',
    );
    expect(source).toContain(
      ".flags[$activeModuleId].developmentBuild = true",
    );
    expect(source).toContain(
      "($activeModuleId): {",
    );

    expect(source).toContain(
      'del(.flags["bane-of-azeroth"].developmentBuild)',
    );
  });

  test("provides a reusable Developer / Diagnostics settings surface", () => {
    const template = read("foundry/templates/developer-settings.hbs");
    const lang = JSON.parse(read("foundry/lang/en.json"));

    expect(template).toContain("schema.fields.druidLifecycleTrace");
    expect(lang.BOA.settings.developer.menuName).toBe("Developer / Diagnostics");
    expect(lang.BOA.settings.developer.groupDiagnostics).toBe("Diagnostics");
  });
});
