-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MemberStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "MemberStatus" ADD VALUE 'REMOVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SettlementStatus" ADD VALUE 'PENDING';
ALTER TYPE "SettlementStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SplitType" ADD VALUE 'EXACT';
ALTER TYPE "SplitType" ADD VALUE 'SHARES';

-- DropForeignKey
ALTER TABLE "splitter_expenses" DROP CONSTRAINT "splitter_expenses_group_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_expenses" DROP CONSTRAINT "splitter_expenses_payer_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_groups" DROP CONSTRAINT "splitter_groups_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_members" DROP CONSTRAINT "splitter_members_group_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_members" DROP CONSTRAINT "splitter_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_settlements" DROP CONSTRAINT "splitter_settlements_creditor_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_settlements" DROP CONSTRAINT "splitter_settlements_debtor_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_settlements" DROP CONSTRAINT "splitter_settlements_group_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_splits" DROP CONSTRAINT "splitter_splits_member_id_fkey";

-- DropForeignKey
ALTER TABLE "splitter_splits" DROP CONSTRAINT "splitter_splits_splitter_expense_id_fkey";

-- DropIndex
DROP INDEX "idx_settlements_group_debt_cred";

-- AlterTable
ALTER TABLE "splitter_settlements" DROP COLUMN "creditor_id",
DROP COLUMN "debtor_id",
DROP COLUMN "deleted_at",
DROP COLUMN "deleted_by",
DROP COLUMN "updated_by",
ADD COLUMN     "currency" "Currency" NOT NULL,
ADD COLUMN     "idempotency_key" VARCHAR(64),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payer_member_id" VARCHAR(36) NOT NULL,
ADD COLUMN     "receiver_member_id" VARCHAR(36) NOT NULL,
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "sync_to_finance" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "created_by" SET NOT NULL;

-- DropTable
DROP TABLE "splitter_expenses";

-- DropTable
DROP TABLE "splitter_groups";

-- DropTable
DROP TABLE "splitter_members";

-- DropTable
DROP TABLE "splitter_splits";

-- CreateTable
CREATE TABLE "split_groups" (
    "id" VARCHAR(36) NOT NULL,
    "owner_id" VARCHAR(36),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "default_currency" "Currency" NOT NULL DEFAULT 'USD',
    "icon" VARCHAR(255),
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "split_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_members" (
    "id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "display_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "split_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_expenses" (
    "id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,
    "created_by" VARCHAR(36) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "currency" "Currency" NOT NULL,
    "total_amount" DECIMAL(18,4) NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_id" VARCHAR(36),
    "notes" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),

    CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_payers" (
    "expense_id" VARCHAR(36) NOT NULL,
    "member_id" VARCHAR(36) NOT NULL,
    "amount_paid" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "expense_payers_pkey" PRIMARY KEY ("expense_id","member_id")
);

-- CreateTable
CREATE TABLE "expense_participants" (
    "expense_id" VARCHAR(36) NOT NULL,
    "member_id" VARCHAR(36) NOT NULL,
    "owed_amount" DECIMAL(18,4) NOT NULL,
    "percentage" DECIMAL(5,2),
    "shares" DECIMAL(10,2),

    CONSTRAINT "expense_participants_pkey" PRIMARY KEY ("expense_id","member_id")
);

-- CreateTable
CREATE TABLE "group_expense_history" (
    "id" VARCHAR(36) NOT NULL,
    "expense_id" VARCHAR(36) NOT NULL,
    "version" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "total_amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "split_type" "SplitType" NOT NULL,
    "payers" JSONB NOT NULL,
    "participants" JSONB NOT NULL,
    "status" "ExpenseStatus" NOT NULL,
    "metadata" JSONB,
    "changed_by" VARCHAR(36) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_expense_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "split_groups_owner_id_idx" ON "split_groups"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "split_members_group_id_user_id_key" ON "split_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "group_expenses_group_id_idx" ON "group_expenses"("group_id");

-- CreateIndex
CREATE INDEX "group_expenses_expense_date_idx" ON "group_expenses"("expense_date");

-- CreateIndex
CREATE INDEX "group_expenses_status_idx" ON "group_expenses"("status");

-- CreateIndex
CREATE INDEX "group_expenses_created_by_idx" ON "group_expenses"("created_by");

-- CreateIndex
CREATE INDEX "group_expense_history_expense_id_idx" ON "group_expense_history"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "splitter_settlements_idempotency_key_key" ON "splitter_settlements"("idempotency_key");

-- CreateIndex
CREATE INDEX "splitter_settlements_group_id_idx" ON "splitter_settlements"("group_id");

-- CreateIndex
CREATE INDEX "splitter_settlements_settled_at_idx" ON "splitter_settlements"("settled_at");

-- AddForeignKey
ALTER TABLE "split_groups" ADD CONSTRAINT "split_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_members" ADD CONSTRAINT "split_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "split_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_members" ADD CONSTRAINT "split_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "split_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payers" ADD CONSTRAINT "expense_payers_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payers" ADD CONSTRAINT "expense_payers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "split_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "split_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expense_history" ADD CONSTRAINT "group_expense_history_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_settlements" ADD CONSTRAINT "splitter_settlements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "split_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_settlements" ADD CONSTRAINT "splitter_settlements_payer_member_id_fkey" FOREIGN KEY ("payer_member_id") REFERENCES "split_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splitter_settlements" ADD CONSTRAINT "splitter_settlements_receiver_member_id_fkey" FOREIGN KEY ("receiver_member_id") REFERENCES "split_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
