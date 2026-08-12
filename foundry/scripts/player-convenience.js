import {
  openDruidFormSwitchDialog,
} from "./druid-form-lifecycle.js";
import {
  openManagedEffectEndDialog,
} from "./managed-effect-lifecycle.js";

function values(collection) {
  if (!collection) {
    return [];
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

function uniqueActors(
  tokens,
) {
  const actors =
    [];
  const ids =
    new Set();

  for (
    const token
    of values(
      tokens,
    )
  ) {
    const actor =
      token?.actor ??
      token?.document?.actor ??
      null;

    if (!actor) {
      continue;
    }

    const key =
      actor.id ??
      actor.uuid ??
      actor;

    if (
      ids.has(
        key,
      )
    ) {
      continue;
    }

    ids.add(
      key,
    );
    actors.push(
      actor,
    );
  }

  return actors;
}

function canManageActor(
  actor,
  user,
  ownerLevel =
    globalThis.CONST
      ?.DOCUMENT_OWNERSHIP_LEVELS
      ?.OWNER ??
    3,
) {
  if (
    !actor ||
    !user
  ) {
    return false;
  }

  if (
    user.isGM ===
      true
  ) {
    return true;
  }

  if (
    actor.isOwner ===
      true
  ) {
    return true;
  }

  return (
    actor.testUserPermission?.(
      user,
      ownerLevel,
    ) === true
  );
}

function notify(
  level,
  message,
  notifications =
    globalThis.ui
      ?.notifications,
) {
  notifications?.[
    level
  ]?.(
    message,
  );
}

function formValue(
  form,
  name,
) {
  return (
    form?.elements
      ?.namedItem?.(
        name,
      )?.value ??
    ""
  );
}

async function chooseOwnedActor(
  actors,
  {
    DialogV2 =
      globalThis.foundry
        ?.applications
        ?.api
        ?.DialogV2,
    notifications =
      globalThis.ui
        ?.notifications,
  } = {},
) {
  if (
    typeof DialogV2?.wait !==
      "function"
  ) {
    notify(
      "warn",
      "Select a token or assign a character before using this macro.",
      notifications,
    );
    return null;
  }

  const options =
    actors
      .map(
        actor =>
          `<option value="${actor.id}">${actor.name}</option>`,
      )
      .join(
        "",
      );

  const form =
    await DialogV2.wait({
      window: {
        title:
          "Choose Character",
      },
      content:
        `<form class="boa-player-convenience-actor-dialog">`
        + `<div class="form-group"><label>Character</label>`
        + `<select name="actorId">${options}</select>`
        + `</div></form>`,
      buttons: [
        {
          action:
            "choose",
          label:
            "Choose",
          default:
            true,
          callback:
            (
              _event,
              button,
            ) =>
              button?.form ??
              null,
        },
        {
          action:
            "cancel",
          label:
            "Cancel",
        },
      ],
      close:
        () => null,
    });

  if (!form) {
    return null;
  }

  const actorId =
    formValue(
      form,
      "actorId",
    );

  return (
    actors.find(
      actor =>
        actor?.id ===
          actorId,
    ) ??
    null
  );
}

export async function resolvePlayerConvenienceActor(
  {
    user =
      globalThis.game?.user,
    actors =
      globalThis.game?.actors,
    controlledTokens =
      globalThis.canvas
        ?.tokens
        ?.controlled ??
      [],
    DialogV2 =
      globalThis.foundry
        ?.applications
        ?.api
        ?.DialogV2,
    notifications =
      globalThis.ui
        ?.notifications,
    ownerLevel =
      globalThis.CONST
        ?.DOCUMENT_OWNERSHIP_LEVELS
        ?.OWNER ??
      3,
  } = {},
) {
  if (!user) {
    notify(
      "error",
      "A Foundry user is required to use this macro.",
      notifications,
    );
    return null;
  }

  const selectedActors =
    uniqueActors(
      controlledTokens,
    );

  if (
    user.isGM ===
      true
  ) {
    if (
      selectedActors.length !==
        1
    ) {
      notify(
        "warn",
        "Select exactly one token before using this macro.",
        notifications,
      );
      return null;
    }

    return (
      selectedActors[
        0
      ] ??
      null
    );
  }

  const ownedSelected =
    selectedActors.filter(
      actor =>
        canManageActor(
          actor,
          user,
          ownerLevel,
        ),
    );

  if (
    ownedSelected.length ===
      1
  ) {
    return (
      ownedSelected[
        0
      ] ??
      null
    );
  }

  const assigned =
    user.character ??
    null;

  if (
    assigned &&
    canManageActor(
      assigned,
      user,
      ownerLevel,
    )
  ) {
    return assigned;
  }

  const ownedCharacters =
    values(
      actors,
    ).filter(
      actor =>
        actor?.type ===
          "character" &&
        canManageActor(
          actor,
          user,
          ownerLevel,
        ),
    );

  if (
    ownedCharacters.length ===
      1
  ) {
    return (
      ownedCharacters[
        0
      ] ??
      null
    );
  }

  if (
    ownedCharacters.length >
      1
  ) {
    return chooseOwnedActor(
      ownedCharacters,
      {
        DialogV2,
        notifications,
      },
    );
  }

  notify(
    "warn",
    "Select an owned token or assign a character before using this macro.",
    notifications,
  );
  return null;
}

export async function runChangeDruidFormMacro(
  options = {},
) {
  const actor =
    await resolvePlayerConvenienceActor(
      options,
    );

  if (!actor) {
    return false;
  }

  const openDialog =
    options.openDruidFormSwitchDialog ??
    openDruidFormSwitchDialog;

  return openDialog(
    actor,
  );
}

export async function runEndEffectsMacro(
  options = {},
) {
  const actor =
    await resolvePlayerConvenienceActor(
      options,
    );

  if (!actor) {
    return false;
  }

  const openDialog =
    options.openManagedEffectEndDialog ??
    openManagedEffectEndDialog;

  return openDialog(
    actor,
  );
}
