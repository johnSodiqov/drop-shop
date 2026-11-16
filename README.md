# DropStore

DropStore is a modular-monolith dropshipping platform. The API is NestJS/TypeScript, the SPA is React/Vite/TypeScript, and PostgreSQL access is through Prisma.

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 15+

## Local setup

1. Copy `.env.example` to `.env`. Set a PostgreSQL `DATABASE_URL`, two different random JWT secrets (at least 32 characters), and strong `ADMIN_PASSWORD`/`ADMIN_PHONE` values.
2. Start local PostgreSQL with `docker compose up -d postgres`, or create the database/user separately. The compose default password is for local development only.
3. Install dependencies: `npm install`.
4. Generate the Prisma client: `npm run db:generate`.
5. Apply migrations: `npm run db:migrate`.
6. Create the first admin and catalog seed data: `npm run db:seed`.
7. Start API and SPA: `npm run dev`.

The API is available at `http://localhost:3000/api/v1`; the SPA is at `http://localhost:5173`. Swagger documentation is available at `http://localhost:3000/api/docs`.

## Deploying the frontend to Vercel

Import the repository into Vercel with the repository root as the project root. The root `vercel.json` builds and serves the React/Vite frontend, including client-side routes. Set `VITE_API_URL` in the Vercel project to the deployed backend URL ending in `/api/v1` (for example, `https://api.example.com/api/v1`).

The NestJS backend is not deployed by this Vercel configuration. Deploy it separately to a Node.js host, provision PostgreSQL, set the backend environment variables from `.env.example` (including a production `DATABASE_URL`, distinct strong JWT secrets, and `FRONTEND_URL` set to the Vercel site URL), then apply migrations with `npm run db:deploy`. Do not deploy using the example credentials.

## Deploying the backend to Railway

Import this GitHub repository into Railway and configure the backend service with the repository root as its root directory. This is an npm-workspaces monorepo, so the root `package.json` and `package-lock.json` must remain available to the service.

Use these service settings:

- Build command: `npm run db:generate && npm run build --workspace @dropstore/backend`
- Pre-deploy command: `npm run db:deploy --workspace @dropstore/backend`
- Start command: `npm run start --workspace @dropstore/backend`
- Healthcheck path: `/api/v1/health`

Add a Railway PostgreSQL service and set the backend service's `DATABASE_URL` to that database's connection URL. Set `NODE_ENV=production`, `FRONTEND_URL` to the Vercel site origin only (for example, `https://shop.example.com`, with no path or trailing slash), and two different random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters. Railway supplies `PORT`; do not hard-code it. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` only if Telegram notifications are needed.

Generate a public domain for the backend in Railway's Networking settings, then set Vercel's `VITE_API_URL` to that domain ending in `/api/v1`. The local `.env` files are ignored by Git and must not be copied to Railway. In particular, generate fresh production JWT secrets and admin credentials instead of reusing local or example values. After configuring the variables, deploy; the pre-deploy command applies committed Prisma migrations. Run `npm run db:seed --workspace @dropstore/backend` as a one-time command if you need to create the initial administrator and sample catalog.

## First administrator

The seed command creates the `ADMIN` account from `ADMIN_PHONE` and `ADMIN_PASSWORD`. The seed fails rather than silently using a hard-coded password when either value is missing. Change the password after first sign-in and never deploy the example credentials.

## Main commands

- `npm run dev` — API and web app in development mode.
- `npm run build` — type-check and production builds for both applications.
- `npm test` — backend and frontend tests.
- `npm run db:generate` — generate Prisma Client.
- `npm run db:migrate` — apply development migrations.
- `npm run db:deploy` — apply committed migrations in a deployed environment.
- `npm run db:seed` — create initial admin and example catalog records.

## Authentication and roles

Registration creates a `CUSTOMER` account. Only an administrator can promote a user to `AGENT` or `ADMIN`; role checks are enforced by API guards. Short-lived access JWTs are kept in frontend memory. Refresh tokens are rotated, stored only as hashes in the database, and delivered in an HttpOnly, SameSite cookie.

Passwords use bcrypt and accept 10–72 printable ASCII characters to stay within bcrypt's 72-byte input limit.

## Orders and stock

The API prices orders from current database records, validates agent pricing against each product's minimum and maximum markup, and decrements stock atomically within a Prisma transaction. Order items preserve cost, sale price, and profit snapshots. Cancelling an order restores stock only on the first valid transition to `CANCELLED`.

## Telegram

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` to enable notifications. Notification records are saved with the order/status transaction; delivery happens after commit and failed messages are retried by the backend scheduler. Orders remain successful if Telegram is unavailable.

## Scope notes

The MVP excludes online payments, automated agent payouts, SMS integration, and multi-level referrals as specified in the technical brief. Phone verification and self-service password recovery require a configured SMS provider and are not represented as working features.
