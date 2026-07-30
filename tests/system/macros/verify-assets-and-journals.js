const checks = [];
const notes = [];

const DISPLAY_TABLE_PREFIX = [
  "@DisplayTable",
  "[RollTable.",
].join("");
const SYMBOLIC_DISPLAY_PREFIX = [
  "@DisplayRef",
  "[",
].join("");
const SYMBOLIC_REFERENCE_PREFIX = [
  "@Ref",
  "[",
].join("");
const UUID_ITEM_PREFIX = [
  "@UUID",
  "[Item.",
].join("");

function occurrences(value, marker) {
  return String(value ?? "").split(marker).length - 1;
}

function worldJournal(contentKey) {
  return boaCollectionValues(game.journal).find(
    journal => boaContentKey(journal) === contentKey
  );
}

function journalPage(journal, contentKey) {
  return boaCollectionValues(journal?.pages).find(
    page => boaContentKey(page) === contentKey
  );
}

function htmlAssetPaths(html) {
  const paths = new Set();
  const pattern =
    /(?:src|href)=["'](modules\/bane-of-azeroth\/[^"']+)["']/g;

  for (const match of String(html ?? "").matchAll(pattern)) {
    paths.add(match[1]);
  }

  return paths;
}

async function probeAsset(path) {
  const url = foundry.utils.getRoute(path);

  try {
    let response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
    });

    if (
      response.status === 405
      || response.status === 501
    ) {
      response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          Range: "bytes=0-0",
        },
      });

      try {
        await response.body?.cancel();
      } catch {
        // The response may already be complete.
      }
    }

    return {
      path,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    return {
      path,
      ok: false,
      status: 0,
      statusText:
        error?.message ?? String(error),
    };
  }
}

try {
  const [
    kinContent,
    abilityContent,
    journalAssets,
  ] = await Promise.all([
    boaFetchJson("content/kin.json"),
    boaFetchJson(
      "content/heroic-class-abilities.json"
    ),
    boaFetchJson(
      "config/journal-assets.json"
    ),
  ]);

  const kinDefinitions =
    kinContent.kin ?? [];
  const classDefinitions =
    abilityContent.classes ?? [];
  const manifestAssets =
    journalAssets.assets ?? [];

  boaCheckEqual(
    checks,
    "Kin source contains 16 entries",
    kinDefinitions.length,
    16
  );
  boaCheckEqual(
    checks,
    "Heroic Class Ability source contains 13 classes",
    classDefinitions.length,
    13
  );
  boaCheck(
    checks,
    "Journal asset manifest contains generated assets",
    manifestAssets.length > 0,
    `${manifestAssets.length} assets`
  );

  const iconPaths = new Set();
  const abilityDefinitions = [];

  for (const kin of kinDefinitions) {
    if (typeof kin.image === "string") {
      iconPaths.add(kin.image);
    }
  }

  for (const classEntry of classDefinitions) {
    for (const ability of classEntry.abilities ?? []) {
      abilityDefinitions.push({
        classKey: classEntry.key,
        ...ability,
      });

      if (typeof ability.image === "string") {
        iconPaths.add(ability.image);
      }
    }
  }

  boaCheckEqual(
    checks,
    "Heroic Class Ability source contains 52 abilities",
    abilityDefinitions.length,
    52
  );
  boaCheckEqual(
    checks,
    "Content source references 29 dedicated Kin and class icons",
    iconPaths.size,
    29
  );

  const playerOptions = worldJournal(
    "journal.player-options"
  );
  const credits = worldJournal(
    "journal.credits"
  );

  boaCheck(
    checks,
    "Imported Player Options Journal exists",
    Boolean(playerOptions),
    "journal.player-options"
  );
  boaCheck(
    checks,
    "Imported Credits Journal exists",
    Boolean(credits),
    "journal.credits"
  );

  const kinPage = journalPage(
    playerOptions,
    "journal-page.player-options.kin"
  );
  const derivedPage = journalPage(
    playerOptions,
    "journal-page.player-options.derived-ratings"
  );
  const creditsPage = journalPage(
    credits,
    "journal-page.credits.credits"
  );

  boaCheck(
    checks,
    "Player Options contains the Kin page",
    Boolean(kinPage)
  );
  boaCheck(
    checks,
    "Player Options contains the Derived Ratings page",
    Boolean(derivedPage)
  );
  boaCheck(
    checks,
    "Credits contains its generated page",
    Boolean(creditsPage)
  );

  const kinHtml =
    kinPage?.text?.content ?? "";
  const derivedHtml =
    derivedPage?.text?.content ?? "";
  const creditsHtml =
    creditsPage?.text?.content ?? "";

  if (kinPage) {
    boaCheckEqual(
      checks,
      "Kin page contains 19 rendered RollTables",
      occurrences(
        kinHtml,
        DISPLAY_TABLE_PREFIX
      ),
      19
    );
    boaCheckEqual(
      checks,
      "Kin page contains 16 illustrations",
      occurrences(kinHtml, "<img "),
      16
    );
    boaCheck(
      checks,
      "Kin page has no unresolved symbolic references",
      !kinHtml.includes(
        SYMBOLIC_DISPLAY_PREFIX
      )
      && !kinHtml.includes(
        SYMBOLIC_REFERENCE_PREFIX
      )
    );
  }

  if (derivedPage) {
    boaCheckEqual(
      checks,
      "Derived Ratings contains one table",
      occurrences(derivedHtml, "<table"),
      1
    );
    boaCheck(
      checks,
      "Derived Ratings uses display-table markup",
      derivedHtml.includes(
        '<div class="display-table">'
      )
    );
  }

  const classesPage = journalPage(
    playerOptions,
    "journal-page.player-options.heroic-class-abilities"
  );

  boaCheck(
    checks,
    "Player Options contains the Heroic Class Abilities page",
    Boolean(classesPage)
  );

  function normalizedText(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function textFromHtml(value) {
    const element = document.createElement("div");
    element.innerHTML = String(value ?? "");
    return normalizedText(
      element.textContent ?? ""
    );
  }

  function abilityDescriptionText(ability) {
    if (
      typeof ability.descriptionHtml === "string"
      && ability.descriptionHtml.trim() !== ""
    ) {
      return textFromHtml(
        ability.descriptionHtml
      );
    }

    if (Array.isArray(ability.description)) {
      return normalizedText(
        ability.description.join(" ")
      );
    }

    return "";
  }

  const classPageProblems = [];
  let classHeadingCount = 0;
  let classIllustrationCount = 0;
  let classAbilityBoxCount = 0;
  let classAbilityLinkCount = 0;
  let classAbilityDescriptionCount = 0;

  const classesHtml =
    classesPage?.text?.content ?? "";
  const classesText = classesPage
    ? textFromHtml(classesHtml)
    : "";

  for (const classEntry of classDefinitions) {
    const heading =
      `<h2>${classEntry.name}</h2>`;

    if (classesHtml.includes(heading)) {
      classHeadingCount += 1;
    } else {
      classPageProblems.push(
        `${classEntry.name}: missing class heading`
      );
    }

    const imagePath =
      "modules/bane-of-azeroth/"
      + "assets/journals/classes/"
      + `${classEntry.key.replaceAll("-", "_")}.webp`;

    if (
      classesHtml.includes(
        `src="${imagePath}"`
      )
    ) {
      classIllustrationCount += 1;
    } else {
      classPageProblems.push(
        `${classEntry.name}: missing class illustration`
      );
    }

    for (const ability of classEntry.abilities ?? []) {
      classAbilityBoxCount += 1;

      const contentKey =
        "heroic-class-ability."
        + `${classEntry.key}.${ability.key}`;
      const item = boaFindWorldItem(
        contentKey,
        "ability"
      );

      if (!item) {
        classPageProblems.push(
          `${classEntry.name}: missing ${contentKey}`
        );
        continue;
      }

      const linkMarker =
        `${UUID_ITEM_PREFIX}${item.id}]`;

      if (classesHtml.includes(linkMarker)) {
        classAbilityLinkCount += 1;
      } else {
        classPageProblems.push(
          `${classEntry.name}: missing link to ${ability.name}`
        );
      }

      const description =
        abilityDescriptionText(ability);
      const descriptionMarker =
        description.slice(0, 80);

      if (
        descriptionMarker !== ""
        && classesText.includes(
          descriptionMarker
        )
      ) {
        classAbilityDescriptionCount += 1;
      } else {
        classPageProblems.push(
          `${classEntry.name}: missing description for ${ability.name}`
        );
      }
    }
  }

  boaCheckEqual(
    checks,
    "Heroic Class Abilities contains 13 class headings",
    classHeadingCount,
    13
  );
  boaCheckEqual(
    checks,
    "Heroic Class Abilities contains 13 class illustrations",
    classIllustrationCount,
    13
  );
  boaCheckEqual(
    checks,
    "Heroic Class Abilities contains 52 overview boxes",
    occurrences(
      classesHtml,
      '<blockquote class="info">'
    ),
    classAbilityBoxCount
  );
  boaCheckEqual(
    checks,
    "Ability box titles link to all 52 Ability Items",
    classAbilityLinkCount,
    52
  );
  boaCheckEqual(
    checks,
    "Ability boxes contain all 52 descriptions",
    classAbilityDescriptionCount,
    52
  );
  boaCheck(
    checks,
    "Classes are readable on one page with complete linked Ability boxes",
    classPageProblems.length === 0,
    classPageProblems.join("\n")
  );

  if (creditsPage) {
    boaCheck(
      checks,
      "Credits references the Bane of Azeroth logo",
      creditsHtml.includes(
        "modules/bane-of-azeroth/"
        + "assets/adventure/logo.webp"
      )
    );
  }

  if (playerOptions) {
    boaCheckEqual(
      checks,
      "Player Options has exactly three pages",
      boaCollectionValues(
        playerOptions.pages
      ).length,
      3
    );
    boaCheckEqual(
      checks,
      "Player Options is in the blue Bane of Azeroth Journal folder",
      {
        name: playerOptions.folder?.name,
        color: boaColorHex(
          playerOptions.folder?.color
        ),
      },
      {
        name: "Bane of Azeroth",
        color: "#0000ff",
      }
    );
  }

  const itemProblems = [];

  for (const kin of kinDefinitions) {
    const contentKey = `kin.${kin.key}`;
    const item = boaFindWorldItem(
      contentKey,
      "kin"
    );

    if (!item) {
      itemProblems.push(`${contentKey}: missing`);
    } else if (item.img !== kin.image) {
      itemProblems.push(
        `${contentKey}: ${item.img} != ${kin.image}`
      );
    }
  }

  for (const ability of abilityDefinitions) {
    const contentKey =
      "heroic-class-ability."
      + `${ability.classKey}.`
      + `${ability.key}`;
    const item = boaFindWorldItem(
      contentKey,
      "ability"
    );

    if (!item) {
      itemProblems.push(`${contentKey}: missing`);
    } else if (item.img !== ability.image) {
      itemProblems.push(
        `${contentKey}: ${item.img} != ${ability.image}`
      );
    }
  }

  boaCheck(
    checks,
    "Imported Kin and Heroic Class Ability Items use their source icons",
    itemProblems.length === 0,
    itemProblems.join("\n")
  );

  const kinTables = boaCollectionValues(
    game.tables
  ).filter(
    table =>
      boaContentKey(table).startsWith(
        "tables.kin."
      )
  );
  const nameTables = kinTables.filter(
    table =>
      boaContentKey(table).startsWith(
        "tables.kin.name."
      )
  );
  const documentTables = kinTables.filter(
    table =>
      !boaContentKey(table).startsWith(
        "tables.kin.name."
      )
  );

  boaCheckEqual(
    checks,
    "Imported world contains 19 Kin RollTables",
    kinTables.length,
    19
  );
  boaCheckEqual(
    checks,
    "Imported world contains 16 Kin name tables",
    nameTables.length,
    16
  );
  boaCheckEqual(
    checks,
    "Imported world contains 3 linked Kin tables",
    documentTables.length,
    3
  );

  const textProblems = [];
  const linkProblems = [];
  let textResultCount = 0;
  let linkedResultCount = 0;

  for (const table of nameTables) {
    for (
      const result
      of boaCollectionValues(table.results)
    ) {
      textResultCount += 1;

      if (
        result.type !== "text"
        || String(result.description ?? "")
          .trim() === ""
        || String(result.name ?? "") !== ""
      ) {
        textProblems.push(
          `${table.name}: ${result.id ?? "unknown"}`
        );
      }
    }
  }

  for (const table of documentTables) {
    for (
      const result
      of boaCollectionValues(table.results)
    ) {
      if (result.type !== "document") {
        linkProblems.push(
          `${table.name}: non-document result`
        );
        continue;
      }

      linkedResultCount += 1;
      const document = await fromUuid(
        result.documentUuid
      );

      if (!document) {
        linkProblems.push(
          `${table.name}: ${result.documentUuid}`
        );
      } else if (document.img !== result.img) {
        linkProblems.push(
          `${table.name}: icon differs from `
          + `${result.documentUuid}`
        );
      }
    }
  }

  boaCheck(
    checks,
    "Kin name table results contain visible text",
    textResultCount > 0
    && textProblems.length === 0,
    textProblems.join("\n")
  );
  boaCheck(
    checks,
    "Kin document results resolve and use linked Item icons",
    linkedResultCount > 0
    && linkProblems.length === 0,
    linkProblems.join("\n")
  );

  const htmlPaths = new Set();

  for (
    const journal
    of boaCollectionValues(game.journal)
  ) {
    if (
      !boaContentKey(journal).startsWith(
        "journal."
      )
    ) {
      continue;
    }

    for (
      const page
      of boaCollectionValues(journal.pages)
    ) {
      for (
        const path
        of htmlAssetPaths(
          page.text?.content
        )
      ) {
        htmlPaths.add(path);
      }
    }
  }

  const requiredAssets = new Set([
    ...manifestAssets
      .map(asset => asset.modulePath)
      .filter(
        path =>
          typeof path === "string"
      ),
    ...iconPaths,
    ...htmlPaths,
  ]);

  const invalidPaths = [
    ...requiredAssets,
  ].filter(
    path =>
      !path.startsWith(
        "modules/bane-of-azeroth/"
      )
  );

  boaCheck(
    checks,
    "All tested assets belong to the module",
    invalidPaths.length === 0,
    invalidPaths.join("\n")
  );

  const assetResults = await Promise.all(
    [...requiredAssets]
      .sort()
      .map(probeAsset)
  );
  const missingAssets = assetResults.filter(
    result => !result.ok
  );

  boaCheck(
    checks,
    "All manifest, journal, Kin, and class assets are available",
    missingAssets.length === 0,
    missingAssets
      .map(
        result =>
          `${result.path}: `
          + `${result.status} `
          + `${result.statusText}`
      )
      .join("\n")
  );

  notes.push(
    `${assetResults.length} unique assets checked.`
  );
  notes.push(
    `${linkedResultCount} linked Kin results checked.`
  );
  notes.push(
    `${textResultCount} Kin name results checked.`
  );
} catch (error) {
  boaCheck(
    checks,
    "Asset and Journal verification completed",
    false,
    error.stack ?? error.message
  );
}

return boaFinish(
  "assets-journals",
  "BOA DEV – Verify Assets and Journals",
  checks,
  notes
);
