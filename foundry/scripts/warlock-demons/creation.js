import { MODULE_ID } from "../core/constants.js";
import {
  getContentKey,
} from "../core/documents.js";
import {
  calculateTokenDistance,
} from "../core/token-placement.js";
import {
  DEMONOLOGIST_CONTENT_KEY,
  WARLOCK_DEMON_DURATION,
  WARLOCK_DEMON_PLACEMENT_RANGE,
  WARLOCK_DEMON_SUMMON_TYPE,
} from "./constants.js";
import {
  findWorldWarlockDemonActor,
} from "./definitions.js";
import {
  getMessageAuthorId,
  getWarlockDemonMessageContext,
} from "./messages.js";
import {
  isWarlockDemonPositionEmpty,
} from "./placement.js";
import {
  validateWarlockDemonPlanShape,
} from "./planning.js";

export function getWarlockDemonOwnerUserIds(
  casterActor,
) {
  return Array.from(game.users ?? [])
    .filter(user => (
      !user.isGM
      && casterActor.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      )
    ))
    .map(user => user.id);
}

export async function configureCreatedWarlockDemon(
  token,
  ownerUserIds = [],
) {
  const actor = token.actor;

  if (!actor?.isToken) {
    throw new Error(
      `Created token ${token.name} has `
      + "no synthetic Actor.",
    );
  }

  const updates = {
    "ownership.default":
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
  };

  for (const userId of ownerUserIds) {
    if (
      typeof userId === "string"
      && userId
    ) {
      updates[`ownership.${userId}`] =
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }
  }

  await actor.update(updates);
}

export async function validateWarlockDemonCreationRequest(
  plan,
  position,
  requesterUserId,
) {
  validateWarlockDemonPlanShape(plan);

  const requester = game.users.get(
    requesterUserId,
  );
  if (!requester) {
    throw new Error(
      "The requesting user could not be found.",
    );
  }

  const sourceMessage = game.messages.get(
    plan.sourceMessageId,
  );
  const context =
    await getWarlockDemonMessageContext(
      sourceMessage,
    );

  if (
    !sourceMessage
    || !context
    || getContentKey(context.ability)
      !== DEMONOLOGIST_CONTENT_KEY
  ) {
    throw new Error(
      "The Demonologist ability message "
      + "could not be found.",
    );
  }

  const authorId =
    getMessageAuthorId(sourceMessage);
  if (
    authorId
    && authorId !== requesterUserId
  ) {
    throw new Error(
      "The requesting user did not create "
      + "the ability message.",
    );
  }

  const actorDocument =
    await fromUuid(plan.actorUuid);
  const actor =
    actorDocument?.actor
    ?? actorDocument;

  if (actor?.documentName !== "Actor") {
    throw new Error(
      "The caster Actor could not be found.",
    );
  }

  if (
    !requester.isGM
    && !actor.testUserPermission(
      requester,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    )
  ) {
    throw new Error(
      "The requesting user does not own "
      + "the caster Actor.",
    );
  }

  if (
    context.actor?.uuid !== plan.actorUuid
    || context.ability?.uuid
      !== plan.abilityUuid
  ) {
    throw new Error(
      "The Demonologist ability does not "
      + "match the caster Actor.",
    );
  }

  const scene = game.scenes.get(plan.sceneId);
  const casterToken = scene?.tokens.get(
    plan.casterTokenId,
  );

  if (!scene || !casterToken) {
    throw new Error(
      "The caster token or scene "
      + "could not be found.",
    );
  }

  if (
    casterToken.actor?.uuid !== plan.actorUuid
    && casterToken.actor?.id !== actor.id
  ) {
    throw new Error(
      "The caster Actor does not match "
      + "the caster token.",
    );
  }

  if (
    Number(plan.placementRange)
    !== WARLOCK_DEMON_PLACEMENT_RANGE
    || plan.duration
      !== WARLOCK_DEMON_DURATION
  ) {
    throw new Error(
      "The Warlock demon plan was manipulated.",
    );
  }

  if (
    typeof position?.x !== "number"
    || typeof position?.y !== "number"
    || !Number.isFinite(position.x)
    || !Number.isFinite(position.y)
  ) {
    throw new Error(
      "The Warlock demon position is invalid.",
    );
  }

  const demonActor =
    findWorldWarlockDemonActor(
      plan.demonKey,
    );
  if (!demonActor) {
    throw new Error(
      "The selected Warlock demon Actor "
      + "could not be found.",
    );
  }

  const previewToken =
    await demonActor.getTokenDocument(
      {
        x: position.x,
        y: position.y,
        actorLink: false,
      },
      { parent: scene },
    );

  const distance = calculateTokenDistance(
    scene,
    casterToken,
    previewToken,
  );
  if (distance > plan.placementRange) {
    throw new Error(
      `The Warlock demon position is `
      + `outside range (${distance} m).`,
    );
  }

  const size = previewToken.getSize();
  if (
    !isWarlockDemonPositionEmpty(
      scene,
      {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      },
    )
  ) {
    throw new Error(
      "The Warlock demon position is occupied.",
    );
  }

  return {
    actor,
    casterToken,
    demonActor,
    requester,
    scene,
  };
}

export async function deletePreviousWarlockDemons(
  casterActorUuid,
  currentSummonId,
) {
  const failedScenes = [];

  for (const scene of game.scenes) {
    const ids = Array.from(scene.tokens ?? [])
      .filter(token => {
        const flags =
          token.flags?.[MODULE_ID];

        return (
          flags?.summonType
            === WARLOCK_DEMON_SUMMON_TYPE
          && flags?.casterActorUuid
            === casterActorUuid
          && flags?.summonId
            !== currentSummonId
        );
      })
      .map(token => token.id);

    if (ids.length === 0) continue;

    try {
      await scene.deleteEmbeddedDocuments(
        "Token",
        ids,
      );
    } catch (error) {
      failedScenes.push(scene.name);
      console.error(
        `${MODULE_ID} | Could not remove previous `
        + `Warlock demons from ${scene.name}.`,
        error,
      );
    }
  }

  return failedScenes;
}

export async function deleteWarlockDemonsForCaster(
  casterActorUuid,
) {
  let deletedCount = 0;
  const failedScenes = [];

  for (const scene of game.scenes) {
    const ids = Array.from(scene.tokens ?? [])
      .filter(token => {
        const flags =
          token.flags?.[MODULE_ID];

        return (
          flags?.summonType
            === WARLOCK_DEMON_SUMMON_TYPE
          && flags?.casterActorUuid
            === casterActorUuid
        );
      })
      .map(token => token.id);

    if (ids.length === 0) continue;

    try {
      await scene.deleteEmbeddedDocuments(
        "Token",
        ids,
      );
      deletedCount += ids.length;
    } catch (error) {
      failedScenes.push(scene.name);
      console.error(
        `${MODULE_ID} | Could not expire `
        + `Warlock demons from ${scene.name}.`,
        error,
      );
    }
  }

  return {
    deletedCount,
    failedScenes,
  };
}

export async function executeWarlockDemonCreation(
  plan,
  position,
  requesterUserId,
) {
  const {
    actor,
    demonActor,
    scene,
  } =
    await validateWarlockDemonCreationRequest(
      plan,
      position,
      requesterUserId,
    );

  const ownerUserIds =
    getWarlockDemonOwnerUserIds(actor);
  const summonId =
    foundry.utils.randomID();
  const tokenDocument =
    await demonActor.getTokenDocument(
      {
        x: position.x,
        y: position.y,
        actorLink: false,
      },
      { parent: scene },
    );
  const data = tokenDocument.toObject();

  delete data._id;

  for (const [key, value] of Object.entries({
    summonType:
      WARLOCK_DEMON_SUMMON_TYPE,
    casterActorUuid:
      plan.actorUuid,
    sourceAbility:
      DEMONOLOGIST_CONTENT_KEY,
    sourceAbilityUuid:
      plan.abilityUuid,
    sourceMessageId:
      plan.sourceMessageId,
    summonId,
    instanceId:
      foundry.utils.randomID(),
    demonKey:
      plan.demonKey,
    duration:
      WARLOCK_DEMON_DURATION,
  })) {
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.${key}`,
      value,
    );
  }

  const [createdToken] =
    await scene.createEmbeddedDocuments(
      "Token",
      [data],
    );

  if (!createdToken) {
    throw new Error(
      "The Warlock demon token "
      + "could not be created.",
    );
  }

  try {
    await configureCreatedWarlockDemon(
      createdToken,
      ownerUserIds,
    );
  } catch (error) {
    await scene.deleteEmbeddedDocuments(
      "Token",
      [createdToken.id],
    );
    throw error;
  }

  const failedCleanupScenes =
    await deletePreviousWarlockDemons(
      plan.actorUuid,
      summonId,
    );

  return {
    summonId,
    createdTokenId: createdToken.id,
    failedCleanupScenes,
  };
}
