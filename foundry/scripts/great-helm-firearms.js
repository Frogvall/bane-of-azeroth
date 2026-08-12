import {
  isPrimaryActiveGM,
} from "./core/users.js";

export const GREAT_HELM_CANONICAL_BANES = Object.freeze([
  "Awareness",
  "Bows",
  "Crossbows",
  "Slings",
]);

export const GREAT_HELM_FIREARMS_BANE = "Firearms";

function collectionValues(collection) {
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

export function parseGreatHelmBanes(
  value,
) {
  return String(
    value ??
      "",
  )
    .split(",")
    .map(
      entry =>
        entry.trim(),
    )
    .filter(Boolean);
}

function sameStringSet(
  left,
  right,
) {
  if (
    left.length !==
      right.length
  ) {
    return false;
  }

  const rightSet =
    new Set(
      right,
    );

  return left.every(
    entry =>
      rightSet.has(
        entry,
      ),
  );
}

export function isCanonicalEnglishGreatHelm(
  item,
) {
  if (
    item?.type !==
      "helmet" ||
    item?.name !==
      "Great Helm" ||
    Number(
      item?.system?.rating,
    ) !==
      2
  ) {
    return false;
  }

  const banes =
    parseGreatHelmBanes(
      item?.system?.banes,
    );

  if (
    banes.includes(
      GREAT_HELM_FIREARMS_BANE,
    )
  ) {
    return false;
  }

  return sameStringSet(
    banes,
    GREAT_HELM_CANONICAL_BANES,
  );
}

export function buildGreatHelmFirearmsBanes(
  item,
) {
  if (
    !isCanonicalEnglishGreatHelm(
      item,
    )
  ) {
    return null;
  }

  return [
    ...parseGreatHelmBanes(
      item?.system?.banes,
    ),
    GREAT_HELM_FIREARMS_BANE,
  ].join(", ");
}

export async function reconcileGreatHelmFirearmsItem(
  item,
  {
    authorityCheck =
      isPrimaryActiveGM,
  } = {},
) {
  if (
    !authorityCheck()
  ) {
    return false;
  }

  const banes =
    buildGreatHelmFirearmsBanes(
      item,
    );

  if (!banes) {
    return false;
  }

  await item.update(
    {
      "system.banes":
        banes,
    },
    {
      boaGreatHelmFirearmsReconcile:
        true,
    },
  );

  return true;
}

export function getGreatHelmFirearmsCandidates(
  {
    items =
      globalThis.game?.items,
    actors =
      globalThis.game?.actors,
  } = {},
) {
  const candidates =
    [];
  const seen =
    new Set();

  const add =
    item => {
      if (!item) {
        return;
      }

      const key =
        item.uuid ??
        item.id ??
        item;

      if (
        seen.has(
          key,
        )
      ) {
        return;
      }

      seen.add(
        key,
      );
      candidates.push(
        item,
      );
    };

  for (
    const item
    of collectionValues(
      items,
    )
  ) {
    add(
      item,
    );
  }

  for (
    const actor
    of collectionValues(
      actors,
    )
  ) {
    for (
      const item
      of collectionValues(
        actor?.items,
      )
    ) {
      add(
        item,
      );
    }
  }

  return candidates;
}

export async function reconcileGreatHelmFirearms(
  {
    authorityCheck =
      isPrimaryActiveGM,
    items =
      globalThis.game?.items,
    actors =
      globalThis.game?.actors,
  } = {},
) {
  if (
    !authorityCheck()
  ) {
    return {
      checked:
        0,
      updated:
        0,
    };
  }

  const candidates =
    getGreatHelmFirearmsCandidates({
      items,
      actors,
    });
  let updated =
    0;

  for (
    const item
    of candidates
  ) {
    if (
      await reconcileGreatHelmFirearmsItem(
        item,
        {
          authorityCheck:
            () => true,
        },
      )
    ) {
      updated +=
        1;
    }
  }

  return {
    checked:
      candidates.length,
    updated,
  };
}

export async function onCreateGreatHelmFirearmsItem(
  item,
) {
  return reconcileGreatHelmFirearmsItem(
    item,
  );
}
