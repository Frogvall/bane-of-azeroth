import {
  SUMMON_DURATION_SHIFT,
} from "../core/summon-duration-lifecycle.js";

export const DEMONOLOGIST_CONTENT_KEY =
  "heroic-class-ability.warlock.demonologist";

export const WARLOCK_DEMON_SUMMON_TYPE =
  "warlock-demon";

export const WARLOCK_DEMON_PLACEMENT_RANGE = 10;

export const WARLOCK_DEMON_DURATION = SUMMON_DURATION_SHIFT;

export const WARLOCK_DEMON_DEFINITIONS = Object.freeze([
  {
    key: "felhunter",
    name: "Felhunter",
    contentKey: "actors.summoned-monsters.felhunter",
    previewColor: "#65a30d",
  },
  {
    key: "imp",
    name: "Imp",
    contentKey: "actors.summoned-monsters.imp",
    previewColor: "#ea580c",
  },
  {
    key: "sayaad",
    name: "Sayaad",
    contentKey: "actors.summoned-monsters.sayaad",
    previewColor: "#be185d",
  },
  {
    key: "voidwalker",
    name: "Voidwalker",
    contentKey: "actors.summoned-monsters.voidwalker",
    previewColor: "#7c3aed",
  },
]);
