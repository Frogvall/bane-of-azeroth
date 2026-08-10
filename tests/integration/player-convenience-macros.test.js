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

const ADVENTURE_ROOT =
  resolve(
    "foundry",
    "pack-src",
    "bane-of-azeroth",
    "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  );

function read(
  path,
) {
  return readFileSync(
    resolve(
      path,
    ),
    "utf-8",
  );
}

function readJson(
  path,
) {
  return JSON.parse(
    read(
      path,
    ),
  );
}

describe(
  "Player convenience Macros",
  () => {
    test(
      "source declares the two stable player-facing Macros",
      () => {
        const source =
          readJson(
            "foundry/content/macros/player-convenience.json",
          );

        expect(
          source.macros,
        ).toEqual([
          expect.objectContaining({
            key:
              "change-druid-form",
            id:
              "BoADruidForm0001",
            name:
              "Change Druid Form",
            img:
              "icons/svg/pawprint.svg",
            apiMethod:
              "runChangeDruidFormMacro",
          }),
          expect.objectContaining({
            key:
              "end-effects",
            id:
              "BoAEndEffects001",
            name:
              "End Effects",
            img:
              "icons/svg/cancel.svg",
            apiMethod:
              "runEndEffectsMacro",
          }),
        ]);
      },
    );

    test(
      "Adventure imports both generated Macros",
      () => {
        const adventure =
          readJson(
            resolve(
              ADVENTURE_ROOT,
              "_Adventure.json",
            ),
          );

        expect(
          adventure.macros,
        ).toHaveLength(
          2,
        );

        expect(
          adventure.macros.some(
            path =>
              path.endsWith(
                "_BoADruidForm0001.json",
              ),
          ),
        ).toBe(
          true,
        );
        expect(
          adventure.macros.some(
            path =>
              path.endsWith(
                "_BoAEndEffects001.json",
              ),
          ),
        ).toBe(
          true,
        );
      },
    );

    test(
      "generated Macros are thin API wrappers with the requested icons",
      () => {
        const adventure =
          readJson(
            resolve(
              ADVENTURE_ROOT,
              "_Adventure.json",
            ),
          );

        const documents =
          adventure.macros.map(
            relative =>
              readJson(
                resolve(
                  ADVENTURE_ROOT,
                  relative,
                ),
              ),
          );

        const change =
          documents.find(
            macro =>
              macro._id ===
                "BoADruidForm0001",
          );
        const end =
          documents.find(
            macro =>
              macro._id ===
                "BoAEndEffects001",
          );

        expect(
          change,
        ).toEqual(
          expect.objectContaining({
            name:
              "Change Druid Form",
            type:
              "script",
            scope:
              "global",
            img:
              "icons/svg/pawprint.svg",
          }),
        );
        expect(
          change.ownership.default,
        ).toBe(
          2,
        );
        expect(
          change.command,
        ).toContain(
          "runChangeDruidFormMacro",
        );

        expect(
          end,
        ).toEqual(
          expect.objectContaining({
            name:
              "End Effects",
            type:
              "script",
            scope:
              "global",
            img:
              "icons/svg/cancel.svg",
          }),
        );
        expect(
          end.ownership.default,
        ).toBe(
          2,
        );
        expect(
          end.command,
        ).toContain(
          "runEndEffectsMacro",
        );

        for (
          const macro
          of documents
        ) {
          expect(
            macro.command,
          ).not.toContain(
            "DialogV2",
          );
          expect(
            macro.command,
          ).not.toContain(
            "deleteEmbeddedDocuments",
          );
        }
      },
    );

    test(
      "generator is part of normal generator checks",
      () => {
        const checker =
          read(
            "tools/check-foundry-generators.py",
          );

        expect(
          checker,
        ).toContain(
          'glob("generate-*.py")',
        );

        const generator =
          read(
            "tools/generate-player-macros.py",
          );

        expect(
          generator,
        ).toContain(
          "--check",
        );
      },
    );
  },
);
