const checks = [];
const notes = [];
const testKey =
  "death-knight-runes";
const testName =
  "BOA DEV – Verify Death Knight Runes";

const source =
  boaFindWorldItem(
    "heroic-class-ability.death-knight.death-knights-rebirth",
  ) ??
  boaCollectionValues(
    game.items,
  ).find(
    item =>
      item.type ===
        "ability" &&
      item.name ===
        "Death Knight's Rebirth",
  ) ??
  null;

boaCheck(
  checks,
  "Death Knight's Rebirth source ability is imported",
  Boolean(
    source,
  ),
  source?.uuid ??
    "",
);

const registration =
  game.settings
    .settings
    ?.get?.(
      `${BOA_TEST_MODULE_ID}.deathKnightRunesAutomation`,
    ) ??
  null;

boaCheck(
  checks,
  "Death Knight Runes automation setting is registered and enabled by default",
  Boolean(
    registration &&
    registration.default ===
      true
  ),
  registration
    ? `default=${registration.default}`
    : "missing",
);

const api =
  game.modules
    .get(
      BOA_TEST_MODULE_ID,
    )
    ?.api ??
  {};

for (
  const functionName
  of [
    "getDeathKnightRuneDefinitions",
    "isDeathKnightRuneEligibleWeapon",
    "buildUnendingThirstEffectData",
    "getDeathKnightRuneState",
    "setDeathKnightRune",
    "clearDeathKnightRune",
  ]
) {
  boaCheck(
    checks,
    `Death Knight Runes API exposes ${functionName}`,
    typeof api[
      functionName
    ] ===
      "function",
    typeof api[
      functionName
    ],
  );
}

if (
  typeof api
    .getDeathKnightRuneDefinitions ===
    "function"
) {
  const definitions =
    api.getDeathKnightRuneDefinitions();

  boaCheckEqual(
    checks,
    "Death Knight Runes defines exactly three rune choices",
    definitions.map(
      rune =>
        rune.key,
    ),
    [
      "fallenCrusader",
      "razorice",
      "unendingThirst",
    ],
  );

  boaCheckEqual(
    checks,
    "Only Unending Thirst is mechanically automated",
    definitions.map(
      rune => ({
        key:
          rune.key,
        automated:
          rune.automated,
      }),
    ),
    [
      {
        key:
          "fallenCrusader",
        automated:
          false,
      },
      {
        key:
          "razorice",
        automated:
          false,
      },
      {
        key:
          "unendingThirst",
        automated:
          true,
      },
    ],
  );

  boaCheckEqual(
    checks,
    "Rune choices use the dedicated rune artwork",
    definitions.map(
      rune =>
        rune.icon,
    ),
    [
      "modules/bane-of-azeroth/assets/icons/runes/fallen_crusader.webp",
      "modules/bane-of-azeroth/assets/icons/runes/razorice.webp",
      "modules/bane-of-azeroth/assets/icons/runes/unending_thirst.webp",
    ],
  );
}

if (
  typeof api
    .isDeathKnightRuneEligibleWeapon ===
    "function"
) {
  const melee = {
    type:
      "weapon",
    isRangedWeapon:
      false,
    system: {
      range:
        2,
    },
  };

  const ranged = {
    type:
      "weapon",
    isRangedWeapon:
      true,
    system: {
      range:
        20,
    },
  };

  boaCheckEqual(
    checks,
    "Death Knight rune selector accepts melee weapons and rejects ranged weapons",
    {
      melee:
        api.isDeathKnightRuneEligibleWeapon(
          melee,
        ),
      ranged:
        api.isDeathKnightRuneEligibleWeapon(
          ranged,
        ),
    },
    {
      melee:
        true,
      ranged:
        false,
    },
  );
}

if (
  typeof api
    .buildUnendingThirstEffectData ===
    "function"
) {
  const data =
    api.buildUnendingThirstEffectData({
      id:
        "synthetic-rune-weapon",
      uuid:
        "Actor.synthetic.Item.synthetic-rune-weapon",
    });

  const changes =
    data?.system
      ?.changes ??
    [];

  boaCheckEqual(
    checks,
    "Unending Thirst uses the Foundry V14 equipped-only Movement +2 Active Effect schema",
    {
      applyOnlyWhenEquipped:
        data?.system
          ?.applyOnlyWhenEquipped,
      topLevelChanges:
        data?.changes ??
        null,
      changes:
        changes.map(
          change => ({
            key:
              change.key,
            type:
              change.type,
            value:
              change.value,
            phase:
              change.phase,
            priority:
              change.priority,
          }),
        ),
    },
    {
      applyOnlyWhenEquipped:
        true,
      topLevelChanges:
        null,
      changes: [{
        key:
          "system.movement.value",
        type:
          "add",
        value:
          "2",
        phase:
          "final",
        priority:
          20,
      }],
    },
  );
}

notes.push(
  "Fallen Crusader remains a visual/rules reminder; automatic living-creature healing is intentionally not implemented.",
);
notes.push(
  "Razorice remains a visual/rules reminder; Dragonbane has no generic magical-weapon state to automate.",
);
notes.push(
  "The stretch required to engrave or replace a rune remains manual. The selector records the result after the stretch.",
);

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
