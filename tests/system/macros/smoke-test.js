const checks = [];
const notes = [];

const module = game.modules.get(BOA_TEST_MODULE_ID);

boaCheckEqual(
  checks,
  "Bane of Azeroth is active",
  module?.active,
  true
);

boaCheckEqual(
  checks,
  "Dragonbane is the active system",
  game.system.id,
  "dragonbane"
);

boaCheck(
  checks,
  "Adventure compendium is available",
  game.packs.has(
    "bane-of-azeroth.bane-of-azeroth"
  )
);

boaCheck(
  checks,
  "Developer-test compendium is available",
  game.packs.has(BOA_TEST_PACK_ID)
);

boaCheck(
  checks,
  "Module socket support is enabled",
  module?.socket === true ||
    module?.manifest?.socket === true,
  String(
    module?.socket ??
    module?.manifest?.socket ??
    "not exposed"
  )
);

const featureKeys = [
  "ammunition",
  "armorPiercing",
  "freehanded",
  "returning",
  "scattershot",
];

for (const key of featureKeys) {
  const localizationKey =
    CONFIG.DoD?.weaponFeatureTypes?.[key];

  boaCheck(
    checks,
    `Weapon feature is registered: ${key}`,
    typeof localizationKey === "string" &&
      localizationKey.length > 0,
    localizationKey ?? ""
  );

  if (typeof localizationKey === "string") {
    const localized = game.i18n.localize(
      localizationKey
    );

    boaCheck(
      checks,
      `Weapon feature is localized: ${key}`,
      localized !== localizationKey,
      localized
    );
  }
}

notes.push(
  `Module ${module?.version ?? "unknown"}; ` +
  `Foundry ${game.version ?? "unknown"}; ` +
  `Dragonbane ${game.system.version ?? "unknown"}.`
);

return boaFinish(
  "smoke",
  "BOA DEV – Smoke Test",
  checks,
  notes
);
