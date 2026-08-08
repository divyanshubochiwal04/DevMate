# Database Architecture Document (DAD)
## Project Name: DevMate — The Telegram-based Personal Operating System

---

## 1. Database Design Principles

To ensure long-term maintainability and high operational velocity in a modular monorepo, all future database objects must adhere to the following design principles:

- **Normalization Strategy:** In V1, all module schemas must prioritize third normal form (3NF) to eliminate data redundancy and preserve integrity. High-precision financial transaction structures must remain fully normalized.
- **Denormalization Rules:** Denormalization is permitted strictly for read performance optimizations (e.g., aggregating monthly spending metrics or caching current balance views). Any denormalized field must represent a read-only projection populated asynchronously via domain events or materialized views.
- **Ownership Rules:** Each database table is owned by exactly one feature module. No module is permitted to alter or insert data directly into tables owned by another module.
- **Isolation Rules:** Modules must maintain logical database isolation. Foreign key constraints across module boundaries are strictly forbidden. Associations must operate using logical identifiers.
- **Consistency Rules:** Transactions must satisfy ACID properties within a module boundary. Cross-module data consistency is handled asynchronously using eventual consistency patterns.
- **Integrity Rules:** Data validation must occur at the domain level before database writes are initiated. Database constraints (unique, check, nullability) serve as secondary integrity guards.

---

## 2. Entity Ownership & Lifecycle

Each database table, view, and index is owned by a single, specific feature module.

- **Write Ownership:** Only the owner module can execute write operations (INSERT, UPDATE, DELETE) on its tables.
- **Read Ownership:** Other modules can read data only by calling the public application service queries of the owner module. Direct SELECT statements across module table boundaries are forbidden.
- **Deletion Ownership:** Cascading deletions must remain strictly contained within a single module. If a user deletes their profile, the User Management module publishes a user-deleted event. Individual modules subscribe to this event and delete their owned records independently.

---

## 3. Cross-Module Communication

Direct database-level joins across tables owned by different modules are prohibited to prevent coupling.

- **Allowed Patterns:**
  - Querying data from another module by calling its public Application Service API (Queries).
  - Subscribing to integration events (e.g., `UserCreatedEvent`) to cache essential read-only reference data.
- **Forbidden Patterns:**
  - Executing SQL queries containing `JOIN` operations across tables owned by different modules.
  - Modifying another module's table data directly in transactions.
  - Creating foreign key database constraints linking tables of different modules.

---

## 4. Transaction Strategy

Database transactions are structured to guarantee consistency while preventing database locking issues under peak loads:

- **Transaction Boundaries:** Transactions must be managed in the application layer using unit-of-work abstractions. A single transaction must be confined to the boundaries of a single module.
- **Nested Transactions:** Nested transactions are forbidden. If a sub-task fails, the parent transaction must rollback fully.
- **Long-Running Operations:** External service integrations (e.g., calling OCR APIs or weather feeds) must never run inside a database transaction. Transactions must be kept short to prevent lock starvation.
- **Consistency Guarantees:** Local transactions guarantee immediate consistency within a module. Event-driven processes guarantee eventual consistency across module boundaries.

---

## 5. Identifier Strategy

A unified identifier strategy prevents key collisions and secures public interfaces:

- **Internal IDs:** Primary keys must use auto-incrementing integers or standard sequential identifiers optimized for database indexing.
- **Public IDs:** Public interfaces (Telegram callback buttons, API endpoints) must never expose internal primary keys. The system uses secure UUIDs or high-entropy random strings for public reference.
- **Reference IDs:** References to entities owned by other modules must use their public identifiers rather than internal keys.
- **Temporary IDs:** Single-use, time-bound tokens (e.g., join group links) are stored with explicit expiration timestamps.

---

## 6. Timestamp Strategy

Timestamps must enforce absolute timezone-agnostic parameters:

- **UTC Policy:** All date and time database fields must store values in UTC.
- **Timestamps Registry:** Every table must incorporate:
  - `createdAt`: Populated automatically at record creation.
  - `updatedAt`: Updated automatically on record modification.
  - `deletedAt`: Optional timestamp tracking soft deletion.
- **Timezone Philosophy:** User timezone offsets are treated as user preference metadata. Offsets are applied to UTC timestamps only during input parsing and output presentation.

---

## 7. Soft Delete Strategy

DevMate enforces soft deletion to protect data and preserve financial history.

- **Rules:** Deleting an entity sets the `deletedAt` timestamp to the current system time. Select queries filter out soft-deleted records by default.
- **Recovery:** Restoring an item clears the `deletedAt` field. Recovery tasks must validate that parent entities (e.g., folders for files) are active.
- **Permanent Deletion:** Permanently erasing records is handled by automated background cleanup tasks after a 30-day retention window in the Trash module.
- **Archival:** Records marked as Archived remain searchable but are flagged read-only.

---

## 8. Audit Strategy

Critical financial and credential tables require detailed audit trails:

- **Audit Ownership:** The Audit Logs module maintains an immutable log database table.
- **Audit Granularity:** Changes to sensitive configurations (passwords, vault files, permissions) must write a structured log entry detailing:
  - User Identifier, Timestamp, Client IP/Context, Action Type, Changed Column Name, Old Value Hash, New Value Hash.
- **Immutable History:** Audit log tables are write-only. Database permissions must block UPDATE and DELETE privileges on audit tables for all application connections.

---

## 9. Schema Versioning & Migrations

The database schema evolves through version-controlled migration scripts.

- **Migration Philosophy:** Every database schema change must be executed via written migration files (DDL scripts) stored in the module's persistence layer. Automatic schema generation at runtime is forbidden in production.
- **Schema Compatibility:** Database changes must maintain backward compatibility with the previous release version. Dropping columns or restructuring tables must occur over a multi-release cycle (deprecate $\rightarrow$ migrate $\rightarrow$ drop).
- **Rollback Strategy:** Every migration script must include a corresponding rollback script. If a deployment fails, rollbacks restore the database to its previous stable version.

---

## 10. Index Philosophy

Indexes must be applied to optimize read access while preserving database write speeds.

- **General Indexing Rules:** Indexes must be created on columns frequently used in `WHERE`, `ORDER BY`, or `JOIN` filters (e.g., `telegram_id` or `group_id`).
- **Composite Indexes:** Create composite indexes for queries utilizing multiple filter columns (e.g., `[user_id, status]`). Order columns from highest to lowest selectivity.
- **Unique Indexes:** Apply unique indexes to prevent duplicate entries (e.g., `[group_id, member_id]`).
- **Forbidden Indexing:** Do not index fields with low cardinality (e.g., boolean flags) or columns subject to high-frequency updates, as this degrades database write performance.

---

## 11. Constraints Philosophy

Constraints enforce system data integrity rules directly in the database:

- **Referential Integrity:** Enforce foreign key constraints strictly *within* module boundaries. Cascading deletes must be explicitly configured to prevent orphaned children.
- **Unique Constraints:** Enforce uniqueness at the database level for all natural keys.
- **Business Constraints:** Check constraints validate numeric limits (e.g., `amount >= 0` or `percent BETWEEN 0 AND 100`).
- **Validation Ownership:** Database constraints serve as the final line of defense. Primary validation remains in the application domain layer.

---

## 12. Money & Currency Handling

Financial data requires absolute precision to prevent rounding discrepancies.

- **Precision Rules:** Monetary amounts must be stored as high-precision decimals (e.g., 18 digits with 4 decimal places) rather than floating-point numbers.
- **Currency Strategy:** Every financial transaction record must include an ISO 4217 currency code column (e.g., `USD`, `EUR`).
- **Rounding Philosophy:** Rounding to user display decimal limits must only occur at the presentation layer. Internal calculations maintain full decimal precision.
- **Exchange Rate Philosophy:** Exchange rates are stored alongside a timestamp in a cached rate table, logging conversion rates historically.

---

## 13. File Metadata Strategy

Stored files are registered in the database, abstracting storage drivers:

- **File Ownership:** File records are owned by the File Vault module, storing file metadata, owner ID, tags, and object storage paths.
- **References:** Other modules referencing files (e.g., OCR receipts, goal attachments) must store only the file's secure UUID in their tables.
- **Storage Abstraction:** Database records store abstract URI paths. The actual storage driver details (e.g., folder paths) are resolved by the infrastructure layer.
- **Lifecycle:** Deleting a database file record triggers an integration event. The storage adapter listens and deletes the physical file.

---

## 14. Search Strategy

Search performance must remain optimized without database engine lock-in:

- **Module Search:** Module queries execute indexing lookups on indexed fields (e.g., search tags, item names).
- **Global Search:** Scans metadata fields across different module indexes.
- **Future Indexing Strategy:** Heavy full-text search indexes are planned to be moved to external search index adapters as search volume expands.

---

## 15. Archival Strategy

Historical data is archived to maintain small, fast active database tables:

- **Archival Criteria:** Financial transactions or activity logs older than a configured duration are flagged for archival.
- **Cold Data Storage:** Archived records are migrated to historical partition tables, reducing index sizes of active database tables.
- **Purging:** Non-critical deleted records (in Trash) are automatically purged after their retention expiration dates.

---

## 16. Backup & Recovery Philosophy

Data recovery procedures must guarantee system restore capabilities:

- **Backups:** Automatic daily incremental backups and weekly full database backups are required.
- **Version Compatibility:** Backup archives must include the schema migration version number.
- **Recovery Validation:** Automated restore tasks must run periodically on test environments to verify backup integrity.

---

## 17. Database Scalability

The database is structured to support horizontal scale paths:

- **Read Scaling:** Implement connection pooling with read-replicas. Read-only queries route to read replicas, freeing primary nodes for write operations.
- **Partitioning Strategy:** Large transactional tables (e.g., user expenses, activity logs) are partitioned by date ranges or user ID hash ranges.
- **Future Sharding:** The database uses logical IDs and enforces strict module boundary isolation, enabling tables of high-volume modules to be moved to dedicated database instances in the future without breaking core logic.

---

## 18. Database Security

Database tables must secure user privacy and sensitive data:

- **Encryption Boundaries:** Sensitive fields (passwords, vault content) are stored encrypted using database-level or application-level symmetric encryption.
- **Sensitive Data Classification:** Data columns are classified by risk levels (Low, Medium, High). Columns labeled High (e.g., access tokens, keys) require encryption and access logging.
- **Access Rules:** Database connection credentials must enforce minimum privileges, blocking direct access to administrative tables.

---

## 19. Database Coding Standards

Consistency across naming structures is mandatory:

- **Naming Conventions:** All database names use lowercase `snake_case`.
- **Pluralization:** Table names are pluralized (e.g., `user_settings`, `todo_items`).
- **Index Naming:** `idx_[table_name]_[column_name]` (e.g., `idx_user_settings_user_id`).
- **Constraint Naming:**
  - Foreign Keys: `fk_[table_name]_[ref_table]_[column_name]` (e.g., `fk_todo_items_users_user_id`).
  - Unique Constraints: `uq_[table_name]_[column_name]` (e.g., `uq_user_profiles_telegram_id`).
- **View Naming:** Views are prefixed with `vw_` (e.g., `vw_group_expense_summaries`).

---

## 20. Future Schema Evolution

To prevent system downtime during schema changes, the database evolution follows a strict transition checklist:

```
[Phase 1] Add New Column (Nullable/Default) & Deploy Code
    ↓
[Phase 2] Deploy Application Logic (Read from old/new, Write to both)
    ↓
[Phase 3] Run Migration Script (Backfill old data into new column)
    ↓
[Phase 4] Deploy Updated Application Logic (Read/Write strictly to new column)
    ↓
[Phase 5] Deprecate & Drop Old Column (Safely clean schema in next cycle)
```

This multi-phase schema migration model ensures zero-downtime updates and continuous backward compatibility.
