-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'INVESTMENT', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('BORROWED', 'LENT');

-- CreateEnum
CREATE TYPE "FinancialGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- AlterTable
ALTER TABLE "expense_categories" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" VARCHAR(36),
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "loan_emis" ADD COLUMN     "installment_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "late_fee" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "remaining_installments" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "direction" "LoanDirection" NOT NULL DEFAULT 'BORROWED',
ADD COLUMN     "remaining_balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "auto_renew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "trial" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "opening_balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "current_balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "available_balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "description" VARCHAR(255) NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "transfer_id" VARCHAR(36),
    "exchange_rate" DECIMAL(10,6) NOT NULL DEFAULT 1.000000,
    "base_amount" DECIMAL(18,4) NOT NULL,
    "category_id" VARCHAR(36),
    "account_id" VARCHAR(36) NOT NULL,
    "to_account_id" VARCHAR(36),
    "recurring_id" VARCHAR(36),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "description" VARCHAR(255) NOT NULL,
    "category_id" VARCHAR(36),
    "account_id" VARCHAR(36) NOT NULL,
    "to_account_id" VARCHAR(36),
    "frequency" "ReminderFrequency" NOT NULL DEFAULT 'MONTHLY',
    "rrule" VARCHAR(255),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "next_run" TIMESTAMP(3),
    "last_run" TIMESTAMP(3),
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "max_occurrences" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_ledger_entries" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "account_id" VARCHAR(36) NOT NULL,
    "transaction_id" VARCHAR(36),
    "amount" DECIMAL(18,4) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_goals" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "target_amount" DECIMAL(18,4) NOT NULL,
    "saved_amount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "deadline" TIMESTAMP(3),
    "status" "FinancialGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "linked_account_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_transactions_user_account_date" ON "finance_transactions"("user_id", "account_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "recurring_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
