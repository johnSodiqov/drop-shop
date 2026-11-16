# ARCHITECTURE.md — Архитектура DropStore

## 1. Общая архитектура

DropStore — веб-платформа для дропшиппинга.

Владелец платформы добавляет товары и управляет складом. Агенты размещают товары на продажу, устанавливают разрешённую наценку и получают прибыль с заказов. Покупатели оформляют заказы через сайт.

Архитектура проекта — модульный монолит.

На этапе MVP запрещено использовать микросервисы без необходимости.

Frontend и Backend должны быть разделены на отдельные приложения.

## 2. Технологический стек

### Backend
- Node.js
- TypeScript
- NestJS
- REST API
- JWT Authentication
- Passport.js
- class-validator
- class-transformer

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Axios
- React Hook Form
- Zod

### Database
- PostgreSQL
- Prisma ORM
- Prisma Schema
- Prisma Migrations

### Интеграции
- Telegram Bot API

### Инструменты разработки
- Git
- npm
- ESLint
- Prettier
- Docker Compose — для локального запуска PostgreSQL при необходимости

## 3. Структура проекта

Использовать структуру Monorepo.

```text
DropStore/
│
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   │
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/
│   │   │   │
│   │   │   ├── config/
│   │   │   │
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── agents/
│   │   │   │   ├── products/
│   │   │   │   ├── categories/
│   │   │   │   ├── inventory/
│   │   │   │   ├── orders/
│   │   │   │   ├── pricing/
│   │   │   │   ├── telegram/
│   │   │   │   └── admin/
│   │   │   │
│   │   │   └── health/
│   │   │
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   │
│       │   ├── app/
│       │   │   ├── router/
│       │   │   ├── providers/
│       │   │   └── layouts/
│       │   │
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── common/
│       │   │   └── forms/
│       │   │
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── products/
│       │   │   ├── orders/
│       │   │   ├── admin/
│       │   │   ├── agent/
│       │   │   └── customer/
│       │   │
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── services/
│       │   ├── types/
│       │   └── utils/
│       │
│       ├── public/
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   └── shared/
│       ├── types/
│       └── constants/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── docs/
│
├── .env.example
├── .gitignore
├── package.json
├── AGENT_RULES.md
├── ARCHITECTURE.md
├── README.md
└── ТЗ.md
```

Агент может изменять структуру, если это обосновано архитектурными решениями. Не создавать лишние директории и модули без необходимости.

## 4. Backend — NestJS

Backend должен быть построен на NestJS с использованием TypeScript.

### Архитектура модулей

Каждый бизнес-модуль должен иметь собственную структуру.

Пример:

```text
modules/
└── products/
    ├── products.module.ts
    ├── products.controller.ts
    ├── products.service.ts
    ├── products.repository.ts
    ├── dto/
    │   ├── create-product.dto.ts
    │   └── update-product.dto.ts
    └── entities/
```

### Controller

Контроллеры отвечают за:

- Обработку HTTP-запросов.
- Валидацию DTO.
- Проверку доступа через Guards.
- Вызов сервисов.
- Формирование HTTP-ответов.

Контроллеры не должны содержать сложную бизнес-логику.

### Service

Сервисы содержат бизнес-логику:

- ProductsService — управление товарами.
- OrdersService — оформление и обработка заказов.
- PricingService — расчёт цены и прибыли.
- InventoryService — управление остатками.
- AuthService — регистрация и авторизация.
- TelegramService — отправка уведомлений.

### Repository

Repository отвечает за работу с базой данных.

Использовать Prisma ORM.

Не размещать SQL-запросы и логику работы с БД непосредственно в контроллерах.

## 5. Frontend — React + Vite

Frontend должен быть реализован на React с TypeScript.

Vite используется как инструмент сборки и разработки.

### Основные требования

- SPA-архитектура.
- React Router для маршрутизации.
- TanStack Query для серверного состояния.
- Axios для HTTP-запросов.
- React Hook Form для форм.
- Zod для валидации форм.
- Tailwind CSS для стилизации.

### UI

Дизайн должен быть:

- Минималистичным.
- Современным.
- Адаптивным.
- Лёгким для восприятия.
- Ориентированным на коммерческое использование.

Обязательно предусмотреть:

- Loading states.
- Error states.
- Empty states.
- Skeleton loaders.
- Toast notifications.
- Подтверждение важных действий.

Не создавать статические элементы интерфейса, которые выглядят функциональными, но не выполняют действий.

## 6. Database — PostgreSQL + Prisma

Использовать PostgreSQL как основную базу данных.

Prisma ORM должна использоваться для:

- Описания моделей.
- Определения связей.
- Генерации Prisma Client.
- Выполнения запросов.
- Управления миграциями.

Основная схема базы данных должна находиться в:

```text
prisma/schema.prisma
```

### Основные сущности

- User
- AgentProfile
- Product
- Category
- Inventory
- Order
- OrderItem
- Transaction
- NotificationLog

### Требования к Prisma Schema

- Использовать корректные типы данных.
- Определять связи через relations.
- Использовать enum для ролей и статусов.
- Использовать индексы для часто запрашиваемых полей.
- Использовать Decimal для денежных значений.
- Не использовать Float для денежных расчётов.
- Определять createdAt и updatedAt.
- Использовать уникальные ограничения для SKU и других уникальных полей.
- Создавать миграции через Prisma Migrate.

Не изменять структуру базы данных вручную в обход Prisma Migrations.

## 7. Authentication и Authorization

Использовать JWT для аутентификации.

Рекомендуемая реализация:

- NestJS Passport.
- JWT Access Token.
- Refresh Token при необходимости.
- bcrypt или Argon2 для хеширования паролей.
- Guards для защиты маршрутов.
- Role-based access control (RBAC).

Роли:

### ADMIN
Полный доступ к системе.

### AGENT
Доступ к каталогу, собственным продажам, заказам и прибыли.

### CUSTOMER
Доступ к каталогу, оформлению и собственным заказам.

Проверка прав должна выполняться на Backend.

Frontend не является источником доверия при проверке ролей.

## 8. Бизнес-логика

### 8.1 Products

Каждый товар должен содержать:

- ID
- SKU
- Название
- Описание
- Категорию
- Изображения
- Закупочную цену
- Рекомендованную цену продажи
- Минимальную разрешённую цену
- Количество на складе
- Статус активности

Управление товарами осуществляется администратором.

### 8.2 Pricing

Агент устанавливает цену продажи в рамках разрешённых ограничений.

Расчёт:

```text
Прибыль агента = Цена продажи - Закупочная цена
```

Цена закупки и цена продажи сохраняются в OrderItem при создании заказа.

Изменение цены товара не должно влиять на ранее оформленные заказы.

### 8.3 Orders

При оформлении заказа:

1. Проверить авторизацию.
2. Проверить доступность товаров.
3. Проверить актуальную цену.
4. Проверить складские остатки.
5. Рассчитать итоговую стоимость.
6. Рассчитать прибыль агента.
7. Создать Order.
8. Создать OrderItems.
9. Обновить складские остатки.
10. Сохранить данные через транзакцию Prisma.
11. Отправить уведомление в Telegram.

Операции с заказом и остатками должны быть атомарными.

Использовать Prisma `$transaction` для связанных операций.

Предотвращать оформление заказа с количеством товара больше доступного остатка.

### 8.4 Order Statuses

Использовать enum:

```text
NEW
CONFIRMED
PACKING
DELIVERY
DELIVERED
CANCELLED
```

При отмене заказа:

- Остатки восстанавливаются только один раз.
- Повторная отмена не должна повторно возвращать товар.
- История изменений заказа сохраняется.

## 9. Telegram Bot API

Telegram используется для уведомления администратора о новых заказах.

Уведомление содержит:

- Номер заказа.
- Дату.
- Имя клиента.
- Телефон.
- Адрес.
- Список товаров.
- Количество.
- Закупочную стоимость.
- Цену продажи.
- Итоговую сумму.
- Комментарий.

Токен бота хранить в переменной окружения.

Если Telegram API недоступен, заказ всё равно должен быть сохранён.

Предусмотреть логирование и повторную отправку уведомлений.

## 10. REST API

API должно быть построено на NestJS.

Использовать префикс:

```text
/api/v1
```

Пример маршрутов:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/products
GET    /api/v1/products/:id

GET    /api/v1/categories

POST   /api/v1/orders
GET    /api/v1/orders
GET    /api/v1/orders/:id

GET    /api/v1/agent/dashboard
GET    /api/v1/agent/orders
GET    /api/v1/agent/earnings

GET    /api/v1/admin/dashboard
GET    /api/v1/admin/products
POST   /api/v1/admin/products
PATCH  /api/v1/admin/products/:id
DELETE /api/v1/admin/products/:id

GET    /api/v1/admin/orders
PATCH  /api/v1/admin/orders/:id/status
```

Использовать DTO для входящих запросов.

Все защищённые маршруты должны проверять авторизацию и роли.

## 11. Security

Обязательные требования:

- Валидация входящих данных.
- Использование DTO.
- Защита от SQL Injection через Prisma.
- Защита от XSS.
- Rate Limiting.
- Безопасное хранение JWT.
- Хеширование паролей.
- Проверка прав доступа.
- CORS с ограниченным списком разрешённых доменов.
- Helmet.
- Защита от массового присваивания полей.
- Запрет хранения секретов в исходном коде.
- Проверка загружаемых файлов.

## 12. Environment Variables

Секреты и конфигурация должны храниться в `.env`.

Пример:

```env
NODE_ENV=development

PORT=3000

DATABASE_URL="postgresql://user:password@localhost:5432/dropstore?schema=public"

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=

FRONTEND_URL=http://localhost:5173
```

Не добавлять `.env` в Git.

Предоставить `.env.example` без реальных секретов.

## 13. Testing

Backend:

- Jest.
- Unit Tests.
- Integration Tests.
- E2E Tests.

Frontend:

- Vitest.
- React Testing Library.

Обязательные тесты:

- Регистрация.
- Авторизация.
- RBAC.
- Создание товара.
- Расчёт прибыли.
- Оформление заказа.
- Проверка остатков.
- Отмена заказа.
- Повторная отмена.
- Telegram-уведомления.
- Доступ к чужим заказам.

## 14. Development Workflow

Использовать npm.

Основные команды должны быть доступны через package.json.

Backend:

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
```

Frontend:

```bash
npm run dev
npm run build
npm run test
```

Prisma:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npx prisma studio
```

Команды должны быть документированы в README.md.

## 15. Этапы разработки

### Этап 1
Анализ ТЗ и проектной структуры.

### Этап 2
Настройка Monorepo, NestJS, React, Vite, PostgreSQL и Prisma.

### Этап 3
Создание Prisma Schema и миграций.

### Этап 4
Регистрация, авторизация и RBAC.

### Этап 5
Каталог товаров и административная панель.

### Этап 6
Личный кабинет агента и ценообразование.

### Этап 7
Оформление заказов и управление остатками.

### Этап 8
Telegram-интеграция.

### Этап 9
Тестирование, исправление ошибок и документация.

## 16. Definition of Done

Проект считается завершённым, если:

- Frontend запускается через Vite.
- Backend запускается через NestJS.
- PostgreSQL подключена.
- Prisma Schema корректно описывает структуру БД.
- Миграции выполняются без ошибок.
- Авторизация работает.
- RBAC реализован на Backend.
- Каталог товаров работает.
- Заказы оформляются корректно.
- Складские остатки не нарушаются.
- Telegram-интеграция работает.
- Все основные страницы адаптивны.
- Критические сценарии покрыты тестами.
- README.md содержит инструкцию запуска.