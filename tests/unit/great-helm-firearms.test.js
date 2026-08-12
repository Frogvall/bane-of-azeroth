import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  GREAT_HELM_FIREARMS_BANE,
  buildGreatHelmFirearmsBanes,
  getGreatHelmFirearmsCandidates,
  isCanonicalEnglishGreatHelm,
  parseGreatHelmBanes,
  reconcileGreatHelmFirearms,
  reconcileGreatHelmFirearmsItem,
} from "../../foundry/scripts/great-helm-firearms.js";

function item({
  id = "great-helm",
  name = "Great Helm",
  type = "helmet",
  rating = 2,
  banes =
    "Awareness, Bows, Crossbows, Slings",
} = {}) {
  return {
    id,
    uuid:
      `Item.${id}`,
    name,
    type,
    system: {
      rating,
      banes,
    },
    update:
      vi.fn(
        async function (
          changes,
        ) {
          if (
            Object.hasOwn(
              changes,
              "system.banes",
            )
          ) {
            this.system.banes =
              changes[
                "system.banes"
              ];
          }
          return this;
        },
      ),
  };
}

describe(
  "Great Helm Firearms compatibility",
  () => {
    test(
      "recognizes the untouched English Core Set signature",
      () => {
        const greatHelm =
          item();

        expect(
          isCanonicalEnglishGreatHelm(
            greatHelm,
          ),
        ).toBe(
          true,
        );

        expect(
          buildGreatHelmFirearmsBanes(
            greatHelm,
          ),
        ).toBe(
          "Awareness, Bows, Crossbows, Slings, Firearms",
        );
      },
    );

    test(
      "does not treat the Swedish Tunnhjälm as supported English content",
      () => {
        const tunnhjalm =
          item({
            name:
              "Tunnhjälm",
            banes:
              "Upptäcka fara, Armborst, Pilbåge, Slunga",
          });

        expect(
          isCanonicalEnglishGreatHelm(
            tunnhjalm,
          ),
        ).toBe(
          false,
        );
        expect(
          buildGreatHelmFirearmsBanes(
            tunnhjalm,
          ),
        ).toBeNull();
      },
    );

    test(
      "leaves already-correct and user-modified Great Helms alone",
      () => {
        const alreadyCorrect =
          item({
            banes:
              "Awareness, Bows, Crossbows, Slings, Firearms",
          });
        const modified =
          item({
            banes:
              "Awareness, Bows, Crossbows, Slings, Acrobatics",
          });

        expect(
          isCanonicalEnglishGreatHelm(
            alreadyCorrect,
          ),
        ).toBe(
          false,
        );
        expect(
          isCanonicalEnglishGreatHelm(
            modified,
          ),
        ).toBe(
          false,
        );
      },
    );

    test(
      "reconcile appends Firearms additively and only once",
      async () => {
        const greatHelm =
          item();

        await expect(
          reconcileGreatHelmFirearmsItem(
            greatHelm,
            {
              authorityCheck:
                () => true,
            },
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          parseGreatHelmBanes(
            greatHelm
              .system
              .banes,
          ),
        ).toEqual([
          "Awareness",
          "Bows",
          "Crossbows",
          "Slings",
          GREAT_HELM_FIREARMS_BANE,
        ]);

        expect(
          greatHelm.update,
        ).toHaveBeenCalledTimes(
          1,
        );

        await expect(
          reconcileGreatHelmFirearmsItem(
            greatHelm,
            {
              authorityCheck:
                () => true,
            },
          ),
        ).resolves.toBe(
          false,
        );

        expect(
          greatHelm.update,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    test(
      "reconcile is GM-authoritative",
      async () => {
        const greatHelm =
          item();

        await expect(
          reconcileGreatHelmFirearmsItem(
            greatHelm,
            {
              authorityCheck:
                () => false,
            },
          ),
        ).resolves.toBe(
          false,
        );

        expect(
          greatHelm.update,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "world and Actor-embedded items share one reconciliation pass",
      async () => {
        const worldHelm =
          item({
            id:
              "world-helm",
          });
        const actorHelm =
          item({
            id:
              "actor-helm",
          });
        const unrelated =
          item({
            id:
              "sword",
            name:
              "Sword",
            type:
              "weapon",
          });

        const actors = [
          {
            id:
              "actor",
            items: [
              actorHelm,
              unrelated,
            ],
          },
        ];

        expect(
          getGreatHelmFirearmsCandidates({
            items: [
              worldHelm,
            ],
            actors,
          }),
        ).toEqual([
          worldHelm,
          actorHelm,
          unrelated,
        ]);

        await expect(
          reconcileGreatHelmFirearms({
            authorityCheck:
              () => true,
            items: [
              worldHelm,
            ],
            actors,
          }),
        ).resolves.toEqual({
          checked:
            3,
          updated:
            2,
        });

        expect(
          worldHelm
            .system
            .banes,
        ).toContain(
          "Firearms",
        );
        expect(
          actorHelm
            .system
            .banes,
        ).toContain(
          "Firearms",
        );
        expect(
          unrelated.update,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
