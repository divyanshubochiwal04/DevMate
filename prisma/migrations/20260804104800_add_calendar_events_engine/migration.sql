/*
  Warnings:

  - Added the required column `calendar_id` to the `calendar_events` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('PERSONAL', 'WORK', 'BIRTHDAY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('EVENT', 'MEETING', 'APPOINTMENT', 'BIRTHDAY', 'DEADLINE', 'BLOCK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'RRULE');

-- DropIndex
DROP INDEX "idx_calendar_user_range";

-- AlterTable
ALTER TABLE "calendar_attendees" ADD COLUMN     "telegram_username" VARCHAR(100);

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "calendar_id" VARCHAR(36) NOT NULL,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "location_address" TEXT,
ADD COLUMN     "location_name" VARCHAR(255),
ADD COLUMN     "longitude" DECIMAL(11,8),
ADD COLUMN     "meeting_url" VARCHAR(500),
ADD COLUMN     "note_id" VARCHAR(36),
ADD COLUMN     "parent_recurring_event_id" VARCHAR(36),
ADD COLUMN     "recurrence_count" INTEGER,
ADD COLUMN     "recurrence_end_at" TIMESTAMP(3),
ADD COLUMN     "recurrence_frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "todo_id" VARCHAR(36),
ADD COLUMN     "type" "EventType" NOT NULL DEFAULT 'EVENT';

-- CreateTable
CREATE TABLE "calendars" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "type" "CalendarType" NOT NULL DEFAULT 'PERSONAL',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_attachments" (
    "id" VARCHAR(36) NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "vault_file_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_recurrence_exceptions" (
    "id" VARCHAR(36) NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "original_occurrence_at" TIMESTAMP(3) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "override_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_recurrence_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendars_user_id_idx" ON "calendars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_user_id_name_key" ON "calendars"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_attachments_event_id_vault_file_id_key" ON "calendar_event_attachments"("event_id", "vault_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_recurrence_exceptions_event_id_original_occu_key" ON "calendar_event_recurrence_exceptions"("event_id", "original_occurrence_at");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_start_time_idx" ON "calendar_events"("user_id", "start_time");

-- CreateIndex
CREATE INDEX "calendar_events_calendar_id_start_time_idx" ON "calendar_events"("calendar_id", "start_time");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_status_start_time_idx" ON "calendar_events"("user_id", "status", "start_time");

-- CreateIndex
CREATE INDEX "calendar_events_todo_id_idx" ON "calendar_events"("todo_id");

-- CreateIndex
CREATE INDEX "calendar_events_note_id_idx" ON "calendar_events"("note_id");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_vault_file_id_fkey" FOREIGN KEY ("vault_file_id") REFERENCES "vault_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_recurrence_exceptions" ADD CONSTRAINT "calendar_event_recurrence_exceptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
