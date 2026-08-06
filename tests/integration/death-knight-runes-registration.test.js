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
            "buildUnendingThirstEffectData",
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
      "registers the setting and renders rune controls on Dragonbane weapon rows",
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
        const runtime =
          read(
            RUNTIME,
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
          settings,
        ).toContain(
          "rerenderOpenDeathKnightRuneSheets",
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
          runtime,
        ).toContain(
          "deathKnightRuneWeaponRows",
        );

        expect(
          runtime,
        ).toContain(
          "tr.sheet-table-data.item[data-item-id]",
        );

        expect(
          runtime,
        ).toContain(
          '"td.text-data"',
        );

        expect(
          runtime,
        ).toContain(
          "DialogV2.wait",
        );

        expect(
          runtime,
        ).not.toContain(
          'root.querySelector(\n      ".heroic-abilities"',
        );

        expect(
          css,
        ).toContain(
          ".boa-death-knight-rune-slot",
        );
      },
    );

    test(
      "localizes rune descriptions and renders rune slots on Main and Inventory weapon rows",
      () => {
        const runtime =
          read(
            RUNTIME,
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
          lang.BOA
            .deathKnightRunes
            .fallenCrusaderDescription,
        ).toBe(
          "Whenever you deal damage to a living creature with the weapon, you heal 1 HP.",
        );

        expect(
          lang.BOA
            .deathKnightRunes
            .razoriceDescription,
        ).toBe(
          "The weapon is cold to the touch, and attacks with it count as magical.",
        );

        expect(
          lang.BOA
            .deathKnightRunes
            .unendingThirstDescription,
        ).toBe(
          "While wielding the weapon, your movement rate increases by 2.",
        );

        expect(
          runtime,
        ).toContain(
          'data-droptarget="weapon"',
        );

        expect(
          runtime,
        ).toContain(
          'data-droptarget="inventory"',
        );

        expect(
          runtime,
        ).toContain(
          "boa-death-knight-rune-description",
        );

        expect(
          runtime,
        ).toContain(
          "active.description",
        );

        expect(
          runtime,
        ).not.toContain(
          '"BOA.deathKnightRunes.engraved"',
        );

        expect(
          css,
        ).toContain(
          ".boa-death-knight-rune-description",
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
