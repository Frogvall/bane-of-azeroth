import {
  isVulperaLuckAutomationEnabled,
} from "./automation-settings.js";

export const VULPERA_LUCK_WP_COST = 3;

export const VULPERA_LUCK_ROLL_OPTION =
  "bane-of-azeroth.vulperaLuckUsed";

/* RED-phase stub: structurally valid, behavior intentionally absent. */
export function canUseVulperaLuck(
  message,
) {
  void message;

  if (
    !isVulperaLuckAutomationEnabled()
  ) {
    return false;
  }

  return false;
}

/* RED-phase stub: intentionally pays no WP and creates no reroll. */
export async function useVulperaLuck(
  message,
  {
    confirm = true,
  } = {},
) {
  void message;
  void confirm;

  return {
    handled: false,
    test: null,
  };
}
