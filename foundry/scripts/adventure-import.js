import {
  ADVENTURE_PACK_ID,
  ADVENTURE_PROMPT_VERSION_SETTING,
  MODULE_ID,
} from "./core/constants.js";

export function registerAdventureImporterSheet() {
  const DocumentSheetConfig =
    globalThis.foundry
      ?.applications
      ?.apps
      ?.DocumentSheetConfig;
  const Adventure =
    globalThis.foundry
      ?.documents
      ?.Adventure;
  const AdventureImporterV2 =
    globalThis.foundry
      ?.applications
      ?.sheets
      ?.AdventureImporterV2;

  if (
    typeof DocumentSheetConfig
      ?.registerSheet !== "function" ||
    typeof Adventure !== "function" ||
    typeof AdventureImporterV2 !== "function"
  ) {
    console.error(
      `${MODULE_ID} | Foundry AdventureImporterV2 sheet APIs were not available.`
    );
    return false;
  }

  DocumentSheetConfig.registerSheet(
    Adventure,
    MODULE_ID,
    AdventureImporterV2,
    {
      label:
        "Bane of Azeroth Adventure Importer",
      makeDefault: false,
    },
  );

  return true;
}

export function registerSettings() {
  game.settings.register(MODULE_ID, ADVENTURE_PROMPT_VERSION_SETTING, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

export function getContentVersion() {
  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "";
  return moduleVersion.match(/^\d+\.\d+\.\d+/)?.[0] ?? moduleVersion;
}

export async function promptAdventureImport() {
  if (!game.user.isGM) return;

  const contentVersion = getContentVersion();
  const promptedVersion = game.settings.get(
    MODULE_ID,
    ADVENTURE_PROMPT_VERSION_SETTING
  );

  if (
    promptedVersion
    && !foundry.utils.isNewerVersion(contentVersion, promptedVersion)
  ) {
    return;
  }

  const pack = game.packs.get(ADVENTURE_PACK_ID);

  if (!pack) {
    console.error(
      `${MODULE_ID} | Adventure pack ${ADVENTURE_PACK_ID} was not found.`
    );
    return;
  }

  const index = await pack.getIndex();
  const adventureId = index.contents[0]?._id;

  if (!adventureId) {
    console.error(
      `${MODULE_ID} | No Adventure document was found in ${ADVENTURE_PACK_ID}.`
    );
    return;
  }

  const adventure = await pack.getDocument(adventureId);

  if (!adventure) {
    console.error(
      `${MODULE_ID} | Adventure ${adventureId} could not be loaded.`
    );
    return;
  }

  const AdventureImporterV2 =
    globalThis.foundry
      ?.applications
      ?.sheets
      ?.AdventureImporterV2;

  if (
    typeof AdventureImporterV2 !==
      "function"
  ) {
    console.error(
      `${MODULE_ID} | Foundry AdventureImporterV2 was not available.`
    );
    return;
  }

  const importer =
    new AdventureImporterV2({
      document: adventure,
    });

  await importer.render(true);

  await game.settings.set(
    MODULE_ID,
    ADVENTURE_PROMPT_VERSION_SETTING,
    contentVersion
  );
}
