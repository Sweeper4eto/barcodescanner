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
