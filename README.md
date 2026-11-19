# DropStore

DropStore is a modular-monolith dropshipping platform. The API is NestJS/TypeScript, the SPA is React/Vite/TypeScript, and PostgreSQL access is through Prisma.

## Requirements

- Node.js 20.19+, 22.12+, or 24+
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

## Production services

| Service | Provider and location | Details |
| --- | --- | --- |
| Frontend | Vercel | React/Vite SPA built from the `frontend/` project root using `frontend/vercel.json`; the build publishes to `frontend/dist/`. Its public domain is managed in the Vercel project settings. |
| Backend API | Railway | NestJS service `drop-shop`, available at `https://drop-shop-production.up.railway.app`. Railway's root directory is `/`, but the configured build and start commands target only `@dropstore/backend`. |
| PostgreSQL | Neon | PostgreSQL 17, project `Drop-shop`, branch `production`, database `dropstore`. The API uses the pooled `DATABASE_URL`; Prisma migrations use `DATABASE_URL_UNPOOLED`. |

## Deploying the frontend to Vercel

The Vercel project uses `frontend` as its Root Directory. Keep the Output Directory set to `dist`. `frontend/vercel.json` runs the frontend build from that project root and rewrites client-side routes such as `/profile` to `index.html`. The frontend defaults to the Railway API URL `https://drop-shop-production.up.railway.app/api/v1`; set `VITE_API_URL` in Vercel only if you need to override it.

The NestJS backend is not deployed by this Vercel configuration; the production API runs on Railway. Set its environment variables there, including Neon connection URLs, distinct strong JWT secrets, and `FRONTEND_URL` set to the Vercel site URL. Never deploy using the example credentials.

## Deploying the backend to Railway

Import this GitHub repository into Railway and configure the backend service with the repository root as its root directory. The backend and frontend live in the root-level `backend/` and `frontend/` directories. This is an npm-workspaces monorepo, so the root `package.json` and `package-lock.json` must remain available to the service.

The root `railway.json` defines the backend build, migration, start, and healthcheck commands. Keep the service root directory at the repository root; setting it to `backend/` breaks npm workspace and Prisma config paths.

The build generates Prisma Client and compiles only the backend. Before deployment, Railway applies PostgreSQL migrations; the production start command runs `backend/dist/main.js` through the backend workspace.

Set the backend service's `DATABASE_URL` to Neon's pooled connection string and `DATABASE_URL_UNPOOLED` to its direct connection string before deployment. The API uses the pooled URL; Prisma migration commands prefer the direct URL and fall back to `DATABASE_URL` for other PostgreSQL hosts. Prisma Client generation does not need a database connection, but migrations and the running API do. Do not use a fake URL to make migrations or startup appear successful. Set `NODE_ENV=production`, `FRONTEND_URL=https://drop-shop-frontend-beta.vercel.app` (origin only, no path or trailing slash), and two different random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters. Railway supplies `PORT`; the server listens on it automatically. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` only if Telegram notifications are needed.

Optional Cloudflare R2 variables are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=dropstore-public`, `R2_ENDPOINT`, and `R2_PUBLIC_URL=https://images.dropstore.uz`. The backend remains operational until these variables are configured; storage endpoints return a configuration error until then. Never add R2 secrets to `VITE_*` variables or the frontend.

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
