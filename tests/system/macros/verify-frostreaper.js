const checks = [];
const notes = [];

const settingKey =
  "frostreaperAutomation";
const contentKey =
  "heroic-class-ability.death-knight.frostreaper";

const definition =
  game.settings?.settings?.get?.(
    `${BOA_TEST_MODULE_ID}.${settingKey}`
  );

boaCheck(
  checks,
  "Frostreaper automation setting is registered",
  Boolean(
    definition
  ),
  `${BOA_TEST_MODULE_ID}.${settingKey}`
);

if (definition) {
  boaCheckEqual(
    checks,
    "Frostreaper automation defaults to enabled",
    definition.default,
    true
  );
}

const sourceAbility =
  boaFindWorldItem(
    contentKey,
    "ability"
  );

boaCheck(
  checks,
  "Frostreaper source ability exists",
  Boolean(
    sourceAbility
  ),
  contentKey
);

const api =
  game.modules.get(
    BOA_TEST_MODULE_ID
  )?.api ?? {};

const isActive =
  api.isFrostreaperActivationActive;
const getAuraData =
  api.getFrostreaperAuraData;

boaCheck(
  checks,
  "Frostreaper timing API is exposed",
  typeof isActive ===
    "function",
  "isFrostreaperActivationActive"
);

boaCheck(
  checks,
  "Frostreaper aura-data API is exposed",
  typeof getAuraData ===
    "function",
  "getFrostreaperAuraData"
);

if (
  typeof isActive === "function" &&
  typeof getAuraData === "function"
) {
  const activation = {
    combatId:
      "boa-frostreaper-combat",
    combatantId:
      "boa-frostreaper-owner",
    actorId:
      "boa-frostreaper-actor",
    sceneId:
      "boa-frostreaper-scene",
    tokenId:
      "boa-frostreaper-token",
    activationRound:
      4,
    activationTurn:
      1,
    range:
      10
  };

  const combatAt = (
    round,
    turn
  ) => ({
    id:
      "boa-frostreaper-combat",
    started:
      true,
    round,
    turn,
    turns: [
      {
        id:
          "boa-before"
      },
      {
        id:
          "boa-frostreaper-owner"
      },
      {
        id:
          "boa-after"
      }
    ]
  });

  boaCheck(
    checks,
    "Frostreaper remains active for the rest of its activation round",
    isActive(
      activation,
      combatAt(
        4,
        2
      )
    ),
    activation
  );

  boaCheck(
    checks,
    "Frostreaper remains active before the owner's turn in the next round",
    isActive(
      activation,
      combatAt(
        5,
        0
      )
    ),
    activation
  );

  boaCheck(
    checks,
    "Frostreaper expires when the owner's turn starts in the next round",
    !isActive(
      activation,
      combatAt(
        5,
        1
      )
    ),
    activation
  );

  boaCheck(
    checks,
    "Frostreaper stays expired after the owner's next turn",
    !isActive(
      activation,
      combatAt(
        5,
        2
      )
    ) &&
      !isActive(
        activation,
        combatAt(
          6,
          0
        )
      ),
    activation
  );

  const token = {
    id:
      "boa-frostreaper-token",
    document: {
      id:
        "boa-frostreaper-token",
      parent: {
        id:
          "boa-frostreaper-scene"
      }
    },
    scene: {
      id:
        "boa-frostreaper-scene",
      grid: {
        size:
          100,
        distance:
          2
      }
    }
  };

  const message = {
    flags: {
      [BOA_TEST_MODULE_ID]: {
        frostreaperActivation:
          activation
      }
    }
  };

  const enabledSettings = {
    get:
      () => true
  };

  const aura =
    getAuraData(
      token,
      {
        settings:
          enabledSettings,
        combat:
          combatAt(
            5,
            0
          ),
        messages: [
          message
        ]
      }
    );

  boaCheckEqual(
    checks,
    "Frostreaper visual reminder uses a 10 m radius",
    aura?.range,
    10
  );

  boaCheckEqual(
    checks,
    "Frostreaper visual reminder converts 10 m to the expected scene radius",
    aura?.radius,
    500
  );

  boaCheckEqual(
    checks,
    "Frostreaper visual reminder uses the light-blue aura color",
    aura?.color,
    0x8edbff
  );

  const disabledAura =
    getAuraData(
      token,
      {
        settings: {
          get:
            () => false
        },
        combat:
          combatAt(
            5,
            0
          ),
        messages: [
          message
        ]
      }
    );

  boaCheck(
    checks,
    "Disabling Frostreaper automation suppresses the visual aura",
    disabledAura ===
      null,
    disabledAura
  );
}

notes.push(
  "Frostreaper automation is intentionally visual only: it does not halve " +
  "movement and does not automate the BUSHCRAFT roll to resist cold."
);
notes.push(
  "The reminder aura lasts through the rest of the activation round and " +
  "expires when the Death Knight's own turn begins in the next round."
);

return boaFinish(
  "frostreaper",
  "BOA DEV – Verify Frostreaper",
  checks,
  notes
);
