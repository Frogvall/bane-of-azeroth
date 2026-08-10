import { MODULE_ID } from "./core/constants.js";

export const DEVELOPER_SETTING_KEYS = Object.freeze({
  DRUID_LIFECYCLE_TRACE: "druidLifecycleTrace",
});

const {
  ApplicationV2,
  HandlebarsApplicationMixin,
} = globalThis.foundry?.applications?.api ?? {};

const BaseDeveloperSettingsApplication =
  ApplicationV2 && HandlebarsApplicationMixin
    ? HandlebarsApplicationMixin(ApplicationV2)
    : class {
        async _prepareContext() {
          return {};
        }
      };

function booleanField(label, hint) {
  const BooleanField = globalThis.foundry?.data?.fields?.BooleanField;
  return BooleanField
    ? new BooleanField({ label, hint })
    : { label, hint };
}

function schemaField(fields) {
  const SchemaField = globalThis.foundry?.data?.fields?.SchemaField;
  return SchemaField ? new SchemaField(fields) : { fields };
}

export function isDevelopmentBuild(
  module = globalThis.game?.modules?.get?.(MODULE_ID),
) {
  return module?.flags?.[MODULE_ID]?.developmentBuild === true;
}

function readDeveloperBoolean(
  key,
  settings = globalThis.game?.settings,
) {
  if (!settings?.get) return false;
  try {
    return settings.get(MODULE_ID, key) === true;
  } catch (_error) {
    return false;
  }
}

function applyDruidLifecycleTrace(
  value,
  module = globalThis.game?.modules?.get?.(MODULE_ID),
) {
  const setter = module?.api?.setDruidLifecycleTraceEnabled;
  if (typeof setter !== "function") return false;
  setter(value === true);
  return true;
}

function onDruidLifecycleTraceChange(value) {
  applyDruidLifecycleTrace(value);
}

export class DeveloperSettingsForm extends BaseDeveloperSettingsApplication {
  static DEFAULT_OPTIONS = {
    id: "bane-of-azeroth-developer-settings",
    tag: "form",
    window: {
      title: "BOA.settings.developer.menuName",
      contentClasses: [
        "dragonbane",
        "standard-form",
        "dragonbane-settings",
        "developer-settings",
        "bane-of-azeroth",
      ],
      resizable: true,
      icon: "fa-solid fa-code",
    },
    position: { width: 520 },
    form: {
      closeOnSubmit: true,
      handler: this._onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: "modules/bane-of-azeroth/templates/developer-settings.hbs",
      scrollable: [""],
      root: true,
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  static #schema = schemaField({
    druidLifecycleTrace: booleanField(
      "BOA.settings.developer.druidLifecycleTraceName",
      "BOA.settings.developer.druidLifecycleTraceHint",
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
        druidLifecycleTrace: readDeveloperBoolean(
          DEVELOPER_SETTING_KEYS.DRUID_LIFECYCLE_TRACE,
        ),
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
    await settings.set(
      MODULE_ID,
      DEVELOPER_SETTING_KEYS.DRUID_LIFECYCLE_TRACE,
      Boolean(values[DEVELOPER_SETTING_KEYS.DRUID_LIFECYCLE_TRACE]),
    );
  }
}

export function registerDeveloperSettings(
  settings = globalThis.game?.settings,
  module = globalThis.game?.modules?.get?.(MODULE_ID),
) {
  if (!isDevelopmentBuild(module) || !settings?.register) return false;

  settings.register(
    MODULE_ID,
    DEVELOPER_SETTING_KEYS.DRUID_LIFECYCLE_TRACE,
    {
      name: "BOA.settings.developer.druidLifecycleTraceName",
      hint: "BOA.settings.developer.druidLifecycleTraceHint",
      scope: "client",
      config: false,
      type: Boolean,
      default: false,
      onChange: onDruidLifecycleTraceChange,
    },
  );

  if (settings.registerMenu) {
    settings.registerMenu(
      MODULE_ID,
      "developerSettings",
      {
        name: "BOA.settings.developer.menuName",
        label: "BOA.settings.developer.menuLabel",
        hint: "BOA.settings.developer.menuHint",
        icon: "fa-solid fa-code",
        type: DeveloperSettingsForm,
        restricted: false,
      },
    );
  }

  return true;
}

export function applyDeveloperSettings(
  settings = globalThis.game?.settings,
  module = globalThis.game?.modules?.get?.(MODULE_ID),
) {
  if (!isDevelopmentBuild(module)) return false;

  return applyDruidLifecycleTrace(
    readDeveloperBoolean(
      DEVELOPER_SETTING_KEYS.DRUID_LIFECYCLE_TRACE,
      settings,
    ),
    module,
  );
}
