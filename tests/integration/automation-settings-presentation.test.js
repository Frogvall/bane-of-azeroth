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

const MANIFEST = resolve(
  "foundry",
  "module.json",
);
const LANG = resolve(
  "foundry",
  "lang",
  "en.json",
);
const SETTINGS_JS = resolve(
  "foundry",
  "scripts",
  "automation-settings.js",
);
const TEMPLATE = resolve(
  "foundry",
  "templates",
  "automation-settings.hbs",
);
const STYLESHEET = resolve(
  "foundry",
  "styles",
  "automation-settings.css",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

describe("Automation Settings presentation", () => {
  test("uses the local Automation Settings title", () => {
    const lang = JSON.parse(read(LANG));
    const labels = lang.BOA.settings.automation;

    expect(labels.menuName).toBe("Automation Settings");
    expect(labels.menuLabel).toBe("Automation Settings");
    expect(labels.menuName).not.toContain("Bane of Azeroth");
    expect(labels.groupSummons).toBe("Summons");
  });

  test("uses a grouped standard form", () => {
    const template = read(TEMPLATE);

    expect(template).toContain(
      'class="boa-automation-settings-form standard-form"',
    );
    expect(template).toContain(
      'class="boa-automation-settings-group"',
    );
    expect(template).toContain("<fieldset");
    expect(template).toContain("<legend>");
    expect(template).toContain(
      'name="elementalTotemAutomation"',
    );
    expect(template).toContain(
      'name="demonAutomation"',
    );
    expect(template).toContain(
      'class="form-footer"',
    );
  });

  test("registers a dedicated dark-theme stylesheet", () => {
    const manifest = JSON.parse(read(MANIFEST));
    const css = read(STYLESHEET);
    const settings = read(SETTINGS_JS);

    expect(manifest.styles).toContain(
      "styles/automation-settings.css",
    );
    expect(settings).toContain('"theme-dark"');
    expect(css).toContain(
      ".window-app.bane-of-azeroth.automation-settings",
    );
    expect(css).toContain(
      ".boa-automation-settings-group",
    );
    expect(css).toContain(
      ".boa-automation-setting",
    );
  });
});
