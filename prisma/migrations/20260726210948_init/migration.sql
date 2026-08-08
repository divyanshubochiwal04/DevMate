-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'FIRED', 'MISSED', 'SNOOZED', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ACHIEVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'SETTLED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "EMIStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'PERCENTAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('SCANNING', 'READY', 'INFECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'SECURITY_FLAG', 'IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'TASK', 'FINANCIAL', 'REMINDER', 'SECURITY');

-- CreateEnum
CREATE TYPE "ReminderAction" AS ENUM ('FIRED', 'SNOOZED', 'PAUSED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PROPOSED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISBANDED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('JOINED', 'LEFT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DocumentJobType" AS ENUM ('OCR', 'PDF_MERGE', 'PDF_SPLIT', 'PDF_COMPRESS', 'PDF_PROTECT', 'PDF_UNLOCK', 'PDF_ROTATE', 'PDF_WATERMARK');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ES', 'FR', 'DE', 'IT', 'RU', 'ZH', 'JA');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "BackgroundJobPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PremiumPlan" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3', 'GOOGLE_DRIVE', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "SearchEntityType" AS ENUM ('TODO', 'REMINDER', 'GOAL', 'EXPENSE', 'LOAN', 'SUBSCRIPTION', 'SPLITTER_GROUP', 'NOTE', 'VAULT_FILE');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('OCR', 'PDF_MERGE', 'PDF_SPLIT', 'PDF_COMPRESS', 'PDF_PROTECT', 'PDF_UNLOCK', 'PDF_ROTATE', 'PDF_WATERMARK', 'BACKUP', 'NOTIFICATION_DELAY', 'DATA_EXPORT', 'DATA_IMPORT', 'CLEANUP');

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(36) NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" VARCHAR(100),
    "first_name" VARCHAR(150) NOT NULL,
    "last_name" VARCHAR(150),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "profile_photo" VARCHAR(500),
    "last_login" TIMESTAMP(3),
    "premium_plan" "PremiumPlan",
    "premium_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "base_currency" "Currency" NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "summary_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "notify_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "associated_todo_id" VARCHAR(36),
    "text" VARCHAR(500) NOT NULL,
    "trigger_time" TIMESTAMP(3) NOT NULL,
    "recurrence" VARCHAR(200),
    "snooze_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_milestones" (
    "id" VARCHAR(36) NOT NULL,
    "goal_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "goal_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "category_id" VARCHAR(36),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "principal" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_emis" (
    "id" VARCHAR(36) NOT NULL,
    "loan_id" VARCHAR(36) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "EMIStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "loan_emis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "cycle" VARCHAR(30) NOT NULL DEFAULT 'Monthly',
    "next_billing" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splitter_groups" (
    "id" VARCHAR(36) NOT NULL,
    "owner_id" VARCHAR(36),
    "name" VARCHAR(100) NOT NULL,
    "invite_token" VARCHAR(64) NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "splitter_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splitter_members" (
    "id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "nickname" VARCHAR(100),
    "status" "MemberStatus" NOT NULL DEFAULT 'JOINED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "splitter_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splitter_expenses" (
    "id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,
    "payer_id" VARCHAR(36) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "split_type" "SplitType" NOT NULL DEFAULT 'EQUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "splitter_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splitter_splits" (
    "id" VARCHAR(36) NOT NULL,
    "splitter_expense_id" VARCHAR(36) NOT NULL,
    "member_id" VARCHAR(36) NOT NULL,
    "share_amount" DECIMAL(18,4) NOT NULL,
    "share_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "splitter_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splitter_settlements" (
    "id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,
    "debtor_id" VARCHAR(36) NOT NULL,
    "creditor_id" VARCHAR(36) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PROPOSED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "splitter_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_folders" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "parent_id" VARCHAR(36),
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vault_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_files" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "folder_id" VARCHAR(36),
    "name" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "extension" VARCHAR(15) NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "checksum" VARCHAR(64) NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'SCANNING',
    "mime_type" VARCHAR(100),
    "original_filename" VARCHAR(255),
    "storage_provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storage_disk" VARCHAR(50),
    "encryption_version" VARCHAR(20),
    "checksum_algorithm" VARCHAR(20),
    "scan_result" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vault_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_file_versions" (
    "id" VARCHAR(36) NOT NULL,
    "file_id" VARCHAR(36) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version_val" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vault_file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_secure_notes" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vault_secure_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_passwords" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "domain" VARCHAR(255),
    "username" VARCHAR(150) NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vault_passwords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" VARCHAR(36) NOT NULL,
    "action" "AuditAction" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "correlation_id" VARCHAR(36) NOT NULL,
    "request_id" VARCHAR(36),
    "ip_address" VARCHAR(45),
    "device" VARCHAR(100),
    "browser" VARCHAR(100),
    "country" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "trigger_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'TELEGRAM',
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "failed_reason" TEXT,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_registry" (
    "id" VARCHAR(36) NOT NULL,
    "plugin_id" VARCHAR(100) NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "status" "PluginStatus" NOT NULL DEFAULT 'INACTIVE',
    "manifest" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version_val" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plugin_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_groups" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "group_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" VARCHAR(36) NOT NULL,
    "permission_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" VARCHAR(36) NOT NULL,
    "role_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "device_name" VARCHAR(100),
    "platform" VARCHAR(50),
    "browser" VARCHAR(50),
    "os" VARCHAR(50),
    "last_activity_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthdays" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "contact_name" VARCHAR(200) NOT NULL,
    "birthdate" DATE NOT NULL,
    "remind_days_before" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "birthdays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_history" (
    "id" VARCHAR(36) NOT NULL,
    "reminder_id" VARCHAR(36) NOT NULL,
    "action" "ReminderAction" NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reminder_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" VARCHAR(36) NOT NULL,
    "job_type" "JobType" NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_log" TEXT,
    "queue" VARCHAR(50),
    "priority" "BackgroundJobPriority" NOT NULL DEFAULT 'MEDIUM',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "worker" VARCHAR(100),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" VARCHAR(36) NOT NULL,
    "update_id" BIGINT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_index_metadata" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "target_table" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(36) NOT NULL,
    "searchable_text" TEXT NOT NULL,
    "entity_type" "SearchEntityType" NOT NULL,
    "ranking_score" DECIMAL(5,2),
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "search_index_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_trashed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_versions" (
    "id" VARCHAR(36) NOT NULL,
    "note_id" VARCHAR(36) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "note_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_tags" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "note_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_tag_maps" (
    "note_id" VARCHAR(36) NOT NULL,
    "tag_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "note_tag_maps_pkey" PRIMARY KEY ("note_id","tag_id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "rrule" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_reminders" (
    "id" VARCHAR(36) NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "offset_minutes" INTEGER NOT NULL,
    "trigger_time" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "calendar_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_attendees" (
    "id" VARCHAR(36) NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "email" VARCHAR(150),
    "name" VARCHAR(150) NOT NULL,
    "status" "AttendeeStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "calendar_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "category_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_jobs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "input_file_id" VARCHAR(36),
    "language" "Language",
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_pages" (
    "id" VARCHAR(36) NOT NULL,
    "job_id" VARCHAR(36) NOT NULL,
    "page_number" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ocr_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" VARCHAR(36) NOT NULL,
    "page_id" VARCHAR(36) NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "bounding_box" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_jobs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "job_type" "DocumentJobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error_log" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pdf_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_source_files" (
    "id" VARCHAR(36) NOT NULL,
    "job_id" VARCHAR(36) NOT NULL,
    "file_id" VARCHAR(36) NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pdf_source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_output_files" (
    "id" VARCHAR(36) NOT NULL,
    "job_id" VARCHAR(36) NOT NULL,
    "file_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pdf_output_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_todos_user_status" ON "todos"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_todos_user_due" ON "todos"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "idx_reminders_user_trigger_status" ON "reminders"("user_id", "trigger_time", "status");

-- CreateIndex
CREATE INDEX "idx_goals_user_status" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_milestones_goal" ON "goal_milestones"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_user_id_name_key" ON "expense_categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "idx_expenses_user_category_date" ON "expenses"("user_id", "category_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_loans_user_status" ON "loans"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_emis_loan_due_status" ON "loan_emis"("loan_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "idx_subs_user_billing_status" ON "subscriptions"("user_id", "next_billing", "status");

-- CreateIndex
CREATE UNIQUE INDEX "splitter_groups_invite_token_key" ON "splitter_groups"("invite_token");

-- CreateIndex
CREATE INDEX "idx_splitter_owner" ON "splitter_groups"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_members_group_user" ON "splitter_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_splitter_expenses_group_payer" ON "splitter_expenses"("group_id", "payer_id");

-- CreateIndex
CREATE INDEX "idx_splits_expense_member" ON "splitter_splits"("splitter_expense_id", "member_id");

-- CreateIndex
CREATE INDEX "idx_settlements_group_debt_cred" ON "splitter_settlements"("group_id", "debtor_id", "creditor_id");

-- CreateIndex
CREATE INDEX "idx_folders_user_parent" ON "vault_folders"("user_id", "parent_id");

-- CreateIndex
CREATE INDEX "idx_files_user_folder_status" ON "vault_files"("user_id", "folder_id", "status");

-- CreateIndex
CREATE INDEX "idx_file_versions_file" ON "vault_file_versions"("file_id");

-- CreateIndex
CREATE INDEX "idx_secnotes_search" ON "vault_secure_notes"("user_id", "title");

-- CreateIndex
CREATE INDEX "idx_passwords_search" ON "vault_passwords"("user_id", "title", "domain");

-- CreateIndex
CREATE INDEX "idx_audit_table_record" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_audit_user_date" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_correlation" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_status_trigger" ON "notifications"("user_id", "status", "trigger_time");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_registry_plugin_id_key" ON "plugin_registry"("plugin_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_groups_name_key" ON "permission_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "idx_permissions_group" ON "permissions"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_token_hash" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_user_expiry" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_birthdays_user_date" ON "birthdays"("user_id", "birthdate");

-- CreateIndex
CREATE INDEX "idx_rem_hist_reminder_date" ON "reminder_history"("reminder_id", "executed_at");

-- CreateIndex
CREATE INDEX "idx_jobs_status_priority_queue" ON "background_jobs"("status", "priority", "queue");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_logs_update_id_key" ON "webhook_logs"("update_id");

-- CreateIndex
CREATE INDEX "idx_webhooks_received" ON "webhook_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_search_user_entity" ON "search_index_metadata"("user_id", "entity_type");

-- CreateIndex
CREATE INDEX "idx_search_target" ON "search_index_metadata"("target_table", "target_id");

-- CreateIndex
CREATE INDEX "idx_notes_user_status" ON "notes"("user_id", "is_pinned", "is_archived", "is_trashed");

-- CreateIndex
CREATE INDEX "idx_note_versions_note_ver" ON "note_versions"("note_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "note_tags_name_key" ON "note_tags"("name");

-- CreateIndex
CREATE INDEX "idx_calendar_user_range" ON "calendar_events"("user_id", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "idx_cal_reminders_event_trigger_status" ON "calendar_reminders"("event_id", "trigger_time", "status");

-- CreateIndex
CREATE INDEX "idx_cal_attendees_event_status" ON "calendar_attendees"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_user_id_name_key" ON "budget_categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "idx_budgets_user_cat_dates" ON "budgets"("user_id", "category_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_ocr_jobs_user_status" ON "ocr_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_ocr_pages_job_page" ON "ocr_pages"("job_id", "page_number");

-- CreateIndex
CREATE INDEX "idx_ocr_results_page" ON "ocr_results"("page_id");

-- CreateIndex
CREATE INDEX "idx_pdf_jobs_user_status" ON "pdf_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_pdf_source_files_job_seq" ON "pdf_source_files"("job_id", "sequence_order");

-- CreateIndex
CREATE INDEX "idx_pdf_output_files_job" ON "pdf_output_files"("job_id");

-- CreateIndex
CREATE INDEX "dashboard_snapshots_user_id_created_at_idx" ON "dashboard_snapshots"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_associated_todo_id_fkey" FOREIGN KEY ("associated_todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_emis" ADD CONSTRAINT "loan_emis_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_groups" ADD CONSTRAINT "splitter_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_members" ADD CONSTRAINT "splitter_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "splitter_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_members" ADD CONSTRAINT "splitter_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_expenses" ADD CONSTRAINT "splitter_expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "splitter_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_expenses" ADD CONSTRAINT "splitter_expenses_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "splitter_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_splits" ADD CONSTRAINT "splitter_splits_splitter_expense_id_fkey" FOREIGN KEY ("splitter_expense_id") REFERENCES "splitter_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_splits" ADD CONSTRAINT "splitter_splits_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "splitter_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_settlements" ADD CONSTRAINT "splitter_settlements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "splitter_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_settlements" ADD CONSTRAINT "splitter_settlements_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "splitter_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_settlements" ADD CONSTRAINT "splitter_settlements_creditor_id_fkey" FOREIGN KEY ("creditor_id") REFERENCES "splitter_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "vault_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_files" ADD CONSTRAINT "vault_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_files" ADD CONSTRAINT "vault_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "vault_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_file_versions" ADD CONSTRAINT "vault_file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "vault_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_secure_notes" ADD CONSTRAINT "vault_secure_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_passwords" ADD CONSTRAINT "vault_passwords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "permission_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthdays" ADD CONSTRAINT "birthdays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_history" ADD CONSTRAINT "reminder_history_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_index_metadata" ADD CONSTRAINT "search_index_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_versions" ADD CONSTRAINT "note_versions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tag_maps" ADD CONSTRAINT "note_tag_maps_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tag_maps" ADD CONSTRAINT "note_tag_maps_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "note_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_reminders" ADD CONSTRAINT "calendar_reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_attendees" ADD CONSTRAINT "calendar_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_input_file_id_fkey" FOREIGN KEY ("input_file_id") REFERENCES "vault_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_pages" ADD CONSTRAINT "ocr_pages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ocr_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "ocr_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_jobs" ADD CONSTRAINT "pdf_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_source_files" ADD CONSTRAINT "pdf_source_files_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "pdf_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_source_files" ADD CONSTRAINT "pdf_source_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "vault_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_output_files" ADD CONSTRAINT "pdf_output_files_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "pdf_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_output_files" ADD CONSTRAINT "pdf_output_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "vault_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
