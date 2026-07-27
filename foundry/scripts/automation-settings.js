import { MODULE_ID } from "./core/constants.js";

export const AUTOMATION_SETTING_KEYS = Object.freeze({
  ELEMENTAL_TOTEMS: "elementalTotemAutomation",
  DEMONS: "demonAutomation",
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
        icon: "fa-solid fa-gears",
        type: AutomationSettingsForm,
        restricted: true,
      },
    );
  }

  return true;
}
