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
