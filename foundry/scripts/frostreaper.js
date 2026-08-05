import {
  MODULE_ID,
} from "./core/constants.js";
import {
  getContentKey,
} from "./core/documents.js";
import {
  isFrostreaperAutomationEnabled,
} from "./automation-settings.js";

export const FROSTREAPER_CONTENT_KEY =
  "heroic-class-ability.death-knight.frostreaper";
export const FROSTREAPER_AURA_RANGE = 10;
export const FROSTREAPER_AURA_COLOR = 0x8edbff;
export const FROSTREAPER_AURA_ALPHA = 0.18;

const ACTIVATION_FLAG =
  "frostreaperActivation";
const frostreaperAuraGraphics =
  new WeakMap();

function collectionValues(
  collection,
) {
  if (!collection) {
    return [];
  }

  if (
    Array.isArray(
      collection,
    )
  ) {
    return collection;
  }

  if (
    typeof collection.values ===
      "function"
  ) {
    return Array.from(
      collection.values(),
    );
  }

  return Array.from(
    collection,
  );
}

function messageActivation(
  message,
) {
  return (
    message?.getFlag?.(
      MODULE_ID,
      ACTIVATION_FLAG,
    ) ??
    message?.flags?.[
      MODULE_ID
    ]?.[
      ACTIVATION_FLAG
    ] ??
    null
  );
}

export function extractAbilityUseItemId(
  content,
) {
  if (
    typeof content !==
      "string"
  ) {
    return null;
  }

  const tags =
    content.match(
      /<[^>]+>/g,
    ) ??
    [];

  for (const tag of tags) {
    if (
      !/\bability-use\b/i.test(
        tag,
      )
    ) {
      continue;
    }

    const match =
      tag.match(
        /\bdata-ability-id\s*=\s*["']([^"']+)["']/i,
      );

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function combatantValues(
  combat,
) {
  const turns =
    collectionValues(
      combat?.turns,
    );

  if (
    turns.length > 0
  ) {
    return turns;
  }

  return collectionValues(
    combat?.combatants,
  );
}

function combatantTokenId(
  combatant,
) {
  return (
    combatant?.tokenId ??
    combatant?.token?.id ??
    null
  );
}

function combatantActorId(
  combatant,
) {
  return (
    combatant?.actorId ??
    combatant?.actor?.id ??
    null
  );
}

function findCombatant(
  combat,
  {
    actorId,
    tokenId,
  },
) {
  const combatants =
    combatantValues(
      combat,
    );

  if (tokenId) {
    const byToken =
      combatants.find(
        combatant =>
          combatantTokenId(
            combatant,
          ) === tokenId,
      );

    if (byToken) {
      return byToken;
    }
  }

  if (actorId) {
    return (
      combatants.find(
        combatant =>
          combatantActorId(
            combatant,
          ) === actorId,
      ) ??
      null
    );
  }

  return null;
}

function combatSceneId(
  combat,
) {
  return (
    combat?.scene?.id ??
    combat?.sceneId ??
    null
  );
}

function isStartedCombat(
  combat,
) {
  if (
    !combat ||
    combat?.started === false ||
    combat?.round === null ||
    combat?.round === undefined ||
    combat?.turn === null ||
    combat?.turn === undefined
  ) {
    return false;
  }

  const round =
    Number(
      combat.round,
    );
  const turn =
    Number(
      combat.turn,
    );

  return (
    Number.isFinite(
      round,
    ) &&
    Number.isInteger(
      turn,
    ) &&
    turn >= 0
  );
}

export function createFrostreaperActivationData(
  message,
  {
    actors =
      globalThis.game?.actors,
    combat =
      globalThis.game?.combat,
  } = {},
) {
  if (
    !message ||
    !isStartedCombat(
      combat,
    )
  ) {
    return null;
  }

  const abilityId =
    extractAbilityUseItemId(
      message.content,
    );

  if (!abilityId) {
    return null;
  }

  const actorId =
    message?.speaker?.actor ??
    null;

  const actor =
    actors?.get?.(
      actorId,
    ) ??
    null;

  const ability =
    actor?.items?.get?.(
      abilityId,
    ) ??
    null;

  if (
    getContentKey(
      ability,
    ) !==
      FROSTREAPER_CONTENT_KEY
  ) {
    return null;
  }

  const speakerTokenId =
    message?.speaker?.token ??
    null;

  const speakerSceneId =
    message?.speaker?.scene ??
    null;

  const combatScene =
    combatSceneId(
      combat,
    );

  if (
    speakerSceneId &&
    combatScene &&
    speakerSceneId !==
      combatScene
  ) {
    return null;
  }

  const combatant =
    findCombatant(
      combat,
      {
        actorId,
        tokenId:
          speakerTokenId,
      },
    );

  if (!combatant) {
    return null;
  }

  const tokenId =
    speakerTokenId ??
    combatantTokenId(
      combatant,
    );
  const sceneId =
    speakerSceneId ??
    combatScene;

  if (
    !tokenId ||
    !sceneId
  ) {
    return null;
  }

  return {
    combatId:
      combat.id,
    combatantId:
      combatant.id,
    actorId,
    sceneId,
    tokenId,
    activationRound:
      Number(
        combat.round,
      ),
    activationTurn:
      Number(
        combat.turn,
      ),
    range:
      FROSTREAPER_AURA_RANGE,
  };
}

export function isFrostreaperActivationActive(
  activation,
  combat,
) {
  if (
    !activation ||
    !combat ||
    activation.combatId !==
      combat.id
  ) {
    return false;
  }

  const activationRound =
    Number(
      activation.activationRound,
    );
  const currentRound =
    Number(
      combat.round,
    );

  if (
    !Number.isFinite(
      activationRound,
    ) ||
    !Number.isFinite(
      currentRound,
    ) ||
    currentRound <
      activationRound
  ) {
    return false;
  }

  if (
    currentRound ===
      activationRound
  ) {
    return true;
  }

  const expiryRound =
    activationRound + 1;

  if (
    currentRound !==
      expiryRound
  ) {
    return false;
  }

  const turns =
    combatantValues(
      combat,
    );

  const ownerTurn =
    turns.findIndex(
      combatant =>
        combatant?.id ===
          activation.combatantId,
    );

  if (
    ownerTurn < 0
  ) {
    return false;
  }

  if (
    combat.turn === null ||
    combat.turn === undefined
  ) {
    return true;
  }

  const currentTurn =
    Number(
      combat.turn,
    );

  if (
    !Number.isInteger(
      currentTurn,
    )
  ) {
    return true;
  }

  return (
    currentTurn <
      ownerTurn
  );
}

function tokenScene(
  token,
) {
  return (
    token?.scene ??
    token?.document?.parent ??
    globalThis.canvas?.scene ??
    null
  );
}

function tokenDocumentId(
  token,
) {
  return (
    token?.document?.id ??
    token?.id ??
    null
  );
}

function latestActiveActivation(
  token,
  {
    combat,
    messages,
  },
) {
  const tokenId =
    tokenDocumentId(
      token,
    );
  const sceneId =
    tokenScene(
      token,
    )?.id ??
    null;

  if (
    !tokenId ||
    !sceneId ||
    !combat
  ) {
    return null;
  }

  const values =
    collectionValues(
      messages,
    );

  for (
    let index =
      values.length - 1;
    index >= 0;
    index -= 1
  ) {
    const activation =
      messageActivation(
        values[index],
      );

    if (
      activation?.combatId !==
        combat.id ||
      activation?.sceneId !==
        sceneId ||
      activation?.tokenId !==
        tokenId
    ) {
      continue;
    }

    if (
      isFrostreaperActivationActive(
        activation,
        combat,
      )
    ) {
      return activation;
    }
  }

  return null;
}

export function getFrostreaperAuraData(
  token,
  {
    settings =
      globalThis.game?.settings,
    combat =
      globalThis.game?.combat,
    messages =
      globalThis.game?.messages,
  } = {},
) {
  if (
    !isFrostreaperAutomationEnabled(
      settings,
    )
  ) {
    return null;
  }

  const activation =
    latestActiveActivation(
      token,
      {
        combat,
        messages,
      },
    );

  if (!activation) {
    return null;
  }

  const scene =
    tokenScene(
      token,
    );
  const gridSize =
    Number(
      scene?.grid?.size,
    );
  const gridDistance =
    Number(
      scene?.grid?.distance,
    );
  const range =
    Number(
      activation.range ??
      FROSTREAPER_AURA_RANGE,
    );

  if (
    !Number.isFinite(
      range,
    ) ||
    range <= 0 ||
    !Number.isFinite(
      gridSize,
    ) ||
    gridSize <= 0 ||
    !Number.isFinite(
      gridDistance,
    ) ||
    gridDistance <= 0
  ) {
    return null;
  }

  return {
    color:
      FROSTREAPER_AURA_COLOR,
    alpha:
      FROSTREAPER_AURA_ALPHA,
    range,
    radius:
      (
        range /
        gridDistance
      ) *
      gridSize,
    activation,
  };
}

export function clearFrostreaperAura(
  token,
) {
  const graphics =
    frostreaperAuraGraphics.get(
      token,
    );

  if (!graphics) {
    return;
  }

  frostreaperAuraGraphics.delete(
    token,
  );

  if (
    !graphics.destroyed
  ) {
    graphics.destroy();
  }
}

export function drawFrostreaperAura(
  token,
) {
  clearFrostreaperAura(
    token,
  );

  if (
    !token ||
    token.destroyed
  ) {
    return;
  }

  const aura =
    getFrostreaperAuraData(
      token,
    );

  if (!aura) {
    return;
  }

  const Graphics =
    globalThis.PIXI
      ?.Graphics;

  if (!Graphics) {
    return;
  }

  const graphics =
    new Graphics();

  graphics.lineStyle(
    2,
    aura.color,
    0.7,
  );
  graphics.beginFill(
    aura.color,
    aura.alpha,
  );
  graphics.drawCircle(
    token.w / 2,
    token.h / 2,
    aura.radius,
  );
  graphics.endFill();

  graphics.interactive =
    false;
  graphics.eventMode =
    "none";
  graphics.zIndex =
    -1000;

  token.addChildAt(
    graphics,
    0,
  );

  frostreaperAuraGraphics.set(
    token,
    graphics,
  );
}

function scheduleDrawAll() {
  const draw = () => {
    drawAllFrostreaperAuras();
  };

  if (
    typeof globalThis.requestAnimationFrame ===
      "function"
  ) {
    globalThis.requestAnimationFrame(
      draw,
    );
  } else {
    queueMicrotask(
      draw,
    );
  }
}

export function drawAllFrostreaperAuras() {
  for (
    const token of
      globalThis.canvas?.tokens
        ?.placeables ??
      []
  ) {
    drawFrostreaperAura(
      token,
    );
  }
}

export function onPreCreateFrostreaperChatMessage(
  message,
) {
  if (
    !isFrostreaperAutomationEnabled()
  ) {
    return;
  }

  const activation =
    createFrostreaperActivationData(
      message,
    );

  if (!activation) {
    return;
  }

  message.updateSource({
    [
      `flags.${MODULE_ID}.${ACTIVATION_FLAG}`
    ]:
      activation,
  });
}

export function onCreateFrostreaperChatMessage(
  message,
) {
  if (
    messageActivation(
      message,
    )
  ) {
    scheduleDrawAll();
  }
}

export function onDeleteFrostreaperChatMessage(
  message,
) {
  if (
    messageActivation(
      message,
    )
  ) {
    scheduleDrawAll();
  }
}

export function onUpdateFrostreaperToken(
  tokenDocument,
) {
  if (
    globalThis.canvas?.scene?.id !==
      tokenDocument?.parent?.id
  ) {
    return;
  }

  const token =
    tokenDocument?.object;

  if (!token) {
    return;
  }

  const draw = () => {
    if (
      !token.destroyed
    ) {
      drawFrostreaperAura(
        token,
      );
    }
  };

  if (
    typeof globalThis.requestAnimationFrame ===
      "function"
  ) {
    globalThis.requestAnimationFrame(
      draw,
    );
  } else {
    queueMicrotask(
      draw,
    );
  }
}

export function onFrostreaperCombatChange() {
  scheduleDrawAll();
}
