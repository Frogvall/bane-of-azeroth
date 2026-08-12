import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  makeActor,
  makeFlagDocument,
} from "../helpers/documents.js";

const MODULE_ID = "bane-of-azeroth";
const MAGE_CONTENT_KEY =
  "heroic-class-ability.mage.mages-brilliance";
const SENSE_MAGIC_UUID =
  "Item.RPnxXYVb8z7EG5Wl";

async function loadSubject() {
  return import(
    "../../foundry/scripts/mage-brilliance.js"
  );
}

function makeMageAbility(actor) {
  return makeFlagDocument({
    id: "mages-brilliance",
    name: "Mage's Brilliance",
    type: "ability",
    parent: actor,
    flags: {
      [MODULE_ID]: {
        contentKey: MAGE_CONTENT_KEY,
      },
    },
  });
}

function makeSpell({
  actor,
  name = "Sense Magic",
  rank = 0,
  sourceUuid = SENSE_MAGIC_UUID,
  coreSourceId,
} = {}) {
  return makeFlagDocument({
    id: "spell",
    name,
    type: "spell",
    parent: actor,
    system: {
      rank,
    },
    flags: {
      [MODULE_ID]: sourceUuid
        ? {
            sourceUuid,
          }
        : {},
      core: coreSourceId
        ? {
            sourceId: coreSourceId,
          }
        : {},
    },
  });
}

function setAutomation(enabled) {
  globalThis.game.settings.get =
    vi.fn((_moduleId, key) => (
      key === "mageBrillianceAutomation"
        ? enabled
        : true
    ));
}

describe("Mage's Brilliance spell cost automation", () => {
  beforeEach(() => {
    setAutomation(true);
  });

  afterEach(() => {
    delete globalThis.CONFIG.Item;
  });

  test("makes managed Sense Magic free while the ability is present", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({ actor });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(0);
    expect(original).not.toHaveBeenCalled();
  });

  test("also applies to a manual Sense Magic without changing ownership", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({
      actor,
      sourceUuid: null,
    });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(0);
    expect(original).not.toHaveBeenCalled();
  });

  test("delegates to Dragonbane when automation is disabled", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    setAutomation(false);

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({ actor });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(1);
    expect(original).toHaveBeenCalledWith(0);
  });

  test("delegates when the Actor does not have Mage's Brilliance", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    const spell = makeSpell({ actor });
    actor.items = [spell];

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(1);
    expect(original).toHaveBeenCalledWith(0);
  });

  test("delegates for unrelated spells", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({
      actor,
      name: "Other Trick",
      sourceUuid: null,
    });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(1);
    expect(original).toHaveBeenCalledWith(0);
  });

  test("patches Dragonbane getSpellCost once and preserves native behavior", async () => {
    const {
      patchMageBrillianceSpellCost,
    } = await loadSubject();

    class FakeDragonbaneItem {
      getSpellCost(powerLevel) {
        return this.system.rank === 0
          ? 1
          : powerLevel * 2;
      }
    }

    globalThis.CONFIG.Item = {
      documentClass: FakeDragonbaneItem,
    };

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];

    const senseMagic =
      new FakeDragonbaneItem();
    Object.assign(
      senseMagic,
      makeSpell({ actor }),
    );
    actor.items.push(senseMagic);

    const unrelated =
      new FakeDragonbaneItem();
    Object.assign(
      unrelated,
      makeSpell({
        actor,
        name: "Other Spell",
        rank: 2,
        sourceUuid: null,
      }),
    );
    actor.items.push(unrelated);

    expect(
      patchMageBrillianceSpellCost(),
    ).toBe(true);

    const firstWrapper =
      FakeDragonbaneItem.prototype.getSpellCost;

    expect(senseMagic.getSpellCost(0)).toBe(0);
    expect(unrelated.getSpellCost(3)).toBe(6);

    expect(
      patchMageBrillianceSpellCost(),
    ).toBe(true);
    expect(
      FakeDragonbaneItem.prototype.getSpellCost,
    ).toBe(firstWrapper);
  });
});

describe("Dragonbane 4.0.1 legacy magic-trick adapter", () => {
  beforeEach(() => {
    setAutomation(true);
  });

  function legacySkillRollHandler() {
    const title = "castMagicTrickTitle";

    if (
      this.actor.system.willPoints.value < 1
    ) {
      return title;
    }

    const oldWP =
      this.actor.system.willPoints.value;
    const newWP = oldWP - 1;

    return newWP;
  }

  function modernSkillRollHandler() {
    return this.spell.getSpellCost(0);
  }

  function makeActorItems(entries) {
    const items = [...entries];
    items.get = id =>
      items.find(item => item.id === id);

    return items;
  }

  test("detects the legacy direct-WP handler but not a modern cost-based handler", async () => {
    const subject = await loadSubject();

    expect(
      typeof subject
        .isLegacyDragonbaneMagicTrickHandler,
    ).toBe("function");

    expect(
      subject
        .isLegacyDragonbaneMagicTrickHandler(
          legacySkillRollHandler,
        ),
    ).toBe(true);

    expect(
      subject
        .isLegacyDragonbaneMagicTrickHandler(
          modernSkillRollHandler,
        ),
    ).toBe(false);
  });

  test("casts Sense Magic for zero WP even when the Actor has zero WP", async () => {
    const subject = await loadSubject();

    expect(
      typeof subject
        .castLegacyFreeSenseMagicTrick,
    ).toBe("function");

    const actor = makeActor();
    actor.type = "character";
    actor.isObserver = true;
    actor.system = {
      willPoints: {
        value: 0,
      },
    };

    const ability =
      makeMageAbility(actor);
    const spell =
      makeSpell({ actor });

    actor.items =
      makeActorItems([
        ability,
        spell,
      ]);

    const result =
      await subject
        .castLegacyFreeSenseMagicTrick(
          actor,
          spell,
          {
            confirmCast: false,
            createMessage: false,
          },
        );

    expect(result).toEqual({
      handled: true,
      cast: true,
      wpCost: 0,
    });
    expect(actor.update)
      .not.toHaveBeenCalled();
    expect(
      actor.system.willPoints.value,
    ).toBe(0);
  });

  test("uses the BoA free-cast prompt instead of Dragonbane's 1 WP prompt", async () => {
    const subject = await loadSubject();

    const actor = makeActor();
    actor.type = "character";
    actor.isObserver = true;
    actor.system = {
      willPoints: {
        value: 5,
      },
    };

    const ability =
      makeMageAbility(actor);
    const spell =
      makeSpell({ actor });

    actor.items =
      makeActorItems([
        ability,
        spell,
      ]);

    let dialogOptions = null;

    const DialogClass = {
      confirm: vi.fn(
        async options => {
          dialogOptions = options;
          return false;
        },
      ),
    };

    const i18n = {
      localize: vi.fn(
        key => key,
      ),
      format: vi.fn(
        (key, data) => {
          if (
            key ===
            "BOA.dialog.mageBrillianceFreeSenseMagicContent"
          ) {
            return (
              `Cast ${data.spell} ` +
              "without spending WP?"
            );
          }

          if (
            key ===
            "DoD.ui.dialog.castMagicTrickContent"
          ) {
            return (
              `Spend 1 WP to cast ` +
              `${data.spell}?`
            );
          }

          return key;
        },
      ),
    };

    const result =
      await subject
        .castLegacyFreeSenseMagicTrick(
          actor,
          spell,
          {
            confirmCast: true,
            createMessage: false,
            DialogClass,
            i18n,
          },
        );

    expect(result).toEqual({
      handled: true,
      cast: false,
      wpCost: 0,
    });

    expect(i18n.format)
      .toHaveBeenCalledWith(
        "BOA.dialog.mageBrillianceFreeSenseMagicContent",
        {
          spell: "Sense Magic",
        },
      );

    expect(dialogOptions?.content)
      .toBe(
        "Cast Sense Magic without spending WP?",
      );

    expect(dialogOptions?.content)
      .not.toContain("1 WP");
  });

  test("does not handle the legacy path when Mage's Brilliance automation is disabled", async () => {
    const subject = await loadSubject();

    setAutomation(false);

    const actor = makeActor();
    actor.type = "character";
    actor.system = {
      willPoints: {
        value: 5,
      },
    };

    const ability =
      makeMageAbility(actor);
    const spell =
      makeSpell({ actor });

    actor.items =
      makeActorItems([
        ability,
        spell,
      ]);

    const result =
      await subject
        .castLegacyFreeSenseMagicTrick(
          actor,
          spell,
          {
            confirmCast: false,
            createMessage: false,
          },
        );

    expect(result).toEqual({
      handled: false,
      cast: false,
      wpCost: null,
    });
    expect(actor.update)
      .not.toHaveBeenCalled();
  });

  test("attaches a capture listener and intercepts only free Sense Magic", async () => {
    const subject = await loadSubject();

    expect(
      typeof subject
        .attachMageBrillianceLegacyMagicTrickAdapter,
    ).toBe("function");

    const actor = makeActor();
    actor.type = "character";
    actor.isObserver = true;
    actor.system = {
      willPoints: {
        value: 0,
      },
    };

    const ability =
      makeMageAbility(actor);
    const spell =
      makeSpell({ actor });

    actor.items =
      makeActorItems([
        ability,
        spell,
      ]);

    let listener = null;
    const element = {
      addEventListener: vi.fn(
        (_name, callback, capture) => {
          listener = callback;
          expect(capture).toBe(true);
        },
      ),
      removeEventListener: vi.fn(),
    };

    const app = {
      actor,
      element,
      options: {
        actions: {
          skillRoll: {
            handler:
              legacySkillRollHandler,
            buttons: [0, 2],
          },
        },
      },
    };

    const cast = vi.fn(
      async () => ({
        handled: true,
        cast: true,
        wpCost: 0,
      }),
    );

    expect(
      subject
        .attachMageBrillianceLegacyMagicTrickAdapter(
          app,
          { cast },
        ),
    ).toBe(true);

    expect(element.addEventListener)
      .toHaveBeenCalledOnce();
    expect(listener)
      .toEqual(expect.any(Function));

    const row = {
      dataset: {
        itemId: spell.id,
      },
    };
    const actionTarget = {
      closest: vi.fn(selector => (
        selector === ".sheet-table-data"
          ? row
          : null
      )),
    };
    const event = {
      type: "click",
      button: 0,
      target: {
        closest: vi.fn(selector => (
          selector ===
          '[data-action="skillRoll"]'
            ? actionTarget
            : null
        )),
      },
      preventDefault: vi.fn(),
      stopImmediatePropagation:
        vi.fn(),
    };

    await listener(event);

    expect(event.preventDefault)
      .toHaveBeenCalledOnce();
    expect(
      event.stopImmediatePropagation,
    ).toHaveBeenCalledOnce();
    expect(cast)
      .toHaveBeenCalledWith(
        actor,
        spell,
      );
  });

  test("does not attach the legacy adapter to a modern Dragonbane handler", async () => {
    const subject = await loadSubject();

    const element = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const app = {
      actor: makeActor(),
      element,
      options: {
        actions: {
          skillRoll: {
            handler:
              modernSkillRollHandler,
            buttons: [0, 2],
          },
        },
      },
    };

    expect(
      subject
        .attachMageBrillianceLegacyMagicTrickAdapter(
          app,
        ),
    ).toBe(false);

    expect(element.addEventListener)
      .not.toHaveBeenCalled();
  });
});

describe("Mage's Brilliance LANGUAGES Take 10", () => {
  beforeEach(() => {
    setAutomation(true);
  });

  function makeLanguagesSkill(
    actor,
    {
      name = "Languages",
      value = 12,
    } = {},
  ) {
    return makeFlagDocument({
      id: "languages",
      name,
      type: "skill",
      parent: actor,
      system: {
        value,
        skillType: "core",
        attribute: "int",
      },
    });
  }

  function makeActorItems(entries) {
    const items = [...entries];
    items.get = id =>
      items.find(
        item => item.id === id,
      );
    return items;
  }

  function makeMageActor({
    skillName = "Languages",
  } = {}) {
    const actor = makeActor();
    actor.documentName = "Actor";
    actor.type = "character";
    actor.isObserver = true;

    const ability =
      makeMageAbility(actor);
    const skill =
      makeLanguagesSkill(
        actor,
        {
          name: skillName,
        },
      );

    actor.items =
      makeActorItems([
        ability,
        skill,
      ]);

    return {
      actor,
      ability,
      skill,
    };
  }

  test("recognizes English Languages and Swedish Språk only", async () => {
    const subject =
      await loadSubject();

    const actor = makeActor();

    expect(
      subject
        .isMageBrillianceLanguagesSkill(
          makeLanguagesSkill(actor),
        ),
    ).toBe(true);

    expect(
      subject
        .isMageBrillianceLanguagesSkill(
          makeLanguagesSkill(
            actor,
            {
              name: "Språk",
            },
          ),
        ),
    ).toBe(true);

    expect(
      subject
        .isMageBrillianceLanguagesSkill(
          makeLanguagesSkill(
            actor,
            {
              name: "Awareness",
            },
          ),
        ),
    ).toBe(false);
  });

  test("resolves Take 10 through Dragonbane skill-test semantics", async () => {
    const subject =
      await loadSubject();

    const {
      actor,
      skill,
    } = makeMageActor();

    class FakeSkillTest {
      constructor(
        testActor,
        testSkill,
        options,
      ) {
        this.actor = testActor;
        this.skill = testSkill;
        this.options = options;
      }

      async roll() {
        this.roll = {
          result: "10",
        };
        this.postRollData = {
          result: 10,
          success:
            10 <=
            this.skill.system.value,
          isDragon: false,
          isDemon: false,
          canPush: false,
        };
        return this;
      }
    }

    const result =
      await subject
        .takeMageBrillianceLanguagesTen(
          actor,
          skill,
          {
            SkillTestClass:
              FakeSkillTest,
            targets: [],
          },
        );

    expect(result.handled)
      .toBe(true);
    expect(result.choice)
      .toBe("take10");
    expect(result.result)
      .toBe(10);

    expect(
      result.test.options,
    ).toMatchObject({
      formula: "10",
      skipDialog: true,
      canPush: false,
    });

    expect(
      result.test
        .postRollData
        .isDragon,
    ).toBe(false);

    expect(
      result.test
        .postRollData
        .isDemon,
    ).toBe(false);

    expect(
      result.test
        .postRollData
        .canPush,
    ).toBe(false);
  });

  test("disabled automation or a missing Mage's Brilliance does not offer Take 10", async () => {
    const subject =
      await loadSubject();

    const {
      actor,
      skill,
    } = makeMageActor();

    setAutomation(false);

    expect(
      subject
        .canUseMageBrillianceLanguagesTen(
          actor,
          skill,
        ),
    ).toBe(false);

    setAutomation(true);

    actor.items =
      makeActorItems([
        skill,
      ]);

    expect(
      subject
        .canUseMageBrillianceLanguagesTen(
          actor,
          skill,
        ),
    ).toBe(false);
  });

  test("Roll delegates to Dragonbane while Take 10 bypasses the native roll", async () => {
    const subject =
      await loadSubject();

    const {
      actor,
      skill,
    } = makeMageActor();

    const nativeRoll = vi.fn();
    const takeTen =
      vi.fn(
        async () => ({
          handled: true,
          choice: "take10",
          result: 10,
        }),
      );

    const i18n = {
      localize:
        vi.fn(key => key),
      format:
        vi.fn(key => key),
    };

    const rollResult =
      await subject
        .chooseMageBrillianceLanguagesRoll(
          actor,
          skill,
          {
            nativeRoll,
            takeTen,
            DialogClass: {
              wait:
                vi.fn(
                  async () => "roll",
                ),
            },
            i18n,
          },
        );

    expect(rollResult.choice)
      .toBe("roll");
    expect(nativeRoll)
      .toHaveBeenCalledOnce();
    expect(takeTen)
      .not.toHaveBeenCalled();

    nativeRoll.mockClear();

    const tenResult =
      await subject
        .chooseMageBrillianceLanguagesRoll(
          actor,
          skill,
          {
            nativeRoll,
            takeTen,
            DialogClass: {
              wait:
                vi.fn(
                  async () => "take10",
                ),
            },
            i18n,
          },
        );

    expect(tenResult.choice)
      .toBe("take10");
    expect(nativeRoll)
      .not.toHaveBeenCalled();
    expect(takeTen)
      .toHaveBeenCalledWith(
        actor,
        skill,
      );
  });

  test("Cancel performs neither path", async () => {
    const subject =
      await loadSubject();

    const {
      actor,
      skill,
    } = makeMageActor();

    const nativeRoll = vi.fn();
    const takeTen = vi.fn();

    const result =
      await subject
        .chooseMageBrillianceLanguagesRoll(
          actor,
          skill,
          {
            nativeRoll,
            takeTen,
            DialogClass: {
              wait:
                vi.fn(
                  async () => "cancel",
                ),
            },
            i18n: {
              localize:
                vi.fn(key => key),
              format:
                vi.fn(key => key),
            },
          },
        );

    expect(result).toEqual({
      handled: true,
      choice: "cancel",
    });
    expect(nativeRoll)
      .not.toHaveBeenCalled();
    expect(takeTen)
      .not.toHaveBeenCalled();
  });

  test("sheet adapter intercepts Languages but leaves other skills untouched", async () => {
    const subject =
      await loadSubject();

    const {
      actor,
      skill,
    } = makeMageActor();

    const otherSkill =
      makeLanguagesSkill(
        actor,
        {
          name: "Awareness",
        },
      );
    otherSkill.id =
      "awareness";
    actor.items.push(
      otherSkill,
    );

    let listener = null;

    const element = {
      addEventListener:
        vi.fn(
          (
            _name,
            callback,
            capture,
          ) => {
            listener = callback;
            expect(capture)
              .toBe(true);
          },
        ),
      removeEventListener:
        vi.fn(),
    };

    const nativeHandler =
      vi.fn();

    const app = {
      actor,
      element,
      options: {
        actions: {
          skillRoll: {
            handler:
              nativeHandler,
            buttons: [0, 2],
          },
        },
      },
    };

    const choose = vi.fn();

    expect(
      subject
        .attachMageBrillianceLanguagesAdapter(
          app,
          {
            choose,
          },
        ),
    ).toBe(true);

    const eventFor = item => {
      const row = {
        dataset: {
          itemId: item.id,
        },
      };

      const actionTarget = {
        closest:
          vi.fn(
            selector => (
              selector ===
                ".sheet-table-data"
                ? row
                : null
            ),
          ),
      };

      return {
        event: {
          type: "click",
          button: 0,
          target: {
            closest:
              vi.fn(
                selector => (
                  selector ===
                    '[data-action="skillRoll"]'
                    ? actionTarget
                    : null
                ),
              ),
          },
          preventDefault:
            vi.fn(),
          stopImmediatePropagation:
            vi.fn(),
        },
        actionTarget,
      };
    };

    const languagesEvent =
      eventFor(skill);

    await listener(
      languagesEvent.event,
    );

    expect(
      languagesEvent.event
        .preventDefault,
    ).toHaveBeenCalledOnce();

    expect(
      languagesEvent.event
        .stopImmediatePropagation,
    ).toHaveBeenCalledOnce();

    expect(choose)
      .toHaveBeenCalledOnce();

    const chooseOptions =
      choose.mock.calls[0][2];

    await chooseOptions
      .nativeRoll();

    expect(nativeHandler)
      .toHaveBeenCalledWith(
        languagesEvent.event,
        languagesEvent.actionTarget,
      );

    choose.mockClear();
    nativeHandler.mockClear();

    const otherEvent =
      eventFor(otherSkill);

    await listener(
      otherEvent.event,
    );

    expect(
      otherEvent.event
        .preventDefault,
    ).not.toHaveBeenCalled();

    expect(
      otherEvent.event
        .stopImmediatePropagation,
    ).not.toHaveBeenCalled();

    expect(choose)
      .not.toHaveBeenCalled();

    expect(nativeHandler)
      .not.toHaveBeenCalled();
  });
});

