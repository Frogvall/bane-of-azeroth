const checks = [];
const notes = [];
const testKey = "shadowform";
const testName =
  "BOA DEV – Verify Shadowform Visuals";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Shadowform system verification changes a world setting.",
  );
  return boaFinish(
    testKey,
    testName,
    checks,
    notes,
  );
}

const api =
  game.modules.get(
    BOA_TEST_MODULE_ID,
  )?.api ??
  {};

for (
  const name
  of [
    "getShadowformState",
    "isShadowformActive",
    "activateShadowform",
    "endShadowform",
    "reconcileShadowformCanvas",
    "reconcileShadowformVisuals",
  ]
) {
  boaCheck(
    checks,
    `Shadowform API exposes ${name}`,
    typeof api?.[
      name
    ] ===
      "function",
    typeof api?.[
      name
    ],
  );
}

const setting =
  game.settings?.settings
    ?.get?.(
      `${BOA_TEST_MODULE_ID}.shadowformVisualAutomation`,
    ) ??
  null;

boaCheck(
  checks,
  "Shadowform Visuals setting is world-scoped and defaults enabled",
  Boolean(
    setting &&
    setting.scope ===
      "world" &&
    setting.default ===
      true
  ),
  setting
    ? {
        scope:
          setting.scope,
        default:
          setting.default,
      }
    : null,
);

const FilterClass =
  globalThis.PIXI
    ?.ColorMatrixFilter ??
  globalThis.PIXI
    ?.filters
    ?.ColorMatrixFilter ??
  null;

boaCheck(
  checks,
  "Foundry exposes ColorMatrixFilter for static token tinting",
  typeof FilterClass ===
    "function",
  typeof FilterClass,
);

notes.push(
  "Manual: cast Shadowform on a character with a token on the active Scene. "
  + "Verify every current-scene token for that Actor becomes dark violet/shadowed "
  + "without changing token art, the character-sheet portrait gets the matching "
  + "static treatment, a newly placed token and a Scene reload reconcile it, and "
  + "End Effects or a Stretch Rest removes the treatment."
);

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
