(() => {
  "use strict";

  const MODULE_ID = "bane-of-azeroth";
  const PACK_ID =
    "bane-of-azeroth.bane-of-azeroth-dev-tests";
  const TEST_FOLDER_NAME = "Bane of Azeroth - System Tests";
  const LEGACY_ROOT_FOLDER_NAME = "Bane of Azeroth";
  const LEGACY_TEST_FOLDER_NAME = "System Tests";
  const IMPORTED_FLAG = "managedSystemTestMacro";

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

  async function ensureMacroFolder(
    name,
    parent = null,
    color = null
  ) {
    const parentId = parent?.id ?? null;

    const existing = collectionValues(game.folders)
      .find(folder =>
        folder.type === "Macro" &&
        folder.name === name &&
        parentFolderId(folder) === parentId
      );

    if (existing) {
      if ((existing.color ?? null) !== color) {
        await existing.update({ color });
      }

      return existing;
    }

    return Folder.create({
      name,
      type: "Macro",
      folder: parentId,
      sorting: "a",
      color,
    });
  }

  function macroFolderChildren(
    folder
  ) {
    return collectionValues(game.folders)
      .filter(candidate =>
        candidate.type === "Macro" &&
        parentFolderId(candidate) === folder.id
      );
  }

  function macrosInFolder(
    folder
  ) {
    return collectionValues(game.macros)
      .filter(macro =>
        parentFolderId(macro) === folder.id
      );
  }

  async function cleanupLegacyMacroFolders() {
    const legacyRoots =
      collectionValues(game.folders)
        .filter(folder =>
          folder.type === "Macro" &&
          folder.name === LEGACY_ROOT_FOLDER_NAME &&
          parentFolderId(folder) === null
        );

    for (const root of legacyRoots) {
      const legacyChildren =
        macroFolderChildren(root)
          .filter(folder =>
            folder.name === LEGACY_TEST_FOLDER_NAME
          );

      for (const child of legacyChildren) {
        if (
          macrosInFolder(child).length === 0 &&
          macroFolderChildren(child).length === 0
        ) {
          await child.delete();
        }
      }

      if (
        root.color === "#1f5fbf" &&
        macrosInFolder(root).length === 0 &&
        macroFolderChildren(root).length === 0
      ) {
        await root.delete();
      }
    }
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

  function systemTestKey(macro) {
    return macro.getFlag(
      MODULE_ID,
      "systemTestKey"
    );
  }

  function buildWorldMacroData(
    source,
    folder,
    moduleVersion
  ) {
    const sourceData = source.toObject();
    const flags = foundry.utils.deepClone(
      sourceData.flags ?? {}
    );

    flags[MODULE_ID] ??= {};
    flags[MODULE_ID][IMPORTED_FLAG] = true;
    flags[MODULE_ID].sourcePack = PACK_ID;
    flags[MODULE_ID].sourceMacroId = source.id;
    flags[MODULE_ID].importedFromModuleVersion =
      moduleVersion;

    return {
      name: source.name,
      type: source.type,
      scope: source.scope,
      command: source.command,
      img: source.img,
      folder: folder.id,
      ownership: {
        default:
          CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      },
      flags,
    };
  }

  function needsUpdate(existing, desired) {
    return (
      existing.name !== desired.name ||
      existing.type !== desired.type ||
      existing.scope !== desired.scope ||
      existing.command !== desired.command ||
      existing.img !== desired.img ||
      parentFolderId(existing) !== desired.folder ||
      existing.getFlag(
        MODULE_ID,
        "importedFromModuleVersion"
      ) !==
        desired.flags[MODULE_ID]
          .importedFromModuleVersion ||
      existing.getFlag(
        MODULE_ID,
        "sourceMacroId"
      ) !==
        desired.flags[MODULE_ID].sourceMacroId
    );
  }

  async function syncDeveloperMacros() {
    if (!game.user.isGM) return;
    if (!isPrimaryActiveGM()) return;

    const module = game.modules.get(MODULE_ID);
    const pack = game.packs.get(PACK_ID);

    if (!module?.active || !pack) return;

    const sourceMacros = await pack.getDocuments();

    if (sourceMacros.length === 0) {
      ui.notifications.error(
        "Bane of Azeroth developer-test " +
        "compendium is empty."
      );
      console.error(
        "Bane of Azeroth | Developer-test " +
        "compendium is empty.",
        pack
      );
      return;
    }

    const testFolder = await ensureMacroFolder(
      TEST_FOLDER_NAME,
      null,
      "#1f5fbf"
    );

    const managedWorldMacros =
      collectionValues(game.macros)
        .filter(macro =>
          macro.getFlag(
            MODULE_ID,
            IMPORTED_FLAG
          ) === true
        );

    let createdCount = 0;
    let updatedCount = 0;

    for (const source of sourceMacros) {
      const key = systemTestKey(source);

      if (!key) {
        console.warn(
          "Bane of Azeroth | Skipping developer " +
          "Macro without systemTestKey.",
          source
        );
        continue;
      }

      const desired = buildWorldMacroData(
        source,
        testFolder,
        module.version
      );

      const existing = managedWorldMacros.find(
        macro => systemTestKey(macro) === key
      );

      if (!existing) {
        await Macro.create(desired, {
          renderSheet: false,
        });
        createdCount += 1;
        continue;
      }

      if (needsUpdate(existing, desired)) {
        await existing.update(desired);
        updatedCount += 1;
      }
    }

    await cleanupLegacyMacroFolders();

    if (createdCount > 0 || updatedCount > 0) {
      ui.notifications.info(
        "Bane of Azeroth system-test Macros: " +
        `${createdCount} imported, ` +
        `${updatedCount} updated.`
      );
    }

    console.info(
      "Bane of Azeroth | Developer-test Macros " +
      "synchronized.",
      {
        sourceCount: sourceMacros.length,
        createdCount,
        updatedCount,
        folder: testFolder.name,
      }
    );
  }

  Hooks.once("ready", () => {
    syncDeveloperMacros().catch(error => {
      console.error(
        "Bane of Azeroth | Failed to synchronize " +
        "developer-test Macros.",
        error
      );

      ui.notifications.error(
        "Could not import Bane of Azeroth " +
        "developer-test Macros. See console."
      );
    });
  });
})();
