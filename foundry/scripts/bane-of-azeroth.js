import DoDOptionalRuleSettings from "/systems/dragonbane/modules/apps/optional-rule-settings.js";
import DoDRollDamageMessageData from "/systems/dragonbane/modules/data/messages/roll-damage-message.js";
import DoDWeaponTest from "/systems/dragonbane/modules/tests/weapon-test.js";
import DoD_Utility from "/systems/dragonbane/modules/utility.js";

const MODULE_ID = "bane-of-azeroth";
const ADVENTURE_PACK_ID = `${MODULE_ID}.${MODULE_ID}`;
const ADVENTURE_PROMPT_VERSION_SETTING = "adventurePromptVersion";

const WEAPON_FEATURES = Object.freeze({
  freehanded: "BOA.weaponFeatureTypes.freehanded",
  returning: "BOA.weaponFeatureTypes.returning",
  ammunition: "BOA.weaponFeatureTypes.ammunition",
  armorPiercing: "BOA.weaponFeatureTypes.armorPiercing",
  scattershot: "BOA.weaponFeatureTypes.scattershot"
});

function registerSettings() {
  game.settings.register(MODULE_ID, ADVENTURE_PROMPT_VERSION_SETTING, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

function getContentVersion() {
  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "";
  return moduleVersion.match(/^\d+\.\d+\.\d+/)?.[0] ?? moduleVersion;
}

async function promptAdventureImport() {
  if (!game.user.isGM) return;

  const contentVersion = getContentVersion();
  const promptedVersion = game.settings.get(
    MODULE_ID,
    ADVENTURE_PROMPT_VERSION_SETTING
  );

  if (
    promptedVersion
    && !foundry.utils.isNewerVersion(contentVersion, promptedVersion)
  ) {
    return;
  }

  const pack = game.packs.get(ADVENTURE_PACK_ID);

  if (!pack) {
    console.error(
      `${MODULE_ID} | Adventure pack ${ADVENTURE_PACK_ID} was not found.`
    );
    return;
  }

  const index = await pack.getIndex();
  const adventureId = index.contents[0]?._id;

  if (!adventureId) {
    console.error(
      `${MODULE_ID} | No Adventure document was found in ${ADVENTURE_PACK_ID}.`
    );
    return;
  }

  const adventure = await pack.getDocument(adventureId);

  if (!adventure) {
    console.error(
      `${MODULE_ID} | Adventure ${adventureId} could not be loaded.`
    );
    return;
  }

  await adventure.sheet.render(true);

  await game.settings.set(
    MODULE_ID,
    ADVENTURE_PROMPT_VERSION_SETTING,
    contentVersion
  );
}

async function ensureAutoGrantedSpellsPrepared(actor) {
  const updates = actor.items
    .filter(
      item =>
        isAutoGrantedSpell(item) &&
        item.system.memorized !== true
    )
    .map(item => ({
      _id: item.id,
      "system.memorized": true,
    }));

  if (updates.length > 0) {
    await actor.updateEmbeddedDocuments("Item", updates);
  }
}

function isAutoGrantedSpell(item) {
  return (
    item?.type === "spell" &&
    getModuleFlag(item, "autoGranted") === true
  );
}

function lockAutoGrantedSpellPreparation(app, html) {
  const actor = app.actor ?? app.document;
  if (actor?.documentName !== "Actor") return;

  for (const spell of actor.items.filter(isAutoGrantedSpell)) {
    const checkbox = html.querySelector(
      `tr.item[data-item-id="${spell.id}"] ` +
      `input.inline-edit[data-field="system.memorized"]`
    );

    if (!checkbox) continue;

    checkbox.checked = true;
    checkbox.disabled = true;
    checkbox.title =
      "Granted by a Heroic Class Ability and always prepared.";
  }
}

function protectAutoGrantedSpellPreparation(
  item,
  changed
) {
  if (!isAutoGrantedSpell(item)) return;

  const flatValue = changed["system.memorized"];
  const nestedValue = foundry.utils.getProperty(
    changed,
    "system.memorized"
  );

  if (flatValue !== false && nestedValue !== false) return;

  if (Object.hasOwn(changed, "system.memorized")) {
    changed["system.memorized"] = true;
  } else {
    foundry.utils.setProperty(
      changed,
      "system.memorized",
      true
    );
  }
}

function isArmorPiercingRangedWeapon(weapon) {
  return Boolean(
    DoDOptionalRuleSettings.damageTypes
    && weapon?.isRangedWeapon
    && !weapon.hasWeaponFeature("thrown")
    && weapon.hasWeaponFeature("piercing")
    && weapon.hasWeaponFeature("armorPiercing")
  );
}

function isScattershotRangedWeapon(weapon) {
  return Boolean(
    weapon?.isRangedWeapon
    && !weapon.hasWeaponFeature("thrown")
    && weapon.hasWeaponFeature("scattershot")
  );
}

function actorHasAmmoPouch(actor) {
  return Boolean(
    actor?.items?.some(
      item =>
        item.type === "item"
        && item.name?.trim().toLowerCase() === "ammo pouch"
    )
  );
}

function getTargetingData(test) {
  const actorToken = canvas.scene?.tokens?.find(
    token => token.actor?.uuid === test.actor.uuid
  );

  const targetToken =
    test.options.targets?.length > 0
      ? test.options.targets[0].document
      : null;

  if (!actorToken || !targetToken) {
    return {
      actorToken: null,
      targetToken: null,
      distance: null
    };
  }

  return {
    actorToken,
    targetToken,
    distance: DoD_Utility.calculateDistanceBetweenTokens(
      actorToken,
      targetToken
    )
  };
}

function patchWeaponTests() {
  const prototype = DoDWeaponTest.prototype;

  if (prototype.__baneOfAzerothPatched) return;

  const originalGetRollOptions = prototype.getRollOptions;

  prototype.getRollOptions = async function (...args) {
    const requiresAmmunition =
      this.weapon?.hasWeaponFeature("ammunition");

    if (
      requiresAmmunition
      && !actorHasAmmoPouch(this.actor)
    ) {
      const confirmAction =
        await foundry.applications.api.DialogV2.confirm({
          window: {
            title: game.i18n.localize(
              "BOA.dialog.missingAmmoPouchTitle"
            )
          },
          content: game.i18n.localize(
            "BOA.dialog.missingAmmoPouchContent"
          ),
          yes: {
            label: game.i18n.localize(
              "DoD.ui.dialog.performAction"
            )
          },
          no: {
            label: game.i18n.localize(
              "DoD.ui.dialog.cancelAction"
            )
          }
        });

      if (!confirmAction) {
        return { cancelled: true };
      }
    }

    return originalGetRollOptions.apply(this, args);
  };

  const originalUpdateDialogData = prototype.updateDialogData;

  prototype.updateDialogData = function (...args) {
    const result = originalUpdateDialogData.apply(this, args);

    /*
     * Armor Piercing:
     * Give a pure ranged piercing weapon the normal Dragonbane
     * Find Weak Spot action.
     */
    if (isArmorPiercingRangedWeapon(this.weapon)) {
      const actions = this.dialogData?.actions;

      if (
        Array.isArray(actions)
        && !actions.some(action => action.id === "weakpoint")
      ) {
        const weakpointAction = {
          id: "weakpoint",
          label: game.i18n.localize(
            "DoD.attackTypes.weakpoint"
          ),
          tooltip: game.i18n.localize(
            "DoD.attackTypes.weakpointTooltip"
          ),
          checked: false
        };

        const rangedIndex = actions.findIndex(
          action => action.id === "ranged"
        );

        actions.splice(
          rangedIndex >= 0 ? rangedIndex + 1 : actions.length,
          0,
          weakpointAction
        );
      }
    }

    /*
     * Scattershot:
     * Reuse Dragonbane's own token-distance calculation. With no
     * targeted token, no automatic Scattershot range handling occurs.
     */
    this._baneOfAzerothScattershotLongRange = false;

    if (isScattershotRangedWeapon(this.weapon)) {
      const { distance } = getTargetingData(this);

      if (distance !== null) {
        if (
          distance <= 2
          && Array.isArray(this.dialogData?.banes)
        ) {
          const pointBlankLabel = game.i18n.localize(
            "DoD.weapon.pointBlank"
          );

          this.dialogData.banes =
            this.dialogData.banes.filter(
              bane => bane.source !== pointBlankLabel
            );
        }

        this._baneOfAzerothScattershotLongRange =
          distance > this.weapon.calculateRange();
      }
    }

    return result;
  };

  const originalUpdatePostRollData = prototype.updatePostRollData;

  prototype.updatePostRollData = function (...args) {
    const isRangedWeakpoint =
      this.preRollData?.action === "weakpoint"
      && isArmorPiercingRangedWeapon(this.weapon);

    /*
     * Dragonbane normally marks only "ranged" and "throw" actions as
     * ranged. Do this before its post-roll processing so ranged Weak
     * Spot uses ranged mishaps and ranged critical behavior.
     */
    if (isRangedWeakpoint) {
      this.preRollData.isRanged = true;
    }

    return originalUpdatePostRollData.apply(this, args);
  };

  const originalCreateMessageData = prototype.createMessageData;

  prototype.createMessageData = async function (...args) {
    const messageData =
      await originalCreateMessageData.apply(this, args);

    if (this._baneOfAzerothScattershotLongRange) {
      foundry.utils.setProperty(
        messageData,
        `flags.${MODULE_ID}.scattershotLongRange`,
        true
      );
    }

    return messageData;
  };

  Object.defineProperty(
    prototype,
    "__baneOfAzerothPatched",
    {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    }
  );
}

async function rollScattershotDamage(message) {
  const context = message.system?.toContext?.();
  const actor = context?.actor;
  const weapon = context?.weapon;

  if (!actor || !weapon) return;

  const target = context.targetActor;
  const damageType = context.damageType;

  const ignoreArmor =
    context.ignoreArmor
    || (
      context.action === "weakpoint"
      && context.success
    )
    || context.criticalEffect === "ignoreArmor";

  const skill = actor.findSkill(weapon.system.skill.name);
  const attribute = skill?.system.attribute;

  let damageBonus =
    attribute
      ? actor.system.damageBonus[attribute]?.value
      : 0;

  if (weapon.hasWeaponFeature("noDamageBonus")) {
    damageBonus = 0;
  }

  let formula = weapon.system.damage;

  if (
    damageBonus
    && damageBonus !== "0"
    && damageBonus !== "none"
  ) {
    formula += ` + ${damageBonus}`;
  }

  if (
    context.extraDamage
    && context.extraDamage !== "0"
  ) {
    formula += ` + ${context.extraDamage}`;
  }

  /*
   * Match Dragonbane's critical weapon-damage behavior before the
   * Scattershot halving is applied.
   */
  const baseRoll = new Roll(formula);

  if (
    context.criticalEffect === "doubleWeaponDamage"
    && baseRoll.terms.length > 0
  ) {
    const firstTerm = baseRoll.terms[0];

    if (firstTerm instanceof foundry.dice.terms.Die) {
      firstTerm.number *= 2;
    }
  }

  /*
   * Foundry Roll formulas support ceil(). This keeps the rolled dice
   * visible while ensuring the stored and applied damage is an integer
   * rounded upward.
   */
  const roll = new Roll(`ceil((${baseRoll.formula}) / 2)`);

  await roll.roll({});

  const rollDamageMessage =
    DoDRollDamageMessageData.fromContext({
      actor,
      weapon,
      targetActor: target,
      damage: roll.total,
      damageType,
      formula: roll.formula,
      isHealing: false,
      ignoreArmor
    });

  await rollDamageMessage.toMessage(roll);
}

function onScattershotDamageClick(event) {
  if (event.detail === 2) return;

  const button = event.target.closest(
    "[data-action='rollWeaponDamage']"
  );

  if (!button) return;

  const messageElement = button.closest(
    ".chat-message, .message"
  );

  const messageId = messageElement?.dataset.messageId;
  const message = game.messages.get(messageId);

  if (
    !message?.getFlag(
      MODULE_ID,
      "scattershotLongRange"
    )
  ) {
    return;
  }

  /*
   * Stop Dragonbane's normal damage handler. We reproduce its weapon
   * damage calculation, then halve the complete result for Scattershot.
   */
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  void rollScattershotDamage(message);
}

const SPELL_GRANT_CONTENT_PATH =
  `modules/${MODULE_ID}/content/heroic-class-abilities.json`;

const spellGrantDefinitions = new Map();
let spellGrantReconcileTimer = null;

function getModuleFlag(document, key) {
  return document?.getFlag?.(MODULE_ID, key);
}

function getContentKey(document) {
  const value = getModuleFlag(document, "contentKey");
  return typeof value === "string" ? value : "";
}

function isPrimaryActiveGM() {
  if (!game.user.isGM) return false;

  const activeGMs = game.users.filter(
    user => user.active && user.isGM
  );
  return activeGMs[0]?.id === game.user.id;
}

async function loadSpellGrantDefinitions() {
  spellGrantDefinitions.clear();

  const contentUrl = foundry.utils.getRoute(
    SPELL_GRANT_CONTENT_PATH
  );
  const response = await fetch(contentUrl);

  if (!response.ok) {
    throw new Error(
      `Could not load spell grant definitions: ` +
      `${response.status} ${response.statusText}`
    );
  }

  const content = await response.json();
  if (!Array.isArray(content.classes)) {
    throw new Error(
      "Heroic Class Ability content does not contain a classes array."
    );
  }

  for (const classEntry of content.classes) {
    if (
      typeof classEntry?.key !== "string" ||
      !Array.isArray(classEntry.abilities)
    ) {
      continue;
    }

    for (const ability of classEntry.abilities) {
      if (
        typeof ability?.key !== "string" ||
        typeof ability?.grantsSpell !== "string"
      ) {
        continue;
      }

      const abilityContentKey =
        `heroic-class-ability.${classEntry.key}.${ability.key}`;
      const spellContentKey = `spells.${ability.grantsSpell}`;

      spellGrantDefinitions.set(
        abilityContentKey,
        spellContentKey
      );
    }
  }
}

function resolveGrantedSpellContentKey(ability) {
  const directValue = getModuleFlag(ability, "grantsSpell");
  if (typeof directValue === "string" && directValue) {
    return directValue;
  }

  return spellGrantDefinitions.get(getContentKey(ability)) ?? "";
}

function findWorldSpell(spellContentKey) {
  return game.items.find(
    item =>
      item.type === "spell" &&
      getContentKey(item) === spellContentKey
  );
}

function actorHasSpell(actor, spellContentKey) {
  return actor.items.some(
    item =>
      item.type === "spell" &&
      (
        getContentKey(item) === spellContentKey ||
        getModuleFlag(item, "sourceSpell") === spellContentKey
      )
  );
}

async function grantSpellForAbility(ability) {
  const actor = ability?.parent;
  if (
    actor?.documentName !== "Actor" ||
    ability.type !== "ability"
  ) {
    return;
  }

  const spellContentKey =
    resolveGrantedSpellContentKey(ability);
  if (!spellContentKey || actorHasSpell(actor, spellContentKey)) {
    return;
  }

  const sourceSpell = findWorldSpell(spellContentKey);
  if (!sourceSpell) {
    console.warn(
      `${MODULE_ID} | Could not grant ${spellContentKey} to ` +
      `${actor.name}: the source spell was not found among world Items.`
    );
    return;
  }

  const abilityContentKey = getContentKey(ability);
  const spellData = sourceSpell.toObject();

  delete spellData._id;
  delete spellData.folder;
  delete spellData.ownership;
  delete spellData._stats;

  foundry.utils.setProperty(
    spellData,
    "system.memorized",
    true
  );
  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.autoGranted`,
    true
  );
  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.grantedByAbility`,
    abilityContentKey
  );
  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.sourceSpell`,
    spellContentKey
  );

  await actor.createEmbeddedDocuments("Item", [spellData]);
}

async function removeSpellForAbility(ability) {
  const actor = ability?.parent;
  if (
    actor?.documentName !== "Actor" ||
    ability.type !== "ability"
  ) {
    return;
  }

  const spellContentKey =
    resolveGrantedSpellContentKey(ability);
  if (!spellContentKey) return;

  const anotherGrantingAbility = actor.items.some(
    item =>
      item.type === "ability" &&
      resolveGrantedSpellContentKey(item) === spellContentKey
  );
  if (anotherGrantingAbility) return;

  const spellIds = actor.items
    .filter(
      item =>
        item.type === "spell" &&
        getModuleFlag(item, "autoGranted") === true &&
        getModuleFlag(item, "sourceSpell") === spellContentKey
    )
    .map(item => item.id);

  if (spellIds.length > 0) {
    await actor.deleteEmbeddedDocuments("Item", spellIds);
  }
}

async function reconcileSpellGrantsForActor(actor) {
  for (const ability of actor.items.filter(
    item => item.type === "ability"
  )) {
    await grantSpellForAbility(ability);
  }
  await ensureAutoGrantedSpellsPrepared(actor);
}

async function reconcileSpellGrants() {
  if (!game.user.isGM) return;

  for (const actor of game.actors) {
    await reconcileSpellGrantsForActor(actor);
  }
}

function scheduleSpellGrantReconciliation() {
  if (!game.user.isGM) return;

  if (spellGrantReconcileTimer !== null) {
    clearTimeout(spellGrantReconcileTimer);
  }

  spellGrantReconcileTimer = setTimeout(() => {
    spellGrantReconcileTimer = null;
    void reconcileSpellGrants().catch(error => {
      console.error(
        `${MODULE_ID} | Failed to reconcile spell grants.`,
        error
      );
    });
  }, 250);
}

function isManagedWorldSpellOrAbility(item) {
  if (item?.parent || !["ability", "spell"].includes(item?.type)) {
    return false;
  }

  const contentKey = getContentKey(item);
  return (
    contentKey.startsWith("heroic-class-ability.") ||
    contentKey.startsWith("spells.")
  );
}

function onCreateItem(item, options, userId) {
  if (userId !== game.user.id) return;

  if (item?.parent?.documentName === "Actor") {
    void grantSpellForAbility(item).catch(error => {
      console.error(
        `${MODULE_ID} | Failed to grant a spell for ${item.name}.`,
        error
      );
    });
    return;
  }

  if (isManagedWorldSpellOrAbility(item)) {
    scheduleSpellGrantReconciliation();
  }
}

function onUpdateItem(item, changes, options, userId) {
  if (
    userId === game.user.id &&
    isManagedWorldSpellOrAbility(item)
  ) {
    scheduleSpellGrantReconciliation();
  }
}

function onDeleteItem(item, options, userId) {
  if (
    userId !== game.user.id ||
    item?.parent?.documentName !== "Actor"
  ) {
    return;
  }

  void removeSpellForAbility(item).catch(error => {
    console.error(
      `${MODULE_ID} | Failed to remove a spell for ${item.name}.`,
      error
    );
  });
}

Hooks.once("init", () => {
  if (game.system.id !== "dragonbane") return;

  registerSettings();
  Hooks.on("createItem", onCreateItem);
  Hooks.on("updateItem", onUpdateItem);
  Hooks.on("deleteItem", onDeleteItem);
  Hooks.on("renderDoDActorBaseSheet", lockAutoGrantedSpellPreparation);
  Hooks.on("preUpdateItem", protectAutoGrantedSpellPreparation);

  const featureTypes = CONFIG.DoD?.weaponFeatureTypes;

  if (!featureTypes) {
    console.error(
      `${MODULE_ID} | Dragonbane weapon features were not available during init.`
    );
    return;
  }

  Object.assign(featureTypes, WEAPON_FEATURES);
  patchWeaponTests();

  console.log(
    `${MODULE_ID} | Registered custom weapon features, Armor Piercing, and Scattershot.`
  );
});

Hooks.once("ready", async () => {
  if (game.system.id !== "dragonbane") return;

  try {
    await loadSpellGrantDefinitions();
    if (isPrimaryActiveGM()) {
      await reconcileSpellGrants();
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize spell grant automation.`,
      error
    );
  }

  /*
   * Capture phase ensures the Scattershot handler runs before
   * Dragonbane's ordinary rollWeaponDamage listener.
   */
  document.addEventListener(
    "click",
    onScattershotDamageClick,
    true
  );

  await promptAdventureImport();
});
