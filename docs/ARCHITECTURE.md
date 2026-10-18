# expire365 — архитектура

**Last updated:** 2026-10-18 (вечер)

Мобилно уеб приложение (PWA) за срок на годност. Домакинствата ползват количка и любими. Магазините ползват намаление на цена, OCR на документ, график на персонала и екип. Админът води акаунти, такси, поддръжка, каталог, OCR статистика и What’s new.

## Технологии

| Слой | Избор |
|------|--------|
| Frontend + API | Next.js 16, React 19, Tailwind |
| База данни | **SQLite** в dev и production (`DATABASE_URL=file:…`). Типичен prod път още е `/var/lib/magazin/data.db` (legacy); нови инсталации: `/var/lib/expire365/data.db` |
| ORM | Prisma 7 + `@prisma/adapter-better-sqlite3` (`src/lib/db.ts`) |
| Auth | JWT само в **httpOnly** cookie `expire365_session`. Няма втори cookie, четим от JavaScript. След вход URL носи `?__session=` за миг (отговор 200 записва cookie); страницата маха параметъра |
| Баркод | html5-qrcode и допълнителни декодери |
| Снимки | Качване в `data/uploads`. `GET /uploads/:filename` — само логнат потребител с право (`canViewUpload`). Каталожна снимка: всеки логнат. Снимка само на ред в годност: този магазин + админ |
| PWA | Web manifest, service worker, икони за „Добави на началния екран“ |
| Админ guard | Всички `/api/admin/*` през `requireAdminResponse` (`src/lib/admin-guard.ts`) |

**PostgreSQL:** не се ползва в production. Миграция е **планирана** (репетиция на desktop, после prod с fallback към SQLite файла) — виж раздел [Бъдеще: PostgreSQL](#бъдеще-postgresql). До тогава всеки документ, който описва Postgres като текуща prod база, е остарял.

**Rate limits** (login / OCR и др.): още in-process `Map` в паметта на Node процеса — не се споделят между инстанции и се губят при рестарт. Персистиране в SQLite е следваща hardening стъпка (не е направена).

## Production (към 2026-10-18)

| | |
|--|--|
| Публичен URL | https://expire365.com |
| Хост | Hetzner VPS (`ubuntu-4gb-nbg1-1`, ~38 GB диск) |
| App dir | още `/var/www/magazin` (преименуване към `/var/www/expire365` не е завършено на сървъра) |
| PM2 процес | `magazin` |
| SQLite | `/var/lib/magazin/data.db` (WAL) |
| Uploads | `/var/www/magazin/data/uploads` |
| Сървърни backups | `/var/backups/magazin/` (скриптът приема и `/var/backups/expire365`) |
| Deploy | `scripts/update-expire365.sh` (с fallback към стари `MAGAZIN_*` пътища) |
| Backup скрипт | `scripts/backup-expire365.sh` — `sqlite3 .backup` + `uploads.tar.gz` |

Вътрешните имена в кода/package са **expire365**; на сървъра пътищата и PM2 още ползват **magazin**, докато не се преименуват умишлено.

SSH към prod: ключ `~/.ssh/id_ed25519` (comment `magazin-hetzner`), потребител `root`, IP на `expire365.com`.

## Роли

- **ADMIN** — `/admin`
- **USER + домакинство** — `/app`: годност, скан, количка, любими
- **USER + магазин** — `/app`: годност, скан, документ (OCR), намаление на цена. Графикът се вижда според `scheduleAccess` на акаунта (`private` / `public` / `disabled`)

## Функционалност

### Админ панел

- **Акаунти:** бизнес и домакинство отделно. За акаунт: Overview, Locations, People, Billing (такса, require payments, mark paid)
- **Дата на регистрация:** в списъка с акаунти датата (`Client.createdAt`) е до името; в хедъра на акаунта — „Registered …“ / „Регистрация …“. За потребители (`User.createdAt`) — в People и в Accounts → Users (`GET /api/admin/users` връща `createdAt`)
- **Плащания / lock:** `Client.paymentsRequired` + `paymentsRequiredSince`. Lock само при просрочен неплатен месец преди текущия. Домакинство и такса ≤ 0 са освободени
- **Плащания (portfolio):** календар и кой дължи
- **Потребители:** търсене в Accounts
- **Audit log:** Business / Household, филтри по акаунт, потребител, обект, IP, период
- **Items / Support / What’s new**
- **OCR usage:** сканирания по потребител, най-новото първо, плюс дневен брой. `GET /api/admin/document-ocr-usage`
- **Minimart locator:** карта и CRM статуси. Пин може да сочи към бизнес клиент. Sync не пипа status, comment и clientId. На мобилен: инструментите са сгъваеми, локацията е dropdown (без вложен scroll на списъка), поле за име на локация; `MenuSelect` рендерира менюто в portal и поддържа търсене при дълги списъци

### Потребител

- Регистрация на домакинство създава собствен магазин. Бизнес потребител без акаунт не влиза в приложението, докато админът не го върже
- Избраният магазин се пази в `localStorage`
- **Скан:** камера или ръчно → продукт → количество → дата → запис
- **Документ:** `/app/add-document`, камера в приложението, OCR, после импорт в годност
- **Годност:** период, търсене, цвят по спешност, премахване, намаление (магазин), количка и любими (домакинство)
- **Мултиизбор в годност:** дълго натискане. Сканът до търсачката става експорт. До 20 избрани реда стават JPG (`src/lib/expiry-selection-export.ts`). Над 20 има съобщение. На Android/desktop файлът се сваля. На iPhone се показва, за да се добави в Снимки
- **Снимка на продукт:** **едно** докосване на истинска снимка в детайлите я отваря голяма. Placeholder „без снимка“ не се увеличава. Повторно докосване затваря. (По-рано беше double-tap; каталог What’s new: `2026-10-detail-photo-tap-zoom`)
- **График:** `/app/schedule`. Седмица, дни, финализиране, автоматично разпределение 07:00–22:00, изключване на човек за ден. Запис като PDF или PNG (`src/lib/schedule-week-print.ts`), със същото поведение за сваляне като експорта на годност
- **Екип и billing:** собственикът управлява хора и вижда таксуването на акаунта

Екранът за годност и екранът за график споделят лентите, диалозите за запис и прегледа на снимката с отделни компоненти (`expiry-selection-chrome`, `schedule-shift-bars`, `schedule-export-sheets`).

### Auth / сесии (hardening)

- Cookie име: `expire365_session` (httpOnly, Secure в production)
- Legacy `magazin_session` / клиентски session cookie: изчистват се / мигрират; приложението **не** чете token от JS storage
- Bootstrap само през `?__session=` query за един отговор, после параметърът се маха от адреса

### Placeholder за липсваща снимка

`ProductImage` показва `NoPicturePlaceholder`, когато няма `imagePath` или снимката не се зареди. Илюстрацията е мини-маркет с mint рамка (`src/components/no-picture-placeholder.tsx`).

### What's new

- Каталог: `src/lib/whats-new-catalog.ts` — нов `key`, EN, BG, по желание `href`
- Admin → What’s new синхронизира каталога като Draft
- Админът избира редове и пуска Push. Разработчикът не пише текста в админа
- Admin-only / docs / security-only промени **не** изискват каталожен запис

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
| GET/POST/PATCH/DELETE | `/api/admin/clients` | Клиенти (`createdAt` в отговора) |
| GET/POST/PATCH/DELETE | `/api/admin/stores` | Магазини |
| GET/PATCH/DELETE | `/api/admin/users` | Потребители (GET връща `createdAt`) |
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

Копира SQLite базата (`sqlite3 .backup` → `data.db.gz`) и снимките от `data/uploads` (и остатък от `public/uploads`, ако има). Веднъж седмично на сървъра; пазят се 2-те най-нови папки. Ако app dir още е `/var/www/magazin`, скриптът ползва legacy пътищата.

```bash
sudo apt install -y sqlite3
sudo mkdir -p /var/backups/expire365   # или /var/backups/magazin
sudo chmod +x /var/www/magazin/scripts/backup-expire365.sh
# crontab — неделя 03:15
15 3 * * 0 /var/www/magazin/scripts/backup-expire365.sh >> /var/log/expire365-backup.log 2>&1
```

Ръчен offline архив (пример 2026-10-18): изтеглен stamp към  
`E:\Work_Home\Backups\backup_expire365\<STAMP>\`  
(`data.db.gz`, `uploads.tar.gz`, `SHA256SUMS`, плюс по желание `.env` / nginx dump).

Възстановяване (спри приложението първо):

```bash
pm2 stop magazin    # или expire365 след преименуване
gunzip -c /path/to/backup/data.db.gz > /var/lib/magazin/data.db
mkdir -p /var/www/magazin/data
tar -C /var/www/magazin/data -xzf /path/to/backup/uploads.tar.gz
pm2 start magazin
```

Архивът от преди 2026-10-18 разархивира снимките в `public/uploads`. След старт приложението ги мести в `data/uploads`.

**Диск:** преди големи импорти / Postgres — освободете стари `data.db.bak-*` под `/var/lib/magazin` (не пипайте live `data.db` / `-wal` / `-shm`).

## Бъдеще: PostgreSQL

- **Статус:** не е започнато в кода. Репетиция първо на desktop PC (копие на `data.db.gz`), после prod.
- **Моделите** (Prisma) остават същите; сменя се `provider`, adapter (`pg`), нова baseline migration история (старите SQLite миграции **не** се преиграват на Postgres).
- **Cutover:** maintenance → финален SQLite backup → import → `DATABASE_URL=postgresql://…` → smoke → SQLite файлът се пази 7–14 дни за fallback.
- **Рискове:** ~4.4M `Product` реда; `LIKE` case-sensitivity (вероятно `ILIKE`); скриптове с `better-sqlite3` / `INSERT OR IGNORE`.
- Подробен план в Cursor canvas: `postgres-migration-plan.canvas.tsx` (workspace canvases).

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

Покрити са годност, график, OCR ред, експорт на снимка, **tap-to-zoom** на детайлна снимка и достъп до качени снимки, плюс вход, админ и ролите home/retail.

## Промени 2026-10-18 (резюме)

| Област | Какво |
|--------|--------|
| Auth | Само httpOnly `expire365_session`; махнат JS-четим client session cookie; legacy magazin cookies се чистят |
| Rename | Код/package/скриптове → expire365; prod пътища/PM2 още magazin |
| Снимки | Private uploads + auth на `/uploads/:filename`; zoom в детайли с **едно** докосване |
| Админ Accounts | Дата на регистрация до акаунт и до потребител |
| Minimart admin | Мобилен UX + `MenuSelect` portal/search |
| Docs / ops | Production топология, backup бележки, Postgres само като бъдещ план |
| Не е в scope днес | Postgres cutover; persist на rate limits; преименуване на `/var/www/magazin` на сървъра |
