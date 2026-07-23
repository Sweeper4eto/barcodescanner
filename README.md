# Magazin

Уеб приложение за управление на стока и срок на годност по магазини — оптимизирано за телефон.

## Функции

- Регистрация/вход, админ панел, потребителско меню
- Сканиране на баркод с камера, снимки на продукти
- Клиенти, магазини, потребители, плащания с календар
- Списък „Годност“ с цветово кодиране
- **PWA** — добавяне на началния екран на телефона

Документация: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### PWA на телефон

- **iPhone:** Safari → Сподели → „Добави на началния екран“
- **Android:** Chrome → „Инсталирай приложение“

> **Важно за тестване на реален iPhone по локална мрежа (`npm run dev:lan`):** сертификатът от `scripts/lan-https.mjs` е self-signed. Safari позволява да разглеждаш сайта след предупреждението, но икона добавена на началния екран от такъв адрес обикновено **не се отваря** (грешка при зареждане), а push notifications изобщо не работят зад ненадежден сертификат — на iOS `PushManager` съществува само в инсталирано като Home Screen приложение с истински доверен HTTPS. За реално тестване на инсталация + push на iPhone: качи сертификата от `.certs/` в „Certificate Trust Settings“ на телефона (Settings → General → VPN & Device Management), или тествай през публичен домейн с валиден сертификат (Let's Encrypt/production).

### Push notifications (VAPID)

Известията за изтичащ срок изискват VAPID ключове в `.env` — без тях функцията е тихо изключена (бутонът не се показва, cron-джобът пропуска изпращането):

```bash
npm run vapid
# копирай изхода (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT) в .env
```

## Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

[http://localhost:3000](http://localhost:3000) · Админ: `admin` / `admin123`

## Скриптове

| Команда | Описание |
|---------|----------|
| `npm run dev` | Development |
| `npm run validate` | lint + test + build |
| `npm run db:migrate` | Миграции |
| `npm run db:seed` | Seed админ |
