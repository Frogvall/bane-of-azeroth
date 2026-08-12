import {
  calculateTokenDistance,
  chooseTokenPosition,
} from "../core/token-placement.js";
import {
  getPrimaryActiveGMUser,
} from "../core/users.js";

export function getElementalTotemPlacementRange(context) {
  let range = Number(context?.spell?.system?.range);
  if (!Number.isFinite(range) || range <= 0) {
    throw new Error("Elemental Totem has no valid placement range.");
  }

  if (context.criticalEffect === "doubleRange") {
    range *= 2;
  }

  return range;
}

export function createElementalTotemPreviewDocument(
  scene,
  definitions,
) {
  return new foundry.documents.TokenDocument(
    {
      name: "Elemental Totem Preview",
      x: 0,
      y: 0,
      width: definitions.tokenWidth,
      height: definitions.tokenHeight,
      actorLink: false,
    },
    { parent: scene },
  );
}

export const calculateElementalTotemDistance =
  calculateTokenDistance;

export async function collectElementalTotemPositions(
  plan,
  definitions,
) {
  const scene = game.scenes.get(plan.sceneId);
  if (!scene || canvas.scene?.id !== scene.id) {
    throw new Error(
      "The scene where Elemental Totem was cast is not active.",
    );
  }

  const casterToken = scene.tokens.get(plan.casterTokenId);
  if (!casterToken) {
    throw new Error(
      "The caster token could not be found in the active scene.",
    );
  }
  if (!game.user.isGM && !getPrimaryActiveGMUser()) {
    throw new Error(
      "An active GM is required to create Elemental Totem tokens.",
    );
  }

  const previewToken = createElementalTotemPreviewDocument(
    scene,
    definitions,
  );
  const positions = [];

  for (let index = 0; index < plan.totemTypes.length; index += 1) {
    const totemType = plan.totemTypes[index];
    const totem = definitions.totems.find(
      entry => entry.key === totemType,
    );
    if (!totem) {
      throw new Error(`Unknown Elemental Totem type: ${totemType}`);
    }

    const position = await chooseTokenPosition({
      scene,
      originToken: casterToken,
      previewToken,
      maxDistance: plan.placementRange,
      validColor: totem.auraColor,
      onPrompt: () => {
        ui.notifications.info(
          game.i18n.format(
            "BOA.dialog.elementalTotem.placementPrompt",
            {
              name: totem.name,
              index: index + 1,
              total: plan.totemTypes.length,
              range: plan.placementRange,
            },
          ),
        );
      },
      onInvalid: candidate => {
        ui.notifications.warn(
          game.i18n.format(
            "BOA.dialog.elementalTotem.placementOutOfRange",
            {
              distance: candidate.distance,
              range: plan.placementRange,
            },
          ),
        );
      },
    });

    if (!position) return null;
    positions.push(position);
  }

  return positions;
}
