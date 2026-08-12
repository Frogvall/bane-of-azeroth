(() => {
  "use strict";

  const MODULE_ID = "bane-of-azeroth";
  const PACK_ID =
    "bane-of-azeroth.bane-of-azeroth-dev-test-actors";
  const TEST_FOLDER_NAME = "Bane of Azeroth - System Tests";
  const IMPORTED_FLAG = "managedSystemTestActor";
  const MANAGED_ITEM_FLAG = "managedSystemTestActorItem";
  const FIXTURE_ITEM_KEY_FLAG = "systemTestActorFixtureItemKey";
  const SOURCE_ITEM_UUID_FLAG = "systemTestActorSourceItemUuid";
  const SYNC_DELAY_MS = 500;

  let syncPromise = null;
  let syncTimer = null;
  let lastMissingSignature = null;

  function collectionValues(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (typeof collection.values === "function") {
      return Array.from(collection.values());
    }

    return Array.from(collection);
  }

  function parentFolderId(document) {
    return document?.folder?.id ??
      document?.folder ??
      null;
  }

  function getFlag(document, key) {
    return document?.getFlag?.(
      MODULE_ID,
      key,
    ) ??
      foundry.utils.getProperty(
        document,
        `flags.${MODULE_ID}.${key}`,
      );
  }

  function contentKey(item) {
    return getFlag(
      item,
      "contentKey",
    ) ?? null;
  }

  function isPrimaryActiveGM() {
    const activeGM = game.users?.activeGM;
    if (activeGM) {
      return activeGM.id === game.user.id;
    }

    const activeGMs = collectionValues(game.users)
      .filter(user => user.active && user.isGM)
      .sort((left, right) =>
        left.id.localeCompare(right.id)
      );

    return activeGMs[0]?.id === game.user.id;
  }

  async function ensureActorFolder() {
    const existing = collectionValues(game.folders)
      .find(folder =>
        folder.type === "Actor" &&
        folder.name === TEST_FOLDER_NAME &&
        parentFolderId(folder) === null
      );

    if (existing) {
      if ((existing.color ?? null) !== "#1f5fbf") {
        await existing.update({ color: "#1f5fbf" });
      }
      return existing;
    }

    return Folder.create({
      name: TEST_FOLDER_NAME,
      type: "Actor",
      folder: null,
      sorting: "a",
      color: "#1f5fbf",
    });
  }

  function systemTestActorKey(actor) {
    return getFlag(
      actor,
      "systemTestActorKey",
    ) ?? null;
  }

  function fixtureStats(source) {
    return getFlag(
      source,
      "fixtureStats",
    ) ?? {};
  }

  function fixtureItems(source) {
    const value = getFlag(
      source,
      "fixtureItems",
    );

    return Array.isArray(value)
      ? value
      : [];
  }

  function buildWorldActorData(
    source,
    folder,
    moduleVersion,
  ) {
    const sourceData = source.toObject();
    const flags = foundry.utils.deepClone(
      sourceData.flags ?? {},
    );

    flags[MODULE_ID] ??= {};
    flags[MODULE_ID][IMPORTED_FLAG] = true;
    flags[MODULE_ID].sourcePack = PACK_ID;
    flags[MODULE_ID].sourceActorId = source.id;
    flags[MODULE_ID].importedFromModuleVersion =
      moduleVersion;

    return {
      name: source.name,
      type: source.type,
      img: source.img,
      prototypeToken:
        foundry.utils.deepClone(
          sourceData.prototypeToken ?? {},
        ),
      folder: folder.id,
      ownership: {
        default:
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
      },
      flags,
    };
  }

  function needsActorUpdate(existing, desired) {
    return (
      existing.name !== desired.name ||
      existing.type !== desired.type ||
      existing.img !== desired.img ||
      parentFolderId(existing) !== desired.folder ||
      existing.ownership?.default !==
        desired.ownership.default ||
      existing.getFlag(
        MODULE_ID,
        "importedFromModuleVersion",
      ) !==
        desired.flags[MODULE_ID]
          .importedFromModuleVersion ||
      existing.getFlag(
        MODULE_ID,
        "sourceActorId",
      ) !==
        desired.flags[MODULE_ID].sourceActorId
    );
  }

  function statUpdate(source) {
    const stats = fixtureStats(source);
    const hp = Number(stats.hp ?? 30);
    const wp = Number(stats.wp ?? 30);

    return {
      "system.hitPoints.base": hp,
      "system.hitPoints.max": hp,
      "system.hitPoints.value": hp,
      "system.willPoints.base": wp,
      "system.willPoints.max": wp,
      "system.willPoints.value": wp,
    };
  }

  function descriptorLabel(descriptor) {
    return String(
      descriptor?.contentKey ??
      descriptor?.name ??
      descriptor?.key ??
      "unknown Item",
    );
  }

  function findSourceItem(descriptor) {
    const worldItems = collectionValues(game.items);
    const expectedType = descriptor?.type ?? null;
    const expectedContentKey =
      descriptor?.contentKey ?? null;
    const expectedName =
      descriptor?.name ?? null;

    if (expectedContentKey) {
      const byContentKey = worldItems.find(item =>
        contentKey(item) === expectedContentKey &&
        (!expectedType || item.type === expectedType)
      );
      if (byContentKey) return byContentKey;
    }

    if (!expectedName) return null;

    return worldItems.find(item =>
      item.name === expectedName &&
      (!expectedType || item.type === expectedType)
    ) ?? null;
  }

  const SOURCE_ITEM_VERSION_FLAG =
    "systemTestActorSourceModuleVersion";

  function cloneManagedItem(
    sourceItem,
    descriptor,
    moduleVersion,
  ) {
    const data = sourceItem.toObject();
    delete data._id;
    delete data._key;
    delete data.folder;

    const fixtureSystemValue =
      descriptor?.systemValue;
    if (fixtureSystemValue !== undefined) {
      const numericValue = Number(
        fixtureSystemValue,
      );
      if (!Number.isFinite(numericValue)) {
        throw new Error(
          "Invalid system-test Actor fixture systemValue " +
          `for ${descriptorLabel(descriptor)}.`,
        );
      }

      data.system ??= {};
      data.system.value = numericValue;
    }

    const fixtureSystemWorn =
      descriptor?.systemWorn;
    if (fixtureSystemWorn !== undefined) {
      if (typeof fixtureSystemWorn !== "boolean") {
        throw new Error(
          "Invalid system-test Actor fixture systemWorn " +
          `for ${descriptorLabel(descriptor)}.`,
        );
      }

      data.system ??= {};
      data.system.worn = fixtureSystemWorn;
    }

    data.flags = foundry.utils.deepClone(
      data.flags ?? {},
    );
    data.flags[MODULE_ID] ??= {};
    data.flags[MODULE_ID][MANAGED_ITEM_FLAG] = true;
    data.flags[MODULE_ID][FIXTURE_ITEM_KEY_FLAG] =
      descriptor.key;
    data.flags[MODULE_ID][SOURCE_ITEM_UUID_FLAG] =
      sourceItem.uuid;
    data.flags[MODULE_ID][SOURCE_ITEM_VERSION_FLAG] =
      moduleVersion;

    return data;
  }

  function managedItemsForDescriptor(
    actor,
    descriptor,
  ) {
    return collectionValues(actor.items)
      .filter(item =>
        getFlag(item, MANAGED_ITEM_FLAG) === true &&
        getFlag(item, FIXTURE_ITEM_KEY_FLAG) ===
          descriptor.key
      );
  }

  function managedItemUpdateData(
    existing,
    sourceItem,
    descriptor,
    moduleVersion,
  ) {
    const data = cloneManagedItem(
      sourceItem,
      descriptor,
      moduleVersion,
    );

    // ActiveEffect is itself an embedded collection. Do not push the
    // source Item's embedded effects through a parent Item update: the
    // existing fixture already received them when it was first created,
    // and avoiding embedded-collection replacement keeps synchronization
    // stable.
    delete data.effects;
    delete data._stats;
    data._id = existing.id;
    return data;
  }

  function reusableActorItemForDescriptor(
    actor,
    descriptor,
  ) {
    if (descriptor?.reuseExisting !== true) {
      return null;
    }

    return collectionValues(actor.items)
      .find(item =>
        getFlag(item, MANAGED_ITEM_FLAG) !== true &&
        item.name === descriptor.name &&
        item.type === descriptor.type
      ) ?? null;
  }

  function fixtureOverrideUpdateData(
    existing,
    descriptor,
  ) {
    const data = {
      _id: existing.id,
    };

    if (descriptor?.systemValue !== undefined) {
      data["system.value"] =
        Number(descriptor.systemValue);
    }

    if (descriptor?.systemWorn !== undefined) {
      data["system.worn"] =
        descriptor.systemWorn;
    }

    return data;
  }

  function fixtureOverridesNeedUpdate(
    existing,
    descriptor,
  ) {
    return (
      (
        descriptor?.systemValue !== undefined &&
        Number(existing.system?.value) !==
          Number(descriptor.systemValue)
      ) ||
      (
        descriptor?.systemWorn !== undefined &&
        Boolean(existing.system?.worn) !==
          descriptor.systemWorn
      )
    );
  }

  async function reconcileFixtureItems(
    actor,
    source,
    moduleVersion,
  ) {
    const descriptors = fixtureItems(source);
    const desiredKeys = new Set(
      descriptors.map(descriptor => descriptor.key),
    );
    const managedItems = collectionValues(actor.items)
      .filter(item =>
        getFlag(item, MANAGED_ITEM_FLAG) === true
      );
    const obsoleteIds = managedItems
      .filter(item =>
        !desiredKeys.has(
          getFlag(item, FIXTURE_ITEM_KEY_FLAG),
        )
      )
      .map(item => item.id);
    if (obsoleteIds.length > 0) {
      await actor.deleteEmbeddedDocuments(
        "Item",
        obsoleteIds,
      );
    }

    const missing = [];
    for (const descriptor of descriptors) {
      const sourceItem = findSourceItem(descriptor);
      if (!sourceItem) {
        missing.push(
          descriptorLabel(descriptor),
        );
        continue;
      }

      const matchingManagedItems =
        managedItemsForDescriptor(
          actor,
          descriptor,
        );
      const reusableExisting =
        reusableActorItemForDescriptor(
          actor,
          descriptor,
        );

      if (reusableExisting) {
        const managedDuplicateIds =
          matchingManagedItems
            .map(item => item.id);

        if (managedDuplicateIds.length > 0) {
          await actor.deleteEmbeddedDocuments(
            "Item",
            managedDuplicateIds,
          );
        }

        if (
          fixtureOverridesNeedUpdate(
            reusableExisting,
            descriptor,
          )
        ) {
          await actor.updateEmbeddedDocuments(
            "Item",
            [
              fixtureOverrideUpdateData(
                reusableExisting,
                descriptor,
              ),
            ],
            {
              renderSheet: false,
            },
          );
        }

        continue;
      }

      const existing =
        matchingManagedItems[0] ?? null;
      const duplicateIds =
        matchingManagedItems
          .slice(1)
          .map(item => item.id);

      if (duplicateIds.length > 0) {
        await actor.deleteEmbeddedDocuments(
          "Item",
          duplicateIds,
        );
      }

      if (!existing) {
        await actor.createEmbeddedDocuments(
          "Item",
          [
            cloneManagedItem(
              sourceItem,
              descriptor,
              moduleVersion,
            ),
          ],
          {
            renderSheet: false,
          },
        );
        continue;
      }

      const fixtureOverrideChanged =
        fixtureOverridesNeedUpdate(
          existing,
          descriptor,
        );
      const sourceChanged =
        getFlag(existing, SOURCE_ITEM_UUID_FLAG) !==
          sourceItem.uuid ||
        getFlag(existing, SOURCE_ITEM_VERSION_FLAG) !==
          moduleVersion ||
        fixtureOverrideChanged;

      if (!sourceChanged) continue;

      await actor.updateEmbeddedDocuments(
        "Item",
        [
          managedItemUpdateData(
            existing,
            sourceItem,
            descriptor,
            moduleVersion,
          ),
        ],
        {
          renderSheet: false,
        },
      );
    }

    return missing;
  }

  function notifyMissingItems(missingByActor) {
    const entries = missingByActor
      .flatMap(entry =>
        entry.items.map(item =>
          `${entry.actor}: ${item}`
        )
      )
      .sort();
    const signature = entries.join("\n");

    if (signature === lastMissingSignature) return;
    lastMissingSignature = signature;

    if (entries.length === 0) return;

    ui.notifications.warn(
      "Bane of Azeroth system-test Actors are waiting for " +
      `${entries.length} source Item(s). Import or reimport ` +
      "the Bane of Azeroth Adventure first.",
    );
  }

  async function performSync() {
    if (!game.user.isGM) return;
    if (!isPrimaryActiveGM()) return;

    const module = game.modules.get(MODULE_ID);
    const pack = game.packs.get(PACK_ID);

    if (!module?.active || !pack) return;

    const sourceActors = await pack.getDocuments();
    if (sourceActors.length === 0) {
      ui.notifications.error(
        "Bane of Azeroth system-test Actor compendium is empty.",
      );
      console.error(
        "Bane of Azeroth | System-test Actor compendium is empty.",
        pack,
      );
      return;
    }

    const folder = await ensureActorFolder();
    const managedActors = collectionValues(game.actors)
      .filter(actor =>
        actor.getFlag(
          MODULE_ID,
          IMPORTED_FLAG,
        ) === true
      );
    const missingByActor = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const source of sourceActors) {
      const key = systemTestActorKey(source);
      if (!key) {
        console.warn(
          "Bane of Azeroth | Skipping system-test Actor " +
          "without systemTestActorKey.",
          source,
        );
        continue;
      }

      const desired = buildWorldActorData(
        source,
        folder,
        module.version,
      );
      let actor = managedActors.find(candidate =>
        systemTestActorKey(candidate) === key
      );

      if (!actor) {
        actor = await Actor.create(
          desired,
          {
            renderSheet: false,
          },
        );
        if (!actor) {
          throw new Error(
            `Could not create system-test Actor ${source.name}.`,
          );
        }
        managedActors.push(actor);
        createdCount += 1;
      } else if (needsActorUpdate(actor, desired)) {
        await actor.update(desired);
        updatedCount += 1;
      }

      await actor.update(
        statUpdate(source),
      );

      const missing = await reconcileFixtureItems(
        actor,
        source,
        module.version,
      );
      if (missing.length > 0) {
        missingByActor.push({
          actor: source.name,
          items: missing,
        });
      }
    }

    const sourceKeys = new Set(
      sourceActors
        .map(systemTestActorKey)
        .filter(Boolean),
    );
    const staleManaged = managedActors
      .filter(actor =>
        !sourceKeys.has(systemTestActorKey(actor))
      );
    if (staleManaged.length > 0) {
      await Actor.deleteDocuments(
        staleManaged.map(actor => actor.id),
      );
    }

    notifyMissingItems(missingByActor);

    if (
      createdCount > 0 ||
      updatedCount > 0 ||
      staleManaged.length > 0
    ) {
      ui.notifications.info(
        "Bane of Azeroth system-test Actors: " +
        `${createdCount} imported, ` +
        `${updatedCount} updated, ` +
        `${staleManaged.length} removed.`,
      );
    }
  }

  function syncDeveloperActors() {
    if (syncPromise) return syncPromise;

    syncPromise = performSync()
      .finally(() => {
        syncPromise = null;
      });

    return syncPromise;
  }

  function scheduleSync() {
    if (!game.ready) return;
    if (!game.user.isGM) return;
    if (!isPrimaryActiveGM()) return;

    if (syncTimer !== null) {
      clearTimeout(syncTimer);
    }

    syncTimer = setTimeout(() => {
      syncTimer = null;
      syncDeveloperActors().catch(error => {
        console.error(
          "Bane of Azeroth | Failed to synchronize " +
          "system-test Actors after world Item changes.",
          error,
        );
      });
    }, SYNC_DELAY_MS);
  }

  Hooks.once("ready", () => {
    syncDeveloperActors().catch(error => {
      console.error(
        "Bane of Azeroth | Failed to synchronize " +
        "system-test Actors.",
        error,
      );

      ui.notifications.error(
        "Could not import Bane of Azeroth system-test Actors. " +
        "See console.",
      );
    });
  });

  Hooks.on("createItem", item => {
    if (!item?.parent) scheduleSync();
  });
  Hooks.on("updateItem", item => {
    if (!item?.parent) scheduleSync();
  });
  Hooks.on("deleteItem", item => {
    if (!item?.parent) scheduleSync();
  });
})();
