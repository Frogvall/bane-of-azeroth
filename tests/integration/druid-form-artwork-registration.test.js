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

const ENTRYPOINT = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
);
const SETTINGS = resolve(
  "foundry",
  "scripts",
  "automation-settings.js",
);
const TEMPLATE = resolve(
  "foundry",
  "templates",
  "automation-settings.hbs",
);
const LANG = resolve(
  "foundry",
  "lang",
  "en.json",
);
const DRUID = resolve(
  "foundry",
  "scripts",
  "druid-forms.js",
);

function read(path) {
  return readFileSync(path, "utf8");
}

describe("Druid form artwork registration", () => {
  test("registers independent artwork automation enabled by default", () => {
    const settings = read(SETTINGS);
    const template = read(TEMPLATE);
    const lang = JSON.parse(read(LANG));

    expect(settings).toContain(
      'DRUID_FORM_ARTWORK: "druidFormArtworkAutomation"',
    );
    expect(settings).toContain(
      "isDruidFormArtworkAutomationEnabled",
    );
    expect(template).toContain(
      "schema.fields.druidFormArtworkAutomation",
    );
    expect(
      lang.BOA.settings.automation.druidFormArtworkName,
    ).toBeTruthy();
    expect(
      lang.BOA.settings.automation.druidFormArtworkHint,
    ).toBeTruthy();
  });

  test("wires artwork APIs, token lifecycle, sheet UI, and socket registration", () => {
    const entrypoint = read(ENTRYPOINT);

    for (const name of [
      "applyDruidFormArtwork",
      "restoreDruidHumanoidArtwork",
      "openDruidFormArtworkDialog",
      "onCreateDruidFormArtworkToken",
      "onRenderDruidFormArtworkActorSheet",
      "registerDruidFormArtworkSocket",
    ]) {
      expect(entrypoint).toContain(name);
    }

    expect(entrypoint).toContain(
      'Hooks.on(\n    "createToken",\n    onCreateDruidFormArtworkToken,',
    );
    expect(entrypoint).toContain(
      'Hooks.on(\n    "renderDoDActorBaseSheet",\n    onRenderDruidFormArtworkActorSheet,',
    );
    expect(entrypoint).toContain(
      "registerDruidFormArtworkSocket();",
    );
  });

  test("dialog markup is limited to owned profiles and uses image file-picker controls", () => {
    const source = read(DRUID);
    expect(source).toContain(
      "getAvailableDruidFormProfiles",
    );
    expect(source).toContain("<file-picker");
    expect(source).toContain("DialogV2.wait");
    expect(source).toContain(
      "boa-druid-form-artwork-button",
    );
  });
});
