import {
  MODULE_ID,
} from "./core/constants.js";

const ARTWORK_FLAG =
  "druidFormArtwork";
const STATE_FLAG =
  "druidFormState";

const FALLBACK_ARTWORK =
  "modules/bane-of-azeroth/assets/icons/classes/druid.webp";

const PROFILE_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      key: "travelPl1",
      spellContentKey:
        "spells.savage-incarnation",
      powerLevel: 1,
      form: "travel",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "travelPl2",
      spellContentKey:
        "spells.savage-incarnation",
      powerLevel: 2,
      form: "travel",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "travelPl3",
      spellContentKey:
        "spells.savage-incarnation",
      powerLevel: 3,
      form: "travel",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "bear",
      spellContentKey:
        "spells.feral-incarnation",
      powerLevel: null,
      form: "bear",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "cat",
      spellContentKey:
        "spells.feral-incarnation",
      powerLevel: null,
      form: "cat",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "tree",
      spellContentKey:
        "spells.incarnation-of-harmony",
      powerLevel: null,
      form: "tree",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "moonkin",
      spellContentKey:
        "spells.incarnation-of-the-stars",
      powerLevel: null,
      form: "moonkin",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
  ]);

function cloneProfile(
  profile,
) {
  return {
    ...profile,
  };
}

function profileDefinition(
  key,
) {
  return PROFILE_DEFINITIONS.find(
    profile =>
      profile.key === key,
  ) ?? null;
}

function itemContentKey(
  item,
) {
  if (!item) {
    return null;
  }

  if (
    typeof item.getFlag ===
      "function"
  ) {
    const value =
      item.getFlag(
        MODULE_ID,
        "contentKey",
      );

    if (
      typeof value ===
        "string" &&
      value.length > 0
    ) {
      return value;
    }
  }

  const value =
    item.flags?.[
      MODULE_ID
    ]?.contentKey;

  return (
    typeof value ===
      "string" &&
    value.length > 0
  )
    ? value
    : null;
}

function actorOwnsSpell(
  actor,
  spellContentKey,
) {
  return [
    ...(
      actor?.items ??
      []
    ),
  ].some(
    item =>
      itemContentKey(
        item,
      ) ===
        spellContentKey,
  );
}

function nonEmptyString(
  value,
) {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  )
    ? value.trim()
    : null;
}

function artworkOverrides(
  actor,
) {
  const value =
    actor?.getFlag?.(
      MODULE_ID,
      ARTWORK_FLAG,
    ) ??
    actor?.flags?.[
      MODULE_ID
    ]?.[
      ARTWORK_FLAG
    ];

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return {};
  }

  return value;
}

async function persistArtwork(
  actor,
  overrides,
) {
  if (!actor) {
    return false;
  }

  if (
    Object.keys(
      overrides,
    ).length ===
      0 &&
    typeof actor.unsetFlag ===
      "function"
  ) {
    await actor.unsetFlag(
      MODULE_ID,
      ARTWORK_FLAG,
    );
    return true;
  }

  if (
    typeof actor.setFlag !==
      "function"
  ) {
    return false;
  }

  await actor.setFlag(
    MODULE_ID,
    ARTWORK_FLAG,
    overrides,
  );

  return true;
}

export function getDruidFormProfileDefinitions() {
  return PROFILE_DEFINITIONS.map(
    cloneProfile,
  );
}

export function getAvailableDruidFormProfiles(
  actor,
) {
  return PROFILE_DEFINITIONS
    .filter(
      profile =>
        actorOwnsSpell(
          actor,
          profile.spellContentKey,
        ),
    )
    .map(
      cloneProfile,
    );
}

export function getDruidFormArtwork(
  actor,
  profileKey,
) {
  const profile =
    profileDefinition(
      profileKey,
    );

  if (!profile) {
    return null;
  }

  const stored =
    artworkOverrides(
      actor,
    )?.[
      profileKey
    ] ?? {};

  const customPortrait =
    nonEmptyString(
      stored.portrait,
    );
  const customToken =
    nonEmptyString(
      stored.token,
    );

  const portrait =
    customPortrait ??
    profile.defaultPortrait;

  const token =
    customToken ??
    customPortrait ??
    profile.defaultToken ??
    portrait;

  return {
    key:
      profile.key,
    portrait,
    token,
    portraitIsCustom:
      Boolean(
        customPortrait,
      ),
    tokenIsCustom:
      Boolean(
        customToken,
      ),
  };
}

export async function setDruidFormArtwork(
  actor,
  profileKey,
  artwork = {},
) {
  const available =
    getAvailableDruidFormProfiles(
      actor,
    ).some(
      profile =>
        profile.key ===
          profileKey,
    );

  if (!available) {
    return false;
  }

  const overrides = {
    ...artworkOverrides(
      actor,
    ),
  };

  const current = {
    ...(
      overrides[
        profileKey
      ] ??
      {}
    ),
  };

  if (
    Object.hasOwn(
      artwork,
      "portrait",
    )
  ) {
    const portrait =
      nonEmptyString(
        artwork.portrait,
      );

    if (portrait) {
      current.portrait =
        portrait;
    } else {
      delete current.portrait;
    }
  }

  if (
    Object.hasOwn(
      artwork,
      "token",
    )
  ) {
    const token =
      nonEmptyString(
        artwork.token,
      );

    if (token) {
      current.token =
        token;
    } else {
      delete current.token;
    }
  }

  if (
    Object.keys(
      current,
    ).length ===
      0
  ) {
    delete overrides[
      profileKey
    ];
  } else {
    overrides[
      profileKey
    ] =
      current;
  }

  return persistArtwork(
    actor,
    overrides,
  );
}

export async function resetDruidFormArtwork(
  actor,
  profileKey,
) {
  if (
    !profileDefinition(
      profileKey,
    )
  ) {
    return false;
  }

  const overrides = {
    ...artworkOverrides(
      actor,
    ),
  };

  delete overrides[
    profileKey
  ];

  return persistArtwork(
    actor,
    overrides,
  );
}

export function getDruidFormState(
  actor,
) {
  const state =
    actor?.getFlag?.(
      MODULE_ID,
      STATE_FLAG,
    ) ??
    actor?.flags?.[
      MODULE_ID
    ]?.[
      STATE_FLAG
    ];

  return {
    currentForm:
      (
        typeof state
          ?.currentForm ===
          "string" &&
        state.currentForm
          .length >
          0
      )
        ? state.currentForm
        : "humanoid",
    activations:
      (
        state
          ?.activations &&
        typeof state
          .activations ===
          "object" &&
        !Array.isArray(
          state.activations,
        )
      )
        ? {
            ...state
              .activations,
          }
        : {},
  };
}
