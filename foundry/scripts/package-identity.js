import {
  MODULE_ID,
} from "./core/constants.js";

export const PRODUCTION_MODULE_ID =
  "bane-of-azeroth"; // BOA_REBRAND_PRESERVE
export const DEVELOPMENT_MODULE_ID =
  "bane-of-azeroth-dev";

const ACTIVE_RUNTIME_SYMBOL =
  Symbol.for(
    "bane-of-azeroth.active-runtime",
  );
const CONFLICT_WARNING_SYMBOL =
  Symbol.for(
    "bane-of-azeroth.package-conflict-warning",
  );

function moduleById(
  modules,
  id,
) {
  return (
    modules?.get?.(
      id,
    ) ??
    null
  );
}

export function getPackageCoexistenceState({
  modules =
    globalThis.game?.modules,
  moduleId =
    MODULE_ID,
} = {}) {
  const production =
    moduleById(
      modules,
      PRODUCTION_MODULE_ID,
    );
  const development =
    moduleById(
      modules,
      DEVELOPMENT_MODULE_ID,
    );

  const productionActive =
    production?.active === true;
  const developmentActive =
    development?.active === true;

  return {
    moduleId,
    production,
    development,
    productionActive,
    developmentActive,
    bothActive:
      productionActive &&
      developmentActive,
    preferredRuntimeId:
      developmentActive
        ? DEVELOPMENT_MODULE_ID
        : productionActive
          ? PRODUCTION_MODULE_ID
          : moduleId,
  };
}

export function shouldActivatePackageRuntime(
  options = {},
) {
  const state =
    getPackageCoexistenceState(
      options,
    );

  return !(
    state.moduleId ===
      PRODUCTION_MODULE_ID &&
    state.developmentActive
  );
}

export function claimPackageRuntime(
  options = {},
) {
  const state =
    getPackageCoexistenceState(
      options,
    );

  if (
    !shouldActivatePackageRuntime(
      options,
    )
  ) {
    return false;
  }

  globalThis[
    ACTIVE_RUNTIME_SYMBOL
  ] =
    state.moduleId;

  return true;
}

export function getClaimedPackageRuntimeId() {
  return (
    globalThis[
      ACTIVE_RUNTIME_SYMBOL
    ] ??
    null
  );
}

export function notifyPackageConflictIfNeeded({
  modules =
    globalThis.game?.modules,
  moduleId =
    MODULE_ID,
  notifications =
    globalThis.ui
      ?.notifications,
  consoleApi =
    globalThis.console,
} = {}) {
  const state =
    getPackageCoexistenceState({
      modules,
      moduleId,
    });

  if (
    !state.bothActive ||
    moduleId !==
      DEVELOPMENT_MODULE_ID
  ) {
    return false;
  }

  if (
    globalThis[
      CONFLICT_WARNING_SYMBOL
    ] === true
  ) {
    return false;
  }

  globalThis[
    CONFLICT_WARNING_SYMBOL
  ] =
    true;

  const message =
    "Both Bane of Azeroth and Bane of Azeroth - Development are enabled. "
    + "The Development runtime is active and the production runtime is inert. "
    + "Disable one of them in Module Management before the next session.";

  consoleApi?.warn?.(
    `${DEVELOPMENT_MODULE_ID} | ${message}`,
  );

  notifications?.warn?.(
    message,
  );

  return true;
}
