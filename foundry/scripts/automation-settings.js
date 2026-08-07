import { MODULE_ID } from "./core/constants.js";

export const AUTOMATION_SETTING_KEYS = Object.freeze({
  ELEMENTAL_TOTEMS: "elementalTotemAutomation",
  DEMONS: "demonAutomation",
  MAGES_BRILLIANCE: "mageBrillianceAutomation",
  EVOKERS_LEGACY: "evokersLegacyAutomation",
  WAR_STOMP: "warStompAutomation",
  EYE_BEAM: "eyeBeamAutomation",
  SERENITY: "serenityAutomation",
  DEMON_HUNTER_INITIATION: "demonHunterInitiationAutomation",
  FROSTREAPER: "frostreaperAutomation",
  DEATH_KNIGHT_RUNES: "deathKnightRunesAutomation",
  DRUID_FORMS: "druidFormsAutomation",
  DRUID_FORM_MOVEMENT: "druidFormMovementAutomation",
  DRUID_FORM_ATTACKS: "druidFormAttackAutomation",
  DRUID_FORM_ARMOR: "druidFormArmorAutomation",
  DRUID_FORM_SPELL_RESTRICTION: "druidFormSpellRestrictionAutomation",
  DRUID_MOONKIN_SPELL_COST: "druidMoonkinSpellCostAutomation",
  DRUID_FORM_ARTWORK: "druidFormArtworkAutomation",
});

const {
  ApplicationV2,
  HandlebarsApplicationMixin,
} = globalThis.foundry?.applications?.api ?? {};

const BaseAutomationSettingsApplication =
  ApplicationV2 && HandlebarsApplicationMixin
    ? HandlebarsApplicationMixin(ApplicationV2)
    : class {
      async _prepareContext() {
        return {};
      }
    };

function booleanField(label, hint) {
  const BooleanField =
    globalThis.foundry?.data?.fields?.BooleanField;

  return BooleanField
    ? new BooleanField({ label, hint })
    : { label, hint };
}

function schemaField(fields) {
  const SchemaField =
    globalThis.foundry?.data?.fields?.SchemaField;

  return SchemaField
    ? new SchemaField(fields)
    : { fields };
}

function settingDefinition(
  name,
  hint,
  additional = {},
) {
  return {
    name,
    hint,
    scope: "world",
    config: false,
    type: Boolean,
    default: true,
    ...additional,
  };
}

function reconcileMageBrillianceAutomation() {
  const reconcile =
    globalThis.game?.modules
      ?.get?.(MODULE_ID)
      ?.api
      ?.reconcileSpellGrants;

  if (typeof reconcile !== "function") return;

  void Promise.resolve(reconcile()).catch(error => {
    console.error(
      `${MODULE_ID} | Failed to reconcile Mage's Brilliance automation.`,
      error,
    );
  });
}

export function isAutomationEnabled(
  key,
  settings = globalThis.game?.settings,
) {
  if (!settings?.get) return true;

  try {
    return settings.get(MODULE_ID, key) !== false;
  } catch (_error) {
    return true;
  }
}

export function isElementalTotemAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS,
    settings,
  );
}

export function isDemonAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DEMONS,
    settings,
  );
}

export function isMageBrillianceAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.MAGES_BRILLIANCE,
    settings,
  );
}

export function isEvokersLegacyAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY,
    settings,
  );
}

function reconcileAbilityActionsOnChange() {
  queueMicrotask(() => {
    const api =
      globalThis.game?.modules?.get?.(MODULE_ID)?.api;

    void api?.reconcileAbilityActions?.();
  });
}

export function isWarStompAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.WAR_STOMP,
    settings,
  );
}

export function isEyeBeamAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.EYE_BEAM,
    settings,
  );
}
function reconcileSerenityOnChange() {
  queueMicrotask(() => {
    const api =
      globalThis.game?.modules?.get?.(MODULE_ID)?.api;

    void api?.reconcileSerenity?.();
  });
}

export function isSerenityAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.SERENITY,
    settings,
  );
}
function reconcileDemonHunterInitiationOnChange() {
  queueMicrotask(() => {
    const api =
      globalThis.game?.modules?.get?.(MODULE_ID)?.api;

    void api?.reconcileDemonHunterInitiation?.();
  });
}

export function isDemonHunterInitiationAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DEMON_HUNTER_INITIATION,
    settings,
  );
}
function redrawFrostreaperOnChange() {
  queueMicrotask(() => {
    const api =
      globalThis.game?.modules?.get?.(MODULE_ID)?.api;

    api?.drawAllFrostreaperAuras?.();
  });
}

export function isFrostreaperAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.FROSTREAPER,
    settings,
  );
}
function rerenderOpenDeathKnightRuneSheets() {
  const actors =
    globalThis.game?.actors
      ?.contents ??
    (
      typeof globalThis.game?.actors
        ?.values ===
        "function"
        ? Array.from(
            globalThis.game.actors.values(),
          )
        : []
    );

  for (
    const actor
    of actors
  ) {
    const sheet =
      actor?.sheet;

    if (
      sheet?.rendered &&
      typeof sheet.render ===
        "function"
    ) {
      sheet.render(
        false,
      );
    }
  }
}

function reconcileDeathKnightRunesOnChange() {
  queueMicrotask(() => {
    const api =
      globalThis.game?.modules
        ?.get?.(MODULE_ID)
        ?.api;

    const finish =
      () =>
        rerenderOpenDeathKnightRuneSheets();

    if (
      !globalThis.game?.user?.isGM
    ) {
      finish();
      return;
    }

    const reconcile =
      api?.reconcileDeathKnightRunes;

    if (
      typeof reconcile !==
      "function"
    ) {
      finish();
      return;
    }

    void Promise.resolve(
      reconcile(),
    )
      .catch(
        error => {
          console.error(
            `${MODULE_ID} | Failed to reconcile Death Knight Runes automation.`,
            error,
          );
        },
      )
      .finally(
        finish,
      );
  });
}


export function isDeathKnightRunesAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DEATH_KNIGHT_RUNES,
    settings,
  );
}

export function isDruidFormsAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_FORMS,
    settings,
  );
}

function reconcileDruidFormMechanicsOnChange() {
  queueMicrotask(() => {
    const reconcile =
      globalThis.game?.modules
        ?.get?.(MODULE_ID)
        ?.api
        ?.reconcileAllDruidFormMechanics;

    if (
      typeof reconcile !==
        "function"
    ) {
      return;
    }

    void Promise.resolve(
      reconcile(),
    ).catch(
      error => {
        console.error(
          `${MODULE_ID} | Failed to reconcile Druid form mechanics.`,
          error,
        );
      },
    );
  });
}

export function isDruidFormMovementAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_FORM_MOVEMENT,
    settings,
  );
}

export function isDruidFormAttackAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_FORM_ATTACKS,
    settings,
  );
}

export function isDruidFormArmorAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_FORM_ARMOR,
    settings,
  );
}

export function isDruidFormSpellRestrictionAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_FORM_SPELL_RESTRICTION,
    settings,
  );
}

export function isDruidMoonkinSpellCostAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_MOONKIN_SPELL_COST,
    settings,
  );
}

function restoreDruidArtworkOnChange(value) {
  if (value !== false) return;
  queueMicrotask(() => {
    const api = globalThis.game?.modules?.get?.(MODULE_ID)?.api;
    void api?.restoreAllDruidFormArtwork?.();
  });
}

export function isDruidFormArtworkAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return isAutomationEnabled(
    AUTOMATION_SETTING_KEYS.DRUID_FORM_ARTWORK,
    settings,
  );
}

export class AutomationSettingsForm
  extends BaseAutomationSettingsApplication {
  static DEFAULT_OPTIONS = {
    id: "bane-of-azeroth-automation-settings",
    tag: "form",
    window: {
      title: "BOA.settings.automation.menuName",
      contentClasses: [
        "dragonbane",
        "standard-form",
        "dragonbane-settings",
        "automation-settings",
        "bane-of-azeroth",
      ],
      resizable: true,
      icon: "fa-solid fa-gears",
    },
    position: {
      width: 480,
    },
    form: {
      closeOnSubmit: true,
      handler: this._onSubmit,
    },
  };

  static PARTS = {
    body: {
      template:
        "modules/bane-of-azeroth/templates/"
        + "automation-settings.hbs",
      scrollable: [""],
      root: true,
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  static #schema = schemaField({
    elementalTotemAutomation: booleanField(
      "BOA.settings.automation.elementalTotemName",
      "BOA.settings.automation.elementalTotemHint",
    ),
    demonAutomation: booleanField(
      "BOA.settings.automation.demonName",
      "BOA.settings.automation.demonHint",
    ),
    mageBrillianceAutomation: booleanField(
      "BOA.settings.automation.mageBrillianceName",
      "BOA.settings.automation.mageBrillianceHint",
    ),
    evokersLegacyAutomation: booleanField(
      "BOA.settings.automation.evokersLegacyName",
      "BOA.settings.automation.evokersLegacyHint",
    ),
    warStompAutomation: booleanField(
      "BOA.settings.automation.warStompName",
      "BOA.settings.automation.warStompHint",
    ),
    eyeBeamAutomation: booleanField(
      "BOA.settings.automation.eyeBeamName",
      "BOA.settings.automation.eyeBeamHint",
    ),
    serenityAutomation: booleanField(
      "BOA.settings.automation.serenityName",
      "BOA.settings.automation.serenityHint",
    ),
    demonHunterInitiationAutomation: booleanField(
      "BOA.settings.automation.demonHunterInitiationName",
      "BOA.settings.automation.demonHunterInitiationHint",
    ),
    frostreaperAutomation: booleanField(
      "BOA.settings.automation.frostreaperName",
      "BOA.settings.automation.frostreaperHint",
    ),
    deathKnightRunesAutomation: booleanField(
      "BOA.settings.automation.deathKnightRunesName",
      "BOA.settings.automation.deathKnightRunesHint",
    ),
    druidFormsAutomation: booleanField(
      "BOA.settings.automation.druidFormsName",
      "BOA.settings.automation.druidFormsHint",
    ),
    druidFormMovementAutomation: booleanField(
      "BOA.settings.automation.druidFormMovementName",
      "BOA.settings.automation.druidFormMovementHint",
    ),
    druidFormAttackAutomation: booleanField(
      "BOA.settings.automation.druidFormAttackName",
      "BOA.settings.automation.druidFormAttackHint",
    ),
    druidFormArmorAutomation: booleanField(
      "BOA.settings.automation.druidFormArmorName",
      "BOA.settings.automation.druidFormArmorHint",
    ),
    druidFormSpellRestrictionAutomation: booleanField(
      "BOA.settings.automation.druidFormSpellRestrictionName",
      "BOA.settings.automation.druidFormSpellRestrictionHint",
    ),
    druidMoonkinSpellCostAutomation: booleanField(
      "BOA.settings.automation.druidMoonkinSpellCostName",
      "BOA.settings.automation.druidMoonkinSpellCostHint",
    ),
    druidFormArtworkAutomation: booleanField(
      "BOA.settings.automation.druidFormArtworkName",
      "BOA.settings.automation.druidFormArtworkHint",
    ),
  });

  static get schema() {
    return this.#schema;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      schema: this.constructor.schema,
      source: {
        elementalTotemAutomation:
          isElementalTotemAutomationEnabled(),
        demonAutomation:
          isDemonAutomationEnabled(),
        mageBrillianceAutomation:
          isMageBrillianceAutomationEnabled(),
        evokersLegacyAutomation:
          isEvokersLegacyAutomationEnabled(),
        warStompAutomation:
          isWarStompAutomationEnabled(),
        eyeBeamAutomation:
          isEyeBeamAutomationEnabled(),
        serenityAutomation:
          isSerenityAutomationEnabled(),
        demonHunterInitiationAutomation:
          isDemonHunterInitiationAutomationEnabled(),
        frostreaperAutomation:
          isFrostreaperAutomationEnabled(),
        deathKnightRunesAutomation:
          isDeathKnightRunesAutomationEnabled(),
        druidFormsAutomation:
          isDruidFormsAutomationEnabled(),
        druidFormMovementAutomation:
          isDruidFormMovementAutomationEnabled(),
        druidFormAttackAutomation:
          isDruidFormAttackAutomationEnabled(),
        druidFormArmorAutomation:
          isDruidFormArmorAutomationEnabled(),
        druidFormSpellRestrictionAutomation:
          isDruidFormSpellRestrictionAutomationEnabled(),
        druidMoonkinSpellCostAutomation:
          isDruidMoonkinSpellCostAutomationEnabled(),
        druidFormArtworkAutomation:
          isDruidFormArtworkAutomationEnabled(),
      },
      buttons: [
        {
          type: "submit",
          icon: "fa-solid fa-floppy-disk",
          label: "SETTINGS.Save",
        },
      ],
    };
  }

  static async _onSubmit(_event, _form, formData) {
    const settings = globalThis.game?.settings;
    if (!settings?.set) return;

    const values = formData?.object ?? {};

    await Promise.all([
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DEMONS,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DEMONS
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.MAGES_BRILLIANCE,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.MAGES_BRILLIANCE
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.WAR_STOMP,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.WAR_STOMP
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.EYE_BEAM,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.EYE_BEAM
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.SERENITY,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.SERENITY
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DEMON_HUNTER_INITIATION,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DEMON_HUNTER_INITIATION
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.FROSTREAPER,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.FROSTREAPER
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DEATH_KNIGHT_RUNES,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DEATH_KNIGHT_RUNES
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_FORMS,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DRUID_FORMS
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_FORM_MOVEMENT,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DRUID_FORM_MOVEMENT
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_FORM_ATTACKS,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DRUID_FORM_ATTACKS
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_FORM_ARMOR,
        Boolean(values[AUTOMATION_SETTING_KEYS.DRUID_FORM_ARMOR]),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_FORM_SPELL_RESTRICTION,
        Boolean(values[AUTOMATION_SETTING_KEYS.DRUID_FORM_SPELL_RESTRICTION]),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_MOONKIN_SPELL_COST,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DRUID_MOONKIN_SPELL_COST
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DRUID_FORM_ARTWORK,
        Boolean(
          values[
            AUTOMATION_SETTING_KEYS.DRUID_FORM_ARTWORK
          ],
        ),
      ),
    ]);
  }
}

export function registerAutomationSettings(
  settings = globalThis.game?.settings,
) {
  if (!settings?.register) return false;

  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS,
    settingDefinition(
      "BOA.settings.automation.elementalTotemName",
      "BOA.settings.automation.elementalTotemHint",
    ),
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DEMONS,
    settingDefinition(
      "BOA.settings.automation.demonName",
      "BOA.settings.automation.demonHint",
    ),
  );

  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.MAGES_BRILLIANCE,
    settingDefinition(
      "BOA.settings.automation.mageBrillianceName",
      "BOA.settings.automation.mageBrillianceHint",
      {
        onChange: reconcileMageBrillianceAutomation,
      },
    ),
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY,
    settingDefinition(
      "BOA.settings.automation.evokersLegacyName",
      "BOA.settings.automation.evokersLegacyHint",
    ),
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.WAR_STOMP,
    {
      ...settingDefinition(
        "BOA.settings.automation.warStompName",
        "BOA.settings.automation.warStompHint",
      ),
      onChange:
        reconcileAbilityActionsOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.EYE_BEAM,
    {
      ...settingDefinition(
        "BOA.settings.automation.eyeBeamName",
        "BOA.settings.automation.eyeBeamHint",
      ),
      onChange:
        reconcileAbilityActionsOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.SERENITY,
    {
      ...settingDefinition(
        "BOA.settings.automation.serenityName",
        "BOA.settings.automation.serenityHint",
      ),
      onChange:
        reconcileSerenityOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DEMON_HUNTER_INITIATION,
    {
      ...settingDefinition(
        "BOA.settings.automation.demonHunterInitiationName",
        "BOA.settings.automation.demonHunterInitiationHint",
      ),
      onChange:
        reconcileDemonHunterInitiationOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.FROSTREAPER,
    {
      ...settingDefinition(
        "BOA.settings.automation.frostreaperName",
        "BOA.settings.automation.frostreaperHint",
      ),
      onChange:
        redrawFrostreaperOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DEATH_KNIGHT_RUNES,
    {
      ...settingDefinition(
        "BOA.settings.automation.deathKnightRunesName",
        "BOA.settings.automation.deathKnightRunesHint",
      ),
      onChange:
        reconcileDeathKnightRunesOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_FORMS,
    settingDefinition(
      "BOA.settings.automation.druidFormsName",
      "BOA.settings.automation.druidFormsHint",
    ),
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_FORM_MOVEMENT,
    {
      ...settingDefinition(
        "BOA.settings.automation.druidFormMovementName",
        "BOA.settings.automation.druidFormMovementHint",
      ),
      onChange:
        reconcileDruidFormMechanicsOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_FORM_ATTACKS,
    {
      ...settingDefinition(
        "BOA.settings.automation.druidFormAttackName",
        "BOA.settings.automation.druidFormAttackHint",
      ),
      onChange:
        reconcileDruidFormMechanicsOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_FORM_ARMOR,
    {
      ...settingDefinition(
        "BOA.settings.automation.druidFormArmorName",
        "BOA.settings.automation.druidFormArmorHint",
      ),
      onChange:
        reconcileDruidFormMechanicsOnChange,
    },
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_FORM_SPELL_RESTRICTION,
    settingDefinition(
      "BOA.settings.automation.druidFormSpellRestrictionName",
      "BOA.settings.automation.druidFormSpellRestrictionHint",
    ),
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_MOONKIN_SPELL_COST,
    settingDefinition(
      "BOA.settings.automation.druidMoonkinSpellCostName",
      "BOA.settings.automation.druidMoonkinSpellCostHint",
    ),
  );
  settings.register(
    MODULE_ID,
    AUTOMATION_SETTING_KEYS.DRUID_FORM_ARTWORK,
    {
      ...settingDefinition(
        "BOA.settings.automation.druidFormArtworkName",
        "BOA.settings.automation.druidFormArtworkHint",
      ),
      onChange: restoreDruidArtworkOnChange,
    },
  );
  if (settings.registerMenu) {
    settings.registerMenu(
      MODULE_ID,
      "automationSettings",
      {
        name: "BOA.settings.automation.menuName",
        label: "BOA.settings.automation.menuLabel",
        hint: "BOA.settings.automation.menuHint",
        icon: "fa-solid fa-gears",
        type: AutomationSettingsForm,
        restricted: true,
      },
    );
  }

  return true;
}
