const checks = [];
const notes = [];
const testKey = "great-helm-firearms";
const testName = "BOA DEV – Verify Great Helm / Firearms";

try {
  const helmModule = await import(
    `/modules/${BOA_TEST_MODULE_ID}/scripts/great-helm-firearms.js`
  );

  // BOA Firearms base-skill regression contract.
  const freshActors = [];
  try {
    for (
      const actorType
      of [
        "character",
        "npc",
      ]
    ) {
      const freshActor =
        await Actor.create(
          {
            name:
              `[BOA TEST] Firearms ${actorType} ` +
              foundry.utils.randomID(6),
            type:
              actorType,
            flags: {
              [BOA_TEST_MODULE_ID]: {
                [BOA_TEST_FIXTURE_FLAG]:
                  true,
              },
            },
          },
          {
            renderSheet:
              false,
          },
        );

      freshActors.push(
        freshActor,
      );

      const firearms =
        freshActor.items.find(
          item =>
            item.type ===
              "skill" &&
            item.system
              ?.skillType ===
              "weapon" &&
            item.name ===
              helmModule
                .GREAT_HELM_FIREARMS_BANE,
        ) ??
        null;

      boaCheck(
        checks,
        `New Dragonbane ${actorType} includes Firearms in its embedded skills`,
        Boolean(
          firearms,
        ),
        freshActor.items
          .filter(
            item =>
              item.type ===
                "skill" &&
              item.system
                ?.skillType ===
                "weapon",
          )
          .map(
            item =>
              item.name,
          ),
      );

      boaCheck(
        checks,
        `New Dragonbane ${actorType} includes Firearms in its weapon skills`,
        Boolean(
          freshActor.system
            ?.weaponSkills
            ?.some(
              skill =>
                skill.name ===
                  helmModule
                    .GREAT_HELM_FIREARMS_BANE,
            ),
        ),
        freshActor.system
          ?.weaponSkills
          ?.map(
            skill =>
              skill.name,
          ) ??
          [],
      );
    }

    boaCheck(
      checks,
      "New Dragonbane Actors include Firearms in their weapon skills",
      freshActors.length ===
        2,
      freshActors.map(
        actor => ({
          type:
            actor.type,
          id:
            actor.id,
        }),
      ),
    );
  } finally {
    for (
      const freshActor
      of freshActors
        .reverse()
    ) {
      try {
        await freshActor.delete();
      } catch (error) {
        boaCheck(
          checks,
          `Temporary Firearms ${freshActor.type} cleanup succeeded`,
          false,
          error.message,
        );
      }
    }
  }

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
