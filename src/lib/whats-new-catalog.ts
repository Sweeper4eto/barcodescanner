/**
 * Code-owned What’s New checklist.
 * When shipping user-facing changes, append a new entry here (unique `key`).
 * Admin GET syncs these into the DB as Draft rows — admin only Push / Unpublish.
 */
export type WhatsNewCatalogEntry = {
  /** Stable id — never reuse after shipping. */
  key: string;
  titleEn: string;
  titleBg: string;
  href?: string | null;
};

export const WHATS_NEW_CATALOG: readonly WhatsNewCatalogEntry[] = [
  {
    key: "2026-08-document-capture-outline",
    titleEn: "Document scan: capture button uses a viewfinder icon in a green outline circle.",
    titleBg:
      "Сканиране на документ: бутонът „Снимай“ е с икона за рамка и зелен контур.",
    href: "/app/add-document",
  },
  {
    key: "2026-08-document-preview-toolbar",
    titleEn:
      "Document scan: review the photo, then use Back, Next, or Cancel in one toolbar.",
    titleBg:
      "Сканиране на документ: преглед на снимката, после Назад, Напред или Отказ в една лента.",
    href: "/app/add-document",
  },
  {
    key: "2026-08-outline-action-buttons",
    titleEn:
      "Clearer buttons — green outline to confirm, red outline to remove.",
    titleBg:
      "По-ясни бутони — зелен контур за потвърждение, червен за премахване.",
  },
  {
    key: "2026-08-whats-new-sheet",
    titleEn:
      "You’ll see a What’s new sheet on home when we publish updates.",
    titleBg:
      "На началния екран ще виждате „Какво е новото“, когато пуснем обновления.",
  },
];