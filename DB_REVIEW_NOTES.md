# Database Design Review Notes
## Project Name: DevMate — The Telegram-based Personal Operating System

---

## 1. Executive Summary & Verification

This Database Design Review identifies missing tables, structural gaps, and consistency requirements between the **Functional Specification Document (FSD)**, the **API Specification**, and the initial **Database Design Document**. 

To prepare the schema for production-ready Prisma migrations, this review specifies:
* **22 Standardized Column Injectors** for mutable tables (created_by, updated_by, version, etc.).
* **10 New Tables** to resolve missing functional module coverage (Birthdays, Sessions, Jobs, etc.).
* **12 Modification Specifications** for existing tables.
* **16 Strict Logic Enums** to replace free-form text status fields.
* **Composite and Unique Index Additions** for performance targets.

---

## 2. Standardization Requirements (Global Injector)

All mutable tables must include the following audit and lock-control columns to enforce consistency:

```sql
ALTER TABLE [table_name] ADD COLUMN created_by VARCHAR(36) NULL REFERENCES users(id);
ALTER TABLE [table_name] ADD COLUMN updated_by VARCHAR(36) NULL REFERENCES users(id);
ALTER TABLE [table_name] ADD COLUMN deleted_by VARCHAR(36) NULL REFERENCES users(id);
ALTER TABLE [table_name] ADD COLUMN version INT NOT NULL DEFAULT 1;
```

* **Purpose:**
  * `version`: Used by application services to implement optimistic concurrency control.
  * `[audit]_by`: Tracks administration updates, splits adjustments, and user profile management actions.

---

## 3. New Tables to Add

### 3.1 Module: Authentication & RBAC

#### Table: `roles`
* **Purpose:** Core RBAC role types.
* **Owner Module:** User Management.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `name` | VARCHAR(50)  | No | None | Yes | Role name (e.g. ADMIN, USER) |

---

#### Table: `permissions`
* **Purpose:** Granular system capabilities.
* **Owner Module:** User Management.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `name` | VARCHAR(100) | No | None | Yes | Scope string (e.g. `vault:write`) |

---

#### Table: `role_permissions`
* **Purpose:** M2M link table mapping permissions to roles.
* **Owner Module:** User Management.
* **Primary Key:** `(role_id, permission_id)`

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `role_id` | VARCHAR(36) | No | None | No | Role link reference |
| `permission_id`| VARCHAR(36) | No | None | No | Permission link reference |

* **Foreign Keys:**
  * `fk_rp_roles`: `role_id` REFERENCES `roles(id)` ON DELETE CASCADE
  * `fk_rp_permissions`: `permission_id` REFERENCES `permissions(id)` ON DELETE CASCADE

---

#### Table: `user_roles`
* **Purpose:** M2M mapper linking users to active roles.
* **Owner Module:** User Management.
* **Primary Key:** `(user_id, role_id)`

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `user_id` | VARCHAR(36) | No | None | No | User reference link |
| `role_id` | VARCHAR(36) | No | None | No | Role reference link |

* **Foreign Keys:**
  * `fk_ur_users`: `user_id` REFERENCES `users(id)` ON DELETE CASCADE
  * `fk_ur_roles`: `role_id` REFERENCES `roles(id)` ON DELETE CASCADE

---

#### Table: `sessions`
* **Purpose:** Active user login tokens tracker.
* **Owner Module:** User Management.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `user_id` | VARCHAR(36) | No | None | No | Associated user link |
| `refresh_token_hash`| VARCHAR(64) | No | None | Yes | Encrypted refresh token payload |
| `ip_address` | VARCHAR(45)  | Yes | NULL | No | Client IP address context |
| `user_agent` | VARCHAR(255) | Yes | NULL | No | Client browser context |
| `expires_at` | TIMESTAMP | No | None | No | Expiration timestamp |
| `created_at` | TIMESTAMP | No | NOW() | No | Session login timestamp |

* **Foreign Keys:**
  * `fk_sessions_users`: `user_id` REFERENCES `users(id)` ON DELETE CASCADE

---

### 3.2 Module: Personal Management (PMM)

#### Table: `birthdays`
* **Purpose:** Contact birthdays register (Missing from initial design).
* **Owner Module:** Birthday Manager.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `user_id` | VARCHAR(36) | No | None | No | Owner reference |
| `contact_name` | VARCHAR(200) | No | None | No | Contact display name |
| `birthdate` | DATE | No | None | No | Contact birthdate |
| `remind_days_before`| INT | No | 0 | No | Buffer days threshold for alerts |

* **Foreign Keys:**
  * `fk_birthdays_users`: `user_id` REFERENCES `users(id)` ON DELETE CASCADE

---

#### Table: `reminder_history`
* **Purpose:** Chronological log of reminder firings and snoozes.
* **Owner Module:** Reminders.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `reminder_id` | VARCHAR(36) | No | None | No | Parent reminder link |
| `action` | VARCHAR(30) | No | None | No | Trigger type (FIRED/SNOOZED/PAUSED) |
| `executed_at` | TIMESTAMP | No | NOW() | No | Action execution timestamp |

* **Foreign Keys:**
  * `fk_history_reminders`: `reminder_id` REFERENCES `reminders(id)` ON DELETE CASCADE

---

### 3.3 Module: Utilities & Background Processing

#### Table: `background_jobs`
* **Purpose:** Asynchronous queue tracking.
* **Owner Module:** System Core.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `job_type` | VARCHAR(50)  | No | None | No | Task category (OCR, PDF, Backup) |
| `payload` | TEXT | No | None | No | Task parameters JSON payload |
| `status` | VARCHAR(30)  | No | 'Pending' | No | Task execution status |
| `retry_count` | INT | No | 0 | No | Retries execution attempts |
| `error_log` | TEXT | Yes | NULL | No | Trace log of failure exceptions |
| `created_at` | TIMESTAMP | No | NOW() | No | Task creation timestamp |
| `updated_at` | TIMESTAMP | No | NOW() | No | Last update timestamp |

---

#### Table: `webhook_logs`
* **Purpose:** Webhook payloads tracking.
* **Owner Module:** System Core.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `update_id` | BIGINT | No | None | Yes | Unique Telegram Update ID |
| `payload` | TEXT | No | None | No | Full request payload JSON |
| `status` | VARCHAR(30)  | No | 'Received' | No | Processing status |
| `created_at` | TIMESTAMP | No | NOW() | No | Webhook received timestamp |

* **Indexes:**
  * Unique Index: `idx_webhooks_update_id` ON `update_id`

---

#### Table: `search_index_metadata`
* **Purpose:** Global catalog indexing references (speeds up Search).
* **Owner Module:** Search.
* **Primary Key:** `id` VARCHAR(36) UUID

| Column | Datatype | Nullable | Default | Unique | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | VARCHAR(36) | No | None | Yes | Primary ID |
| `user_id` | VARCHAR(36) | No | None | No | Target document owner |
| `target_table` | VARCHAR(100) | No | None | No | Source database table name |
| `target_id` | VARCHAR(36) | No | None | No | Source record UUID |
| `searchable_text`| TEXT | No | None | No | Normalized text content |

* **Foreign Keys:**
  * `fk_search_users`: `user_id` REFERENCES `users(id)` ON DELETE CASCADE

---

## 4. Existing Tables to Modify

1. **`users`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
2. **`todos`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
   * Rename `priority` values logic to match enum boundaries (`LOW`, `MEDIUM`, `HIGH`).
3. **`reminders`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
4. **`goals`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
5. **`expenses`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
6. **`loans`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
7. **`subscriptions`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
8. **`splitter_groups`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
9. **`vault_folders`**:
   * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
10. **`vault_files`**:
    * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
11. **`vault_secure_notes`**:
    * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).
12. **`vault_passwords`**:
    * Add: `created_by` (UUID), `updated_by` (UUID), `deleted_by` (UUID), `version` (INT).

---

## 5. Enum Catalogue Specifications

Logical database column definitions must be updated to use the following standardized enum keys in the Prisma schema:

- **`RoleName`**: `ADMIN`, `USER`, `MEMBER`
- **`UserStatus`**: `PENDING_ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`
- **`PriorityLevel`**: `LOW`, `MEDIUM`, `HIGH`
- **`TodoStatus`**: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`
- **`ReminderStatus`**: `PENDING`, `FIRED`, `MISSED`, `SNOOZED`, `PAUSED`, `COMPLETED`
- **`GoalStatus`**: `DRAFT`, `ACTIVE`, `ACHIEVED`, `ABANDONED`
- **`LoanStatus`**: `ACTIVE`, `SETTLED`, `DEFAULTED`
- **`EMIStatus`**: `PENDING`, `PAID`, `OVERDUE`
- **`SplitType`**: `EQUAL`, `PERCENTAGE`, `CUSTOM`
- **`FileStatus`**: `SCANNING`, `READY`, `INFECTED`, `DELETED`
- **`JobStatus`**: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`
- **`NotificationStatus`**: `UNREAD`, `READ`, `ARCHIVED`
- **`AuditAction`**: `INSERT`, `UPDATE`, `DELETE`, `SECURITY_FLAG`, `IMPORT`, `EXPORT`

---

## 6. Critical Index Additions

The following additional indexes must be defined in the schema to support query performance targets:

* **`idx_sessions_token_hash`**: Unique Index ON `sessions(refresh_token_hash)`
  * *Purpose:* Optimizes token exchanges during session updates.
* **`idx_webhooks_received`**: Index ON `webhook_logs(status, created_at)`
  * *Purpose:* Accelerates logs cleanup sweeps.
* **`idx_search_text`**: Index ON `search_index_metadata(user_id)`
  * *Purpose:* Speeds up global keyword searches.
* **`idx_jobs_status`**: Index ON `background_jobs(status, job_type)`
  * *Purpose:* Accelerates background processing worker loops.

---

## 7. Consistency Corrections

- **Currency Fields Mapping:** The `loan_emis` and `loans` tables require adding a `currency VARCHAR(3)` field to ensure consistency with the `expenses` table for conversion operations.
- **Splitter Deletions:** The delete rule for `splitter_groups.owner_id` is updated from RESTRICT to **SET NULL** or group transfer policy, allowing user account deletions without breaking historical group financial ledgers.
- **Audit Logs payload format:** Change type of `old_value` and `new_value` from TEXT to **JSON** or structured string configurations, matching structured logging principles.
