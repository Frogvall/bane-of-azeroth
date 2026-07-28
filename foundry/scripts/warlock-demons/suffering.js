/**
 * Temporary contract stub for Voidwalker Suffering.
 *
 * This module intentionally exposes the planned public API without
 * implementing Suffering. It exists so prerelease Foundry tests can import the
 * contract and fail on missing behavior rather than on a missing JavaScript
 * module.
 *
 * Do not register patchVoidwalkerSuffering() in the runtime entrypoint until
 * the implementation patch replaces this stub.
 */

export function splitVoidwalkerSufferingDamage(
  _damage,
) {
  return null;
}

export function findEligibleVoidwalkerForSuffering(
  _options,
) {
  return null;
}

export function resolveVoidwalkerSuffering(
  _options,
) {
  return null;
}

export function patchVoidwalkerSuffering(
  _options = {},
) {
  return {
    applyDamage: "not-implemented",
  };
}
