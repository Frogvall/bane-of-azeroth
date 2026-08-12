import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
let mechanics;

function settings() {
  return {
    get: vi.fn(
      (_moduleId, key) =>
        key === "druidFormArmorAutomation"
          ? true
          : true,
    ),
  };
}

function buildActor({
  silentlyDropRestore = false,
} = {}) {
  const armor = {
    id: "studded",
    type: "armor",
    system: {
      worn: false,
      rating: 2,
    },
    flags: {},
  };

  const result = {
    id: "druid",
    uuid: "Actor.druid",
    type: "character",
    flags: {
      [MODULE_ID]: {
        druidFormState: {
          currentForm: "humanoid",
          activations: {},
        },
        druidFormArmorBaseline: {
          items: [
            {
              id: "studded",
              type: "armor",
              worn: true,
            },
          ],
        },
      },
    },
    items: [armor],
    effects: [],
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key];
    },
    async setFlag(moduleId, key, value) {
      this.flags[moduleId] ??= {};
      this.flags[moduleId][key] =
        structuredClone(value);
      return value;
    },
    unsetFlag: vi.fn(
      async function (moduleId, key) {
        delete this.flags?.[moduleId]?.[key];
        return true;
      },
    ),
    createEmbeddedDocuments: vi.fn(async () => []),
    deleteEmbeddedDocuments: vi.fn(async () => []),
    updateEmbeddedDocuments: vi.fn(
      async function (
        type,
        updates,
        options = {},
      ) {
        expect(type).toBe("Item");

        for (const update of updates) {
          const item =
            this.items.find(
              candidate =>
                candidate.id === update._id,
            );
          if (!item) continue;

          if (update["system.worn"] === true) {
            // Deterministically reproduce the race:
            // another form state arrives before preUpdateItem
            // handles the Humanoid restore.
            this.flags[MODULE_ID].druidFormState = {
              currentForm: "cat",
              activations: {
                feral: {
                  active: true,
                  powerLevel: 2,
                },
              },
            };
          }

          const allowed =
            mechanics.onPreUpdateDruidFormArmorItem(
              {
                ...item,
                parent: this,
              },
              update,
              {
                ...options,
                settings: settings(),
              },
            );

          if (
            allowed === false ||
            (
              silentlyDropRestore &&
              update["system.worn"] === true
            )
          ) {
            continue;
          }

          if (
            Object.hasOwn(
              update,
              "system.worn",
            )
          ) {
            item.system.worn =
              update["system.worn"];
          }
        }

        return updates;
      },
    ),
  };

  result.items.get =
    id =>
      result.items.find(
        item => item.id === id,
      );

  return {
    actor: result,
    armor,
  };
}

beforeEach(async () => {
  vi.resetModules();

  globalThis.game = {
    settings: settings(),
    i18n: {
      localize: vi.fn(key => key),
    },
  };
  globalThis.ui = {
    notifications: {
      warn: vi.fn(),
    },
  };

  mechanics =
    await import(
      "../../foundry/scripts/druid-form-mechanics.js"
    );
});

describe(
  "Druid humanoid armor restore race",
  () => {
    test(
      "BoA internal restore bypasses the shifted-form manual equip guard",
      async () => {
        const { actor, armor } =
          buildActor();

        const result =
          await mechanics.reconcileDruidFormArmor(
            actor,
            {
              currentForm: "humanoid",
              activations: {},
            },
            {
              settings: settings(),
            },
          );

        expect(armor.system.worn).toBe(true);
        expect(result.pending).toBe(0);
        expect(actor.unsetFlag).toHaveBeenCalledWith(
          MODULE_ID,
          mechanics.DRUID_FORM_ARMOR_BASELINE_FLAG,
        );

        const restoreCall =
          actor.updateEmbeddedDocuments.mock.calls.find(
            ([, updates]) =>
              updates.some(
                update =>
                  update["system.worn"] === true,
              ),
          );

        expect(
          restoreCall?.[2]?.[
            mechanics.DRUID_FORM_ARMOR_INTERNAL_UPDATE_OPTION
          ],
        ).toBe(true);
      },
    );

    test(
      "manual re-equip is still blocked while shifted",
      () => {
        const { actor, armor } =
          buildActor();

        actor.flags[MODULE_ID].druidFormState = {
          currentForm: "cat",
          activations: {
            feral: {
              active: true,
              powerLevel: 2,
            },
          },
        };

        expect(
          mechanics.onPreUpdateDruidFormArmorItem(
            {
              ...armor,
              parent: actor,
            },
            {
              "system.worn": true,
            },
            {
              settings: settings(),
            },
          ),
        ).toBe(false);

        expect(
          mechanics.onPreUpdateDruidFormArmorItem(
            {
              ...armor,
              parent: actor,
            },
            {
              "system.worn": true,
            },
            {
              settings: settings(),
              [
                mechanics
                  .DRUID_FORM_ARMOR_INTERNAL_UPDATE_OPTION
              ]: true,
            },
          ),
        ).toBe(true);
      },
    );

    test(
      "baseline is retained if the requested restore did not actually land",
      async () => {
        const { actor, armor } =
          buildActor({
            silentlyDropRestore: true,
          });

        const result =
          await mechanics.reconcileDruidFormArmor(
            actor,
            {
              currentForm: "humanoid",
              activations: {},
            },
            {
              settings: settings(),
            },
          );

        expect(armor.system.worn).toBe(false);
        expect(result.pending).toBe(1);
        expect(actor.unsetFlag).not.toHaveBeenCalled();
        expect(
          actor.getFlag(
            MODULE_ID,
            mechanics.DRUID_FORM_ARMOR_BASELINE_FLAG,
          ),
        ).toBeTruthy();
      },
    );
  },
);
