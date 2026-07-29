const checks = [];
const notes = [];

if (!game.user.isGM) {
  boaCheck(
    checks,
    "External UUID verification is run by a game master",
    false,
    "World JournalEntry documents may not be visible to players.",
  );

  return boaFinish(
    "external-uuids",
    "BOA DEV – Verify External UUIDs",
    checks,
    notes,
  );
}

const externalUuidConfiguration =
  __BOA_EXTERNAL_UUID_CONFIGURATION__;

function installedSourcePackage(source) {
  if (source.packageType === "module") {
    return game.modules.get(
      source.packageId,
    ) ?? null;
  }

  if (
    source.packageType === "system"
    && game.system?.id === source.packageId
  ) {
    return game.system;
  }

  return null;
}

function verifiedSourceVersion(
  source,
  verifiedEnvironment,
) {
  if (source.packageType === "module") {
    return (
      verifiedEnvironment
        .modules?.[source.packageId]
        ?.version
      ?? null
    );
  }

  if (
    source.packageType === "system"
    && verifiedEnvironment.system?.id
      === source.packageId
  ) {
    return (
      verifiedEnvironment.system.version
      ?? null
    );
  }

  return null;
}

const {
  verifiedEnvironment,
  sources,
  references,
} = externalUuidConfiguration;

for (
  const [sourceKey, source]
  of Object.entries(sources)
    .sort(([left], [right]) =>
      left.localeCompare(right)
    )
) {
  const installed =
    installedSourcePackage(source);
  const installedVersion =
    installed?.version ?? null;
  const verifiedVersion =
    verifiedSourceVersion(
      source,
      verifiedEnvironment,
    );

  if (!boaCheck(
    checks,
    `External source exists: ${sourceKey}`,
    Boolean(installed),
    {
      packageId: source.packageId,
      packageType: source.packageType,
    },
  )) {
    continue;
  }

  if (source.packageType === "module") {
    boaCheck(
      checks,
      `External source is active: ${sourceKey}`,
      installed.active === true,
      {
        packageId: source.packageId,
        installedVersion,
      },
    );
  }

  if (
    verifiedVersion
    && installedVersion
    && installedVersion !== verifiedVersion
  ) {
    notes.push(
      `${source.packageId}: installed version `
      + `${installedVersion}; whole-module `
      + `verified version ${verifiedVersion}. `
      + "UUID compatibility is tested below, "
      + "but full module compatibility has not "
      + "yet been declared for this version.",
    );
  } else if (
    verifiedVersion
    && installedVersion === verifiedVersion
  ) {
    notes.push(
      `${source.packageId}: installed version `
      + `${installedVersion} matches the `
      + "whole-module verified environment.",
    );
  }
}

for (
  const [referenceKey, reference]
  of Object.entries(references)
    .sort(([left], [right]) =>
      left.localeCompare(right)
    )
) {
  const [
    documentUuid,
    anchor = "",
  ] = reference.uuid.split(
    "#",
    2,
  );

  let document = null;
  let resolutionError = null;

  try {
    document = await fromUuid(
      documentUuid,
    );
  } catch (error) {
    resolutionError = error;
  }

  if (!boaCheck(
    checks,
    `External UUID resolves: ${referenceKey}`,
    Boolean(document),
    {
      uuid: reference.uuid,
      error:
        resolutionError?.stack
        ?? resolutionError?.message
        ?? null,
    },
  )) {
    continue;
  }

  boaCheckEqual(
    checks,
    `External UUID type is correct: ${referenceKey}`,
    document.documentName,
    reference.documentType,
  );

  if (anchor) {
    notes.push(
      `${referenceKey}: document resolved; `
      + `link anchor #${anchor} is retained for `
      + "Foundry journal navigation.",
    );
  }
}

boaCheckEqual(
  checks,
  "All registered external UUIDs were checked",
  Object.keys(references).length,
  1,
);

return boaFinish(
  "external-uuids",
  "BOA DEV – Verify External UUIDs",
  checks,
  notes,
);