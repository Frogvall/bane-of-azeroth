import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  SERENITY_CONTENT_KEY,
  isIronFistAbility,
  isSerenityAbility,
  isUnarmedWeapon,
  reconcileSerenityActor,
} from "../../foundry/scripts/serenity.js";

const MODULE_ID =
  "bane-of-azeroth";

function makeItem({
  id,
  name,
  type,
  contentKey = null,
  damage = null,
  description = "",
  skill = "",
  features = [],
}) {
  const item = {
    id,
    name,
    type,
    system: {
      damage,
      itemDescription:
        description,
      skill: {
        name:
          skill,
      },
      features:
        [...features],
    },
    flags: {},
    getFlag(moduleId, key) {
      return (
        this.flags?.[
          moduleId
        ]?.[key]
      );
    },
    async setFlag(
      moduleId,
      key,
      value,
    ) {
      this.flags[
        moduleId
      ] ??= {};
      this.flags[
        moduleId
      ][key] = value;
    },
    async unsetFlag(
      moduleId,
      key,
    ) {
      delete this.flags?.[
        moduleId
      ]?.[key];
    },
    async update(update) {
      if (
        Object.hasOwn(
          update,
          "system.damage",
        )
      ) {
        this.system.damage =
          update[
            "system.damage"
          ];
      }

      if (
        Object.hasOwn(
          update,
          "system.itemDescription",
        )
      ) {
        this.system.itemDescription =
          update[
            "system.itemDescription"
          ];
      }
    },
  };

  if (contentKey) {
    item.flags[
      MODULE_ID
    ] = {
      contentKey,
    };
  }

  return item;
}

function actor(items) {
  const result = {
    type:
      "character",
    items,
  };

  for (const item of items) {
    item.parent =
      result;
  }

  return result;
}

function settings(
  enabled = true,
) {
  return {
    get:
      vi.fn(
        () =>
          enabled,
      ),
  };
}

afterEach(() => {
  delete globalThis.game;
});

describe(
  "Monk's Serenity automation",
  () => {
    test("recognizes the exact embedded item shapes", () => {
      const serenity =
        makeItem({
          id:
            "serenity",
          name:
            "Monk's Serenity",
          type:
            "ability",
          contentKey:
            SERENITY_CONTENT_KEY,
        });

      const unarmed =
        makeItem({
          id:
            "unarmed",
          name:
            "Unarmed",
          type:
            "weapon",
          damage:
            "D6",
          skill:
            "Brawling",
          features: [
            "bludgeoning",
            "unarmed",
          ],
        });

      const ironFist =
        makeItem({
          id:
            "iron",
          name:
            "Iron Fist",
          type:
            "ability",
        });

      expect(
        isSerenityAbility(
          serenity,
        ),
      ).toBe(true);

      expect(
        isUnarmedWeapon(
          unarmed,
        ),
      ).toBe(true);

      expect(
        isIronFistAbility(
          ironFist,
        ),
      ).toBe(true);
    });

    test("does nothing when Serenity exists before Unarmed", async () => {
      const serenity =
        makeItem({
          id:
            "serenity",
          name:
            "Monk's Serenity",
          type:
            "ability",
          contentKey:
            SERENITY_CONTENT_KEY,
        });

      const testActor =
        actor([
          serenity,
        ]);

      await expect(
        reconcileSerenityActor(
          testActor,
          {
            settings:
              settings(),
          },
        ),
      ).resolves.toBe(true);

      expect(
        testActor.items,
      ).toEqual([
        serenity,
      ]);
    });

    test("changes Unarmed to D10 and restores the actor's original damage", async () => {
      const serenity =
        makeItem({
          id:
            "serenity",
          name:
            "Monk's Serenity",
          type:
            "ability",
          contentKey:
            SERENITY_CONTENT_KEY,
        });

      const unarmed =
        makeItem({
          id:
            "unarmed",
          name:
            "Unarmed",
          type:
            "weapon",
          damage:
            "D8",
          skill:
            "Brawling",
          features: [
            "bludgeoning",
            "unarmed",
          ],
        });

      const testActor =
        actor([
          serenity,
          unarmed,
        ]);

      await reconcileSerenityActor(
        testActor,
        {
          settings:
            settings(),
        },
      );

      expect(
        unarmed.system.damage,
      ).toBe("D10");

      expect(
        unarmed.getFlag(
          MODULE_ID,
          "serenityOriginalUnarmedDamage",
        ),
      ).toBe("D8");

      testActor.items =
        testActor.items.filter(
          item =>
            item !== serenity,
        );

      await reconcileSerenityActor(
        testActor,
        {
          settings:
            settings(),
        },
      );

      expect(
        unarmed.system.damage,
      ).toBe("D8");

      expect(
        unarmed.getFlag(
          MODULE_ID,
          "serenityManagedUnarmed",
        ),
      ).toBeUndefined();
    });

    test("changes only the embedded Iron Fist description from 2D6 to 2D10 and restores it", async () => {
      const original =
        "<p>The damage of an unarmed attack increases to 2D6. " +
        "You can activate this heroic ability as a free action after rolling the attack.</p>";

      const serenity =
        makeItem({
          id:
            "serenity",
          name:
            "Monk's Serenity",
          type:
            "ability",
          contentKey:
            SERENITY_CONTENT_KEY,
        });

      const ironFist =
        makeItem({
          id:
            "iron",
          name:
            "Iron Fist",
          type:
            "ability",
          description:
            original,
        });

      const testActor =
        actor([
          serenity,
          ironFist,
        ]);

      await reconcileSerenityActor(
        testActor,
        {
          settings:
            settings(),
        },
      );

      expect(
        ironFist.system
          .itemDescription,
      ).toContain("2D10");

      expect(
        ironFist.system
          .itemDescription,
      ).not.toContain("2D6");

      expect(
        ironFist.getFlag(
          MODULE_ID,
          "serenityOriginalIronFistDescription",
        ),
      ).toBe(original);

      testActor.items =
        testActor.items.filter(
          item =>
            item !== serenity,
        );

      await reconcileSerenityActor(
        testActor,
        {
          settings:
            settings(),
        },
      );

      expect(
        ironFist.system
          .itemDescription,
      ).toBe(original);
    });

    test("leaves a custom Iron Fist description without 2D6 untouched", async () => {
      const serenity =
        makeItem({
          id:
            "serenity",
          name:
            "Monk's Serenity",
          type:
            "ability",
          contentKey:
            SERENITY_CONTENT_KEY,
        });

      const ironFist =
        makeItem({
          id:
            "iron",
          name:
            "Iron Fist",
          type:
            "ability",
          description:
            "<p>Custom local rules text.</p>",
        });

      await reconcileSerenityActor(
        actor([
          serenity,
          ironFist,
        ]),
        {
          settings:
            settings(),
        },
      );

      expect(
        ironFist.system
          .itemDescription,
      ).toBe(
        "<p>Custom local rules text.</p>",
      );

      expect(
        ironFist.getFlag(
          MODULE_ID,
          "serenityManagedIronFist",
        ),
      ).toBeUndefined();
    });

    test("disabling automation restores both local changes", async () => {
      const originalIronFist =
        "<p>The damage of an unarmed attack increases to 2D6.</p>";

      const serenity =
        makeItem({
          id:
            "serenity",
          name:
            "Monk's Serenity",
          type:
            "ability",
          contentKey:
            SERENITY_CONTENT_KEY,
        });

      const unarmed =
        makeItem({
          id:
            "unarmed",
          name:
            "Unarmed",
          type:
            "weapon",
          damage:
            "D6",
          skill:
            "Brawling",
          features: [
            "bludgeoning",
            "unarmed",
          ],
        });

      const ironFist =
        makeItem({
          id:
            "iron",
          name:
            "Iron Fist",
          type:
            "ability",
          description:
            originalIronFist,
        });

      const testActor =
        actor([
          serenity,
          unarmed,
          ironFist,
        ]);

      await reconcileSerenityActor(
        testActor,
        {
          settings:
            settings(true),
        },
      );

      expect(
        unarmed.system.damage,
      ).toBe("D10");

      expect(
        ironFist.system
          .itemDescription,
      ).toContain("2D10");

      await reconcileSerenityActor(
        testActor,
        {
          settings:
            settings(false),
        },
      );

      expect(
        unarmed.system.damage,
      ).toBe("D6");

      expect(
        ironFist.system
          .itemDescription,
      ).toBe(
        originalIronFist,
      );
    });
  },
);
