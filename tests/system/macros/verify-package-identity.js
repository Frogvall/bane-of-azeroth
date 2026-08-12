const checks = [];
const notes = [];

const DEVELOPMENT_ID =
  "bane-of-azeroth-dev";
const PRODUCTION_ID =
  "bane-of-azeroth"; // BOA_REBRAND_PRESERVE

const development =
  game.modules.get(
    DEVELOPMENT_ID,
  ) ??
  null;
const production =
  game.modules.get(
    PRODUCTION_ID,
  ) ??
  null;

const activeRuntimeId =
  globalThis[
    Symbol.for(
      "bane-of-azeroth.active-runtime",
    )
  ] ??
  null;

boaCheck(
  checks,
  "Development package uses a distinct Foundry package id",
  Boolean(
    development?.active &&
    development.id ===
      DEVELOPMENT_ID
  ),
  development
    ? {
        id:
          development.id,
        title:
          development.title,
        active:
          development.active,
      }
    : null,
);

boaCheck(
  checks,
  "Development package has a distinct visible title",
  development?.title ===
    "Bane of Azeroth - Development",
  development?.title ??
    null,
);

boaCheck(
  checks,
  "Development Adventure pack uses development namespace",
  Boolean(
    game.packs.get(
      "bane-of-azeroth-dev.bane-of-azeroth",
    )
  ),
  boaCollectionValues(
    game.packs,
  )
    .map(
      pack =>
        pack.collection,
    )
    .filter(
      id =>
        String(
          id,
        ).includes(
          "bane-of-azeroth",
        ),
    ),
);

boaCheck(
  checks,
  "Development runtime is authoritative",
  activeRuntimeId ===
    DEVELOPMENT_ID,
  {
    activeRuntimeId,
    productionActive:
      production?.active ??
      false,
    developmentActive:
      development?.active ??
      false,
  },
);

if (
  production?.active &&
  development?.active
) {
  notes.push(
    "Both packages are enabled. Development owns the BoA runtime and "
    + "the production runtime is inert. Disable one before the next session."
  );
} else {
  notes.push(
    "Production and Development can be installed side-by-side. "
    + "Only Development is enabled in this world."
  );
}

return boaFinish(
  "package-identity",
  "BOA DEV – Verify Package Identity",
  checks,
  notes,
);
