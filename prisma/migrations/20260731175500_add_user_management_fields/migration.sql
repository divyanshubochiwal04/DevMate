-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "TimeFormat" AS ENUM ('H12', 'H24');

-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('YYYY_MM_DD', 'DD_MM_YYYY', 'MM_DD_YYYY');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('METRIC', 'IMPERIAL');

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "ai_preferences" JSONB,
ADD COLUMN     "privacy_settings" JSONB,
ADD COLUMN     "security_settings" JSONB,
ADD COLUMN     "telegram_preferences" JSONB;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "date_format" "DateFormat" NOT NULL DEFAULT 'YYYY_MM_DD',
ADD COLUMN     "measurement_units" "MeasurementUnit" NOT NULL DEFAULT 'METRIC',
ADD COLUMN     "notification_preferences" JSONB,
ADD COLUMN     "number_format" VARCHAR(50) NOT NULL DEFAULT 'COMMAS',
ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'DARK',
ADD COLUMN     "time_format" "TimeFormat" NOT NULL DEFAULT 'H24',
ADD COLUMN     "week_start_day" "WeekDay" NOT NULL DEFAULT 'MONDAY';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_file_id" VARCHAR(36),
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "last_active" TIMESTAMP(3),
ADD COLUMN     "last_username_change" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "telegram_conversations" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "current_state" VARCHAR(100) NOT NULL DEFAULT 'START',
    "handler_id" VARCHAR(100),
    "step" INTEGER NOT NULL DEFAULT 0,
    "state_data" TEXT NOT NULL,
    "stack_data" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_conversations_user_id_chat_id_key" ON "telegram_conversations"("user_id", "chat_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "vault_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
