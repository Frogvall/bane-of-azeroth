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

boaCheck(
  checks,
  "Development package uses a distinct Foundry package id",
  Boolean(
    development?.active &&
    development.id === DEVELOPMENT_ID
  ),
  development
    ? {
        id: development.id,
        title: development.title,
        active: development.active,
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
      pack => pack.collection,
    )
    .filter(
      id =>
        String(id).includes(
          "bane-of-azeroth",
        ),
    ),
);

boaCheck(
  checks,
  "Production and development packages are not both active",
  !production?.active,
  production
    ? {
        id: production.id,
        title: production.title,
        active: production.active,
      }
    : "Production package is not installed.",
);

notes.push(
  "Manual: install both production and development manifests. "
  + "Verify Foundry Setup shows two separate module entries and enable "
  + "only Bane of Azeroth - Development in the development world."
);

return boaFinish(
  "package-identity",
  "BOA DEV – Verify Package Identity",
  checks,
  notes,
);
