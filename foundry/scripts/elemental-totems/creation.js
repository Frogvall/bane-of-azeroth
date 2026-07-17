import { MODULE_ID } from "../core/constants.js";
import { getContentKey } from "../core/documents.js";
import {
  ELEMENTAL_TOTEM_CONTENT_KEY,
} from "./constants.js";
import {
  getElementalTotemDefinitions,
} from "./definitions.js";
import {
  getElementalTotemMessageContext,
  isElementalTotemSpellTest,
} from "./messages.js";
import {
  validateElementalTotemPlanShape,
} from "./planning.js";
import {
  calculateElementalTotemDistance,
  createElementalTotemPreviewDocument,
  getElementalTotemPlacementRange,
} from "./placement.js";

function findWorldElementalTotemActor(totemType) {
  const contentKey = `actors.elemental-totems.${totemType}`;

  return game.actors.find(
    actor => getContentKey(actor) === contentKey
  ) ?? null;
}

export async function validateElementalTotemCreationRequest(
  plan,
  positions,
  requesterUserId
) {
  const definitions = await getElementalTotemDefinitions();
  validateElementalTotemPlanShape(plan, definitions);

  const requester = game.users.get(requesterUserId);
  if (!requester) {
    throw new Error("The requesting user could not be found.");
  }

  const sourceMessage = game.messages.get(plan.sourceMessageId);
  const context = getElementalTotemMessageContext(sourceMessage);
  if (
    !sourceMessage ||
    !context ||
    !isElementalTotemSpellTest(sourceMessage, context) ||
    context.success !== true
  ) {
    throw new Error(
      "The successful Elemental Totem spell message was not found."
    );
  }

  const messageAuthorId =
    sourceMessage.author?.id ??
    sourceMessage.user?.id ??
    sourceMessage.user ??
    null;
  if (messageAuthorId && messageAuthorId !== requesterUserId) {
    throw new Error(
      "The requesting user did not create the spell message."
    );
  }

  const actorDocument = await fromUuid(plan.actorUuid);
  const actor = actorDocument?.actor ?? actorDocument;
  if (actor?.documentName !== "Actor") {
    throw new Error("The caster Actor could not be found.");
  }
  if (
    !requester.isGM &&
    !actor.testUserPermission(
      requester,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    )
  ) {
    throw new Error(
      "The requesting user does not own the caster Actor."
    );
  }

  const scene = game.scenes.get(plan.sceneId);
  const casterToken = scene?.tokens.get(plan.casterTokenId);
  if (!scene || !casterToken) {
    throw new Error("The caster token or scene could not be found.");
  }

  const contextActorUuid = context.actor?.uuid ?? null;
  if (
    contextActorUuid !== plan.actorUuid ||
    (
      casterToken.actor?.uuid !== plan.actorUuid &&
      casterToken.actor?.id !== actor.id
    )
  ) {
    throw new Error(
      "The caster Actor does not match the caster token."
    );
  }

  const expectedPlacementRange =
    getElementalTotemPlacementRange(context);
  if (Number(plan.placementRange) !== expectedPlacementRange) {
    throw new Error("The Elemental Totem placement range is invalid.");
  }

  if (
    !Array.isArray(positions) ||
    positions.length !== plan.totemTypes.length
  ) {
    throw new Error(
      "The number of positions does not match the number of totems."
    );
  }

  const previewToken = createElementalTotemPreviewDocument(
    scene,
    definitions
  );

  for (const position of positions) {
    if (
      typeof position?.x !== "number" ||
      typeof position?.y !== "number" ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      throw new Error("An Elemental Totem position is invalid.");
    }

    previewToken.updateSource({
      x: position.x,
      y: position.y,
    });
    const distance = calculateElementalTotemDistance(
      scene,
      casterToken,
      previewToken
    );
    if (distance > expectedPlacementRange) {
      throw new Error(
        `An Elemental Totem position is outside range (${distance} m).`
      );
    }
  }

  const totemActors = plan.totemTypes.map(totemType => {
    const actorTemplate = findWorldElementalTotemActor(totemType);
    if (!actorTemplate) {
      throw new Error(
        `The ${totemType} Elemental Totem Actor was not found.`
      );
    }
    return actorTemplate;
  });

  return {
    definitions,
    scene,
    casterToken,
    actor,
    totemActors,
  };
}

export async function configureCreatedElementalTotem(
  token,
  plan
) {
  const actor = token.actor;
  if (!actor?.isToken) {
    throw new Error(
      `Created token ${token.name} has no synthetic Actor.`
    );
  }

  await actor.update({
    "ownership.default":
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    "system.hitPoints.base": plan.hitPoints,
    "system.hitPoints.max": plan.hitPoints,
    "system.hitPoints.value": plan.hitPoints,
  });

  const armor = actor.items.find(
    item =>
      item.type === "armor" &&
      (
        getContentKey(item).endsWith(".armor") ||
        item.name === "Totem Armor"
      )
  );
  if (!armor) {
    throw new Error(`${token.name} has no Totem Armor item.`);
  }

  await armor.update({
    "system.rating": plan.armorRating,
    "system.worn": true,
  });
}

export async function deletePreviousElementalTotems(
  casterActorUuid,
  currentCastId
) {
  const failedScenes = [];

  for (const scene of game.scenes) {
    const tokenIds = scene.tokens
      .filter(token => {
        const flags = token.flags?.[MODULE_ID];
        return (
          flags?.summonType === "elementalTotem" &&
          flags?.casterActorUuid === casterActorUuid &&
          flags?.castId !== currentCastId
        );
      })
      .map(token => token.id);

    if (tokenIds.length === 0) continue;

    try {
      await scene.deleteEmbeddedDocuments("Token", tokenIds);
    } catch (error) {
      failedScenes.push(scene.name);
      console.error(
        `${MODULE_ID} | Could not remove previous Elemental ` +
        `Totems from ${scene.name}.`,
        error
      );
    }
  }

  return failedScenes;
}

export async function executeElementalTotemCreation(
  plan,
  positions,
  requesterUserId
) {
  const {
    scene,
    totemActors,
  } = await validateElementalTotemCreationRequest(
    plan,
    positions,
    requesterUserId
  );

  const castId = foundry.utils.randomID();
  const tokenData = [];

  for (let index = 0; index < totemActors.length; index += 1) {
    const actorTemplate = totemActors[index];
    const totemType = plan.totemTypes[index];
    const position = positions[index];
    const tokenDocument = await actorTemplate.getTokenDocument(
      {
        x: position.x,
        y: position.y,
        actorLink: false,
      },
      { parent: scene }
    );
    const data = tokenDocument.toObject();

    delete data._id;

    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.summonType`,
      "elementalTotem"
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.casterActorUuid`,
      plan.actorUuid
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.sourceSpell`,
      ELEMENTAL_TOTEM_CONTENT_KEY
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.sourceMessageId`,
      plan.sourceMessageId
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.castId`,
      castId
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.instanceId`,
      foundry.utils.randomID()
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.totemType`,
      totemType
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.auraRange`,
      plan.auraRange
    );

    tokenData.push(data);
  }

  const createdTokens = await scene.createEmbeddedDocuments(
    "Token",
    tokenData
  );

  try {
    for (const token of createdTokens) {
      await configureCreatedElementalTotem(token, plan);
    }
  } catch (error) {
    await scene.deleteEmbeddedDocuments(
      "Token",
      createdTokens.map(token => token.id)
    );
    throw error;
  }

  const failedCleanupScenes = await deletePreviousElementalTotems(
    plan.actorUuid,
    castId
  );

  return {
    castId,
    createdTokenIds: createdTokens.map(token => token.id),
    failedCleanupScenes,
  };
}
