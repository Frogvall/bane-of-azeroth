import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  FIREARMS_SKILL_NAME,
  appendFirearmsBaseSkill,
  buildFirearmsSkillData,
  isFirearmsSkill,
  patchDragonbaneBaseSkills,
  registerFirearmsBaseSkillAdapter,
} from "../../foundry/scripts/firearms-base-skill.js";

describe(
  "Firearms base skill",
  () => {
    test(
      "builds the canonical Dragonbane weapon skill",
      () => {
        const firearms =
          buildFirearmsSkillData();

        expect(
          firearms,
        ).toMatchObject({
          name:
            "Firearms",
          type:
            "skill",
          system: {
            skillType:
              "weapon",
            attribute:
              "agl",
            value:
              0,
            advance:
              0,
            hideTrained:
              false,
            taught:
              false,
          },
        });

        expect(
          isFirearmsSkill(
            firearms,
          ),
        ).toBe(true);
        expect(
          FIREARMS_SKILL_NAME,
        ).toBe("Firearms");
      },
    );

    test(
      "adds Firearms to Dragonbane base skills without modifying the native array",
      () => {
        const native = [
          {
            name:
              "Bows",
            type:
              "skill",
            system: {
              skillType:
                "weapon",
            },
          },
        ];

        const result =
          appendFirearmsBaseSkill(
            native,
          );

        expect(
          result,
        ).not.toBe(native);
        expect(
          native,
        ).toHaveLength(1);
        expect(
          result.map(
            skill =>
              skill.name,
          ),
        ).toEqual([
          "Bows",
          "Firearms",
        ]);
      },
    );

    test(
      "does not duplicate an existing Firearms weapon skill",
      () => {
        const existing = [
          buildFirearmsSkillData(),
        ];

        expect(
          appendFirearmsBaseSkill(
            existing,
          ),
        ).toBe(existing);
      },
    );

    test(
      "leaves a non-array native result untouched",
      () => {
        expect(
          appendFirearmsBaseSkill(
            null,
          ),
        ).toBeNull();
      },
    );

    test(
      "wraps Dragonbane getBaseSkills idempotently",
      async () => {
        class UtilityClass {
          static getBaseSkills =
            vi.fn(
              async () => [
                {
                  name:
                    "Bows",
                  type:
                    "skill",
                  system: {
                    skillType:
                      "weapon",
                  },
                },
              ],
            );
        }

        expect(
          patchDragonbaneBaseSkills({
            UtilityClass,
          }),
        ).toBe(true);
        expect(
          patchDragonbaneBaseSkills({
            UtilityClass,
          }),
        ).toBe(true);

        const skills =
          await UtilityClass
            .getBaseSkills();

        expect(
          skills.map(
            skill =>
              skill.name,
          ),
        ).toEqual([
          "Bows",
          "Firearms",
        ]);
      },
    );

    test(
      "register helper accepts an injected Dragonbane Utility class",
      async () => {
        class UtilityClass {
          static async getBaseSkills() {
            return [];
          }
        }

        await expect(
          registerFirearmsBaseSkillAdapter({
            UtilityClass,
          }),
        ).resolves.toBe(true);

        await expect(
          UtilityClass
            .getBaseSkills(),
        ).resolves.toEqual([
          expect.objectContaining({
            name:
              "Firearms",
          }),
        ]);
      },
    );

    test(
      "fails safely when Dragonbane getBaseSkills is unavailable",
      () => {
        expect(
          patchDragonbaneBaseSkills({
            UtilityClass: {},
          }),
        ).toBe(false);
      },
    );
  },
);
