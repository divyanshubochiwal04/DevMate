# API Data Model Review Notes
## Project Name: DevMate — The Telegram-based Personal Operating System

---

## 1. Executive Summary & Verification

This review establishes the additional data transfer objects (DTOs), new enums, and structural validation rules required to bridge the data model coverage for asynchronous utilities, batch operations, filters, and audit tasks.

---

## 2. New Shared & Utility Models

### 2.1 File & Batch Upload Models

#### `FileUploadDetails`
* **Purpose:** Detailed metadata block returned after secure file virus scanning is completed.
* **Fields:**
  * `fileId` (String): Secure UUID reference identifier. [Required] [Read Only]
  * `fileName` (String): Original uploaded file name. [Required]
  * `fileSize` (Integer): Size in bytes. [Required]
  * `mimeType` (String): Verified mime type. [Required]
  * `checksum` (String): SHA256 checksum verify hash. [Required]
  * `status` (FileStatus): Current security scan status. [Required]

---

#### `BatchActionRequest`
* **Purpose:** Envelope model for bulk status mutations (e.g. bulk-archiving tasks).
* **Fields:**
  * `ids` (Array<String>): List of target UUIDs to update. [Required] [MinItems: 1]
  * `action` (String): Desired batch mutation operation (e.g. `archive`, `pause`, `delete`). [Required]
  * `parameters` (Object): Optional metadata parameters for the operation. [Optional]

---

### 2.2 Async & Job Processing Models

#### `JobCancelRequest`
* **Purpose:** Request body schema used to cancel running async tasks (e.g. active imports).
* **Fields:**
  * `reason` (String): Optional description detailing cancel rationale. [Optional] [MaxLength: 200]

---

### 2.3 Filtering & Search Models

#### `SearchFilters`
* **Purpose:** Multi-category search filter parameters object.
* **Fields:**
  * `categories` (Array<String>): Category filter arrays. [Optional]
  * `tags` (Array<String>): List of low-cased search tags. [Optional]
  * `startDate` (String): ISO date-time lower threshold. [Optional]
  * `endDate` (String): ISO date-time upper threshold. [Optional]

---

## 3. New Enums Catalogue

Add the following logic enums to the system catalog to support strict validation:

- **`BatchActionType`**: `ARCHIVE`, `DELETE`, `PAUSE`, `RESUME`, `CATEGORIZE`
- **`OCRType`**: `RECEIPT`, `BUSINESS_CARD`
- **`PDFOperationType`**: `MERGE`, `SPLIT`, `COMPRESS`, `PROTECT`, `UNLOCK`, `ROTATE`
- **`ImportExportStatus`**: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

---

## 4. New Fields & Validation Rules Additions

1. **`TelegramAuthRequest`**:
   * Add field: `hash` validation rule: Must be a valid 64-character hexadecimal signature value. [Required] [Pattern: `^[a-fA-F0-9]{64}$`]
2. **`CreateReminderRequest`**:
   * Add field: `triggerTime` validation rule: Must represent a future date timestamp. Triggers matching current or past dates must be rejected by input controllers.
3. **`AddGroupExpenseRequest`**:
   * Add field: `payerId` validation: Payer UUID must exist in the active `splitter_members` roster.
   * Add validation rule: The sum of all splits in `participants` shares must equal the total transaction `amount` value (precision checking).
4. **`SaveSecureNoteRequest`**:
   * Add validation rule: `ciphertext` payload must contain valid Base64 encoded encrypted strings.

---

## 5. Consistency & Versioning Corrections

- **Money Model Serialization:** Update `Money` fields datatype definition to store values strictly as **Decimal Strings** (e.g. `"150.50"`) instead of float formats, ensuring decimal precision matching on all database writes.
- **Audit Logs Metadata Schema:** Include a `clientIp` (String) and `userAgent` (String) tracking fields inside the `AuditMetadata` wrapper to match security logging standards defined in the SAD.
