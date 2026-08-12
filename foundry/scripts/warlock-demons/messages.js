import { MODULE_ID } from "../core/constants.js";
import {
  getContentKey,
} from "../core/documents.js";
import {
  DEMONOLOGIST_CONTENT_KEY,
} from "./constants.js";

export function getMessageAuthorId(message) {
  return (
    message?.author?.id
    ?? message?.user?.id
    ?? message?.user
    ?? null
  );
}

export function getDocumentUuidsFromMessage(
  message,
) {
  const content = String(message?.content ?? "");
  const values = new Set();

  for (
    const match of content.matchAll(
      /@UUID\[([^\]]+)\]/g,
    )
  ) {
    values.add(match[1]);
  }

  for (
    const match of content.matchAll(
      /data-uuid=["']([^"']+)["']/g,
    )
  ) {
    values.add(match[1]);
  }

  return [...values];
}

export async function getWarlockDemonMessageContext(
  message,
  {
    fromUuidFn = globalThis.fromUuid,
    actors = globalThis.game?.actors,
  } = {},
) {
  if (!message || typeof fromUuidFn !== "function") {
    return null;
  }

  try {
    for (
      const uuid of getDocumentUuidsFromMessage(
        message,
      )
    ) {
      const document = await fromUuidFn(uuid);
      const ability =
        document?.documentName === "Item"
          ? document
          : null;

      if (
        ability
        && getContentKey(ability)
          === DEMONOLOGIST_CONTENT_KEY
      ) {
        const actor =
          ability.parent?.documentName === "Actor"
            ? ability.parent
            : actors?.get?.(
              message.speaker?.actor,
            ) ?? null;

        return {
          ability,
          actor,
        };
      }
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not resolve Demonologist `
      + "message context.",
      error,
      message,
    );
  }

  return null;
}

export async function isDemonologistAbilityMessage(
  message,
  options = {},
) {
  return Boolean(
    await getWarlockDemonMessageContext(
      message,
      options,
    ),
  );
}
