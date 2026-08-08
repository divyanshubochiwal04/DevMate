-- CreateEnum
CREATE TYPE "VaultItemType" AS ENUM ('SECURE_NOTE', 'CREDENTIAL', 'PASSWORD', 'API_KEY', 'RECOVERY_CODE', 'IDENTITY', 'DOCUMENT', 'GENERIC_SECRET');

-- DropForeignKey
ALTER TABLE "vault_passwords" DROP CONSTRAINT "vault_passwords_user_id_fkey";

-- DropForeignKey
ALTER TABLE "vault_secure_notes" DROP CONSTRAINT "vault_secure_notes_user_id_fkey";

-- AlterTable
ALTER TABLE "vault_file_versions" ADD COLUMN     "content_auth_tag" VARCHAR(64),
ADD COLUMN     "content_iv" VARCHAR(64),
ADD COLUMN     "dek_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "vault_files" ADD COLUMN     "content_auth_tag" VARCHAR(64),
ADD COLUMN     "content_iv" VARCHAR(64),
ADD COLUMN     "dek_version" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "vault_passwords";

-- DropTable
DROP TABLE "vault_secure_notes";

-- CreateTable
CREATE TABLE "vault_user_keys" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "wrapped_key" TEXT NOT NULL,
    "wrap_iv" VARCHAR(64) NOT NULL,
    "wrap_auth_tag" VARCHAR(64) NOT NULL,
    "wrapping_algorithm" VARCHAR(50) NOT NULL,
    "kek_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "vault_user_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_items" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "folder_id" VARCHAR(36),
    "type" "VaultItemType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "content_iv" VARCHAR(64) NOT NULL,
    "content_auth_tag" VARCHAR(64) NOT NULL,
    "algorithm" VARCHAR(20) NOT NULL DEFAULT 'aes-256-gcm',
    "encryption_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "dek_version" INTEGER NOT NULL DEFAULT 1,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" VARCHAR(36),
    "updated_by" VARCHAR(36),
    "deleted_by" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vault_user_keys_user_id_key" ON "vault_user_keys"("user_id");

-- CreateIndex
CREATE INDEX "idx_vault_items_user_folder" ON "vault_items"("user_id", "folder_id");

-- AddForeignKey
ALTER TABLE "vault_user_keys" ADD CONSTRAINT "vault_user_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "vault_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
