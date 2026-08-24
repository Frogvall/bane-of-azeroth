import {
  MODULE_ID,
} from "./core/constants.js";

const BASE_SKILLS_PATCH =
  Symbol.for(
    `${MODULE_ID}.firearms-base-skills`,
  );

export const FIREARMS_SKILL_NAME =
  "Firearms";

export function buildFirearmsSkillData() {
  /*
   * This is the Actor-embedded form of the canonical BoA Firearms skill.
   * Do not carry source folder/_id/_stats metadata into newly created Actors.
   */
  return {
    name:
      FIREARMS_SKILL_NAME,
    type:
      "skill",
    img:
      "modules/dragonbane-coreset/assets/icons/gear/book.webp",
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
      gmDescription:
        "",
      itemDescription:
        "<p>This skill is used for attacks with firearms of all kinds.</p>",
      taught:
        false,
    },
    effects: [],
    sort:
      100000,
    flags: {},
  };
}

export function isFirearmsSkill(
  skill,
) {
  return (
    skill?.type ===
      "skill" &&
    skill?.system?.skillType ===
      "weapon" &&
    String(
      skill?.name ?? "",
    ).toLocaleLowerCase() ===
      FIREARMS_SKILL_NAME
        .toLocaleLowerCase()
  );
}

export function appendFirearmsBaseSkill(
  skills,
) {
  if (!Array.isArray(skills)) {
    return skills;
  }

  if (
    skills.some(
      isFirearmsSkill,
    )
  ) {
    return skills;
  }

  return [
    ...skills,
    buildFirearmsSkillData(),
  ];
}

export function patchDragonbaneBaseSkills({
  UtilityClass,
} = {}) {
  const current =
    UtilityClass
      ?.getBaseSkills;

  if (
    typeof current !==
      "function"
  ) {
    return false;
  }

  if (
    current[
      BASE_SKILLS_PATCH
    ] === true
  ) {
    return true;
  }

  const original =
    current;

  async function boaGetBaseSkills(
    ...args
  ) {
    const skills =
      await original.apply(
        this,
        args,
      );

    return appendFirearmsBaseSkill(
      skills,
    );
  }

  Object.defineProperty(
    boaGetBaseSkills,
    BASE_SKILLS_PATCH,
    {
      value:
        true,
    },
  );

  UtilityClass.getBaseSkills =
    boaGetBaseSkills;

  return true;
}

async function loadDragonbaneUtilityClass() {
  const relativePath =
    "systems/dragonbane/modules/utility.js";
  const route =
    globalThis.foundry
      ?.utils
      ?.getRoute?.(
        relativePath,
      ) ??
    `/${relativePath}`;

  const module =
    await import(
      route
    );

  if (
    typeof module?.default
      ?.getBaseSkills !==
      "function"
  ) {
    throw new Error(
      `${MODULE_ID} | Dragonbane DoD_Utility#getBaseSkills could not be loaded.`,
    );
  }

  return module.default;
}

export async function registerFirearmsBaseSkillAdapter({
  UtilityClass =
    null,
} = {}) {
  const ResolvedUtilityClass =
    UtilityClass ??
    await loadDragonbaneUtilityClass();

  return patchDragonbaneBaseSkills({
    UtilityClass:
      ResolvedUtilityClass,
  });
}
