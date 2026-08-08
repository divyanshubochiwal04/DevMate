-- AlterEnum
ALTER TYPE "PriorityLevel" ADD VALUE 'URGENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TodoStatus" ADD VALUE 'TODO';
ALTER TYPE "TodoStatus" ADD VALUE 'WAITING';
ALTER TYPE "TodoStatus" ADD VALUE 'BLOCKED';
ALTER TYPE "TodoStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "TodoStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "actual_duration" INTEGER,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by_id" VARCHAR(36),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "completed_by_id" VARCHAR(36),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "estimated_duration" INTEGER,
ADD COLUMN     "list_id" VARCHAR(36),
ADD COLUMN     "parent_todo_id" VARCHAR(36),
ADD COLUMN     "project_id" VARCHAR(36),
ADD COLUMN     "recurrence_rule" TEXT,
ADD COLUMN     "start_date" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'TODO';

-- CreateTable
CREATE TABLE "todo_projects" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_lists" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_labels" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "color" VARCHAR(7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_label_mappings" (
    "todo_id" VARCHAR(36) NOT NULL,
    "label_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "todo_label_mappings_pkey" PRIMARY KEY ("todo_id","label_id")
);

-- CreateTable
CREATE TABLE "todo_attachments" (
    "id" VARCHAR(36) NOT NULL,
    "todo_id" VARCHAR(36) NOT NULL,
    "vault_file_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_comments" (
    "id" VARCHAR(36) NOT NULL,
    "todo_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_checklists" (
    "id" VARCHAR(36) NOT NULL,
    "todo_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_checklist_items" (
    "id" VARCHAR(36) NOT NULL,
    "checklist_id" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_history" (
    "id" VARCHAR(36) NOT NULL,
    "todo_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_dependencies" (
    "id" VARCHAR(36) NOT NULL,
    "todo_id" VARCHAR(36) NOT NULL,
    "depends_on_todo_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "todo_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "todo_projects_user_id_name_key" ON "todo_projects"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "todo_lists_user_id_name_key" ON "todo_lists"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "todo_labels_user_id_name_key" ON "todo_labels"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "todo_dependencies_todo_id_depends_on_todo_id_key" ON "todo_dependencies"("todo_id", "depends_on_todo_id");

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "todo_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "todo_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_parent_todo_id_fkey" FOREIGN KEY ("parent_todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_projects" ADD CONSTRAINT "todo_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_labels" ADD CONSTRAINT "todo_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_label_mappings" ADD CONSTRAINT "todo_label_mappings_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_label_mappings" ADD CONSTRAINT "todo_label_mappings_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "todo_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_attachments" ADD CONSTRAINT "todo_attachments_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_attachments" ADD CONSTRAINT "todo_attachments_vault_file_id_fkey" FOREIGN KEY ("vault_file_id") REFERENCES "vault_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_comments" ADD CONSTRAINT "todo_comments_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_comments" ADD CONSTRAINT "todo_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_checklists" ADD CONSTRAINT "todo_checklists_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_checklist_items" ADD CONSTRAINT "todo_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "todo_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_history" ADD CONSTRAINT "todo_history_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_history" ADD CONSTRAINT "todo_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_dependencies" ADD CONSTRAINT "todo_dependencies_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_dependencies" ADD CONSTRAINT "todo_dependencies_depends_on_todo_id_fkey" FOREIGN KEY ("depends_on_todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
