const checks = [];
const notes = [];

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Adventure ownership verification is run by a game master",
    false,
    "The test temporarily changes a world setting."
  );
  return boaFinish(
    "adventure-ownership",
    "BOA DEV – Verify Adventure Ownership",
    checks,
    notes
  );
}

const settingNamespace = "dragonbane";
const settingKey = "keepOwnershipOnImport";
const settingId =
  `${settingNamespace}.${settingKey}`;
const registeredSetting =
  game.settings.settings.get(settingId);

if (!boaCheck(
  checks,
  "Dragonbane ownership-import setting is registered",
  Boolean(registeredSetting),
  settingId
)) {
  return boaFinish(
    "adventure-ownership",
    "BOA DEV – Verify Adventure Ownership",
    checks,
    notes
  );
}

boaCheckEqual(
  checks,
  "Ownership-import setting uses world scope",
  registeredSetting.scope,
  "world"
);
boaCheckEqual(
  checks,
  "Ownership-import setting is configurable",
  registeredSetting.config,
  true
);
boaCheck(
  checks,
  "Ownership-import setting is Boolean",
  registeredSetting.type === Boolean,
  registeredSetting.type?.name ?? ""
);
boaCheckEqual(
  checks,
  "Ownership-import setting defaults to enabled",
  registeredSetting.default,
  true
);

const originalValue = game.settings.get(
  settingNamespace,
  settingKey
);
const ownerUserId = "BoaOwnerUser0001";
const sourceOwnership = {
  default:
    CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
  [ownerUserId]:
    CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
};

function makeImportPayload() {
  return {
    toCreate: {
      Item: [
        {
          _id: "BoaAdvCreate0001",
          name: "[BOA TEST] Newly imported item",
          ownership:
            foundry.utils.deepClone(
              sourceOwnership
            ),
        },
      ],
    },
    toUpdate: {
      Actor: [
        {
          _id: "BoaAdvActor0001",
          name: "[BOA TEST] Existing actor",
          ownership:
            foundry.utils.deepClone(
              sourceOwnership
            ),
        },
      ],
      Item: [
        {
          _id: "BoaAdvUpdate0001",
          name: "[BOA TEST] Existing item",
          ownership:
            foundry.utils.deepClone(
              sourceOwnership
            ),
        },
        {
          _id: "BoaAdvNoOwner001",
          name:
            "[BOA TEST] Existing item without ownership",
        },
      ],
    },
  };
}

function invokePreImportAdventure(
  toCreate,
  toUpdate
) {
  return Hooks.call(
    "preImportAdventure",
    {
      _id: "BoaAdvTest000001",
      name:
        "[BOA TEST] Adventure ownership verification",
    },
    {},
    toCreate,
    toUpdate
  );
}

function hasOwnOwnership(data) {
  return Object.prototype.hasOwnProperty.call(
    data,
    "ownership"
  );
}

let executionError = null;

try {
  await game.settings.set(
    settingNamespace,
    settingKey,
    false
  );

  const disabled = makeImportPayload();
  const disabledHookResult =
    invokePreImportAdventure(
      disabled.toCreate,
      disabled.toUpdate
    );

  boaCheck(
    checks,
    "Adventure import hook permits import when preservation is disabled",
    disabledHookResult !== false,
    boaDiagnosticValue(disabledHookResult)
  );
  boaCheckEqual(
    checks,
    "Disabled setting leaves Actor ownership in update data",
    disabled.toUpdate.Actor[0].ownership,
    sourceOwnership
  );
  boaCheckEqual(
    checks,
    "Disabled setting leaves Item ownership in update data",
    disabled.toUpdate.Item[0].ownership,
    sourceOwnership
  );
  boaCheckEqual(
    checks,
    "Disabled setting does not alter ownership for newly created content",
    disabled.toCreate.Item[0].ownership,
    sourceOwnership
  );

  await game.settings.set(
    settingNamespace,
    settingKey,
    true
  );

  const enabled = makeImportPayload();
  const enabledHookResult =
    invokePreImportAdventure(
      enabled.toCreate,
      enabled.toUpdate
    );

  boaCheck(
    checks,
    "Adventure import hook permits import when preservation is enabled",
    enabledHookResult !== false,
    boaDiagnosticValue(enabledHookResult)
  );
  boaCheck(
    checks,
    "Enabled setting removes Actor ownership from update data",
    !hasOwnOwnership(
      enabled.toUpdate.Actor[0]
    ),
    boaDiagnosticValue(
      enabled.toUpdate.Actor[0]
    )
  );
  boaCheck(
    checks,
    "Enabled setting removes Item ownership from update data",
    !hasOwnOwnership(
      enabled.toUpdate.Item[0]
    ),
    boaDiagnosticValue(
      enabled.toUpdate.Item[0]
    )
  );
  boaCheck(
    checks,
    "Enabled setting tolerates update data without ownership",
    !hasOwnOwnership(
      enabled.toUpdate.Item[1]
    ),
    boaDiagnosticValue(
      enabled.toUpdate.Item[1]
    )
  );
  boaCheckEqual(
    checks,
    "Enabled setting does not alter ownership for newly created content",
    enabled.toCreate.Item[0].ownership,
    sourceOwnership
  );

  const settingName =
    typeof registeredSetting.name === "string"
      ? game.i18n.localize(
          registeredSetting.name
        )
      : String(
          registeredSetting.name ?? settingId
        );

  notes.push(
    `Verified setting: ${settingId} ` +
    `(${settingName}).`
  );
  notes.push(
    "When enabled, Dragonbane removes ownership " +
    "from Adventure update data. Existing world " +
    "document ownership is therefore preserved."
  );
  notes.push(
    "The setting affects updates only; ownership " +
    "on newly created imported content is unchanged."
  );
} catch (error) {
  executionError = error;
  boaCheck(
    checks,
    "Adventure ownership verification completed",
    false,
    error.stack ?? error.message
  );
} finally {
  try {
    await game.settings.set(
      settingNamespace,
      settingKey,
      originalValue
    );

    boaCheckEqual(
      checks,
      "Original ownership-import setting was restored",
      game.settings.get(
        settingNamespace,
        settingKey
      ),
      originalValue
    );
  } catch (restoreError) {
    boaCheck(
      checks,
      "Original ownership-import setting was restored",
      false,
      restoreError.stack ??
        restoreError.message
    );
  }
}

if (executionError) {
  notes.push(
    "The setting restoration was attempted after " +
    "the verification error."
  );
}

return boaFinish(
  "adventure-ownership",
  "BOA DEV – Verify Adventure Ownership",
  checks,
  notes
);
