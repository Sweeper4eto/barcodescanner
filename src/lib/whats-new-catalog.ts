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
    key: "2026-09-owner-billing-page",
    titleEn:
      "Owners can open Billing on Home to see payment status and a scrollable month history.",
    titleBg:
      "Собствениците отварят „Плащания“ от Начало за статус и история по месеци (с превъртане).",
    href: "/app/billing",
  },
  {
    key: "2026-09-document-ai-admin-push",
    titleEn:
      "Admins get a push alert when document scan AI (Gemini) fails — rate-limited so it won’t spam.",
    titleBg:
      "Админите получават push при срив на AI за сканиране на документи (Gemini) — с лимит, за да няма спам.",
    href: "/admin",
  },
  {
    key: "2026-09-expiry-added-by",
    titleEn:
      "Expiry item details show who added or imported the entry (Added by).",
    titleBg:
      "В детайлите на артикул от Годност се вижда кой го е добавил или импортирал (Добавил).",
    href: "/app/expiry",
  },
  {
    key: "2026-09-expiry-search-dates",
    titleEn:
      "Expiry search also finds items by expiry or added date — full or partial (25/09/2026, 25.09, 25…).",
    titleBg:
      "Търсенето в Годност намира и по дата на годност или добавяне — пълна или частична (25.09.2026, 25.09, 25…).",
    href: "/app/expiry",
  },
  {
    key: "2026-09-whats-new-per-user",
    titleEn:
      "“Got it” on What’s new is saved for your account, so it won’t show again on other devices.",
    titleBg:
      "„Разбрах“ при Новости се записва за акаунта ви и няма да се показва отново на други устройства.",
  },
  {
    key: "2026-09-team-sheet-keyboard",
    titleEn:
      "Team add/edit sheet stays fully visible when the keyboard opens on mobile.",
    titleBg:
      "Листът за добавяне/редакция в Екип остава видим при отворена клавиатура на мобилен.",
    href: "/app/team",
  },
  {
    key: "2026-09-team-sheet-wizard",
    titleEn:
      "Team: list people first, then add or edit in one compact sheet (account, role, stores).",
    titleBg:
      "Екип: първо списък с хора, после добавяне/редакция в един компактен лист (акаунт, роля, обекти).",
    href: "/app/team",
  },
  {
    key: "2026-09-push-follows-language",
    titleEn:
      "Expiry alert language follows your app language when you switch EN/BG.",
    titleBg:
      "Езикът на известията за годност следва езика на приложението при смяна EN/БГ.",
  },
  {
    key: "2026-09-camera-double-tap",
    titleEn:
      "Double-tap the live camera preview to take a photo on document scan and product pictures.",
    titleBg:
      "Докоснете два пъти камерата, за да снимате при документ и при снимка на продукт.",
    href: "/app/add-document",
  },
  {
    key: "2026-09-expiry-period-days",
    titleEn: "Expiry filter is now 7 days, 14 days, 30 days, or All.",
    titleBg: "Филтърът за годност вече е 7 дни, 14 дни, 30 дни или Всички.",
    href: "/app/expiry",
  },
  {
    key: "2026-09-document-preview-two-buttons",
    titleEn:
      "Document photo preview: Back retakes, Next continues — no extra Cancel or circle button.",
    titleBg:
      "Преглед на документ: Назад за нова снимка, Напред за продължаване — без Отказ и кръгъл бутон.",
    href: "/app/add-document",
  },
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
    key: "2026-09-expiry-dual-tier-times",
    titleEn:
      "Early and Urgent expiry alerts each have their own daily time — you get both when both are due.",
    titleBg:
      "Ранно и Спешно известие за годност имат отделен час всеки ден — получавате и двете, когато са насрочени.",
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
  {
    key: "2026-09-action-flash-above-nav",
    titleEn:
      "Cart and expiry success messages stay pinned above the bottom menu so the list does not jump.",
    titleBg:
      "Съобщенията за успех в количката и годността остават над долното меню, за да не подскача списъкът.",
    href: "/app/buy-list",
  },
  {
    key: "2026-09-retail-default-main-location",
    titleEn:
      "New business accounts start with a Main location again — ready to scan right after signup (rename anytime).",
    titleBg:
      "Новите бизнес акаунти отново започват с обект Main — готови за скен веднага след регистрация (преименувайте когато искате).",
    href: "/app",
  },
  {
    key: "2026-09-expiry-bulk-remove",
    titleEn:
      "Expiry list: long-press an item to select several, then remove them together.",
    titleBg:
      "Списък с годност: задръжте артикул, за да изберете няколко и да ги премахнете заедно.",
    href: "/app/expiry",
  },
  {
    key: "2026-10-home-menu-compact",
    titleEn:
      "Home menu is more compact — Team, Billing, Support, and alerts show title only.",
    titleBg:
      "Началните менюта са по-компактни — Екип, Плащания, Поддръжка и известия са само със заглавие.",
    href: "/app",
  },
  {
    key: "2026-10-store-schedule-mvp",
    titleEn:
      "Schedule (per location): open from Team — staff set desired hours; owners run auto or manual and finalize.",
    titleBg:
      "График (по обект): от Екип — персоналът задава желани часове; собственикът пуска авто или ръчно и финализира.",
    href: "/app/team",
  },
  {
    key: "2026-10-schedule-access-toggle",
    titleEn:
      "Team → Schedule: Off, Private (owner only), or Everyone (shows on Home for staff).",
    titleBg:
      "Екип → График: Изкл., Само аз (само собственик) или Всички (на Начало за служители).",
    href: "/app/team",
  },
  {
    key: "2026-10-schedule-week-label-live-hours",
    titleEn:
      "Schedule: week shows start–end dates; hours update live while you drag shifts.",
    titleBg:
      "График: седмицата показва начална–крайна дата; часовете се обновяват наживо при плъзгане.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-ui-tidy",
    titleEn:
      "Schedule: tighter week controls, slimmer shift sliders, and clearer save confirmation for desired hours.",
    titleBg:
      "График: по-компактна седмица, по-тънки плъзгачи и ясно потвърждение при запазване на желани часове.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-duration-hm",
    titleEn:
      "Schedule durations show as hours and minutes (e.g. 3h 15m), not decimals.",
    titleBg:
      "Продължителността в графика е в часове и минути (напр. 3ч 15мин), без десетични.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-day-coverage",
    titleEn:
      "Schedule shows day coverage at the top — whether 07:00–22:00 is fully filled by staff shifts.",
    titleBg:
      "Графикът показва покритие на деня отгоре — дали 07:00–22:00 е напълно запълнен от смените.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-auto-stays-manual",
    titleEn:
      "Schedule: Automatic schedule fills the day, then stays Manual so you can adjust.",
    titleBg:
      "График: Автоматичен график запълва деня и остава Ръчно, за да можете да го коригирате.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-auto-all-staff",
    titleEn:
      "Automatic schedule uses desired hours; if two desires overlap, fewer hours this month wins that slot.",
    titleBg:
      "Автоматичният график ползва желаните часове; при застъпване печели този с по-малко часове за месеца.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-coverage-hint",
    titleEn:
      "Schedule day coverage is clearer, and hints when someone still needs a shift.",
    titleBg:
      "Покритието на деня в графика е по-ясно и подсказва когато някой още няма смяна.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-selected-day-header",
    titleEn:
      "Schedule header shows the selected weekday and date on the left; week arrows stay on the right.",
    titleBg:
      "В заглавието на графика вляво са избраният ден и датата; стрелките за седмицата са вдясно.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-team-display-name",
    titleEn:
      "Team: optional Name field for each person — shown in the team list and schedule.",
    titleBg:
      "Екип: по желание поле Име за всеки — показва се в списъка и в графика.",
    href: "/app/team",
  },
  {
    key: "2026-10-schedule-week-save-print",
    titleEn:
      "Schedule: save icon next to the week switches — print or save the week as PDF (table per day).",
    titleBg:
      "График: икона за запис до седмицата — печат или PDF на седмицата (таблица по дни).",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-finalize-edit",
    titleEn:
      "Schedule: Finalize locks the day; tap Edit to reopen and change shifts again.",
    titleBg:
      "График: Финализирай заключва деня; Редактирай го отваря отново за промени.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-all-team-staff",
    titleEn:
      "Schedule (owners): see and assign every team member, not only staff linked to that location.",
    titleBg:
      "График (собственик): виждате и назначавате целия екип, не само служителите за обекта.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-participant-toggle",
    titleEn:
      "Schedule: owners can tick people in or out per day; auto-fill skips those marked out that day.",
    titleBg:
      "График: собственикът включва/изключва хора по ден; авто ги пропуска за маркирания ден.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-team-hours-this-month",
    titleEn:
      "Team → edit employee: see hours worked this month from the schedule (1st through yesterday).",
    titleBg:
      "Екип → редакция на служител: отработени часове за месеца от графика (от 1-во до вчера).",
    href: "/app/team",
  },
  {
    key: "2026-10-schedule-save-pdf-or-picture",
    titleEn:
      "Schedule save: choose PDF (print dialog) or Picture (PNG download) for the week table.",
    titleBg:
      "Запис на график: изберете PDF (печат) или Снимка (PNG) за седмичната таблица.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-schedule-save-flash",
    titleEn:
      "Schedule: after saving the week as PDF or Picture, a short Saved confirmation appears.",
    titleBg:
      "График: след запис на седмицата като PDF или Снимка се показва кратко „Готово“.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-android-no-phantom-scrollbar",
    titleEn:
      "Android: removed the grey side scrollbar on short screens (Home and similar).",
    titleBg:
      "Android: премахнат е сивият страничен скролер на къси екрани (Начало и подобни).",
    href: "/app",
  },
  {
    key: "2026-10-android-viewport-height-scrollbar",
    titleEn:
      "Android: short pages (login, home) no longer show a side scrollbar when nothing needs scrolling.",
    titleBg:
      "Android: късите екрани (вход, начало) вече не показват страничен скролер, когато няма какво да се скролва.",
    href: "/app",
  },
  {
    key: "2026-10-document-preview-red-within-3-days",
    titleEn:
      "Document import: lines expiring in 3 days or less (including already expired) show in red in the review list.",
    titleBg:
      "Импорт на документ: редове със срок до 3 дни или по-малко (вкл. вече изтекли) са в червено в прегледа.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-keep-shared-godnost",
    titleEn:
      "Document import: short product names keep their expiry date even when the next line has the same date.",
    titleBg:
      "Импорт на документ: кратките имена на продукти запазват срока си, дори когато следващият ред има същата дата.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-merge-wrapped-names",
    titleEn:
      "Document import: long product names that wrap onto two lines stay one item with their expiry date.",
    titleBg:
      "Импорт на документ: дългите имена на два реда остават един продукт със своя срок на годност.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-keep-first-row-godnost",
    titleEn:
      "Document import: a full first product no longer loses its expiry when a later line on the page has no date.",
    titleBg:
      "Импорт на документ: пълният първи продукт вече не губи срока си, когато по-долу на страницата има ред без дата.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-ocr-alignment-pass",
    titleEn:
      "Document import: clearer OCR reading of each row’s own quantity and expiry (fewer shifted or missing dates).",
    titleBg:
      "Импорт на документ: по-ясно разчитане на количество и срок по редове (по-малко разместени или липсващи дати).",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-duplicate-names-ok",
    titleEn:
      "Document import: the same product name on consecutive rows is kept as separate lines (own qty and date).",
    titleBg:
      "Импорт на документ: едно и също име на няколко реда остава отделни редове (собствено к-во и срок).",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-ocr-row-separator-lines",
    titleEn:
      "Document import: when a page has horizontal lines between products, those lines keep each row’s qty and expiry separate.",
    titleBg:
      "Импорт на документ: когато има хоризонтални линии между продуктите, те държат к-во и срок на правилния ред.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-schedule-no-desired-hours",
    titleEn:
      "Schedule: desired hours are removed — staff can view the week; owners still set and finalize shifts.",
    titleBg:
      "График: желаните часове са премахнати — служителите само преглеждат седмицата; собствениците задават и финализират смените.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-expiry-push-per-store",
    titleEn:
      "Expiry alerts: one notification per store, with the location name first in the title.",
    titleBg:
      "Известия за годност: отделно известие за всеки обект, с името на локацията в началото на заглавието.",
    href: "/app/settings/notifications",
  },
  {
    key: "2026-10-document-processing-keep-awake",
    titleEn:
      "Document scan: the screen stays awake while Processing is shown, so the phone is less likely to drop the wait.",
    titleBg:
      "Сканиране на документ: екранът не заспива докато тече „Обработка“, за да не се прекъсва чакането.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-ai-try-again-5m",
    titleEn:
      "Document scan: if reading is busy, you’ll see a clear message to wait about 5 minutes and try again.",
    titleBg:
      "Сканиране на документ: ако четенето е заето, виждате ясно съобщение да изчакате около 5 минути и да опитате отново.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-literal-names-xh-match",
    titleEn:
      "Document scan: names stay closer to the print, and x/х or гр/г quirks no longer create duplicate products as often.",
    titleBg:
      "Сканиране на документ: имената са по-близо до отпечатаното, а обърквания x/х или гр/г по-рядко правят дублирани продукти.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-sku-leading-9",
    titleEn:
      "Document scan: if a SKU looks like it lost a leading 9 (0000…), we also check the 9… form so the same product merges.",
    titleBg:
      "Сканиране на документ: ако SKU изглежда без водеща 9 (0000…), проверяваме и варианта с 9…, за да се слее същият продукт.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-schedule-picture-share-gesture",
    titleEn:
      "Schedule: Save as picture opens the share sheet reliably again on phones (no more silent fail).",
    titleBg:
      "График: „Запази като снимка“ отново отваря споделянето надеждно на телефона (без тихо отказване).",
    href: "/app/schedule",
  },
  {
    key: "2026-10-pwa-install-remind-week",
    titleEn:
      "Home screen icon: if you skip Add icon, we’ll ask again after about a week (only if it still isn’t installed).",
    titleBg:
      "Икона на началния екран: ако пропуснете „Добави икона“, ще попитаме отново след около седмица (само ако още не е добавена).",
    href: "/app",
  },
  {
    key: "2026-10-team-activity-log",
    titleEn:
      "Team: owners can open Activity log — only your locations and your users, with search and filters.",
    titleBg:
      "Екип: собствениците отварят „Дневник на действията“ — само вашите обекти и хора, с търсене и филтри.",
    href: "/app/team/activity",
  },
  {
    key: "2026-10-business-no-default-main",
    titleEn:
      "New business signups no longer get a Main location — contact support to add one before using the app.",
    titleBg:
      "Новите бизнес регистрации вече не получават автоматично обект Main — свържете се с поддръжката за добавяне на обект, преди да ползвате приложението.",
    href: "/app",
  },
  {
    key: "2026-10-app-screen-keep-awake",
    titleEn:
      "Screen stays awake on Expiry list, document scan, and while the camera/scanner is open.",
    titleBg:
      "Екранът остава буден в списъка с годност, при скен на документ и докато е отворена камерата/скенерът.",
    href: "/app",
  },
  {
    key: "2026-10-remember-last-location",
    titleEn:
      "Your last selected location is remembered after logout — it’s selected again when you sign back in.",
    titleBg:
      "Последният избран обект се запомня след изход — при следващ вход отново е избран.",
    href: "/app",
  },
  {
    key: "2026-10-scan-location-confirm",
    titleEn:
      "Before document scan, confirm the location (Yes / No) so items go to the right store.",
    titleBg:
      "Преди скен на документ потвърдете обекта (Да / Не), за да отидат артикулите на правилното място.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-lock-store-while-scanning",
    titleEn:
      "Location picker is locked while scanning (and after you confirm a document location) so items can’t go to the wrong store.",
    titleBg:
      "Изборът на обект е заключен по време на сканиране (и след потвърждение при документ), за да не отидат артикули на грешен обект.",
    href: "/app/scan",
  },
  {
    key: "2026-10-expiry-export-selection",
    titleEn:
      "Expiry multi-select: the scan button becomes a save icon that exports up to 20 selected items as a picture.",
    titleBg:
      "Годност, множествен избор: бутонът за скен става дискета и запазва до 20 избрани артикула като снимка.",
    href: "/app/expiry",
  },
  {
    key: "2026-10-expiry-export-saves-file",
    titleEn:
      "Expiry export saves the picture on your phone (Downloads), instead of only copying it.",
    titleBg:
      "Експортът от Годност запазва снимката на телефона (Изтегляния), вместо само да я копира.",
    href: "/app/expiry",
  },
  {
    key: "2026-10-schedule-picture-saves-file",
    titleEn:
      "Schedule “Picture” saves the week on your phone (Downloads), instead of only copying it.",
    titleBg:
      "График „Снимка“ запазва седмицата на телефона (Изтегляния), вместо само да я копира.",
    href: "/app/schedule",
  },
  {
    key: "2026-10-detail-photo-double-tap",
    titleEn:
      "Item details: double-tap a real product photo to see it larger. The no-picture art stays as it is.",
    titleBg:
      "Детайли на артикул: двойно докосване на истинска снимка я показва по-голяма. Картинката без снимка остава същата.",
    href: "/app/expiry",
  },
  {
    key: "2026-10-detail-photo-tap-zoom",
    titleEn:
      "Item details: tap a real product photo once to see it larger. Tap again or Close to dismiss.",
    titleBg:
      "Детайли на артикул: едно докосване на истинска снимка я показва по-голяма. Докоснете отново или Затвори, за да я затворите.",
    href: "/app/expiry",
  },
  {
    key: "2026-10-document-iso-date-in-printed",
    titleEn:
      "Document scan: year-first dates like 2027-02-11 are kept even when the scanner puts them in the wrong field.",
    titleBg:
      "Скан на документ: дати като 2027-02-11 (година първа) се запазват, дори когато скенерът ги сложи в грешното поле.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-alerts-both-tiers-off-saves",
    titleEn:
      "Expiry alerts: turn Early and Urgent both off, then Save — alerts disable instead of blocking save.",
    titleBg:
      "Известия за годност: изключете Ранно и Спешно и Запази — известията се спират, вместо да блокират записа.",
    href: "/app/settings/notifications",
  },
  {
    key: "2026-10-register-household-disabled",
    titleEn:
      "Registration: Household is shown but unavailable for now — new signups are Business only.",
    titleBg:
      "Регистрация: Домакинство се вижда, но временно не може да се избере — новите акаунти са само Бизнес.",
    href: "/register",
  },
  {
    key: "2026-10-document-multi-page-sections",
    titleEn:
      "Document scan: multi-photo review groups items by photo — Retake or Reattach one page without losing the others.",
    titleBg:
      "Скан на документ: при няколко снимки артикулите са по секции — Повтори или Прикачи само една страница, без да губите останалите.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-ocr-edge-confirm",
    titleEn:
      "Document scan: we quickly re-check the first and last rows against the photo (up to two tries) and ask for a clearer picture if they still disagree.",
    titleBg:
      "Скан на документ: бързо сверяваме първите и последните редове със снимката (до два опита) и искаме по-ясна снимка, ако пак не съвпадат.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-ocr-edge-confirm-removed",
    titleEn:
      "Document scan: removed the extra first/last-row photo check that often blocked scans with “clearer photo” errors.",
    titleBg:
      "Скан на документ: махнахме допълнителната проверка на първи/последни редове, която често блокираше с грешка „по-ясна снимка“.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-page-no-date",
    titleEn:
      "Document review: each photo section has its own No date button next to Retake / Reattach (search-bar button still clears all pages).",
    titleBg:
      "Преглед на документ: всяка снимка има бутон Без дата до Повтори / Прикачи (бутонът до търсенето пак чисти всички страници).",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-server-deskew",
    titleEn:
      "Document scan: automatic photo straighten was turned off — it was slowing Retake and mis-rotating some pages.",
    titleBg:
      "Скан на документ: автоматичното изправяне на снимки е изключено — забавяше Повтори и обръщаше някои страници грешно.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-leave-review-confirm",
    titleEn:
      "Document review: Scan and Expiry ask before leaving so you do not lose an unfinished review by accident.",
    titleBg:
      "Преглед на документ: Скан и Годност питат преди изход, за да не загубите незавършен преглед по погрешка.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-retake-busy-feedback",
    titleEn:
      "Document retake: Continue shows reading progress right away, and the spinner always clears when reading finishes.",
    titleBg:
      "Повторно снимане на документ: Напред веднага показва четене, и спинерът винаги изчезва когато четенето приключи.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-import-ready-pages",
    titleEn:
      "Document review: Add items stays available after removing No date rows even if another photo is still reading.",
    titleBg:
      "Преглед на документ: Добави стоките остава активен след Без дата, дори ако друга снимка още се чете.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-retake-no-hint",
    titleEn:
      "Document Retake: removed the hint above the camera so the capture buttons sit higher.",
    titleBg:
      "Повторно снимане на документ: махнат е текстът над камерата, за да са по-високо бутоните.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-retake-faster-prep",
    titleEn:
      "Document Retake: photo prep before reading is much faster when you already have several pages open.",
    titleBg:
      "Повторно снимане на документ: подготовката на снимката преди четене е много по-бърза, когато вече имате няколко страници.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-gallery-paper-crop",
    titleEn:
      "Document upload from gallery: prep now crops to the white page so table background does not waste resolution.",
    titleBg:
      "Качване на документ от галерията: подготовката изрязва белия лист, за да не се губи резолюция в масата наоколо.",
    href: "/app/add-document",
  },
  {
    key: "2026-10-document-paper-crop-keep-bottom",
    titleEn:
      "Document gallery prep keeps the full page even when phone shadow falls on any side.",
    titleBg:
      "Подготовката при качване от галерията запазва целия лист дори когато сянката от телефона пада от която и да е страна.",
    href: "/app/add-document",
  },
];





