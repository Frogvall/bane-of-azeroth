import {
  existsSync,
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
    expect(labels.groupHeroicAbilities).toBe(
      "Heroic Abilities",
    );
    expect(labels.groupKinAbilities).toBe(
      "Kin Abilities",
    );
    expect(labels.warStompName).toBe(
      "War Stomp",
    );
    expect(labels.eyeBeamName).toBe(
      "Eye Beam",
    );
    expect(labels.mageBrillianceName).toBe(
      "Mage's Brilliance",
    );
    expect(labels.evokersLegacyName).toBe(
      "Evoker's Legacy",
    );
  });

  test("uses Foundry ApplicationV2 like Dragonbane", () => {
    const source = read(SETTINGS_JS);

    expect(source).toContain(
      "HandlebarsApplicationMixin(ApplicationV2)",
    );
    expect(source).toContain(
      "static DEFAULT_OPTIONS",
    );
    expect(source).toContain(
      'tag: "form"',
    );
    expect(source).toContain(
      '"dragonbane-settings"',
    );
    expect(source).toContain(
      "static PARTS",
    );
    expect(source).toContain(
      '"templates/generic/form-footer.hbs"',
    );
    expect(source).toContain(
      "SchemaField",
    );
    expect(source).toContain(
      "BooleanField",
    );
    expect(source).toContain(
      "static async _onSubmit",
    );
  });

  test("lets formGroup render all native checkbox rows", () => {
    const template = read(TEMPLATE);

    expect(template).toContain("<fieldset>");
    expect(template).toContain("<legend>");
    expect(
      template.match(/\{\{formGroup/g),
    ).toHaveLength(10);
    expect(template).toContain(
      "schema.fields.elementalTotemAutomation",
    );
    expect(template).toContain(
      "schema.fields.demonAutomation",
    );
    expect(template).toContain(
      "schema.fields.mageBrillianceAutomation",
    );
    expect(template).toContain(
      "schema.fields.evokersLegacyAutomation",
    );
    expect(template).toContain(
      "schema.fields.warStompAutomation",
    );
    expect(template).toContain(
      "schema.fields.eyeBeamAutomation",
    );
    expect(template).toContain(
      "schema.fields.frostreaperAutomation",
    );
    expect(template).toContain(
      "schema.fields.deathKnightRunesAutomation",
    );
    expect(template).not.toContain("<form");
    expect(template).not.toContain("<button");
    expect(template).not.toContain(
      "boa-automation-setting",
    );
  });

  test("removes the imitation stylesheet", () => {
    const manifest = JSON.parse(read(MANIFEST));

    expect(manifest.styles ?? []).not.toContain(
      "styles/automation-settings.css",
    );
    expect(existsSync(STYLESHEET)).toBe(false);
  });
});
