import {
  chooseTokenPosition,
} from "../core/token-placement.js";
import {
  getPrimaryActiveGMUser,
} from "../core/users.js";
import {
  getWarlockDemonDefinition,
  findWorldWarlockDemonActor,
} from "./definitions.js";

function tokenRectangle(
  token,
  gridSize,
) {
  const size =
    typeof token.getSize === "function"
      ? token.getSize()
      : {
          width:
            Number(token.width ?? 1)
            * gridSize,
          height:
            Number(token.height ?? 1)
            * gridSize,
        };

  return {
    left: Number(token.x ?? 0),
    top: Number(token.y ?? 0),
    right:
      Number(token.x ?? 0)
      + Number(size.width),
    bottom:
      Number(token.y ?? 0)
      + Number(size.height),
  };
}

function rectanglesOverlap(
  left,
  right,
) {
  return (
    left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top
  );
}

export function isWarlockDemonPositionEmpty(
  scene,
  candidate,
  {
    ignoredTokenIds = [],
  } = {},
) {
  const ignored = new Set(ignoredTokenIds);
  const candidateRectangle = {
    left: candidate.x,
    top: candidate.y,
    right:
      candidate.x + candidate.width,
    bottom:
      candidate.y + candidate.height,
  };

  return !Array.from(scene.tokens ?? [])
    .filter(token => !ignored.has(token.id))
    .some(token =>
      rectanglesOverlap(
        candidateRectangle,
        tokenRectangle(
          token,
          scene.grid.size,
        ),
      )
    );
}

export async function createWarlockDemonPreviewDocument(
  scene,
  demonActor,
) {
  return demonActor.getTokenDocument(
    {
      x: 0,
      y: 0,
      actorLink: false,
    },
    { parent: scene },
  );
}

export async function collectWarlockDemonPosition(
  plan,
  {
    choosePositionFn = chooseTokenPosition,
    findActorFn =
      findWorldWarlockDemonActor,
  } = {},
) {
  const scene = game.scenes.get(plan.sceneId);

  if (!scene || canvas.scene?.id !== scene.id) {
    throw new Error(
      "The scene where Demonologist was used "
      + "is not active.",
    );
  }

  const casterToken = scene.tokens.get(
    plan.casterTokenId,
  );
  if (!casterToken) {
    throw new Error(
      "The caster token could not be found "
      + "in the active scene.",
    );
  }

  if (
    !game.user.isGM
    && !getPrimaryActiveGMUser()
  ) {
    throw new Error(
      "An active GM is required to create "
      + "Warlock demon tokens.",
    );
  }

  const definition =
    getWarlockDemonDefinition(
      plan.demonKey,
    );
  const demonActor = findActorFn(
    plan.demonKey,
  );

  if (!definition || !demonActor) {
    throw new Error(
      "The selected Warlock demon Actor "
      + "could not be found.",
    );
  }

  const previewToken =
    await createWarlockDemonPreviewDocument(
      scene,
      demonActor,
    );

  return choosePositionFn({
    scene,
    originToken: casterToken,
    previewToken,
    maxDistance: plan.placementRange,
    validColor: definition.previewColor,
    validateCandidate: candidate => {
      const empty =
        isWarlockDemonPositionEmpty(
          scene,
          candidate,
        );

      return {
        valid: empty,
        invalidReason:
          empty ? null : "occupied",
      };
    },
    onPrompt: () => {
      ui.notifications.info(
        game.i18n.format(
          "BOA.dialog.warlockDemon.placementPrompt",
          {
            name: definition.name,
            range: plan.placementRange,
          },
        ),
      );
    },
    onInvalid: candidate => {
      const key =
        candidate.invalidReason === "occupied"
          ? "BOA.dialog.warlockDemon.placementOccupied"
          : "BOA.dialog.warlockDemon.placementOutOfRange";

      ui.notifications.warn(
        game.i18n.format(
          key,
          {
            distance: candidate.distance,
            range: plan.placementRange,
          },
        ),
      );
    },
  });
}
