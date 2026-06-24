# Magazin — архитектура

**Last updated:** 2026-06-24

Мобилно-оптимизирано уеб приложение за управление на стока по магазини, срок на годност, клиенти и месечни плащания.

## Технологии

| Слой | Избор |
|------|--------|
| Frontend + API | Next.js 16, React 19, Tailwind |
| База данни | SQLite (dev) / PostgreSQL (prod) |
| ORM | Prisma 7 + better-sqlite3 adapter |
| Auth | JWT в httpOnly cookie |
| Баркод | html5-qrcode |
| Снимки | MediaDevices API + качване в `public/uploads` |
| PWA | Web manifest, service worker, икони за „Добави на началния екран“ |

## Роли

- **ADMIN** — `/admin`: клиенти, магазини, потребители, плащания
- **USER** — `/app`: сканиране, въвеждане, годност (след асайнване)

## Функционалност

### Админ панел

- **Клиенти:** търсене, създаване, редакция, деактивиране, изтриване
- **Магазини:** CRUD по клиент, enable/disable, адрес/телефон/бележка
- **Потребители:** асайнване към клиент, избор на магазини, деактивиране
- **Плащания:** календар по месец, платено/неплатено, отстъпка при запис

### Потребител

- Регистрация → „Please contact administrator for Customer assignment“
- Логин без клиент или с неактивен клиент → грешка
- Dropdown магазин (запомня се в `localStorage`)
- **Сканирай:** камера/ръчно → продукт → количество 1–20 → дата → запис
- **Въведи стока:** баркод → име → снимка → глобална база
- **Годност:** сортиране по срок, цветове, премахване

### Годност и purge

- Видими: изтичащи в следващите 3 месеца или изтекли до 6 месеца назад
- Цветове: ≤7д червено, ≤14д жълто, ≤28д синьо
- `removedAt` — ръчно премахване от списъка
- `deletedAt` — hard delete 6 месеца след изтичане (cron + при зареждане на списъка)

## API

| Метод | Път | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Потребител + магазини |
| GET/POST/PATCH/DELETE | `/api/admin/clients` | Клиенти |
| GET/POST/PATCH/DELETE | `/api/admin/stores` | Магазини |
| GET/PATCH | `/api/admin/users` | Потребители |
| GET/POST | `/api/admin/payments` | Плащания |
| GET | `/api/admin/payments/calendar` | Календарен изглед |
| GET/POST | `/api/products` | Продукти |
| GET/POST/PATCH | `/api/inventory` | Стока в магазин |
| POST | `/api/upload` | Качване на снимка |
| POST/GET | `/api/cron/purge-inventory` | Hard delete (header `x-cron-secret`) |

## PWA (Progressive Web App)

Приложението може да се **добави на началния екран** на телефона и да се отваря на цял екран като приложение.

- Manifest: `src/app/manifest.ts` → `/manifest.webmanifest`
- Service worker: `public/sw.js` (кешира основни страници; API заявките винаги са online)
- Икони: `public/icons/` (генерират се с `npm run icons`)

### iPhone (Safari)

1. Отворете сайта в Safari
2. Бутон **Сподели** → **Add to Home Screen** / **Добави на началния екран**

### Android (Chrome)

1. Отворете сайта в Chrome
2. Меню → **Инсталирай приложение** или **Добави на началния екран**

> За камерата на телефон в production е препоръчително **HTTPS**.

## Cron

Извикване (напр. от systemd/cron job):

```bash
curl -X POST -H "x-cron-secret: YOUR_SECRET" http://localhost:3000/api/cron/purge-inventory
```

## Стартиране

```bash
cd D:\Work\magazin
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Админ: `admin` / `admin123`

## Тестове

```bash
npm run validate   # lint + test + build
```

`tests/expiry.test.ts` — формула за плащания, видимост и цветове на годност.
