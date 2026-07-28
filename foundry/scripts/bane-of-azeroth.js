import { onRenderControlledMonsterSheet } from "./monster-attack-control.js";
import {
  registerCommonAnimalStatusSocket,
  onRenderCommonAnimalRestrainedSource,
} from "./common-animal-status-effects.js";
import {
  MODULE_ID,
  WEAPON_FEATURES,
} from "./core/constants.js";
import {
  getContentVersion,
  promptAdventureImport,
  registerSettings,
} from "./adventure-import.js";
import {
  isAutoGrantedSpell,
  lockAutoGrantedSpellPreparation,
  protectAutoGrantedSpellPreparation,
} from "./spell-preparation.js";

import {
  getContentKey,
  getModuleFlag,
} from "./core/documents.js";
import {
  loadSpellGrantDefinitions,
  onCreateItem,
  onDeleteItem,
  onUpdateItem,
  reconcileSpellGrants,
} from "./spell-grants.js";

import {
  onScattershotDamageClick,
  patchWeaponTests,
} from "./weapon-features.js";


import {
  drawAllElementalTotemAuras,
  drawElementalTotemAura,
  onCreateElementalTotemChatMessage,
  onDeleteElementalTotemAura,
  onUpdateElementalTotemAura,
  onUpdateElementalTotemChatMessage,
  registerElementalTotemSocket,
  protectElementalTotemMovement,
} from "./elemental-totems.js";
import {
  onCreateWarlockDemonChatMessage,
registerWarlockDemonSocket,
} from "./warlock-demons.js";
import {
  patchVoidwalkerSuffering,
  registerVoidwalkerSufferingSocket,
  registerVoidwalkerSufferingDamageCardHook,
} from "./warlock-demons/suffering.js";
import {
  isPrimaryActiveGM,
} from "./core/users.js";
import {
  patchSummonRestLifecycle,
  registerSummonDurationLifecycleSocket,
} from "./core/summon-duration-lifecycle.js";
import {
  onCommonAnimalRollDamageChatMessage,
  processCommonAnimalAttackResult,
} from "./common-animal-attack-effects.js";
import {
  onCreateCommonAnimalEffectOnlyWeaponTestMessage,
  onPreCreateCommonAnimalEffectOnlyWeaponTestMessage,
  onRenderCommonAnimalEffectOnlyActorSheet,
  onUpdateCommonAnimalEffectOnlyWeaponTestMessage,
} from "./common-animal-effect-only-attacks.js";
import {
  onUpdateCommonAnimalMovementToken,
} from "./common-animal-movement.js";

import { registerAutomationSettings } from "./automation-settings.js";
Hooks.once("init", () => {

  if (game.system.id !== "dragonbane") return;
  registerAutomationSettings();

  Hooks.on("drawToken", drawElementalTotemAura);
  Hooks.on("updateToken", onUpdateElementalTotemAura);
  Hooks.on(
    "updateToken",
    onUpdateCommonAnimalMovementToken
  );
  Hooks.on("deleteToken", onDeleteElementalTotemAura);
  Hooks.on(
    "preUpdateToken",
    protectElementalTotemMovement
  );
  Hooks.on("canvasReady", drawAllElementalTotemAuras);

  registerSettings();

  const boaModule =
    game.modules.get(MODULE_ID);

  if (boaModule) {
    boaModule.api = {
      ...(boaModule.api ?? {}),
      processCommonAnimalAttackResult,
    };
  }

  Hooks.on("createItem", onCreateItem);
  Hooks.on("updateItem", onUpdateItem);
  Hooks.on("deleteItem", onDeleteItem);
Hooks.on(
    "preCreateChatMessage",
    onPreCreateCommonAnimalEffectOnlyWeaponTestMessage
  );
  Hooks.on("createChatMessage", onCreateElementalTotemChatMessage);
  Hooks.on(
    "createChatMessage",
    onCreateWarlockDemonChatMessage,
  );
  Hooks.on(
    "createChatMessage",
    onCreateCommonAnimalEffectOnlyWeaponTestMessage
  );
  Hooks.on(
    "createChatMessage",
    onCommonAnimalRollDamageChatMessage
  );
  Hooks.on("updateChatMessage", onUpdateElementalTotemChatMessage);
  Hooks.on(
    "updateChatMessage",
    onUpdateCommonAnimalEffectOnlyWeaponTestMessage
  );
  Hooks.on("renderDoDActorBaseSheet", lockAutoGrantedSpellPreparation);
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderCommonAnimalEffectOnlyActorSheet
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderCommonAnimalRestrainedSource
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderControlledMonsterSheet,
  );
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
  patchVoidwalkerSuffering({
    useAuthority: true,
  });

  console.log(
    `${MODULE_ID} | Registered custom weapon features, Armor Piercing, and Scattershot.`
  );
});

Hooks.once("ready", async () => {
  if (game.system.id !== "dragonbane") return;


  registerSummonDurationLifecycleSocket();
  patchSummonRestLifecycle();
  registerElementalTotemSocket();
  registerWarlockDemonSocket();
  registerVoidwalkerSufferingSocket();
  registerVoidwalkerSufferingDamageCardHook();
  registerCommonAnimalStatusSocket();

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
