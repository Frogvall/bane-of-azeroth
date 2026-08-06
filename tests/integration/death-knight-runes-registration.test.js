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

const ROOT =
  resolve(".");
const RUNTIME =
  resolve(
    ROOT,
    "foundry",
    "scripts",
    "death-knight-runes.js",
  );
const ENTRYPOINT =
  resolve(
    ROOT,
    "foundry",
    "scripts",
    "bane-of-azeroth.js",
  );
const SETTINGS =
  resolve(
    ROOT,
    "foundry",
    "scripts",
    "automation-settings.js",
  );
const TEMPLATE =
  resolve(
    ROOT,
    "foundry",
    "templates",
    "automation-settings.hbs",
  );
const LANG =
  resolve(
    ROOT,
    "foundry",
    "lang",
    "en.json",
  );
const CSS =
  resolve(
    ROOT,
    "foundry",
    "styles",
    "bane-of-azeroth.css",
  );

function read(path) {
  return readFileSync(
    path,
    "utf-8",
  );
}

describe(
  "Death Knight rune registration",
  () => {
    test(
      "ships the rune runtime and all three rune icons",
      () => {
        expect(
          existsSync(
            RUNTIME,
          ),
        ).toBe(
          true,
        );

        for (
          const file
          of [
            "fallen_crusader.webp",
            "razorice.webp",
            "unending_thirst.webp",
          ]
        ) {
          expect(
            existsSync(
              resolve(
                ROOT,
                "foundry",
                "assets",
                "icons",
                "runes",
                file,
              ),
            ),
          ).toBe(
            true,
          );
        }
      },
    );

    test(
      "registers actor-sheet and item lifecycle hooks plus the public API",
      () => {
        const entrypoint =
          read(
            ENTRYPOINT,
          );

        for (
          const marker
          of [
            'from "./death-knight-runes.js"',
            'Hooks.on(\n    "createItem",\n    onCreateDeathKnightRuneItem',
            'Hooks.on(\n    "updateItem",\n    onUpdateDeathKnightRuneItem',
            'Hooks.on(\n    "deleteItem",\n    onDeleteDeathKnightRuneItem',
            'Hooks.on(\n    "renderDoDActorBaseSheet",\n    onRenderDeathKnightRuneActorSheet',
            "reconcileDeathKnightRunes",
            "reconcileDeathKnightRuneActor",
            "setDeathKnightRune",
            "clearDeathKnightRune",
            "getDeathKnightRuneState",
          ]
        ) {
          expect(
            entrypoint,
          ).toContain(
            marker,
          );
        }
      },
    );

    test(
      "registers a default-enabled granular automation setting and sheet UI",
      () => {
        const settings =
          read(
            SETTINGS,
          );
        const template =
          read(
            TEMPLATE,
          );
        const lang =
          JSON.parse(
            read(
              LANG,
            ),
          );
        const css =
          read(
            CSS,
          );

        expect(
          settings,
        ).toContain(
          'DEATH_KNIGHT_RUNES: "deathKnightRunesAutomation"',
        );

        expect(
          settings,
        ).toContain(
          "isDeathKnightRunesAutomationEnabled",
        );

        expect(
          template,
        ).toContain(
          "schema.fields.deathKnightRunesAutomation",
        );

        expect(
          lang.BOA.settings
            .automation
            .deathKnightRunesName,
        ).toBe(
          "Death Knight Runes",
        );

        expect(
          lang.BOA
            .deathKnightRunes
            .unendingThirst,
        ).toBe(
          "Unending Thirst",
        );

        expect(
          css,
        ).toContain(
          ".boa-death-knight-runes",
        );
      },
    );

    test(
      "keeps Fallen Crusader, Razorice, and the stretch rule manual",
      () => {
        const runtime =
          read(
            RUNTIME,
          );

        expect(
          runtime,
        ).toContain(
          'automated: false',
        );

        expect(
          runtime,
        ).not.toContain(
          "living creature",
        );

        expect(
          runtime,
        ).not.toContain(
          "magical weapon",
        );

        expect(
          runtime,
        ).not.toContain(
          "stretchRest",
        );

        expect(
          runtime,
        ).toContain(
          '"system.movement.value"',
        );

        expect(
          runtime,
        ).toContain(
          "applyOnlyWhenEquipped",
        );
        expect(
          runtime,
        ).not.toContain(
          "ACTIVE_EFFECT_MODES",
        );

        expect(
          runtime,
        ).toContain(
          '?.phase ===\n          "final"',
        );
      },
    );
  },
);
