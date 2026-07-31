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

const REFERENCE_LABEL_PATTERN = new RegExp(
  "@(?:UUID|Ref)\\[[^\\]]+\\]\\{([^{}]+)\\}",
  "g"
);

function referenceLabels(value) {
  return String(value ?? "").replace(
    REFERENCE_LABEL_PATTERN,
    "$1"
  );
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

  const illustrationPage = journalPage(
    playerOptions,
    "journal-page.player-options.illustration"
  );
  const introductionPage = journalPage(
    playerOptions,
    "journal-page.player-options.introduction"
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
  const classesPage = journalPage(
    playerOptions,
    "journal-page.player-options.heroic-class-abilities"
  );
  const gearPage = journalPage(
    playerOptions,
    "journal-page.player-options.gear"
  );

  boaCheck(
    checks,
    "Player Options contains the Illustration page",
    Boolean(illustrationPage)
  );
  boaCheck(
    checks,
    "Player Options contains the Introduction page",
    Boolean(introductionPage)
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
    "Player Options contains the Heroic Class Abilities page",
    Boolean(classesPage)
  );
  boaCheck(
    checks,
    "Player Options contains the Gear page",
    Boolean(gearPage)
  );
  boaCheck(
    checks,
    "Credits contains its generated page",
    Boolean(creditsPage)
  );

  const introductionHtml =
    introductionPage?.text?.content ?? "";
  const kinHtml =
    kinPage?.text?.content ?? "";
  const derivedHtml =
    derivedPage?.text?.content ?? "";
  const creditsHtml =
    creditsPage?.text?.content ?? "";
  const gearHtml =
    gearPage?.text?.content ?? "";

  if (illustrationPage) {
    boaCheckEqual(
      checks,
      "Player Options opens with the cover Illustration",
      {
        type: illustrationPage.type,
        titleShown:
          illustrationPage.title?.show,
        src: illustrationPage.src,
        caption:
          illustrationPage.image?.caption ?? "",
      },
      {
        type: "image",
        titleShown: false,
        src:
          "modules/bane-of-azeroth/"
          + "assets/journals/cover/"
          + "bane_of_azeroth_cover.webp",
        caption: "",
      }
    );
  }

  if (introductionPage) {
    const introductionProblems = [];

    for (const marker of [
      "Warcraft is one of the most beloved "
        + "and enduring fantasy franchises",
      "Why Azeroth?",
      "What is this book?",
      "Design Goals",
      "Buy-In and Creativity",
      "Contact and More",
      "The goal is a game that feels like "
        + "Warcraft in the ways that matter "
        + "most to your table.",
    ]) {
      if (!introductionHtml.includes(marker)) {
        introductionProblems.push(
          `missing ${marker}`
        );
      }
    }

    if (
      introductionHtml.includes(
        "Creating a Hero of Azeroth"
      )
    ) {
      introductionProblems.push(
        "temporary custom introduction remains"
      );
    }

    boaCheck(
      checks,
      "Introduction mirrors the book chapter",
      introductionProblems.length === 0,
      introductionProblems.join("\n")
    );
  }

  if (creditsPage) {
    const headingElement =
      document.createElement("div");
    headingElement.innerHTML = creditsHtml;

    const creditsHeadings = [
      ...headingElement.querySelectorAll("h4"),
    ].map(
      heading =>
        String(heading.textContent ?? "")
          .trim()
    );

    boaCheckEqual(
      checks,
      "Credits uses readable heading capitalization",
      creditsHeadings,
      [
        "Author",
        "Version",
        "Credits",
        "Artwork",
        "Made With",
      ]
    );
  }

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

    const headingElement =
      document.createElement("div");
    headingElement.innerHTML = kinHtml;
    const kinHeadings = [
      ...headingElement.querySelectorAll(
        "h2, h3"
      ),
    ].map(
      heading =>
        String(heading.textContent ?? "")
          .trim()
    );
    const allCapsHeadings =
      kinHeadings.filter(
        heading =>
          /[A-Za-z]/.test(heading)
          && heading === heading.toUpperCase()
      );

    boaCheckEqual(
      checks,
      "Kin page contains 38 readable headings",
      kinHeadings.length,
      38
    );
    boaCheck(
      checks,
      "Kin source headings use normal capitalization",
      allCapsHeadings.length === 0,
      allCapsHeadings.join("\n")
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

  if (gearPage) {
    const gearSpecs = [
      {
        table: "melee",
        contentKey: "gear.fist-weapon",
        id: "FistWpnA7k2P9xQZ",
        name: "Fist Weapon",
        type: "weapon",
      },
      {
        table: "melee",
        contentKey: "gear.throwing-glaive",
        id: "ThrowGlvB4m8R2zQ",
        name: "Throwing Glaive",
        type: "weapon",
      },
      {
        table: "melee",
        contentKey: "gear.warglaive",
        id: "Mtrym5LUbMbXISlI",
        name: "Warglaive",
        type: "weapon",
      },
      {
        table: "ranged",
        contentKey: "gear.blunderbuss",
        id: "4pgpXANRnIBz5nNF",
        name: "Blunderbuss",
        type: "weapon",
      },
      {
        table: "ranged",
        contentKey: "gear.pistol",
        id: "3xoYCFEAWm88zRQq",
        name: "Pistol",
        type: "weapon",
      },
      {
        table: "ranged",
        contentKey: "gear.rifle",
        id: "RifleC6n3T9vK2xP",
        name: "Rifle",
        type: "weapon",
      },
      {
        table: "trade",
        contentKey: "gear.ammo-pouch",
        id: "n0yAAcVxspJur19y",
        name: "Ammo Pouch",
        type: "item",
      },
      {
        table: "trade",
        contentKey: "gear.sniper-scope",
        id: "SniperScp7kQ2mPx",
        name: "Sniper Scope",
        type: "item",
      },
    ];
    const gearProblems = [];

    boaCheckEqual(
      checks,
      "Gear page contains three Gear tables",
      occurrences(
        gearHtml,
        "@GearTableStart["
      ),
      3
    );

    for (const tableType of [
      "melee",
      "ranged",
      "trade",
    ]) {
      if (
        !gearHtml.includes(
          `@GearTableStart[${tableType}]`
        )
      ) {
        gearProblems.push(
          `missing ${tableType} Gear table`
        );
      }
    }

    for (const spec of gearSpecs) {
      const marker =
        `@Gear[Item.${spec.id}]`
        + `{${spec.name}}`;
      const item = boaFindWorldItem(
        spec.contentKey,
        spec.type
      );

      if (
        occurrences(gearHtml, marker) !== 1
      ) {
        gearProblems.push(
          `${spec.name}: Gear link count `
          + `${occurrences(gearHtml, marker)}`
        );
      }

      if (!item) {
        gearProblems.push(
          `${spec.contentKey}: missing Item`
        );
      } else if (
        item.id !== spec.id
        || item.name !== spec.name
      ) {
        gearProblems.push(
          `${spec.contentKey}: `
          + `${item.id}/${item.name}`
        );
      }
    }

    boaCheck(
      checks,
      "Gear page links all eight generated Gear Items",
      gearProblems.length === 0,
      gearProblems.join("\n")
    );
    boaCheck(
      checks,
      "Gear page includes the 500 meter firearm report",
      gearHtml.includes(
        "audible out to 500 meters."
      )
    );
  }

  function normalizedText(value) {
    return referenceLabels(value)
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
  let grantedSpellCount = 0;
  let abilitySpellLinkCount = 0;
  let journalSpellLinkCount = 0;

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

      if (
        typeof ability.grantsSpell === "string"
      ) {
        grantedSpellCount += 1;

        const spellContentKey =
          `spells.${ability.grantsSpell}`;
        const spell = boaFindWorldItem(
          spellContentKey,
          "spell"
        );

        if (!spell) {
          classPageProblems.push(
            `${ability.name}: missing ${spellContentKey}`
          );
          continue;
        }

        const spellLinkMarker =
          `${UUID_ITEM_PREFIX}${spell.id}]`;

        if (
          String(
            item.system?.itemDescription ?? ""
          ).includes(spellLinkMarker)
        ) {
          abilitySpellLinkCount += 1;
        } else {
          classPageProblems.push(
            `${ability.name}: Ability description does not link ${spell.name}`
          );
        }

        if (
          classesHtml.includes(
            spellLinkMarker
          )
        ) {
          journalSpellLinkCount += 1;
        } else {
          classPageProblems.push(
            `${ability.name}: Journal box does not link ${spell.name}`
          );
        }
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
  boaCheckEqual(
    checks,
    "Heroic Class Ability source grants six Spells",
    grantedSpellCount,
    6
  );
  boaCheckEqual(
    checks,
    "Spell-granting Ability descriptions link all six Spell Items",
    abilitySpellLinkCount,
    grantedSpellCount
  );
  boaCheckEqual(
    checks,
    "Spell-granting Journal boxes link all six Spell Items",
    journalSpellLinkCount,
    grantedSpellCount
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
      "Player Options has exactly six pages",
      boaCollectionValues(
        playerOptions.pages
      ).length,
      6
    );
    const orderedPageNames =
      boaCollectionValues(
        playerOptions.pages
      )
        .sort(
          (left, right) =>
            Number(left.sort ?? 0)
            - Number(right.sort ?? 0)
            || String(left.name ?? "")
              .localeCompare(
                String(right.name ?? "")
              )
        )
        .map(page => page.name);
    boaCheckEqual(
      checks,
      "Player Options page order starts with cover and introduction",
      orderedPageNames,
      [
        "Illustration",
        "Introduction",
        "Kin",
        "Derived Ratings",
        "Heroic Class Abilities",
        "Gear",
      ]
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

  const rulesReferenceSpecs = [
    {
      contentKey:
        "ability.draconic-wings-falling",
      page: "kin",
      link:
        "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
        + "JournalEntryPage.6WPxPxUjh4W80RNy"
        + "#falling]{falling}",
    },
    {
      contentKey: "ability.arcane-affinity",
      page: "kin",
      link:
        "@UUID[JournalEntry.BHzSGEPaCGVadFsb."
        + "JournalEntryPage.cvFSLoFtdJOQcxtU"
        + "#magic-tricks]{Magic Tricks}",
    },
    {
      contentKey: "ability.escape-artist",
      page: "kin",
      link:
        "@UUID[Item.GiE0TwixaYnxFT6i]"
        + "{Hard to Catch}",
    },
    {
      contentKey: "ability.relentless",
      page: "kin",
      link:
        "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
        + "JournalEntryPage.CJjqkHzpow39ViUi"
        + "#death]{rally}",
    },
    {
      contentKey: "ability.regeneration",
      page: "kin",
      link:
        "@UUID[Item.SY62xmX9uBVml786]"
        + "{Fast Healer}",
    },
    {
      contentKey:
        "ability.touch-of-the-grave",
      page: "kin",
      link:
        "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
        + "JournalEntryPage.CJjqkHzpow39ViUi"
        + "#death]{Death Roll}",
    },
    {
      contentKey: "ability.luck",
      page: "kin",
      link:
        "@UUID[JournalEntry.V4R4dCuKSK2mi8RF."
        + "JournalEntryPage.eIQgHhYPUczg7kbZ"
        + "#pushing-your-roll]"
        + "{Pushing your Roll}",
    },
    {
      contentKey: "ability.two-forms",
      page: "kin",
      link:
        "@UUID[JournalEntry.BoAJrnlPlayerOpt."
        + "JournalEntryPage.BoAPgPlayerKin01"
        + "#human]{Human}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "death-knight.summon-ghoul",
      page: "classes",
      link:
        "@UUID[Actor.GhoulAct6Kp9T2xP]"
        + "{ghoul}",
    },
    {
      contentKey:
        "heroic-class-ability.evoker.tailwind",
      page: "classes",
      link:
        "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
        + "JournalEntryPage.KrSXg7HKmfo7xRcI"
        + "#movement]{dash}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "hunter.aimed-shot",
      page: "classes",
      link:
        "@UUID[Item.J6l8QwCJhBirvg03]"
        + "{Twin Shot}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "mage.mages-brilliance",
      page: "classes",
      link:
        "@UUID[Item.RPnxXYVb8z7EG5Wl]"
        + "{Sense Magic}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "monk.monks-serenity",
      page: "classes",
      link:
        "@UUID[Item.O7p7ZWnZNgxP8PFw]"
        + "{Iron Fist}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "rogue.roguish-cunning",
      page: "classes",
      link:
        "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
        + "JournalEntryPage.KrSXg7HKmfo7xRcI"
        + "#sneak-attack]{sneak attack}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "rogue.envenom-weapons",
      page: "classes",
      link:
        "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
        + "JournalEntryPage.6WPxPxUjh4W80RNy"
        + "#poison]{poison}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "warlock.warlocks-ambition",
      page: "classes",
      link:
        "@UUID[JournalEntry.BHzSGEPaCGVadFsb."
        + "JournalEntryPage.C0stUmhj95JFgL4f"
        + "#power-level]"
        + "{Power from the Body}",
    },
    {
      contentKey:
        "heroic-class-ability."
        + "warrior.warriors-rage",
      page: "classes",
      link:
        "@UUID[Item.JrQqkQrSOFJzR7H9]"
        + "{Dual Wield}",
    },
  ];

  const ruleLinkProblems = [];

  for (const spec of rulesReferenceSpecs) {
    const item = boaFindWorldItem(
      spec.contentKey,
      "ability"
    );
    const itemHtml =
      item?.system?.itemDescription ?? "";
    const pageHtml =
      spec.page === "kin"
        ? kinHtml
        : classesHtml;

    if (!item) {
      ruleLinkProblems.push(
        `${spec.contentKey}: missing Item`
      );
    } else if (
      occurrences(itemHtml, spec.link) !== 1
    ) {
      ruleLinkProblems.push(
        `${spec.contentKey}: Item link count `
        + `${occurrences(itemHtml, spec.link)}`
      );
    }

    if (
      occurrences(pageHtml, spec.link) !== 1
    ) {
      ruleLinkProblems.push(
        `${spec.contentKey}: Journal link count `
        + `${occurrences(pageHtml, spec.link)}`
      );
    }
  }

  boaCheck(
    checks,
    "Ability and Journal rule links are present",
    ruleLinkProblems.length === 0,
    ruleLinkProblems.join("\n")
  );

  const ghoulActor =
    game.actors.get("GhoulAct6Kp9T2xP");
  boaCheck(
    checks,
    "Ghoul rule link targets the imported Actor",
    Boolean(
      ghoulActor
      && ghoulActor.name === "Ghoul"
    ),
    ghoulActor?.name ?? "missing"
  );

  const soulsCollector =
    boaFindWorldItem(
      "heroic-class-ability."
      + "warlock.souls-collector",
      "ability"
    );
  const soulsHtml =
    soulsCollector?.system
      ?.itemDescription ?? "";
  boaCheck(
    checks,
    "Souls Collector uses an inline D3 roll",
    soulsHtml.includes(
      "recover [[/roll D3]] WP"
    )
    && classesHtml.includes(
      "recover [[/roll D3]] WP"
    ),
    soulsHtml
  );

  const demonologist =
    boaFindWorldItem(
      "heroic-class-ability."
      + "warlock.demonologist",
      "ability"
    );
  const demonologistHtml =
    demonologist?.system
      ?.itemDescription ?? "";
  boaCheck(
    checks,
    "Demonologist no longer references a missing appendix",
    demonologistHtml.includes(
      "summon a demon into an empty space"
    )
    && !demonologistHtml.includes(
      "Appendix B in this book"
    )
    && !classesHtml.includes(
      "Appendix B in this book"
    ),
    demonologistHtml
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
