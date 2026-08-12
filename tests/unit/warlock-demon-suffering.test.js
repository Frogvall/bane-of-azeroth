import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  createVoidwalkerSufferingMessage,
  executeVoidwalkerSufferingTransfer,
  findEligibleVoidwalkerForSuffering,
  patchVoidwalkerSuffering,
  resolveVoidwalkerSuffering,
  splitVoidwalkerSufferingDamage,
  rewriteVoidwalkerSufferingCasterDamageCard,
} from "../../foundry/scripts/warlock-demons/suffering.js";

const MODULE_ID = "bane-of-azeroth";
const CASTER_UUID = "Actor.suffering-caster";

function makeToken(
  id,
  {
    actor = {
      uuid: `Actor.${id}`,
      system: {
        armor: 0,
        hitPoints: {
          max: 20,
          value: 20,
        },
      },
    },
    casterActorUuid = CASTER_UUID,
    demonKey = "voidwalker",
    duration = "shift",
    summonType = "warlock-demon",
    withFlags = true,
  } = {},
) {
  return {
    actor,
    id,
    uuid: `Scene.suffering.Token.${id}`,
    flags: withFlags
      ? {
          [MODULE_ID]: {
            casterActorUuid,
            demonKey,
            duration,
            summonType,
          },
        }
      : {},
  };
}

function distanceLookup(distances) {
  return (
    _casterToken,
    candidate,
  ) => distances.get(candidate.id);
}

describe("Voidwalker Suffering damage split", () => {
  test.each([
    [
      1,
      {
        warlockDamage: 1,
        voidwalkerDamage: 1,
      },
    ],
    [
      2,
      {
        warlockDamage: 1,
        voidwalkerDamage: 1,
      },
    ],
    [
      5,
      {
        warlockDamage: 3,
        voidwalkerDamage: 3,
      },
    ],
    [
      6,
      {
        warlockDamage: 3,
        voidwalkerDamage: 3,
      },
    ],
  ])(
    "splits %s final damage with each half rounded up",
    (damage, expected) => {
      expect(
        splitVoidwalkerSufferingDamage(
          damage,
        ),
      ).toEqual(expected);
    },
  );

  test.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    undefined,
    null,
  ])(
    "does not create a Suffering split for %s",
    damage => {
      expect(
        splitVoidwalkerSufferingDamage(
          damage,
        ),
      ).toBeNull();
    },
  );
});

describe("eligible Voidwalker selection", () => {
  test("accepts a correctly linked Voidwalker at exactly 10 meters", () => {
    const casterToken = {
      id: "caster-token",
    };
    const voidwalker = makeToken(
      "eligible",
    );

    expect(
      findEligibleVoidwalkerForSuffering({
        casterActorUuid: CASTER_UUID,
        casterToken,
        tokens: [voidwalker],
        calculateDistanceFn:
          distanceLookup(
            new Map([
              [voidwalker.id, 10],
            ]),
          ),
      }),
    ).toBe(voidwalker);
  });

  test("selects the eligible Voidwalker while ignoring invalid candidates", () => {
    const casterToken = {
      id: "caster-token",
    };
    const eligible = makeToken(
      "eligible",
    );
    const candidates = [
      makeToken(
        "distant",
      ),
      makeToken(
        "other-caster",
        {
          casterActorUuid:
            "Actor.other-caster",
        },
      ),
      makeToken(
        "felhunter",
        {
          demonKey: "felhunter",
        },
      ),
      makeToken(
        "wrong-duration",
        {
          duration: "stretch",
        },
      ),
      makeToken(
        "wrong-summon-type",
        {
          summonType:
            "elementalTotem",
        },
      ),
      makeToken(
        "manual",
        {
          withFlags: false,
        },
      ),
      makeToken(
        "no-actor",
        {
          actor: null,
        },
      ),
      eligible,
    ];
    const distances = new Map([
      ["distant", 12],
      ["other-caster", 4],
      ["felhunter", 4],
      ["wrong-duration", 4],
      ["wrong-summon-type", 4],
      ["manual", 4],
      ["no-actor", 4],
      ["eligible", 8],
    ]);

    expect(
      findEligibleVoidwalkerForSuffering({
        casterActorUuid: CASTER_UUID,
        casterToken,
        tokens: candidates,
        calculateDistanceFn:
          distanceLookup(distances),
      }),
    ).toBe(eligible);
  });

  test.each([
    {
      label: "more than 10 meters away",
      token: makeToken("distant"),
      distance: 10.01,
    },
    {
      label: "linked to another caster",
      token: makeToken(
        "other-caster",
        {
          casterActorUuid:
            "Actor.other-caster",
        },
      ),
      distance: 4,
    },
    {
      label: "not a Voidwalker",
      token: makeToken(
        "felhunter",
        {
          demonKey: "felhunter",
        },
      ),
      distance: 4,
    },
    {
      label: "not a Shift summon",
      token: makeToken(
        "wrong-duration",
        {
          duration: "stretch",
        },
      ),
      distance: 4,
    },
    {
      label: "not a Warlock demon",
      token: makeToken(
        "wrong-type",
        {
          summonType:
            "elementalTotem",
        },
      ),
      distance: 4,
    },
    {
      label: "missing automatic summon flags",
      token: makeToken(
        "manual",
        {
          withFlags: false,
        },
      ),
      distance: 4,
    },
  ])(
    "returns no candidate when the only token is $label",
    ({
      token,
      distance,
    }) => {
      expect(
        findEligibleVoidwalkerForSuffering({
          casterActorUuid: CASTER_UUID,
          casterToken: {
            id: "caster-token",
          },
          tokens: [token],
          calculateDistanceFn:
            distanceLookup(
              new Map([
                [token.id, distance],
              ]),
            ),
        }),
      ).toBeNull();
    },
  );
});

describe("Voidwalker Suffering resolution", () => {
  test("returns a complete plan for 5 final damage", () => {
    const casterActor = {
      uuid: CASTER_UUID,
    };
    const casterToken = {
      id: "caster-token",
    };
    const voidwalker = makeToken(
      "eligible",
    );

    expect(
      resolveVoidwalkerSuffering({
        actor: casterActor,
        damage: 5,
        casterToken,
        tokens: [voidwalker],
        calculateDistanceFn:
          distanceLookup(
            new Map([
              [voidwalker.id, 6],
            ]),
          ),
      }),
    ).toEqual({
      warlockDamage: 3,
      voidwalkerDamage: 3,
      voidwalkerToken: voidwalker,
    });
  });

  test("returns null without positive damage or an eligible Voidwalker", () => {
    const casterToken = {
      id: "caster-token",
    };

    expect(
      resolveVoidwalkerSuffering({
        actor: {
          uuid: CASTER_UUID,
        },
        damage: 0,
        casterToken,
        tokens: [],
        calculateDistanceFn:
          vi.fn(),
      }),
    ).toBeNull();

    expect(
      resolveVoidwalkerSuffering({
        actor: {
          uuid: CASTER_UUID,
        },
        damage: 5,
        casterToken,
        tokens: [],
        calculateDistanceFn:
          vi.fn(),
      }),
    ).toBeNull();
  });
});

describe("Dragonbane applyDamage Suffering patch", () => {
  function makeActorClass({
    failUuid = null,
  } = {}) {
    return class TestActor {
      constructor(
        uuid,
        {
          armor = 0,
          hp = 20,
        } = {},
      ) {
        this.uuid = uuid;
        this.calls = [];
        this.system = {
          armor,
          hitPoints: {
            max: hp,
            value: hp,
          },
        };
      }

      async applyDamage(damage) {
        this.calls.push(damage);

        if (this.uuid === failUuid) {
          throw new Error(
            "Original damage failed",
          );
        }

        this.system.hitPoints.value =
          Math.max(
            0,
            this.system.hitPoints.value
              - damage,
          );

        return this.system.hitPoints.value;
      }
    };
  }

  test("applies 3 final damage to both creatures when the incoming damage is 5", async () => {
    const TestActor =
      makeActorClass();
    const caster = new TestActor(
      CASTER_UUID,
    );
    const voidwalker = new TestActor(
      "Actor.voidwalker",
      {
        armor: 6,
      },
    );
    const voidwalkerToken = makeToken(
      "voidwalker",
      {
        actor: voidwalker,
      },
    );
    const resolveSufferingFn = vi.fn(
      actor => (
        actor === caster
          ? {
              warlockDamage: 3,
              voidwalkerDamage: 3,
              voidwalkerToken,
            }
          : null
      ),
    );
    const createMessageFn = vi.fn();

    expect(
      patchVoidwalkerSuffering({
        actorClass: TestActor,
        resolveSufferingFn,
        createMessageFn,
      }),
    ).toEqual({
      applyDamage: "patched",
    });

    await expect(
      caster.applyDamage(5),
    ).resolves.toBe(17);

    expect(caster.calls).toEqual([3]);
    expect(voidwalker.calls).toEqual([3]);
    expect(
      caster.system.hitPoints.value,
    ).toBe(17);
    expect(
      voidwalker.system.hitPoints.value,
    ).toBe(17);

    expect(resolveSufferingFn)
      .toHaveBeenCalledOnce();
    expect(resolveSufferingFn)
      .toHaveBeenCalledWith(
        caster,
        5,
      );
    expect(createMessageFn)
      .toHaveBeenCalledWith({
        casterActor: caster,
        originalDamage: 5,
        warlockDamage: 3,
        voidwalkerDamage: 3,
        voidwalkerToken,
      });
  });

  test("bypasses the wrapper for transferred damage and therefore cannot recurse", async () => {
    const TestActor =
      makeActorClass();
    const caster = new TestActor(
      CASTER_UUID,
    );
    const voidwalker = new TestActor(
      "Actor.voidwalker",
    );
    const voidwalkerToken = makeToken(
      "voidwalker",
      {
        actor: voidwalker,
      },
    );
    const resolveSufferingFn = vi.fn(
      actor => (
        actor === caster
          ? {
              warlockDamage: 1,
              voidwalkerDamage: 1,
              voidwalkerToken,
            }
          : null
      ),
    );

    patchVoidwalkerSuffering({
      actorClass: TestActor,
      resolveSufferingFn,
      createMessageFn: vi.fn(),
    });

    await caster.applyDamage(1);

    expect(resolveSufferingFn)
      .toHaveBeenCalledOnce();
    expect(caster.calls).toEqual([1]);
    expect(voidwalker.calls).toEqual([1]);
  });

  test("forwards normal damage unchanged when Suffering does not apply", async () => {
    const TestActor =
      makeActorClass();
    const actor = new TestActor(
      CASTER_UUID,
    );
    const resolveSufferingFn =
      vi.fn(() => null);
    const createMessageFn = vi.fn();

    patchVoidwalkerSuffering({
      actorClass: TestActor,
      resolveSufferingFn,
      createMessageFn,
    });

    await expect(
      actor.applyDamage(5),
    ).resolves.toBe(15);

    expect(actor.calls).toEqual([5]);
    expect(createMessageFn)
      .not.toHaveBeenCalled();
  });

  test("does not damage the Voidwalker when the original caster damage fails", async () => {
    const TestActor =
      makeActorClass({
        failUuid: CASTER_UUID,
      });
    const caster = new TestActor(
      CASTER_UUID,
    );
    const voidwalker = new TestActor(
      "Actor.voidwalker",
    );
    const voidwalkerToken = makeToken(
      "voidwalker",
      {
        actor: voidwalker,
      },
    );
    const createMessageFn = vi.fn();

    patchVoidwalkerSuffering({
      actorClass: TestActor,
      resolveSufferingFn: vi.fn(
        () => ({
          warlockDamage: 3,
          voidwalkerDamage: 3,
          voidwalkerToken,
        }),
      ),
      createMessageFn,
    });

    await expect(
      caster.applyDamage(5),
    ).rejects.toThrow(
      "Original damage failed",
    );

    expect(caster.calls).toEqual([3]);
    expect(voidwalker.calls).toEqual([]);
    expect(createMessageFn)
      .not.toHaveBeenCalled();
  });

  test("patching applyDamage is idempotent", () => {
    const TestActor =
      makeActorClass();
    const options = {
      actorClass: TestActor,
      resolveSufferingFn:
        vi.fn(() => null),
      createMessageFn: vi.fn(),
    };

    expect(
      patchVoidwalkerSuffering(
        options,
      ),
    ).toEqual({
      applyDamage: "patched",
    });
    expect(
      patchVoidwalkerSuffering(
        options,
      ),
    ).toEqual({
      applyDamage:
        "already-patched",
    });
  });
});

describe("Voidwalker Suffering chat presentation", () => {
  test("passes the visible halving formula to localization and message flags", async () => {
    const create = vi.fn(async data => data);
    const format = vi.fn(() => "Formatted Suffering message");
    const casterActor = {
      name: "Warlock",
      uuid: CASTER_UUID,
    };
    const voidwalkerToken = makeToken(
      "message-voidwalker",
    );

    await createVoidwalkerSufferingMessage({
      casterActor,
      originalDamage: 5,
      warlockDamage: 3,
      voidwalkerDamage: 3,
      voidwalkerToken,
      chatMessageClass: {
        create,
        getSpeaker: vi.fn(
          () => ({
            alias: "Warlock",
          }),
        ),
      },
      i18n: {
        format,
      },
      user: {
        id: "player",
      },
    });

    const expectedFormula =
      "ceil(5 / 2) = 3";

    expect(format)
      .toHaveBeenCalledWith(
        "BOA.chat.voidwalkerSuffering",
        expect.objectContaining({
          originalDamage: 5,
          damage: 3,
          formula: expectedFormula,
        }),
      );

    expect(create)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          flags: {
            [MODULE_ID]: {
              voidwalkerSuffering:
                expect.objectContaining({
                  originalDamage: 5,
                  warlockDamage: 3,
                  voidwalkerDamage: 3,
                  formula: expectedFormula,
                }),
            },
          },
        }),
      );
  });

  test("uses Dragonbane's localized damage-applied path for the Voidwalker", async () => {
    const player = {
      id: "player",
      isGM: false,
    };
    const casterActor = {
      documentName: "Actor",
      name: "Warlock",
      uuid: CASTER_UUID,
      testUserPermission: vi.fn(
        user => user === player,
      ),
    };
    const voidwalkerActor = {
      name: "Voidwalker",
      system: {
        hitPoints: {
          max: 20,
          value: 20,
        },
      },
      uuid: "Actor.voidwalker",
    };
    const scene = {
      documentName: "Scene",
      id: "suffering-scene",
    };
    const casterToken = {
      actor: casterActor,
      id: "caster-token",
      parent: scene,
      uuid:
        "Scene.suffering-scene.Token.caster-token",
    };
    const voidwalkerToken = makeToken(
      "native-card-voidwalker",
      {
        actor: voidwalkerActor,
      },
    );
    voidwalkerToken.parent = scene;

    const documents = new Map([
      [casterActor.uuid, casterActor],
      [casterToken.uuid, casterToken],
      [voidwalkerToken.uuid, voidwalkerToken],
    ]);
    const originalApplyDamage = vi.fn(
      async function (damage) {
        this.system.hitPoints.value -= damage;
        return this.system.hitPoints.value;
      },
    );
    const applyDamageMessageFn = vi.fn(
      async ({
        actor,
        damage,
      }) => {
        actor.system.hitPoints.value -= damage;
      },
    );

    await executeVoidwalkerSufferingTransfer(
      {
        casterActorUuid:
          casterActor.uuid,
        casterTokenUuid:
          casterToken.uuid,
        voidwalkerTokenUuid:
          voidwalkerToken.uuid,
        originalDamage: 5,
        damage: 3,
        casterHpBefore: 10,
        casterHpAfter: 7,
      },
      player.id,
      {
        applyDamageMessageFn,
        calculateDistanceFn:
          () => 6,
        fromUuidFn:
          async uuid => documents.get(uuid),
        originalApplyDamage,
        users: new Map([
          [player.id, player],
        ]),
      },
    );

    expect(
      applyDamageMessageFn,
    ).toHaveBeenCalledOnce();
    expect(
      applyDamageMessageFn,
    ).toHaveBeenCalledWith({
      actor: voidwalkerActor,
      damage: 3,
      damageType: "none",
      ignoreArmor: true,
      multiplier: 1,
    });
    expect(
      originalApplyDamage,
    ).not.toHaveBeenCalled();
  });
});

describe("Voidwalker Suffering native caster-card correction", () => {
  test("shows a rounded half multiplier and the actual shared total", () => {
    const actorUuid =
      "Actor.suffering-caster";
    const source = `
      <div
        class="damage-message permission-owner"
        data-damage="3"
        data-actor-id="${actorUuid}"
      >
        <div class="damage-details">
          <div class="expandable">
            <b>Damage:</b> 7 Damage<br>
            <b>Armor:</b> 2<br>
            <b>Multiplier:</b> x1<br>
            <b>Total damage:</b> 5<br>
            <b>HP:</b> 7 → 4<br>
          </div>
        </div>
      </div>
    `;
    const i18n = {
      localize: vi.fn(key => ({
        "DoD.ui.chat.damageDetailMultiplier":
          "Multiplier",
        "DoD.ui.chat.damageDetailTotal":
          "Total damage",
        "BOA.chat.sufferingRoundedUp":
          "rounded up",
      })[key]),
    };

    const rewritten =
      rewriteVoidwalkerSufferingCasterDamageCard(
        source,
        {
          actorUuid,
          sharedDamage: 3,
          i18n,
        },
      );

    expect(rewritten)
      .toContain(
        "<b>Multiplier:</b> x0.5 (rounded up)<br>",
      );
    expect(rewritten)
      .toContain(
        "<b>Total damage:</b> 3<br>",
      );
    expect(rewritten)
      .toContain(
        "<b>Damage:</b> 7 Damage<br>",
      );
    expect(rewritten)
      .toContain(
        "<b>Armor:</b> 2<br>",
      );
    expect(rewritten)
      .toContain(
        'data-damage="3"',
      );
  });

  test("does not rewrite another Actor's damage card", () => {
    const source =
      '<div class="damage-message" '
      + 'data-damage="3" '
      + 'data-actor-id="Actor.other">'
      + "<b>Multiplier:</b> x1<br>"
      + "<b>Total damage:</b> 5<br>"
      + "</div>";

    expect(
      rewriteVoidwalkerSufferingCasterDamageCard(
        source,
        {
          actorUuid:
            "Actor.suffering-caster",
          sharedDamage: 3,
          i18n: {
            localize: key => ({
              "DoD.ui.chat.damageDetailMultiplier":
                "Multiplier",
              "DoD.ui.chat.damageDetailTotal":
                "Total damage",
              "BOA.chat.sufferingRoundedUp":
                "rounded up",
            })[key],
          },
        },
      ),
    ).toBe(source);
  });

  test("damages the caster, explains Suffering, then damages the Voidwalker", async () => {
    const events = [];

    class OrderedActor {
      constructor() {
        this.uuid =
          "Actor.ordered-caster";
        this.system = {
          hitPoints: {
            value: 10,
            max: 10,
          },
        };
      }

      async applyDamage(damage) {
        events.push("caster");
        this.system.hitPoints.value -= damage;
        return this.system.hitPoints.value;
      }
    }

    const voidwalkerToken = {
      actor: {
        uuid:
          "Actor.ordered-voidwalker",
      },
      uuid:
        "Scene.ordered.Token.voidwalker",
    };

    patchVoidwalkerSuffering({
      actorClass: OrderedActor,
      resolveSufferingFn:
        async () => ({
          warlockDamage: 3,
          voidwalkerDamage: 3,
          voidwalkerToken,
        }),
      createMessageFn:
        async () => {
          events.push("suffering");
        },
      transferDamageFn:
        async () => {
          events.push("voidwalker");
        },
    });

    const actor = new OrderedActor();
    await actor.applyDamage(5);

    expect(events).toEqual([
      "caster",
      "suffering",
      "voidwalker",
    ]);
  });
});
