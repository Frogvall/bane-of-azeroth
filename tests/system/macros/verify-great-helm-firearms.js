const checks = [];
const notes = [];
const testKey = "great-helm-firearms";
const testName = "BOA DEV – Verify Great Helm / Firearms";

try {
  const helmModule = await import(
    `/modules/${BOA_TEST_MODULE_ID}/scripts/great-helm-firearms.js`
  );

  const reconcileResult =
    await helmModule.reconcileGreatHelmFirearms();

  boaCheck(
    checks,
    "Great Helm / Firearms reconciliation inspected real world Items",
    Number(
      reconcileResult?.checked ??
        0,
    ) > 0,
    reconcileResult,
  );

  const canonicalBase = new Set(
    helmModule.GREAT_HELM_CANONICAL_BANES,
  );
  const candidates =
    helmModule.getGreatHelmFirearmsCandidates();

  const compatibleGreatHelms =
    candidates.filter(item => {
      if (
        item?.type !== "helmet" ||
        item?.name !== "Great Helm" ||
        Number(
          item?.system?.rating,
        ) !== 2
      ) {
        return false;
      }

      const banes =
        helmModule.parseGreatHelmBanes(
          item.system?.banes,
        );
      const withoutFirearms =
        banes.filter(
          bane =>
            bane !==
              helmModule.GREAT_HELM_FIREARMS_BANE,
        );

      return (
        withoutFirearms.length ===
          canonicalBase.size &&
        withoutFirearms.every(
          bane =>
            canonicalBase.has(
              bane,
            )
        )
      );
    });

  if (
    compatibleGreatHelms.length === 0
  ) {
    boaSkip(
      checks,
      "Canonical English Great Helm receives Firearms bane",
      "No canonical English Great Helm is currently imported into world Items or Actor Items.",
    );
  } else {
    for (
      const helm
      of compatibleGreatHelms
    ) {
      const banes =
        helmModule.parseGreatHelmBanes(
          helm.system?.banes,
        );

      boaCheck(
        checks,
        `${helm.uuid ?? helm.name} includes Firearms exactly once`,
        banes.filter(
          bane =>
            bane ===
              helmModule.GREAT_HELM_FIREARMS_BANE,
        ).length === 1,
        banes.join(", "),
      );
    }
  }
} catch (error) {
  boaCheck(
    checks,
    "Great Helm / Firearms runtime integration loaded",
    false,
    error.stack ?? error.message,
  );
}

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
