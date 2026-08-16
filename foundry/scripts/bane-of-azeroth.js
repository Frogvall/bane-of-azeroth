import {
  claimPackageRuntime,
  notifyPackageConflictIfNeeded,
  shouldActivatePackageRuntime,
} from "./package-identity.js";
import {
  getDruidMoonkinSpellCost,
  patchDruidMoonkinSpellCost,
  buildDruidFormArmorData,
  isDruidFormSpellAllowed,
  onPreUpdateDruidFormArmorItem,
  reconcileDruidFormArmor,
  buildDruidFormAttackData,
  buildDruidTravelMovementEffectData,
  getBestDruidNaturalAttackSkill,
  isDruidFormWeaponUseAllowed,
  onUpdateDruidFormMechanicsActor,
  patchDruidFormWeaponUsage,
  reconcileAllDruidFormMechanics,
  reconcileDruidFormMechanics,
} from "./druid-form-mechanics.js";
import {
  onRenderControlledMonsterSheet } from "./monster-attack-control.js";
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
  registerAdventureImporterSheet,
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

import {
  getAbilityActionDefinition,
  onAbilityActionDamageClick,
  onCreateAbilityActionItem,
  onDeleteAbilityActionItem,
  onRenderAbilityActionActorSheet,
  patchWarStompWeaponTest,
  planEyeBeamAction,
  reconcileAbilityActions,
  reconcileActorAbilityActions,
  onUpdateAbilityActionChatMessage,
  patchAbilityActionWeaponSlots,
  createAbilityActionResolutionMessages,
  rollAbilityActionResolutionDamage,
} from "./ability-actions.js";
import {
  onCreateDemonHunterInitiationItem,
  onCreateDemonHunterInitiationToken,
  onDeleteDemonHunterInitiationItem,
  onRenderDemonHunterInitiationActorSheet,
  reconcileDemonHunterInitiation,
  reconcileDemonHunterInitiationActor,
  registerDemonHunterInitiationSocket,
  requestDemonHunterInitiationReconcile,
} from "./demon-hunter-initiation.js";
import {
  onCreateSerenityItem,
  onDeleteSerenityItem,
  onRenderSerenityActorSheet,
  reconcileSerenity,
  reconcileSerenityActor,
} from "./serenity.js";
import {
  drawAllFrostreaperAuras,
  drawFrostreaperAura,
  getFrostreaperAuraData,
  isFrostreaperActivationActive,
  onCreateFrostreaperChatMessage,
  onDeleteFrostreaperChatMessage,
  onFrostreaperCombatChange,
  onPreCreateFrostreaperChatMessage,
  onUpdateFrostreaperToken,
} from "./frostreaper.js";
import {
  buildUnendingThirstEffectData,
  clearDeathKnightRune,
  getDeathKnightRuneDefinitions,
  getDeathKnightRuneEligibleWeapons,
  getDeathKnightRuneState,
  isDeathKnightRuneEligibleWeapon,
  onCreateDeathKnightRuneItem,
  onDeleteDeathKnightRuneItem,
  onRenderDeathKnightRuneActorSheet,
  onUpdateDeathKnightRuneItem,
  reconcileDeathKnightRuneActor,
  reconcileDeathKnightRunes,
  setDeathKnightRune,
} from "./death-knight-runes.js";
import {
  restoreDruidHumanoidArtwork,
  restoreAllDruidFormArtwork,
  registerDruidFormArtworkSocket,
  openDruidFormArtworkDialog,
  onRenderDruidFormArtworkActorSheet,
  onCreateDruidFormArtworkToken,
  executeDruidFormArtworkRequest,
  applyDruidFormArtwork,
  getAvailableDruidFormProfiles,
  getDruidFormArtwork,
  getDruidFormProfileDefinitions,
  getDruidFormState,
  resetDruidFormArtwork,
  setDruidFormArtwork,
} from "./druid-forms.js";
import {
  endDruidIncarnation,
  activateDruidIncarnation,
  executeDruidFormLifecycleRequest,
  expireDruidIncarnationsForRest,
  getDruidFormSwitchOptions,
  getDruidIncarnationDefinitions,
  isDruidFormsAutomationEnabled,
  onCreateDruidFormSpellMessage,
  onRenderDruidFormLifecycleActorSheet,
  openDruidFormSwitchDialog,
  patchDruidFormRestLifecycle,
  registerDruidFormLifecycleSocket,
  switchDruidForm,
  setDruidLifecycleTraceEnabled,
  isDruidLifecycleTraceEnabled,
  exportDruidLifecycleTrace,
  clearDruidLifecycleTrace,
} from "./druid-form-lifecycle.js";
import {
  endAllManagedEffects,
  endManagedEffect,
  getManagedEffectsForActor,
  onRenderManagedEffectLifecycleActorSheet,
  openManagedEffectEndDialog,
  registerManagedEffectLifecycleSocket,
} from "./managed-effect-lifecycle.js";
import { registerAutomationSettings } from "./automation-settings.js";
// BOA player convenience Macros.
import {
  resolvePlayerConvenienceActor,
  runChangeDruidFormMacro,
  runEndEffectsMacro,
} from "./player-convenience.js";
// BOA Druid shared roll-boon adapter.
import {
  applyDruidRollBoonsToDialog,
  getDruidRollBoons,
  isDruidSneakingSkill,
  patchDruidRollBoons,
  registerDruidRollBoonAdapter,
} from "./druid-roll-boons.js";
// BOA developer diagnostics settings.
import {
  applyDeveloperSettings,
  isDevelopmentBuild,
  registerDeveloperSettings,
} from "./developer-settings.js";
import {
  patchEvokersLegacySpellCost,
} from "./evokers-legacy.js";
import {
  patchMageBrillianceSpellCost,
  takeMageBrillianceLanguagesTen,
} from "./mage-brilliance.js";
import {
  castLegacyFreeSenseMagicTrick,
  registerMageBrillianceLegacyMagicTrickAdapter,
} from "./mage-brilliance.js";

import {
  canBoACastSpell,
  getBoASpellCost,
  registerBoASpellTestAdapter,
} from "./spellcasting.js";
// BOA Great Helm + Firearms compatibility.
import {
  onCreateGreatHelmFirearmsItem,
  reconcileGreatHelmFirearms,
} from "./great-helm-firearms.js";
import {
  activateShadowform,
  endShadowform,
  getShadowformState,
  isShadowformActive,
  onCreateShadowformSpellMessage,
  onDrawShadowformToken,
  onRenderShadowformActorSheet,
  onUpdateShadowformActor,
  patchShadowformRestLifecycle,
  reconcileShadowformCanvas,
  reconcileShadowformVisuals,
} from "./shadowform-visuals.js";

Hooks.once("init", () => {

  if (game.system.id !== "dragonbane") return;
  registerAdventureImporterSheet();
  if (!claimPackageRuntime()) return;
  registerAutomationSettings();
  registerDeveloperSettings();
  patchMageBrillianceSpellCost();
  patchEvokersLegacySpellCost();

  Hooks.on("drawToken", drawElementalTotemAura);
  Hooks.on("drawToken", drawFrostreaperAura);
  Hooks.on("drawToken", onDrawShadowformToken);
  Hooks.on("updateToken", onUpdateElementalTotemAura);
  Hooks.on("updateToken", onUpdateFrostreaperToken);
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
  Hooks.on("canvasReady", drawAllFrostreaperAuras);
  Hooks.on("canvasReady", reconcileShadowformCanvas);

  registerSettings();

  const boaModule =
    game.modules.get(MODULE_ID);

  if (boaModule) {
    boaModule.api = {
      ...(boaModule.api ?? {}),
      resolvePlayerConvenienceActor,
      runChangeDruidFormMacro,
      runEndEffectsMacro,

      getDruidRollBoons,
      applyDruidRollBoonsToDialog,
      isDruidSneakingSkill,
      patchDruidRollBoons,
      registerDruidRollBoonAdapter,
      setDruidLifecycleTraceEnabled,
      isDruidLifecycleTraceEnabled,
      exportDruidLifecycleTrace,
      clearDruidLifecycleTrace,
      isDevelopmentBuild,

      takeMageBrillianceLanguagesTen,
      castLegacyFreeSenseMagicTrick,
      processCommonAnimalAttackResult,
      reconcileSpellGrants,
      reconcileAbilityActions,
      reconcileActorAbilityActions,
      getAbilityActionDefinition,
      planEyeBeamAction,
          createAbilityActionResolutionMessages,
      rollAbilityActionResolutionDamage,
      reconcileSerenity,
      reconcileSerenityActor,
      reconcileDemonHunterInitiation,
      reconcileDemonHunterInitiationActor,
      requestDemonHunterInitiationReconcile,
      drawAllFrostreaperAuras,
      getFrostreaperAuraData,
      isFrostreaperActivationActive,
      buildUnendingThirstEffectData,
      getDeathKnightRuneDefinitions,
      getDeathKnightRuneEligibleWeapons,
      getDeathKnightRuneState,
      isDeathKnightRuneEligibleWeapon,
      setDeathKnightRune,
      clearDeathKnightRune,
      reconcileDeathKnightRunes,
      reconcileDeathKnightRuneActor,
      getDruidFormProfileDefinitions,
      getAvailableDruidFormProfiles,
      getDruidFormArtwork,
      setDruidFormArtwork,
      resetDruidFormArtwork,
      getDruidFormState,
      applyDruidFormArtwork,
      executeDruidFormArtworkRequest,
      openDruidFormArtworkDialog,
      restoreAllDruidFormArtwork,
      restoreDruidHumanoidArtwork,
      activateDruidIncarnation,
      switchDruidForm,
      expireDruidIncarnationsForRest,
      getDruidFormSwitchOptions,
      openDruidFormSwitchDialog,
      endDruidIncarnation,
      getManagedEffectsForActor,
      endManagedEffect,
      endAllManagedEffects,
      openManagedEffectEndDialog,
      executeDruidFormLifecycleRequest,
      getDruidIncarnationDefinitions,
      isDruidFormsAutomationEnabled,
      getDruidMoonkinSpellCost,
      buildDruidFormArmorData,
      isDruidFormSpellAllowed,
      reconcileDruidFormArmor,
      getBestDruidNaturalAttackSkill,
      buildDruidFormAttackData,
      buildDruidTravelMovementEffectData,
      reconcileDruidFormMechanics,
      reconcileAllDruidFormMechanics,
      isDruidFormWeaponUseAllowed,
      getBoASpellCost,
      canBoACastSpell,
      getShadowformState,
      isShadowformActive,
      activateShadowform,
      endShadowform,
      reconcileShadowformCanvas,
      reconcileShadowformVisuals,
};
  }

  Hooks.on(
    "createItem",
    onCreateDemonHunterInitiationItem,
  );
  Hooks.on(
    "createItem",
    onCreateSerenityItem,
  );
  Hooks.on(
    "createItem",
    onCreateDeathKnightRuneItem,
  );
  Hooks.on(
    "createToken",
    onCreateDemonHunterInitiationToken,
  );
  Hooks.on(
    "createToken",
    onCreateDruidFormArtworkToken,
  );
  Hooks.on("createItem", onCreateItem);
  Hooks.on("createItem", onCreateGreatHelmFirearmsItem);
  Hooks.on(
    "createItem",
    onCreateAbilityActionItem,
  );
  Hooks.on("updateItem", onUpdateItem);
  Hooks.on(
    "updateItem",
    onUpdateDeathKnightRuneItem,
  );
  Hooks.on(
    "deleteItem",
    onDeleteDemonHunterInitiationItem,
  );
  Hooks.on(
    "deleteItem",
    onDeleteSerenityItem,
  );
  Hooks.on(
    "deleteItem",
    onDeleteDeathKnightRuneItem,
  );
  Hooks.on("deleteItem", onDeleteItem);
  Hooks.on(
    "deleteItem",
    onDeleteAbilityActionItem,
  );
Hooks.on(
    "preCreateChatMessage",
    onPreCreateCommonAnimalEffectOnlyWeaponTestMessage
  );
  Hooks.on(
    "preCreateChatMessage",
    onPreCreateFrostreaperChatMessage,
  );
  Hooks.on("createChatMessage", onCreateElementalTotemChatMessage);
  Hooks.on(
    "createChatMessage",
    onCreateFrostreaperChatMessage,
  );
  Hooks.on(
    "deleteChatMessage",
    onDeleteFrostreaperChatMessage,
  );
  Hooks.on(
    "updateCombat",
    onFrostreaperCombatChange,
  );
  Hooks.on(
    "updateCombatant",
    onFrostreaperCombatChange,
  );
  Hooks.on(
    "deleteCombatant",
    onFrostreaperCombatChange,
  );
  Hooks.on(
    "deleteCombat",
    onFrostreaperCombatChange,
  );
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
  Hooks.on(
    "createChatMessage",
    onCreateDruidFormSpellMessage,
  );
  Hooks.on(
    "createChatMessage",
    onCreateShadowformSpellMessage,
  );
  Hooks.on("updateChatMessage", onUpdateElementalTotemChatMessage);
  Hooks.on(
    "updateChatMessage",
    onUpdateCommonAnimalEffectOnlyWeaponTestMessage
  );
  Hooks.on(
    "updateChatMessage",
    onUpdateAbilityActionChatMessage,
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
  registerMageBrillianceLegacyMagicTrickAdapter();
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderAbilityActionActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderDemonHunterInitiationActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderSerenityActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderDeathKnightRuneActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderDruidFormArtworkActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderDruidFormLifecycleActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderManagedEffectLifecycleActorSheet,
  );
  Hooks.on(
    "renderDoDActorBaseSheet",
    onRenderShadowformActorSheet,
  );
  Hooks.on("preUpdateItem", protectAutoGrantedSpellPreparation);
  Hooks.on("preUpdateItem", onPreUpdateDruidFormArmorItem);

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

});

Hooks.once("ready", async () => {
  if (game.system.id !== "dragonbane") return;
  if (!shouldActivatePackageRuntime()) return;
  notifyPackageConflictIfNeeded();

  try {
    await reconcileGreatHelmFirearms();
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to reconcile Great Helm Firearms banes.`,
      error,
    );
  }

  try {
    await registerDruidRollBoonAdapter();
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize the shared Druid roll-boon adapter.`,
      error,
    );
  }

  try {
    await registerBoASpellTestAdapter();
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize the shared spell-test adapter.`,
      error,
    );
  }

  try {
    await patchWarStompWeaponTest();
    await patchAbilityActionWeaponSlots();

    if (isPrimaryActiveGM()) {
      await reconcileAbilityActions();
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize ability-action automation.`,
      error,
    );
  }
  try {
    if (isPrimaryActiveGM()) {
      await reconcileSerenity();
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize Serenity automation.`,
      error,
    );
  }
  try {
    if (isPrimaryActiveGM()) {
      await reconcileDemonHunterInitiation();
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize Demon Hunter Initiation automation.`,
      error,
    );
  }
  try {
    if (isPrimaryActiveGM()) {
      await reconcileDeathKnightRunes();
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize Death Knight Runes automation.`,
      error,
    );
  }
  Hooks.on(
    "updateActor",
    onUpdateDruidFormMechanicsActor,
  );
  Hooks.on("updateActor", onUpdateShadowformActor);
  try {
    await patchDruidFormWeaponUsage();
    patchDruidMoonkinSpellCost();
    await reconcileAllDruidFormMechanics();
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize Druid form mechanics.`,
      error,
    );
  }
  registerSummonDurationLifecycleSocket();
  patchSummonRestLifecycle();
  registerElementalTotemSocket();
  registerWarlockDemonSocket();
  registerDemonHunterInitiationSocket();
  registerDruidFormArtworkSocket();
  registerDruidFormLifecycleSocket();
  applyDeveloperSettings();
  registerManagedEffectLifecycleSocket();
  patchDruidFormRestLifecycle();
  patchShadowformRestLifecycle();
  reconcileShadowformVisuals();
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
  document.addEventListener(
    "click",
    onAbilityActionDamageClick,
    true,
  );

  await promptAdventureImport();
});
