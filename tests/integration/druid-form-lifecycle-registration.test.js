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

const entry =
  readFileSync(
    resolve(
      "foundry",
      "scripts",
      "bane-of-azeroth.js",
    ),
    "utf8",
  );

describe(
  "Druid form lifecycle registration",
  () => {
    test(
      "entrypoint owns lifecycle hooks, socket, rest patch, and public API",
      () => {
        for (
          const marker
          of [
            'from "./druid-form-lifecycle.js"',
            'Hooks.on(\n    "createChatMessage",\n    onCreateDruidFormSpellMessage',
            'Hooks.on(\n    "renderDoDActorBaseSheet",\n    onRenderDruidFormLifecycleActorSheet',
            "registerDruidFormLifecycleSocket();",
            "patchDruidFormRestLifecycle();",
            "activateDruidIncarnation,",
            "switchDruidForm,",
            "expireDruidIncarnationsForRest,",
            "getDruidFormSwitchOptions,",
            "openDruidFormSwitchDialog,",
          ]
        ) {
          expect(
            entry,
          ).toContain(
            marker,
          );
        }
      },
    );
  },
);
