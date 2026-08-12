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

const RUNTIME = resolve(
  "foundry",
  "scripts",
  "frostreaper.js",
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

const GENERATOR = resolve(
  "tools",
  "generate-system-test-macros.py",
);

function read(
  path,
) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "Frostreaper aura registration",
  () => {
    test("registers the visual lifecycle hooks without movement or BUSHCRAFT automation", () => {
      const entrypoint =
        read(
          ENTRYPOINT,
        );

      for (const marker of [
        'from "./frostreaper.js"',
        'Hooks.on("drawToken", drawFrostreaperAura);',
        '"preCreateChatMessage",\n    onPreCreateFrostreaperChatMessage',
        '"createChatMessage",\n    onCreateFrostreaperChatMessage',
        '"deleteChatMessage",\n    onDeleteFrostreaperChatMessage',
        '"updateCombat",\n    onFrostreaperCombatChange',
        '"updateCombatant",\n    onFrostreaperCombatChange',
        "drawAllFrostreaperAuras,",
        "isFrostreaperActivationActive,",
        "getFrostreaperAuraData,",
      ]) {
        expect(
          entrypoint,
        ).toContain(
          marker,
        );
      }

      const runtime =
        read(
          RUNTIME,
        );

      expect(
        runtime,
      ).toContain(
        "heroic-class-ability.death-knight.frostreaper",
      );

      expect(
        runtime,
      ).toContain(
        "FROSTREAPER_AURA_RANGE = 10",
      );

      expect(
        runtime,
      ).not.toContain(
        "BUSHCRAFT",
      );

      expect(
        runtime,
      ).not.toContain(
        "movement rate",
      );
    });

    test("registers a default-enabled Frostreaper automation setting", () => {
      const settings =
        read(
          SETTINGS,
        );

      expect(
        settings,
      ).toContain(
        'FROSTREAPER: "frostreaperAutomation"',
      );

      expect(
        settings,
      ).toContain(
        "isFrostreaperAutomationEnabled",
      );

      const template =
        read(
          TEMPLATE,
        );

      expect(
        template,
      ).toContain(
        "schema.fields.frostreaperAutomation",
      );

      const lang =
        JSON.parse(
          read(
            LANG,
          ),
        );

      expect(
        lang.BOA.settings
          .automation
          .frostreaperName,
      ).toBe(
        "Frostreaper",
      );

      expect(
        lang.BOA.settings
          .automation
          .frostreaperHint,
      ).toContain(
        "10 m",
      );

      expect(
        lang.BOA.settings
          .automation
          .frostreaperHint,
      ).toContain(
        "turn in the next round",
      );
    });

    test("ships a dedicated Frostreaper system Macro", () => {
      const generator =
        read(
          GENERATOR,
        );

      for (const marker of [
        '"key": "frostreaper"',
        '"id": "BoaDevFrost00015"',
        '"file": "verify-frostreaper.js"',
        '"name": "BOA DEV – Verify Frostreaper"',
      ]) {
        expect(
          generator,
        ).toContain(
          marker,
        );
      }
    });
  },
);
