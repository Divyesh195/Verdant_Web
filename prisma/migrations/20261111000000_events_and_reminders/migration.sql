-- CreateEnum
BEGIN;

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WEB_PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderTarget" AS ENUM ('START', 'DUE', 'END');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompletionSource" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "category" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "requestKey" TEXT NOT NULL,
    "dueAt" TIMESTAMPTZ(3),
    "autoCompleteOnDue" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ(3),
    "completionSource" "CompletionSource",
    "previousEventId" TEXT,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "frequency" "ReminderFrequency" NOT NULL,
    "rule" JSONB,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "channels" "ReminderChannel"[] DEFAULT ARRAY['EMAIL']::"ReminderChannel"[],
    "firstRunAt" TIMESTAMPTZ(3) NOT NULL,
    "repeatUntil" TIMESTAMPTZ(3),
    "offsetMinutes" INTEGER,
    "target" "ReminderTarget",
    "nextRunAt" TIMESTAMPTZ(3),
    "lastSentAt" TIMESTAMPTZ(3),
    "lastScheduledFor" TIMESTAMPTZ(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMPTZ(3),
    "lockToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailPreference" (
    "userId" UUID NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_previousEventId_key" ON "Event"("previousEventId");

-- CreateIndex
CREATE INDEX "Event_userId_status_idx" ON "Event"("userId", "status");

-- CreateIndex
CREATE INDEX "Event_userId_startsAt_idx" ON "Event"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_status_autoCompleteOnDue_dueAt_idx" ON "Event"("status", "autoCompleteOnDue", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_userId_requestKey_key" ON "Event"("userId", "requestKey");

-- CreateIndex
CREATE INDEX "Reminder_enabled_nextRunAt_idx" ON "Reminder"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "Reminder_eventId_idx" ON "Reminder"("eventId");

-- CreateIndex
CREATE INDEX "ReminderDelivery_status_scheduledFor_idx" ON "ReminderDelivery"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReminderDelivery_reminderId_scheduledFor_idx" ON "ReminderDelivery"("reminderId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_reminderId_channel_scheduledFor_recipientK_key" ON "ReminderDelivery"("reminderId", "channel", "scheduledFor", "recipientKey");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_previousEventId_fkey" FOREIGN KEY ("previousEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_auto_complete_requires_due" CHECK (NOT "autoCompleteOnDue" OR "dueAt" IS NOT NULL);
ALTER TABLE "Event" ADD CONSTRAINT "Event_dates_ordered" CHECK ("endsAt" IS NULL OR ("startsAt" IS NOT NULL AND "endsAt" >= "startsAt"));
ALTER TABLE "Event" ADD CONSTRAINT "Event_no_self_successor" CHECK ("previousEventId" IS DISTINCT FROM id);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_channels_nonempty" CHECK (cardinality(channels) BETWEEN 1 AND 2);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_offset_target_pair" CHECK (("offsetMinutes" IS NULL) = (target IS NULL));
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_quiet_hours_valid" CHECK (
  ("quietHoursStart" IS NULL AND "quietHoursEnd" IS NULL) OR
  ("quietHoursStart" IS NOT NULL AND "quietHoursEnd" IS NOT NULL AND "quietHoursStart" BETWEEN 0 AND 23 AND "quietHoursEnd" BETWEEN 0 AND 23)
);

COMMIT;
