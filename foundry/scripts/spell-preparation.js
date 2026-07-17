import { MODULE_ID } from "./core/constants.js";

export async function ensureAutoGrantedSpellsPrepared(actor) {
  const updates = actor.items
    .filter(
      item =>
        isAutoGrantedSpell(item) &&
        item.system.memorized !== true
    )
    .map(item => ({
      _id: item.id,
      "system.memorized": true,
    }));

  if (updates.length > 0) {
    await actor.updateEmbeddedDocuments("Item", updates);
  }
}

export function isAutoGrantedSpell(item) {
  return (
    item?.type === "spell" &&
    item?.getFlag?.(MODULE_ID, "autoGranted") === true
  );
}

export function lockAutoGrantedSpellPreparation(app, html) {
  const actor = app.actor ?? app.document;
  if (actor?.documentName !== "Actor") return;

  for (const spell of actor.items.filter(isAutoGrantedSpell)) {
    const checkbox = html.querySelector(
      `tr.item[data-item-id="${spell.id}"] ` +
      `input.inline-edit[data-field="system.memorized"]`
    );

    if (!checkbox) continue;

    checkbox.checked = true;
    checkbox.disabled = true;
    checkbox.classList.add("boa-always-prepared");
    checkbox.title = game.i18n.localize(
      "BOA.spellAutomation.alwaysPreparedTooltip"
    );
  }
}

export function protectAutoGrantedSpellPreparation(
  item,
  changed
) {
  if (!isAutoGrantedSpell(item)) return;

  const flatValue = changed["system.memorized"];
  const nestedValue = foundry.utils.getProperty(
    changed,
    "system.memorized"
  );

  if (flatValue !== false && nestedValue !== false) return;

  if (Object.hasOwn(changed, "system.memorized")) {
    changed["system.memorized"] = true;
  } else {
    foundry.utils.setProperty(
      changed,
      "system.memorized",
      true
    );
  }
}
