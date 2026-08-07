import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";

function makeItem(
  contentKey,
) {
  return {
    getFlag(
      moduleId,
      key,
    ) {
      if (
        moduleId === MODULE_ID &&
        key === "contentKey"
      ) {
        return contentKey;
      }
      return null;
    },
  };
}

function setPath(
  target,
  path,
  value,
) {
  const parts =
    path.split(".");
  let current =
    target;

  while (
    parts.length > 1
  ) {
    const part =
      parts.shift();
    current[
      part
    ] ??= {};
    current =
      current[
        part
      ];
  }

  current[
    parts[0]
  ] = structuredClone(
    value,
  );
}

function makeActor() {
  const actor = {
    id: "druid-1",
    uuid: "Actor.druid-1",
    isOwner: true,
    flags: {},
    system: {
      willPoints: {
        value: 10,
      },
    },
    items: [
      makeItem(
        "spells.savage-incarnation",
      ),
      makeItem(
        "spells.feral-incarnation",
      ),
      makeItem(
        "spells.incarnation-of-harmony",
      ),
      makeItem(
        "spells.incarnation-of-the-stars",
      ),
    ],
    getFlag(
      moduleId,
      key,
    ) {
      return this.flags?.[
        moduleId
      ]?.[
        key
      ];
    },
    async update(
      changes,
    ) {
      for (
        const [path, value]
        of Object.entries(
          changes,
        )
      ) {
        setPath(
          this,
          path,
          value,
        );
      }
      return this;
    },
  };

  return actor;
}

let lifecycle;

beforeEach(
  async () => {
    vi.resetModules();
    globalThis.game = {
      settings: {
        get:
          vi.fn(
            () => true,
          ),
      },
      user: null,
    };
    lifecycle =
      await import(
        "../../foundry/scripts/druid-form-lifecycle.js"
      );
  },
);

describe(
  "Druid form lifecycle",
  () => {
    test(
      "activates overlapping incarnations and exposes all available physical forms",
      async () => {
        const actor =
          makeActor();
        const applyArtwork =
          vi.fn(
            async () => true,
          );
        const restoreArtwork =
          vi.fn(
            async () => true,
          );

        await lifecycle
          .activateDruidIncarnation(
            actor,
            "spells.savage-incarnation",
            2,
            {
              bypassAuthority: true,
              applyArtwork,
              restoreArtwork,
            },
          );

        expect(
          actor.flags[MODULE_ID]
            .druidFormState,
        ).toEqual({
          currentForm: "travel",
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
          },
        });
        expect(
          applyArtwork,
        ).toHaveBeenLastCalledWith(
          actor,
          "travelPl2",
          {
            bypassAuthority: true,
          },
        );

        await lifecycle
          .activateDruidIncarnation(
            actor,
            "spells.feral-incarnation",
            3,
            {
              initialForm: "bear",
              bypassAuthority: true,
              applyArtwork,
              restoreArtwork,
            },
          );

        expect(
          lifecycle
            .getDruidFormSwitchOptions(
              actor,
            )
            .map(
              option =>
                option.form,
            ),
        ).toEqual([
          "humanoid",
          "travel",
          "bear",
          "cat",
        ]);
      },
    );

    test(
      "action switching is free while free-action switching costs exactly 1 WP",
      async () => {
        const actor =
          makeActor();
        const deps = {
          bypassAuthority: true,
          applyArtwork:
            vi.fn(
              async () => true,
            ),
          restoreArtwork:
            vi.fn(
              async () => true,
            ),
        };

        await lifecycle
          .activateDruidIncarnation(
            actor,
            "spells.feral-incarnation",
            2,
            {
              ...deps,
              initialForm: "bear",
            },
          );

        const before =
          actor.system.willPoints
            .value;

        await lifecycle
          .switchDruidForm(
            actor,
            "cat",
            {
              ...deps,
              mode: "action",
            },
          );

        expect(
          actor.system.willPoints
            .value,
        ).toBe(
          before,
        );

        await lifecycle
          .switchDruidForm(
            actor,
            "humanoid",
            {
              ...deps,
              mode: "free",
            },
          );

        expect(
          actor.system.willPoints
            .value,
        ).toBe(
          before - 1,
        );
        expect(
          actor.flags[MODULE_ID]
            .druidFormState
            .currentForm,
        ).toBe(
          "humanoid",
        );
      },
    );

    test(
      "stretch removes stretch incarnations and shift removes Savage too",
      async () => {
        const actor =
          makeActor();
        const deps = {
          bypassAuthority: true,
          applyArtwork:
            vi.fn(
              async () => true,
            ),
          restoreArtwork:
            vi.fn(
              async () => true,
            ),
        };

        await lifecycle
          .activateDruidIncarnation(
            actor,
            "spells.savage-incarnation",
            2,
            deps,
          );
        await lifecycle
          .activateDruidIncarnation(
            actor,
            "spells.incarnation-of-harmony",
            2,
            deps,
          );

        await lifecycle
          .expireDruidIncarnationsForRest(
            actor,
            "stretch",
            deps,
          );

        expect(
          actor.flags[MODULE_ID]
            .druidFormState,
        ).toEqual({
          currentForm: "humanoid",
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
          },
        });

        await lifecycle
          .switchDruidForm(
            actor,
            "travel",
            {
              ...deps,
              mode: "action",
            },
          );
        await lifecycle
          .expireDruidIncarnationsForRest(
            actor,
            "shift",
            deps,
          );

        expect(
          actor.flags[MODULE_ID]
            .druidFormState,
        ).toEqual({
          currentForm: "humanoid",
          activations: {},
        });
      },
    );

    test(
      "recognizes Dragonbane spellTest from system.type even when the core message type is generic",
      async () => {
        const actor =
          makeActor();
        const spell =
          makeItem(
            "spells.savage-incarnation",
          );

        globalThis.fromUuid =
          vi.fn(
            async uuid => {
              if (
                uuid ===
                  "Item.savage"
              ) {
                return spell;
              }

              if (
                uuid ===
                  actor.uuid
              ) {
                return actor;
              }

              return null;
            },
          );

        try {
          const result =
            await lifecycle
              .onCreateDruidFormSpellMessage(
                {
                  type: 0,
                  system: {
                    type: "spellTest",
                    success: true,
                    spellUuid:
                      "Item.savage",
                    actorUuid:
                      actor.uuid,
                    powerLevel: 2,
                  },
                },
              );

          expect(
            result?.currentForm,
          ).toBe(
            "travel",
          );
          expect(
            actor.flags[MODULE_ID]
              .druidFormState
              .activations
              .savage
              .powerLevel,
          ).toBe(
            2,
          );
        } finally {
          delete globalThis.fromUuid;
        }
      },
    );

    test(
      "rest wrappers expire incarnation state after the Dragonbane rest method completes",
      async () => {
        class FakeActor {
          constructor() {
            Object.assign(
              this,
              makeActor(),
            );
            this.restCalls = 0;
          }

          async restStretch() {
            this.restCalls += 1;
            return "stretch-result";
          }

          async restShift() {
            this.restCalls += 1;
            return "shift-result";
          }
        }

        const actor =
          new FakeActor();
        const deps = {
          bypassAuthority: true,
          applyArtwork:
            vi.fn(
              async () => true,
            ),
          restoreArtwork:
            vi.fn(
              async () => true,
            ),
        };

        await lifecycle
          .activateDruidIncarnation(
            actor,
            "spells.feral-incarnation",
            2,
            {
              ...deps,
              initialForm: "bear",
            },
          );

        expect(
          lifecycle
            .patchDruidFormRestLifecycle({
              actorClass: FakeActor,
            }),
        ).toEqual({
          restStretch: "patched",
          restShift: "patched",
        });

        expect(
          await actor.restStretch(),
        ).toBe(
          "stretch-result",
        );
        expect(
          actor.restCalls,
        ).toBe(
          1,
        );
        expect(
          actor.flags[MODULE_ID]
            .druidFormState,
        ).toEqual({
          currentForm: "humanoid",
          activations: {},
        });

        expect(
          lifecycle
            .patchDruidFormRestLifecycle({
              actorClass: FakeActor,
            }),
        ).toEqual({
          restStretch: "already-patched",
          restShift: "already-patched",
        });
      },
    );

    test(
      "GM request execution rejects a non-owner",
      async () => {
        const actor =
          makeActor();
        actor.testUserPermission =
          vi.fn(
            () => false,
          );
        const user = {
          id: "player-1",
          active: true,
          isGM: false,
        };

        await expect(
          lifecycle
            .executeDruidFormLifecycleRequest(
              {
                requesterUserId:
                  user.id,
                actorId:
                  actor.id,
                action: "switch",
                targetForm:
                  "humanoid",
                mode: "action",
              },
              {
                users:
                  new Map([
                    [
                      user.id,
                      user,
                    ],
                  ]),
                actors:
                  new Map([
                    [
                      actor.id,
                      actor,
                    ],
                  ]),
              },
            ),
        ).rejects.toThrow(
          /does not own/i,
        );
      },
    );
  },
);
