import { MODULE_ID } from "./core/constants.js";
import {
  isDruidCatSneakingAutomationEnabled,
  isDruidMoonkinSpellcastingBoonAutomationEnabled,
} from "./automation-settings.js";

const STATE_FLAG = "druidFormState";
const SKILL_TEST_PATCH = Symbol.for(
  `${MODULE_ID}.druidRollBoons.skillTest`,
);
const SNEAKING_NAMES = new Set(["sneaking", "smyga"]);

function currentState(actor) {
  return (
    actor?.getFlag?.(MODULE_ID, STATE_FLAG) ??
    actor?.flags?.[MODULE_ID]?.[STATE_FLAG] ??
    { currentForm: "humanoid", activations: {} }
  );
}

function activeActivation(state, key) {
  const activation = state?.activations?.[key];
  return activation?.active === true ? activation : null;
}

function localize(key, fallback) {
  const localized = globalThis.game?.i18n?.localize?.(key);
  return localized && localized !== key ? localized : fallback;
}

export function isDruidSneakingSkill(skill) {
  return (
    skill?.type === "skill" &&
    SNEAKING_NAMES.has(
      String(skill?.name ?? "").trim().toLocaleLowerCase(),
    )
  );
}

export function getDruidRollBoons({
  actor,
  skill = null,
  spell = null,
  settings = globalThis.game?.settings,
} = {}) {
  if (actor?.type !== "character") return [];

  const state = currentState(actor);
  const boons = [];

  if (
    !spell &&
    state?.currentForm === "cat" &&
    activeActivation(state, "feral") &&
    isDruidSneakingSkill(skill) &&
    isDruidCatSneakingAutomationEnabled(settings)
  ) {
    boons.push({
      id: "cat-sneaking",
      source: localize(
        "BOA.rollBoons.druidCatSneaking",
        "Cat Form",
      ),
      value: true,
    });
  }

  if (
    spell?.type === "spell" &&
    state?.currentForm === "moonkin" &&
    activeActivation(state, "stars") &&
    isDruidMoonkinSpellcastingBoonAutomationEnabled(settings)
  ) {
    boons.push({
      id: "moonkin-spellcasting",
      source: localize(
        "BOA.rollBoons.druidMoonkinSpellcasting",
        "Moonkin Form",
      ),
      value: true,
    });
  }

  return boons;
}

function recalculateFillers(dialogData) {
  const boons = Array.isArray(dialogData?.boons)
    ? dialogData.boons
    : [];
  const banes = Array.isArray(dialogData?.banes)
    ? dialogData.banes
    : [];

  dialogData.fillerBanes = Math.max(
    0,
    boons.length - banes.length,
  );
  dialogData.fillerBoons = Math.max(
    0,
    banes.length - boons.length,
  );
}

export function applyDruidRollBoonsToDialog(
  test,
  { settings = globalThis.game?.settings } = {},
) {
  if (
    !test?.dialogData ||
    test.noBanesBoons ||
    test.autoSuccess
  ) {
    return { added: 0, boons: [] };
  }

  test.dialogData.boons ??= [];

  const wanted = getDruidRollBoons({
    actor: test.actor,
    skill: test.skill,
    spell: test.spell ?? null,
    settings,
  });
  const existingSources = new Set(
    test.dialogData.boons.map(
      boon => String(boon?.source ?? ""),
    ),
  );
  const added = [];

  for (const boon of wanted) {
    if (existingSources.has(boon.source)) continue;

    test.dialogData.boons.push({
      source: boon.source,
      value: true,
    });
    existingSources.add(boon.source);
    added.push(boon);
  }

  recalculateFillers(test.dialogData);

  return {
    added: added.length,
    boons: added,
  };
}

export function patchDruidRollBoons({ SkillTestClass } = {}) {
  const prototype = SkillTestClass?.prototype;
  const current = prototype?.updateDialogData;

  if (typeof current !== "function") return false;
  if (current[SKILL_TEST_PATCH] === true) return true;

  const original = current;

  function boaDruidRollBoonUpdateDialogData(...args) {
    const result = original.apply(this, args);
    applyDruidRollBoonsToDialog(this);
    return result;
  }

  Object.defineProperty(
    boaDruidRollBoonUpdateDialogData,
    SKILL_TEST_PATCH,
    { value: true },
  );

  prototype.updateDialogData = boaDruidRollBoonUpdateDialogData;
  return true;
}

async function loadDragonbaneSkillTestClass() {
  const relativePath =
    "systems/dragonbane/modules/tests/skill-test.js";
  const route =
    globalThis.foundry?.utils?.getRoute?.(relativePath) ??
    `/${relativePath}`;
  const module = await import(route);

  if (typeof module?.default !== "function") {
    throw new Error(
      `${MODULE_ID} | Dragonbane DoDSkillTest could not be loaded for Druid roll boons.`,
    );
  }

  return module.default;
}

export async function registerDruidRollBoonAdapter({
  SkillTestClass = null,
} = {}) {
  const TestClass =
    SkillTestClass ??
    await loadDragonbaneSkillTestClass();

  return patchDruidRollBoons({
    SkillTestClass: TestClass,
  });
}
