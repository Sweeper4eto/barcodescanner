# expire365 — архитектура

**Last updated:** 2026-10-18

Мобилно уеб приложение (PWA) за срок на годност. Домакинствата ползват количка и любими. Магазините ползват намаление на цена, OCR на документ, график на персонала и екип. Админът води акаунти, такси, поддръжка, каталог, OCR статистика и What’s new.

## Технологии

| Слой | Избор |
|------|--------|
| Frontend + API | Next.js 16, React 19, Tailwind |
| База данни | SQLite и в разработка, и в production (`EXPIRE365_DB_PATH`, по подразбиране `/var/lib/expire365/data.db`) |
| ORM | Prisma 7 + better-sqlite3 adapter |
| Auth | JWT само в httpOnly cookie. След вход адресът носи `?__session=` за миг, за да се запише това cookie на отговор 200; страницата маха параметъра и не пази token в JavaScript |
| Баркод | html5-qrcode и допълнителни декодери |
| Снимки | Качване в `data/uploads`. `GET /uploads/:filename` пуска файла само на логнат потребител, който има право да го види. Каталожна снимка е за всеки логнат потребител. Снимка само върху ред в годност е за този магазин и за админ |
| PWA | Web manifest, service worker, икони за „Добави на началния екран“ |

PostgreSQL не се ползва. Документ, който го описва като production база, е остарял.

## Роли

- **ADMIN** — `/admin`
- **USER + домакинство** — `/app`: годност, скан, количка, любими
- **USER + магазин** — `/app`: годност, скан, документ (OCR), намаление на цена. Графикът се вижда според `scheduleAccess` на акаунта (`private` / `public` / `disabled`)

## Функционалност

### Админ панел

- **Акаунти:** бизнес и домакинство отделно. За акаунт: Overview, Locations, People, Billing (такса, require payments, mark paid)
- **Плащания / lock:** `Client.paymentsRequired` + `paymentsRequiredSince`. Lock само при просрочен неплатен месец преди текущия. Домакинство и такса ≤ 0 са освободени
- **Плащания (portfolio):** календар и кой дължи
- **Потребители:** търсене в Accounts
- **Audit log:** Business / Household, филтри по акаунт, потребител, обект, IP, период
- **Items / Support / What’s new**
- **OCR usage:** сканирания по потребител, най-новото първо, плюс дневен брой. `GET /api/admin/document-ocr-usage`
- **Minimart locator:** карта и CRM статуси. Пин може да сочи към бизнес клиент. Sync не пипа status, comment и clientId

Всички `/api/admin/*` минават през `requireAdminResponse` в `src/lib/admin-guard.ts`.

### Потребител

- Регистрация на домакинство създава собствен магазин. Бизнес потребител без акаунт не влиза в приложението, докато админът не го върже
- Избраният магазин се пази в `localStorage`
- **Скан:** камера или ръчно → продукт → количество → дата → запис
- **Документ:** `/app/add-document`, камера в приложението, OCR, после импорт в годност
- **Годност:** период, търсене, цвят по спешност, премахване, намаление (магазин), количка и любими (домакинство)
- **Мултиизбор в годност:** дълго натискане. Сканът до търсачката става експорт. До 20 избрани реда стават JPG (`src/lib/expiry-selection-export.ts`). Над 20 има съобщение. На Android/desktop файлът се сваля. На iPhone се показва, за да се добави в Снимки
- **Снимка на продукт:** двойно докосване на истинска снимка в детайлите я отваря голяма. Картинката „без снимка“ не се увеличава. Повторно докосване я затваря
- **График:** `/app/schedule`. Седмица, дни, финализиране, автоматично разпределение 07:00–22:00, изключване на човек за ден. Запис като PDF или PNG (`src/lib/schedule-week-print.ts`), със същото поведение за сваляне като експорта на годност
- **Екип и billing:** собственикът управлява хора и вижда таксуването на акаунта

Екранът за годност и екранът за график споделят лентите, диалозите за запис и прегледа на снимката с отделни компоненти (`expiry-selection-chrome`, `schedule-shift-bars`, `schedule-export-sheets`).

### Placeholder за липсваща снимка

`ProductImage` показва `NoPicturePlaceholder`, когато няма `imagePath` или снимката не се зареди. Илюстрацията е мини-маркет с mint рамка (`src/components/no-picture-placeholder.tsx`).

### What's new

- Каталог: `src/lib/whats-new-catalog.ts` — нов `key`, EN, BG, по желание `href`
- Admin → What’s new синхронизира каталога като Draft
- Админът избира редове и пуска Push. Разработчикът не пише текста в админа

### Push за годност

- Настройки: `/app/settings/notifications` — ранно и спешно напомняне, отделен час, филтър по обект
- Изпращане: `sendExpiryDigests()` в `src/lib/push-expiry.ts`
- Cron: `POST /api/cron/expiry-notifications` с header `x-cron-secret`, на 15 минути

### Годност и purge

- Списъкът по подразбиране е периодът, избран от потребителя (по подразбиране 30 дни)
- Цветове: ≤7 дни критично, ≤14 предупреждение, ≤28 скоро
- `removedAt` — махнат от списъка
- `deletedAt` — hard delete след гратисния период (cron)
- Намалена цена: `priceReducedAt`, `priceDiscountPercent`, `priceReducedByUserId`

## API

| Метод | Път | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Потребител + магазини |
| GET/POST/PATCH/DELETE | `/api/admin/clients` | Клиенти |
| GET/POST/PATCH/DELETE | `/api/admin/stores` | Магазини |
| GET/PATCH/DELETE | `/api/admin/users` | Потребители |
| GET | `/api/admin/document-ocr-usage` | OCR сканирания |
| GET/POST/PATCH/DELETE | `/api/admin/minimart-locator` | Minimart карта |
| GET | `/api/admin/payments/calendar` | Календар на плащания |
| GET/POST | `/api/products` | Продукти |
| GET/POST/PATCH | `/api/inventory` | Стока в магазин |
| GET/POST/PATCH | `/api/schedule` | График на магазина |
| POST | `/api/upload` | Качване на снимка (изисква сесия) |
| GET | `/uploads/:filename` | Снимка само за оторизиран потребител |
| POST | `/api/cron/purge-inventory` | Hard delete (`x-cron-secret`) |
| POST | `/api/cron/expiry-notifications` | Push за годност (`x-cron-secret`) |

## PWA

- Manifest: `src/app/manifest.ts`
- Service worker: `public/sw.js` (страници; API заявките са online)
- Икони: `public/icons/` (`npm run icons`)

За камера на телефон в production е нужен HTTPS.

## Cron

```bash
curl -X POST -H "x-cron-secret: YOUR_SECRET" http://localhost:3000/api/cron/purge-inventory
curl -X POST -H "x-cron-secret: YOUR_SECRET" http://localhost:3000/api/cron/expiry-notifications
```

## Backups

Скрипт: `scripts/backup-expire365.sh`

Копира SQLite базата и снимките от `data/uploads` (и остатък от `public/uploads`, ако има). Веднъж седмично, пазят се 2-те най-нови папки. Ако сървърът още е в `/var/www/magazin`, скриптът ползва тази папка, докато не я преименувате.

```bash
sudo apt install -y sqlite3
sudo mkdir -p /var/backups/expire365
sudo chmod +x /var/www/expire365/scripts/backup-expire365.sh
# crontab — неделя 03:15
15 3 * * 0 /var/www/expire365/scripts/backup-expire365.sh >> /var/log/expire365-backup.log 2>&1
```

Възстановяване (спри приложението първо):

```bash
pm2 stop expire365
gunzip -c /path/to/backup/data.db.gz > /var/lib/expire365/data.db
mkdir -p /var/www/expire365/data
tar -C /var/www/expire365/data -xzf /path/to/backup/uploads.tar.gz
pm2 start expire365
```

Архивът от преди 2026-10-18 разархивира снимките в `public/uploads`. След старт приложението ги мести в `data/uploads`.

## Стартиране

От директорията на проекта:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Админ след seed: `admin` / `admin123`

## Тестове

```bash
npm test          # unit + integration
npm run test:e2e  # Playwright
npm run validate  # lint + test + build
```

Покрити са годност, график, OCR ред, експорт на снимка, двойно докосване и достъп до качени снимки, плюс вход, админ и ролите home/retail.
