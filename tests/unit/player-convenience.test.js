import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  resolvePlayerConvenienceActor,
  runChangeDruidFormMacro,
  runEndEffectsMacro,
} from "../../foundry/scripts/player-convenience.js";

function actor(
  id,
  {
    name = id,
    type = "character",
    isOwner = true,
  } = {},
) {
  return {
    id,
    uuid:
      `Actor.${id}`,
    name,
    type,
    isOwner,
    testUserPermission:
      vi.fn(
        () =>
          isOwner,
      ),
  };
}

function token(
  actorValue,
) {
  return {
    actor:
      actorValue,
  };
}

function notifications() {
  return {
    warn:
      vi.fn(),
    error:
      vi.fn(),
  };
}

beforeEach(() => {
  globalThis.CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: {
      OWNER:
        3,
    },
  };
});

describe(
  "Player convenience actor resolution",
  () => {
    test(
      "GM requires exactly one selected token and uses its Actor",
      async () => {
        const selected =
          actor(
            "gm-target",
            {
              isOwner:
                false,
            },
          );
        const notices =
          notifications();

        expect(
          await resolvePlayerConvenienceActor({
            user: {
              id:
                "gm",
              isGM:
                true,
            },
            controlledTokens: [
              token(
                selected,
              ),
            ],
            notifications:
              notices,
          }),
        ).toBe(
          selected,
        );

        expect(
          await resolvePlayerConvenienceActor({
            user: {
              id:
                "gm",
              isGM:
                true,
            },
            controlledTokens:
              [],
            notifications:
              notices,
          }),
        ).toBeNull();

        expect(
          notices.warn,
        ).toHaveBeenCalledWith(
          "Select exactly one token before using this macro.",
        );
      },
    );

    test(
      "GM refuses multiple selected Actors",
      async () => {
        const notices =
          notifications();

        expect(
          await resolvePlayerConvenienceActor({
            user: {
              id:
                "gm",
              isGM:
                true,
            },
            controlledTokens: [
              token(
                actor(
                  "one",
                ),
              ),
              token(
                actor(
                  "two",
                ),
              ),
            ],
            notifications:
              notices,
          }),
        ).toBeNull();
      },
    );

    test(
      "player prefers exactly one controlled owned Actor",
      async () => {
        const controlled =
          actor(
            "controlled",
          );
        const assigned =
          actor(
            "assigned",
          );

        expect(
          await resolvePlayerConvenienceActor({
            user: {
              id:
                "player",
              isGM:
                false,
              character:
                assigned,
            },
            controlledTokens: [
              token(
                controlled,
              ),
            ],
            actors: [
              controlled,
              assigned,
            ],
            notifications:
              notifications(),
          }),
        ).toBe(
          controlled,
        );
      },
    );

    test(
      "player falls back to assigned character",
      async () => {
        const assigned =
          actor(
            "assigned",
          );

        expect(
          await resolvePlayerConvenienceActor({
            user: {
              id:
                "player",
              isGM:
                false,
              character:
                assigned,
            },
            controlledTokens:
              [],
            actors: [
              assigned,
            ],
            notifications:
              notifications(),
          }),
        ).toBe(
          assigned,
        );
      },
    );

    test(
      "player falls back to the only owned character",
      async () => {
        const owned =
          actor(
            "owned",
          );
        const other =
          actor(
            "other",
            {
              isOwner:
                false,
            },
          );

        expect(
          await resolvePlayerConvenienceActor({
            user: {
              id:
                "player",
              isGM:
                false,
              character:
                null,
            },
            controlledTokens:
              [],
            actors: [
              owned,
              other,
            ],
            notifications:
              notifications(),
          }),
        ).toBe(
          owned,
        );
      },
    );

    test(
      "Change Druid Form wrapper opens only the existing Druid dialog",
      async () => {
        const selected =
          actor(
            "druid",
          );
        const openDialog =
          vi.fn(
            async () =>
              "druid-dialog-result",
          );

        await expect(
          runChangeDruidFormMacro({
            user: {
              id:
                "player",
              isGM:
                false,
              character:
                selected,
            },
            actors: [
              selected,
            ],
            controlledTokens:
              [],
            notifications:
              notifications(),
            openDruidFormSwitchDialog:
              openDialog,
          }),
        ).resolves.toBe(
          "druid-dialog-result",
        );

        expect(
          openDialog,
        ).toHaveBeenCalledWith(
          selected,
        );
      },
    );

    test(
      "End Effects wrapper opens only the existing managed-effect dialog",
      async () => {
        const selected =
          actor(
            "character",
          );
        const openDialog =
          vi.fn(
            async () =>
              "end-dialog-result",
          );

        await expect(
          runEndEffectsMacro({
            user: {
              id:
                "player",
              isGM:
                false,
              character:
                selected,
            },
            actors: [
              selected,
            ],
            controlledTokens:
              [],
            notifications:
              notifications(),
            openManagedEffectEndDialog:
              openDialog,
          }),
        ).resolves.toBe(
          "end-dialog-result",
        );

        expect(
          openDialog,
        ).toHaveBeenCalledWith(
          selected,
        );
      },
    );
  },
);
