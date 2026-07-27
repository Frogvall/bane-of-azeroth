import { MODULE_ID } from "./core/constants.js";

export const AUTOMATION_SETTING_KEYS = Object.freeze({
  ELEMENTAL_TOTEMS: "elementalTotemAutomation",
  DEMONS: "demonAutomation",
});

const BaseFormApplication =
  globalThis.FormApplication ?? class {};

function settingDefinition(name, hint) {
  return {
    name,
    hint,
    scope: "world",
    config: false,
    type: Boolean,
    default: true,
  };
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

export class AutomationSettingsForm
  extends BaseFormApplication {
  static get defaultOptions() {
    const defaults = super.defaultOptions ?? {};
    const classes = [
      ...(defaults.classes ?? []),
      "bane-of-azeroth",
      "automation-settings",
    ];

    return {
      ...defaults,
      id: "bane-of-azeroth-automation-settings",
      title: "BOA.settings.automation.menuName",
      template:
        "modules/bane-of-azeroth/templates/"
        + "automation-settings.hbs",
      classes: [...new Set(classes)],
      width: 560,
      height: "auto",
      closeOnSubmit: true,
    };
  }

  getData() {
    return {
      elementalTotemAutomation:
        isElementalTotemAutomationEnabled(),
      demonAutomation:
        isDemonAutomationEnabled(),
    };
  }

  async _updateObject(_event, formData) {
    const settings = globalThis.game?.settings;
    if (!settings?.set) return;

    await Promise.all([
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS,
        Boolean(
          formData[
            AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS
          ],
        ),
      ),
      settings.set(
        MODULE_ID,
        AUTOMATION_SETTING_KEYS.DEMONS,
        Boolean(
          formData[
            AUTOMATION_SETTING_KEYS.DEMONS
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

  if (settings.registerMenu) {
    settings.registerMenu(
      MODULE_ID,
      "automationSettings",
      {
        name: "BOA.settings.automation.menuName",
        label: "BOA.settings.automation.menuLabel",
        hint: "BOA.settings.automation.menuHint",
        icon: "fas fa-gears",
        type: AutomationSettingsForm,
        restricted: true,
      },
    );
  }

  return true;
}
