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
    "utf-8",
  );
}

describe(
  "Shadowform visual registration",
  () => {
    test(
      "entrypoint registers cast, token, scene, sheet, actor and rest paths",
      () => {
        const source =
          read(
            "foundry/scripts/bane-of-azeroth.js",
          );

        expect(source).toContain(
          'from "./shadowform-visuals.js";',
        );
        expect(source).toContain(
          'Hooks.on("drawToken", onDrawShadowformToken);',
        );
        expect(source).toContain(
          'Hooks.on("canvasReady", reconcileShadowformCanvas);',
        );
        expect(source).toContain(
          'Hooks.on("updateActor", onUpdateShadowformActor);',
        );
        expect(source).toContain(
          'Hooks.on(\n    "createChatMessage",\n    onCreateShadowformSpellMessage,',
        );
        expect(source).toContain(
          'Hooks.on(\n    "renderDoDActorBaseSheet",\n    onRenderShadowformActorSheet,',
        );
        expect(source).toContain(
          "patchShadowformRestLifecycle();",
        );
      },
    );

    test(
      "setting is independent, default-on infrastructure and presented as Spells",
      () => {
        const settings =
          read(
            "foundry/scripts/automation-settings.js",
          );
        const template =
          read(
            "foundry/templates/automation-settings.hbs",
          );
        const lang =
          read(
            "foundry/lang/en.json",
          );

        expect(settings).toContain(
          'SHADOWFORM_VISUAL: "shadowformVisualAutomation"',
        );
        expect(settings).toContain(
          "isShadowformVisualAutomationEnabled",
        );
        expect(template).toContain(
          "schema.fields.shadowformVisualAutomation",
        );
        expect(template).toContain(
          "BOA.settings.automation.groupSpells",
        );
        expect(lang).toContain(
          '"shadowformVisualName": "Shadowform Visuals"',
        );
      },
    );

    test(
      "portrait CSS is static and contains no animation",
      () => {
        const css =
          read(
            "foundry/styles/bane-of-azeroth.css",
          );

        expect(css).toContain(
          ".boa-shadowform-active",
        );
        expect(css).toContain(
          "hue-rotate",
        );
        expect(css).not.toContain(
          "@keyframes boa-shadowform",
        );
      },
    );

    test(
      "existing End Effects workflow includes Shadowform",
      () => {
        const source =
          read(
            "foundry/scripts/managed-effect-lifecycle.js",
          );

        expect(source).toContain(
          'id: "shadowform"',
        );
        expect(source).toContain(
          'type: "shadowform"',
        );
        expect(source).toContain(
          "endShadowform",
        );
      },
    );

    test(
      "runtime identifies the generated Shadowform by stable contentKey",
      () => {
        const content =
          JSON.parse(
            read(
              "foundry/content/spells.json",
            ),
          );
        const spell =
          content.spells.find(
            candidate =>
              candidate.key ===
                "shadowform",
          );

        expect(spell).toMatchObject({
          id: "Shadowform0JkLmN",
          name: "Shadowform",
          duration: "stretch",
        });

        const runtime =
          read(
            "foundry/scripts/shadowform-visuals.js",
          );
        expect(runtime).toContain(
          '"spells.shadowform"',
        );
      },
    );
  },
);
