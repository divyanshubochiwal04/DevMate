/*
  Warnings:

  - You are about to drop the column `action` on the `reminder_history` table. All the data in the column will be lost.
  - You are about to drop the column `recurrence` on the `reminders` table. All the data in the column will be lost.
  - Added the required column `duration` to the `reminder_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `execution_id` to the `reminder_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `result` to the `reminder_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduled_at` to the `reminder_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trigger_source` to the `reminder_history` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('TODO', 'NOTE', 'EVENT', 'BIRTHDAY', 'FINANCE', 'EMI', 'LOAN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('ONETIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'RRULE');

-- CreateEnum
CREATE TYPE "RetryStrategy" AS ENUM ('FIXED', 'LINEAR', 'EXPONENTIAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "ReminderStatus" ADD VALUE 'RUNNING';
ALTER TYPE "ReminderStatus" ADD VALUE 'FAILED';
ALTER TYPE "ReminderStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "reminder_history" DROP COLUMN "action",
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "execution_id" VARCHAR(36) NOT NULL,
ADD COLUMN     "result" "ReminderStatus" NOT NULL,
ADD COLUMN     "retry" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduled_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "trigger_source" VARCHAR(100) NOT NULL,
ADD COLUMN     "worker_id" VARCHAR(100);

-- AlterTable
ALTER TABLE "reminders" DROP COLUMN "recurrence",
ADD COLUMN     "last_executed_at" TIMESTAMP(3),
ADD COLUMN     "max_retries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "next_execution_at" TIMESTAMP(3),
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retry_strategy" "RetryStrategy" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "snoozed_until" TIMESTAMP(3),
ADD COLUMN     "target_id" VARCHAR(36),
ADD COLUMN     "target_type" "ReminderType",
ADD COLUMN     "type" "ReminderType" NOT NULL DEFAULT 'CUSTOM';

-- CreateTable
CREATE TABLE "reminder_rules" (
    "id" VARCHAR(36) NOT NULL,
    "reminder_id" VARCHAR(36) NOT NULL,
    "frequency" "ReminderFrequency" NOT NULL DEFAULT 'ONETIME',
    "rrule" VARCHAR(255),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "max_occurrences" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reminder_rules_reminder_id_key" ON "reminder_rules"("reminder_id");

-- CreateIndex
CREATE INDEX "idx_rem_hist_execution_id" ON "reminder_history"("execution_id");

-- AddForeignKey
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
