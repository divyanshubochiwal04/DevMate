# API Data Model Specification
## Project Name: DevMate — The Telegram-based Personal Operating System

---

## 1. Shared Models & Envelopes

To prevent duplication inside future API contracts, these models define the standard structures for response envelopes, pagination schemas, common data blocks, and error handling.

### 1.1 SuccessResponse<T>
* **Purpose:** Standard API success envelope wrapping all non-paginated read/write responses.
* **Fields:**
  * `success` (Boolean): Always `true` for success. [Required] [Read Only]
  * `data` (T): The resource or payload returned. [Required]
  * `meta` (AuditMetadata): Telemetry and tracking tracing information. [Required] [Read Only]
* **Example Payload:**
  ```json
  {
    "success": true,
    "data": { "id": "uuid-12345" },
    "meta": {
      "correlationId": "corr-uuid-9999",
      "traceId": "trace-uuid-8888"
    }
  }
  ```

---

### 1.2 PaginatedResponse<T>
* **Purpose:** Envelope wrapping all paginated database listing arrays.
* **Fields:**
  * `success` (Boolean): Always `true`. [Required] [Read Only]
  * `data` (Array<T>): List of items. [Required]
  * `pagination` (CursorPagination): Cursor metadata. [Required] [Read Only]
  * `meta` (AuditMetadata): Telemetry and tracking data. [Required] [Read Only]
* **Example Payload:**
  ```json
  {
    "success": true,
    "data": [{ "id": "uuid-1" }],
    "pagination": {
      "nextCursor": "cursor-string-123",
      "hasMore": true
    },
    "meta": { "correlationId": "c-1", "traceId": "t-1" }
  }
  ```

---

### 1.3 CursorPagination
* **Purpose:** Metadata fields returning cursor pointer details.
* **Fields:**
  * `nextCursor` (String): Pointer payload for the next page fetch query. [Nullable]
  * `hasMore` (Boolean): States if more records exist. [Required]

---

### 1.4 OffsetPagination
* **Purpose:** Standard offset pagination parameters.
* **Fields:**
  * `page` (Integer): Target page index. Default 1. [Required] [Min: 1]
  * `limit` (Integer): Max records limit. Default 20. [Required] [Max: 100]
  * `total` (Integer): Total record count. [Required] [Read Only]

---

### 1.5 AuditMetadata
* **Purpose:** Shared request tracking metadata.
* **Fields:**
  * `correlationId` (String): Correlation tracer ID UUID. [Required]
  * `traceId` (String): Profiling trace ID UUID. [Required]

---

### 1.6 Money
* **Purpose:** Shared financial representation schema.
* **Fields:**
  * `amount` (String): High-precision numeric decimal string. [Required] [Pattern: `^\d+(\.\d{1,4})?$`]
  * `currency` (String): ISO 4217 currency code. [Required] [Length: 3]
* **Example Payload:**
  ```json
  {
    "amount": "150.5000",
    "currency": "EUR"
  }
  ```

---

### 1.7 Attachment
* **Purpose:** Reference to an uploaded secure file vault object.
* **Fields:**
  * `fileId` (String): UUID matching a `vault_files` record. [Required]
  * `name` (String): File name description. [Required]

---

### 1.8 SearchResult
* **Purpose:** Generic result output for global searches.
* **Fields:**
  * `id` (String): Source record UUID. [Required]
  * `module` (String): Source module identifier (e.g. `todos`). [Required]
  * `title` (String): Match header title. [Required]
  * `snippet` (String): Matching text snippet. [Required]

---

### 1.9 Error Models

#### ValidationError
* **Purpose:** Returns validation constraints issues (HTTP 400).
* **Fields:**
  * `success` (Boolean): Always `false`. [Required]
  * `error` (Object): Container. [Required]
    * `code` (String): `VALIDATION_FAILED`. [Required]
    * `message` (String): General summary. [Required]
    * `details` (Array): Field issues. [Required]
      * `field` (String): Invalid field path. [Required]
      * `issue` (String): Validation violation detail. [Required]
* **Example Payload:**
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Input validation failed.",
      "details": [{ "field": "amount", "issue": "Value must be positive" }]
    }
  }
  ```

---

#### BusinessError & NotFoundError
* **Purpose:** Return logical execution issues (HTTP 404, 409, 422).
* **Fields:**
  * `success` (Boolean): Always `false`. [Required]
  * `error` (Object): [Required]
    * `code` (String): Unified error classification code. [Required]
    * `message` (String): Safe error message for user. [Required]

---

## 2. Enum Catalogue

All API status, priority, and role parameters must serialize strictly using these enums:

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

## 3. Module Request/Response Models

### 3.1 Authentication Module

#### `TelegramAuthRequest`
* **Purpose:** Webhook login payload data transfer.
* **Fields:**
  * `id` (Integer): Telegram user ID. [Required]
  * `first_name` (String): Telegram first name. [Required]
  * `last_name` (String): Telegram last name. [Optional] [Nullable]
  * `username` (String): Telegram username handle. [Optional] [Nullable]
  * `auth_date` (Integer): Login timestamp. [Required]
  * `hash` (String): Verification hash checksum. [Required]
* **Example Payload:**
  ```json
  {
    "id": 12345,
    "first_name": "John",
    "auth_date": 178239482,
    "hash": "abcdef12345hash"
  }
  ```

---

### 3.2 User & Profile Module

#### `UpdateProfileRequest`
* **Purpose:** Modify user details payload.
* **Fields:**
  * `firstName` (String): User first name. [Optional] [Min: 1]
  * `lastName` (String): User last name. [Optional] [Nullable]
  * `username` (String): User handle. [Optional] [Nullable]

---

### 3.3 Settings & Preferences Module

#### `UpdatePreferencesRequest`
* **Purpose:** Modify settings localization configuration.
* **Fields:**
  * `baseCurrency` (String): Target currency code. [Optional] [Length: 3]
  * `timezone` (String): Timezone identifier string. [Optional] [MaxLength: 100]
  * `language` (String): Localization language. [Optional] [MaxLength: 5]

---

### 3.4 Todo Module

#### `CreateTodoRequest`
* **Purpose:** Initialize a task record.
* **Fields:**
  * `title` (String): Task name. [Required] [Min: 1, Max: 255]
  * `priority` (PriorityLevel): Task priority. [Optional] [Default: `MEDIUM`]
  * `dueDate` (String): Deadline ISO timestamp. [Optional] [Nullable]

---

### 3.5 Reminders Module

#### `CreateReminderRequest`
* **Purpose:** Configure a notification trigger.
* **Fields:**
  * `text` (String): Alert message content. [Required] [MaxLength: 500]
  * `triggerTime` (String): Future target ISO timestamp. [Required]
  * `recurrence` (String): Optional iCal recurrence rule format. [Optional] [Nullable]

---

### 3.6 Finance Module

#### `CreateExpenseRequest`
* **Purpose:** Log a transaction.
* **Fields:**
  * `amount` (Money): Transaction monetary value block. [Required]
  * `description` (String): Transaction notes details. [Required] [MaxLength: 255]
  * `category` (String): Category folder index. [Required] [MaxLength: 100]

---

### 3.7 Expense Splitter Module

#### `CreateGroupRequest`
* **Purpose:** Create an expense sharing group.
* **Fields:**
  * `name` (String): Group display name. [Required] [Min: 1, Max: 100]

#### `AddGroupExpenseRequest`
* **Purpose:** Log shared group expense.
* **Fields:**
  * `amount` (Money): Shared transaction cost. [Required]
  * `description` (String): Transaction notes details. [Required]
  * `splitType` (SplitType): Split calculation logic. [Required]
  * `payerId` (String): Member ID UUID of the payer. [Required]
  * `participants` (Array<String>): Member ID UUIDs involved. [Required] [MinItems: 2]

---

### 3.8 Personal Vault Module

#### `SaveSecureNoteRequest`
* **Purpose:** Save an encrypted text block.
* **Fields:**
  * `title` (String): Searchable note title. [Required] [MaxLength: 150]
  * `ciphertext` (String): AES-GCM encrypted notes content. [Required]

---

### 3.9 OCR & PDF Module

#### `OCRJobResponse`
* **Purpose:** Return state of an OCR text extraction task.
* **Fields:**
  * `jobId` (String): Job ID UUID. [Required] [Read Only]
  * `status` (JobStatus): Active parsing job state. [Required]
  * `parsedData` (Object): Parsed result properties JSON. [Optional] [Nullable]
