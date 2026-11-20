CREATE TYPE "OrderStatusSource" AS ENUM ('WEB', 'TELEGRAM');

ALTER TABLE "OrderStatusHistory"
ADD COLUMN "source" "OrderStatusSource" NOT NULL DEFAULT 'WEB';

ALTER TABLE "User"
ADD COLUMN "telegramUserId" TEXT,
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramLinkCodeHash" TEXT,
ADD COLUMN "telegramLinkExpiresAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");
