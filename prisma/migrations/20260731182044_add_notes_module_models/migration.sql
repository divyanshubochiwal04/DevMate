/*
  Warnings:

  - Added the required column `user_id` to the `note_tags` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('PLAIN', 'MARKDOWN', 'CHECKLIST', 'JOURNAL', 'REFERENCE', 'SNIPPET');

-- DropIndex
DROP INDEX "note_tags_name_key";

-- AlterTable
ALTER TABLE "note_tags" ADD COLUMN     "user_id" VARCHAR(36) NOT NULL;

-- AlterTable
ALTER TABLE "note_versions" ADD COLUMN     "edited_by_id" VARCHAR(36),
ADD COLUMN     "summary" VARCHAR(255);

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "character_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimated_reading_time" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "folder_id" VARCHAR(36),
ADD COLUMN     "is_favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "NoteType" NOT NULL DEFAULT 'PLAIN',
ADD COLUMN     "word_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "note_folders" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "parent_id" VARCHAR(36),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_attachments" (
    "id" VARCHAR(36) NOT NULL,
    "note_id" VARCHAR(36) NOT NULL,
    "vault_file_id" VARCHAR(36) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "note_folders_user_id_parent_id_name_key" ON "note_folders"("user_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "idx_note_tags_user_name" ON "note_tags"("user_id", "name");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "note_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_versions" ADD CONSTRAINT "note_versions_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_folders" ADD CONSTRAINT "note_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_folders" ADD CONSTRAINT "note_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "note_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_vault_file_id_fkey" FOREIGN KEY ("vault_file_id") REFERENCES "vault_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
