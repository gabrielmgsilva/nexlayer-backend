-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ACCESSORY_LOW', 'MATERIAL_LOW', 'LIFESPAN_WARNING', 'LIFESPAN_CRITICAL', 'MAINTENANCE_DUE', 'MAINTENANCE_OVERDUE');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "notifications" (
    "id"          TEXT NOT NULL,
    "type"        "NotificationType" NOT NULL,
    "severity"    "NotificationSeverity" NOT NULL DEFAULT 'WARNING',
    "title"       TEXT NOT NULL,
    "message"     TEXT NOT NULL,
    "entity_id"   TEXT,
    "entity_type" TEXT,
    "entity_name" TEXT,
    "is_read"     BOOLEAN NOT NULL DEFAULT false,
    "read_at"     TIMESTAMP(3),
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Index for quick unread count queries
CREATE INDEX "notifications_is_read_expires_at_idx" ON "notifications"("is_read", "expires_at");
