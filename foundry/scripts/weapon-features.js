import DoDOptionalRuleSettings from
  "/systems/dragonbane/modules/apps/optional-rule-settings.js";
import DoDRollDamageMessageData from
  "/systems/dragonbane/modules/data/messages/roll-damage-message.js";
import DoDWeaponTest from
  "/systems/dragonbane/modules/tests/weapon-test.js";
import DoD_Utility from
  "/systems/dragonbane/modules/utility.js";

import { MODULE_ID } from "./core/constants.js";

export function isArmorPiercingRangedWeapon(weapon) {
  return Boolean(
    DoDOptionalRuleSettings.damageTypes
    && weapon?.isRangedWeapon
    && !weapon.hasWeaponFeature("thrown")
    && weapon.hasWeaponFeature("piercing")
    && weapon.hasWeaponFeature("armorPiercing")
  );
}

export function isScattershotRangedWeapon(weapon) {
  return Boolean(
    weapon?.isRangedWeapon
    && !weapon.hasWeaponFeature("thrown")
    && weapon.hasWeaponFeature("scattershot")
  );
}

export function actorHasAmmoPouch(actor) {
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

export function patchWeaponTests() {
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

export function onScattershotDamageClick(event) {
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
