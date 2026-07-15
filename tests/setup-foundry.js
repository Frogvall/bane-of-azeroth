import { vi } from "vitest";

function getProperty(object, path) {
  return String(path)
    .split(".")
    .reduce(
      (current, key) =>
        current === null || current === undefined
          ? undefined
          : current[key],
      object
    );
}

function setProperty(object, path, value) {
  const keys = String(path).split(".");
  const finalKey = keys.pop();
  let current = object;

  for (const key of keys) {
    if (
      current[key] === null ||
      typeof current[key] !== "object"
    ) {
      current[key] = {};
    }
    current = current[key];
  }

  current[finalKey] = value;
  return true;
}

globalThis.Hooks = {
  once: vi.fn(),
  on: vi.fn(),
};

globalThis.CONFIG = {
  DoD: {
    weaponFeatureTypes: {},
  },
};

globalThis.CONST = {
  DOCUMENT_OWNERSHIP_LEVELS: {
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3,
  },
};

globalThis.foundry = {
  applications: {
    api: {
      DialogV2: {
        confirm: vi.fn(),
        input: vi.fn(),
      },
    },
  },

  dice: {
    terms: {
      Die: class Die {
        constructor(number = 1) {
          this.number = number;
        }
      },
    },
  },

  utils: {
    deepClone: structuredClone,
    getProperty,
    getRoute: value => value,
    isNewerVersion: vi.fn(() => false),
    randomID: vi.fn(() => "test-random-id"),
    setProperty,
  },
};

globalThis.game = {
  actors: [],
  i18n: {
    format: (key, data = {}) =>
      `${key}:${JSON.stringify(data)}`,
    localize: key => key,
  },
  items: [],
  messages: new Map(),
  modules: new Map(),
  packs: new Map(),
  scenes: new Map(),
  settings: {
    get: vi.fn(),
    register: vi.fn(),
    set: vi.fn(),
  },
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
  },
  system: {
    id: "dragonbane",
  },
  user: {
    active: true,
    id: "test-user",
    isGM: true,
  },
  users: [],
};

globalThis.canvas = {
  scene: null,
  tokens: {
    controlled: [],
    placeables: [],
  },
};

globalThis.document = {
  addEventListener: vi.fn(),
};

globalThis.ui = {
  notifications: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
};

globalThis.PIXI = {
  Graphics: class Graphics {},
};

globalThis.requestAnimationFrame = callback => {
  callback();
  return 1;
};

globalThis.cancelAnimationFrame = vi.fn();

globalThis.Roll = class Roll {
  constructor(formula) {
    this.formula = formula;
    this.terms = [];
    this.total = 0;
  }

  async roll() {
    return this;
  }
};
