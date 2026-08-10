import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  applyDruidRollBoonsToDialog,
  getDruidRollBoons,
  isDruidSneakingSkill,
  patchDruidRollBoons,
} from "../../foundry/scripts/druid-roll-boons.js";

const MODULE_ID = "bane-of-azeroth";

function settings(values = {}) {
  return {
    get: vi.fn((_moduleId, key) => values[key] ?? true),
  };
}

function actor(currentForm, activations = {}) {
  return {
    type: "character",
    flags: {
      [MODULE_ID]: {
        druidFormState: { currentForm, activations },
      },
    },
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key];
    },
  };
}

function skill(name) {
  return {
    type: "skill",
    name,
    system: { attribute: "agl", value: 12 },
  };
}

function spell() {
  return { type: "spell", name: "Lightning Flash" };
}

beforeEach(() => {
  globalThis.game = {
    i18n: { localize: vi.fn(key => key) },
  };
});

describe("shared Druid roll boons", () => {
  test("recognizes English and Swedish SNEAKING names", () => {
    expect(isDruidSneakingSkill(skill("Sneaking"))).toBe(true);
    expect(isDruidSneakingSkill(skill("SMYGA"))).toBe(true);
    expect(isDruidSneakingSkill(skill("Awareness"))).toBe(false);
  });

  test("Cat + active Feral gives one SNEAKING boon", () => {
    expect(
      getDruidRollBoons({
        actor: actor("cat", {
          feral: { active: true, powerLevel: 2 },
        }),
        skill: skill("Sneaking"),
        settings: settings(),
      }),
    ).toEqual([
      expect.objectContaining({
        id: "cat-sneaking",
        source: "Cat Form",
        value: true,
      }),
    ]);
  });

  test("Feral alone is insufficient outside Cat Form", () => {
    expect(
      getDruidRollBoons({
        actor: actor("bear", { feral: { active: true } }),
        skill: skill("Sneaking"),
        settings: settings(),
      }),
    ).toEqual([]);
  });

  test("Moonkin + active Stars gives one spellcasting boon", () => {
    expect(
      getDruidRollBoons({
        actor: actor("moonkin", {
          stars: { active: true, powerLevel: 3 },
        }),
        skill: skill("Animism"),
        spell: spell(),
        settings: settings(),
      }),
    ).toEqual([
      expect.objectContaining({
        id: "moonkin-spellcasting",
        source: "Moonkin Form",
        value: true,
      }),
    ]);
  });

  test("Stars alone is insufficient outside Moonkin Form", () => {
    expect(
      getDruidRollBoons({
        actor: actor("humanoid", { stars: { active: true } }),
        skill: skill("Animism"),
        spell: spell(),
        settings: settings(),
      }),
    ).toEqual([]);
  });

  test("the two settings disable only their own rule", () => {
    expect(
      getDruidRollBoons({
        actor: actor("cat", { feral: { active: true } }),
        skill: skill("Sneaking"),
        settings: settings({
          druidCatSneakingAutomation: false,
        }),
      }),
    ).toEqual([]);

    expect(
      getDruidRollBoons({
        actor: actor("moonkin", { stars: { active: true } }),
        skill: skill("Animism"),
        spell: spell(),
        settings: settings({
          druidMoonkinSpellcastingBoonAutomation: false,
        }),
      }),
    ).toEqual([]);
  });

  test("dialog adapter adds a checked boon without changing skill value", () => {
    const sneaking = skill("Sneaking");
    const testObject = {
      actor: actor("cat", { feral: { active: true } }),
      skill: sneaking,
      dialogData: { boons: [], banes: [] },
    };

    expect(
      applyDruidRollBoonsToDialog(
        testObject,
        { settings: settings() },
      ).added,
    ).toBe(1);
    expect(testObject.dialogData.boons).toEqual([
      { source: "Cat Form", value: true },
    ]);
    expect(sneaking.system.value).toBe(12);
  });

  test("one SkillTest patch also applies to spell subclasses", () => {
    class FakeSkillTest {
      constructor(actorValue, skillValue) {
        this.actor = actorValue;
        this.skill = skillValue;
        this.dialogData = {};
      }
      updateDialogData() {
        this.dialogData.boons = [
          { source: "Existing", value: true },
        ];
        this.dialogData.banes = [];
      }
    }

    class FakeSpellTest extends FakeSkillTest {
      constructor(actorValue, skillValue, spellValue) {
        super(actorValue, skillValue);
        this.spell = spellValue;
      }
    }

    expect(
      patchDruidRollBoons({ SkillTestClass: FakeSkillTest }),
    ).toBe(true);

    const moonkin = new FakeSpellTest(
      actor("moonkin", { stars: { active: true } }),
      skill("Animism"),
      spell(),
    );
    moonkin.updateDialogData();

    expect(moonkin.dialogData.boons).toEqual([
      { source: "Existing", value: true },
      { source: "Moonkin Form", value: true },
    ]);
    expect(moonkin.dialogData.fillerBanes).toBe(2);
  });

  test("noBanesBoons explicitly suppresses Druid boons", () => {
    const testObject = {
      actor: actor("cat", { feral: { active: true } }),
      skill: skill("Sneaking"),
      noBanesBoons: true,
      dialogData: { boons: [], banes: [] },
    };

    expect(
      applyDruidRollBoonsToDialog(
        testObject,
        { settings: settings() },
      ).added,
    ).toBe(0);
  });
});
