import { MODULE_ID } from "./core/constants.js";
import { getContentKey } from "./core/documents.js";
import { isPrimaryActiveGM } from "./core/users.js";

import { parseHexColor } from "./core/colors.js";

import {
  buildTotemOptions,
  getElementalTotemDefinitions,
  getTotemName,
  loadElementalTotemDefinitions,
} from "./elemental-totems/definitions.js";
import {
  buildElementalTotemPlan,
  validateElementalTotemPlanShape,
} from "./elemental-totems/planning.js";

import {
  getPrimaryActiveGMUser,
} from "./core/users.js";
import {
  calculateElementalTotemDistance,
  collectElementalTotemPositions,
  createElementalTotemPreviewDocument,
  getElementalTotemPlacementRange,
} from "./elemental-totems/placement.js";

import {
  ELEMENTAL_TOTEM_CONTENT_KEY,
} from "./elemental-totems/constants.js";
import {
  getElementalTotemMessageContext,
  isElementalTotemSpellTest,
} from "./elemental-totems/messages.js";
import {
  configureCreatedElementalTotem,
  deletePreviousElementalTotems,
  executeElementalTotemCreation,
  validateElementalTotemCreationRequest,
} from "./elemental-totems/creation.js";

import {
  registerElementalTotemSocket,
  requestElementalTotemCreation,
} from "./elemental-totems/socket.js";

export {
  onCreateElementalTotemChatMessage,
  onUpdateElementalTotemChatMessage,
  shouldStartElementalTotemDialog,
} from "./elemental-totems/dialogs.js";

export {
  registerElementalTotemSocket,
};

export {
  configureCreatedElementalTotem,
  deletePreviousElementalTotems,
  executeElementalTotemCreation,
  validateElementalTotemCreationRequest,
};

export { getPrimaryActiveGMUser };

export {
  getElementalTotemPlacementRange,
};

export {
  buildTotemOptions,
  loadElementalTotemDefinitions,
  buildElementalTotemPlan,
  validateElementalTotemPlanShape,
};

export {
  drawAllElementalTotemAuras,
  drawElementalTotemAura,
  getElementalTotemAuraData,
  onDeleteElementalTotemAura,
  onUpdateElementalTotemAura,
} from "./elemental-totems/aura.js";

function redrawElementalTotemAuraForDocument(tokenDocument) {
  if (canvas.scene?.id !== tokenDocument?.parent?.id) return;

  const token = tokenDocument.object;
  if (!token) return;

  /*
   * Let Foundry apply its own token refresh flags before measuring the
   * token's current pixel width and height.
   */
  requestAnimationFrame(() => {
    if (!token.destroyed) {
      drawElementalTotemAura(token);
    }
  });
}

