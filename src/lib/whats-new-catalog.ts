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
    key: "2026-08-legal-pages-redesign",
    titleEn:
      "Privacy and Terms pages match the app look, with a clear Back control.",
    titleBg:
      "Страниците Поверителност и Условия са в стила на приложението, с ясен бутон Назад.",
    href: "/privacy",
  },
  {
    key: "2026-08-cart-manual-add-modal",
    titleEn: "Adding an item from cart search opens the same confirmation modal (name, photo, quantity).",
    titleBg: "Добавянето от търсене в количката отваря същия модал за потвърждение (име, снимка, количество).",
    href: "/app/buy-list",
  },
  {
    key: "2026-08-expiry-add-to-cart-modal",
    titleEn: "Add to cart from expiry uses a confirmation modal with photo, name, and quantity.",
    titleBg: "Добавянето в количка от годност е с модал: снимка, име и количество.",
    href: "/app/expiry",
  },
  {
    key: "2026-08-expiry-favourite-on-image",
    titleEn: "Favourite star on expiry cards sits on the product photo (household accounts).",
    titleBg: "Звездата за любими на картите за годност е върху снимката на продукта (домакински акаунти).",
    href: "/app/expiry",
  },
  {
    key: "2026-08-document-import-done-redesign",
    titleEn:
      "Import complete screen matches the new design (logo, stat icons, outline buttons).",
    titleBg:
      "Екранът „Импортът приключи“ следва новия дизайн (лого, икони, контурни бутони).",
    href: "/app/add-document",
  },
  {
    key: "2026-08-document-detail-match-expiry",
    titleEn:
      "Document review item details use the same layout as expiry item details.",
    titleBg:
      "Детайлите при преглед на документ вече са със същия изглед като при годност.",
    href: "/app/add-document",
  },
  {
    key: "2026-08-document-cards-match-expiry",
    titleEn:
      "Document review item cards now match the expiry list layout (without price reduction).",
    titleBg:
      "Картите при преглед на документ вече са като списъка с годност (без намаляване на цена).",
    href: "/app/add-document",
  },
  {
    key: "2026-08-document-review-redesign",
    titleEn:
      "Document review: clearer item cards, count badge, and side-by-side Retake / Add buttons.",
    titleBg:
      "Преглед на документ: по-ясни карти на артикули, брояч и бутони Повтори / Добави един до друг.",
    href: "/app/add-document",
  },
  {
    key: "2026-08-expiry-date-focus",
    titleEn:
      "Editing expiry scrolls the calendar into view so dates stay visible on small phones.",
    titleBg:
      "При редакция на годност календарът се показва на екрана — датите остават видими и на малки телефони.",
    href: "/app/expiry",
  },
  {
    key: "2026-08-document-capture-outline",
    titleEn: "Document scan: capture button uses a viewfinder icon in a green outline circle.",
    titleBg:
      "Сканиране на документ: бутонът „Снимай“ е с икона за рамка и зелен контур.",
    href: "/app/add-document",
  },
  {
    key: "2026-08-instant-new-picture",
    titleEn:
      "New picture applies right away — Keep old picture if you change your mind.",
    titleBg:
      "Нова снимка се прилага веднага — „Запази старата снимка“, ако размислите.",
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
  {
    key: "2026-08-header-store-under-flag",
    titleEn:
      "Store name sits under the language flag (shortened with …); full name in the menu.",
    titleBg:
      "Името на магазина е под знамето за език (със … при дълго име); пълното име е в менюто.",
  },
  {
    key: "2026-09-no-picture-mint-placeholder",
    titleEn:
      "Products without a photo show a mint store illustration instead of grey “No picture” text.",
    titleBg:
      "Продуктите без снимка показват mint илюстрация на щанд вместо сив текст „Няма снимка“.",
  },
  {
    key: "2026-09-expiry-notification-settings",
    titleEn:
      "Customize expiry push alerts: reminder tiers (early + urgent), daily schedule, quiet hours, and store filter.",
    titleBg:
      "Персонализирайте push известия за годност: ранно и спешно напомняне, график, тихи часове и филтър по обект.",
    href: "/app/settings/notifications",
  },
  {
    key: "2026-09-document-scan-no-reprompt",
    titleEn:
      "Document scan on iPhone keeps the in-app camera open — no permission prompt on every new scan.",
    titleBg:
      "Сканиране на документ на iPhone остава в приложението — без повторно питане за камера при нов скан.",
    href: "/app/add-document",
  },
  {
    key: "2026-09-notification-timezone-auto",
    titleEn:
      "Expiry alert timezone is auto-detected; pick another from the list and Save to keep it.",
    titleBg:
      "Часовата зона за известия се открива автоматично; изберете друга от списъка и Запази, за да остане.",
    href: "/app/settings/notifications",
  },
  {
    key: "2026-09-retail-no-default-location",
    titleEn:
      "Business accounts start without a location — bottom menu stays locked until a location is assigned; home and support stay available.",
    titleBg:
      "Бизнес акаунтите започват без обект — долното меню е заключено до назначаване на обект; началото и поддръжката остават достъпни.",
    href: "/app",
  },
  {
    key: "2026-09-register-scroll-with-keyboard",
    titleEn:
      "Registration and other forms: you can scroll to the next fields while the keyboard is open.",
    titleBg:
      "Регистрация и други форми: можете да скролвате към следващите полета докато клавиатурата е отворена.",
    href: "/register",
  },
  {
    key: "2026-09-price-reduced-by-user",
    titleEn:
      "Price reduced shows who last set the discount and when (updates if someone else changes it).",
    titleBg:
      "Намалена цена показва кой последно е задал отстъпката и кога (обновява се при промяна от друг).",
    href: "/app/expiry",
  },
];