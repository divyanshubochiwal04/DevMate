# API Specification Document (API Spec)
## Project Name: DevMate — The Telegram-based Personal Operating System

---

## 1. API Design Principles

The DevMate API Layer is built on a set of design principles ensuring clean client-server contracts:

- **API Philosophy:** The API is structured as a collection of RESTful resources combined with RPC-style business endpoints where REST mappings are not standard (e.g., `/settle`, `/snooze`).
- **Consistency:** All request and response bodies use camelCase serialization, while URL paths use kebab-case paths.
- **Versioning:** URI versioning is enforced for all endpoints using the prefix `/api/v[version_number]/` (e.g., `/api/v1/todos`).
- **Backward Compatibility:** Deprecated endpoints are supported for at least two minor versions before removal. Deprecation warning headers are sent on all deprecated routes.
- **Pagination:** Lists utilize cursor-based pagination to prevent query offsets issues. Request parameters: `cursor`, `limit`. Response returns: `nextCursor`.
- **Filtering, Sorting, & Search:** Multi-value filters use query parameters (e.g., `?status=pending,in-progress`). Sorting uses `sortBy` and `sortOrder` (e.g., `?sortBy=dueDate&sortOrder=asc`). Simple search uses `?q=query_string`.
- **Idempotency:** State-mutating write operations (POST, PUT) support the header `X-Idempotency-Key` containing a UUID. Repeating a request with the same key returns the cached response, preventing duplicate actions.
- **Caching Philosophy:** Read-only requests utilize the `Cache-Control` header. Responses use `ETag` validation to minimize data transport.
- **Error Response & Response Envelope Philosophy:** All APIs return a consistent success or error envelope structure, removing differences between modules.
- **Rate Limiting:** Every endpoint is assigned to a rate limit category (Standard, Heavy, Write, Admin) enforced by the gateway using the request context and client identifiers.
- **Validation:** Inputs are validated against schema boundaries before routing to internal services. Failure returns structured error payloads.

---

## 2. Authentication & Authorization

Authentication secures access to the API services:

- **Authentication Flow:**
  - **Telegram Bot Inbound:** Telegram webhooks are validated using the header `X-Telegram-Bot-Api-Secret-Token`.
  - **Client Applications:** Clients exchange a Telegram `initData` string verified on the server for a short-lived Access Token.
- **Token Lifecycle & Refresh Strategy:**
  - Access Token: Extracted from `Authorization: Bearer <token>`, valid for 1 hour.
  - Refresh Token: Stored securely in a HTTP-only, secure cookie, valid for 7 days.
  - Expiration triggers a refresh request to `/api/v1/auth/refresh` to get a new access token without user prompt.
- **Logout Strategy:** POST to `/api/v1/auth/logout` invalidates the active session token in the distributed cache and clears cookies.
- **Permission Model (RBAC):** Users are assigned to Roles (`ADMIN`, `USER`, `MEMBER`). API access controls evaluate roles and permission scopes (e.g., `vault:read`, `splitter:write`) mapped to the token session.

---

## 3. Standard Response Envelopes

### 3.1 Success Envelope
```json
{
  "success": true,
  "data": {
    "id": "todo-uuid-12345",
    "title": "Buy milk",
    "status": "pending"
  },
  "meta": {
    "correlationId": "corr-uuid-9999",
    "traceId": "trace-uuid-8888"
  }
}
```

### 3.2 Validation Error (HTTP 400 Bad Request)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request body failed validation constraints.",
    "details": [
      { "field": "amount", "issue": "Value must be positive" }
    ]
  },
  "meta": {
    "correlationId": "corr-uuid-9999",
    "traceId": "trace-uuid-8888"
  }
}
```

### 3.3 Authentication Error (HTTP 401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authorization token is missing or expired."
  },
  "meta": { "correlationId": "corr-uuid-9999", "traceId": "trace-uuid-8888" }
}
```

### 3.4 Authorization Error (HTTP 403 Forbidden)
```json
{
  "success": false,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "You do not have the required permissions to access this resource."
  },
  "meta": { "correlationId": "corr-uuid-9999", "traceId": "trace-uuid-8888" }
}
```

### 3.5 Business Conflict Error (HTTP 409 Conflict)
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot join group: user is already an active member."
  },
  "meta": { "correlationId": "corr-uuid-9999", "traceId": "trace-uuid-8888" }
}
```

### 3.6 Resource Not Found (HTTP 404 Not Found)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource could not be found."
  },
  "meta": { "correlationId": "corr-uuid-9999", "traceId": "trace-uuid-8888" }
}
```

### 3.7 Rate Limit Error (HTTP 429 Too Many Requests)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Request rate limit exceeded. Please try again after 60 seconds."
  },
  "meta": { "correlationId": "corr-uuid-9999", "traceId": "trace-uuid-8888" }
}
```

### 3.8 Server Error (HTTP 500 Internal Server Error)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Reference ID has been logged.",
    "errorId": "err-uuid-7777"
  },
  "meta": { "correlationId": "corr-uuid-9999", "traceId": "trace-uuid-8888" }
}
```

---

## 4. Uploads Contract

* **Maximum Upload Sizes:**
  * Files: Up to 50MB per upload.
  * OCR Images: Up to 10MB per image.
* **Security & File Type Validation:**
  * Submissions must use `multipart/form-data`.
  * Extension blocklists (e.g., `.exe`, `.sh`) are evaluated on upload.
  * All files undergo an asynchronous virus scan before status transitions to `Ready`.
* **Metadata Handling:** Uploaded files return a unique UUID. This reference UUID is passed to associated resources (e.g., Todo attachments).

---

## 5. Webhooks Contract (Inbound Telegram Webhook)

* **Endpoint:** `POST /api/v1/webhooks/telegram`
* **Authentication:** Webhooks include the header `X-Telegram-Bot-Api-Secret-Token`. Requests are rejected with HTTP 403 if the secret token does not match configuration variables.
* **Idempotency:** Telegram uses retry logic. The webhook gateway logs the unique `update_id` in a distributed cache for 24 hours. Duplicate `update_id` requests are acknowledged with HTTP 200 OK immediately without reprocessing.
* **Failure Responses:** If the application fails to parse a webhook payload, the gateway returns HTTP 200 OK with error body to prevent Telegram from looping retries, logging details to observability streams.

---

## 6. Observability

All API headers must inject the following telemetry parameters:
* **`X-Request-ID`**: Uniquely tracks the network socket request lifetime.
* **`X-Correlation-ID`**: Tracks execution logic across distinct application layers, workers, and queues.
* **`X-Trace-ID`**: Tracks execution spans inside profiling systems.

---

## 7. Endpoint Registry

### 7.1 Authentication Module

#### POST `/api/v1/auth/telegram`
* **Purpose:** Authenticate user session using Telegram login verification data.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "id": 12345678,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "auth_date": 178239482,
    "hash": "abcdef1234567890hashsignature"
  }
  ```
* **Validation Rules:** All fields are required. `auth_date` must be within a configured threshold of the current time.
* **Success Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "expiresIn": 3600
    }
  }
  ```
* **Rate Limit Category:** Standard Write.
* **Audit Requirement:** None.

---

### 7.2 User Management & Settings Module

#### GET `/api/v1/users/me`
* **Purpose:** Retrieve the active user's profile information.
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "user-uuid-1111",
      "telegramId": 12345678,
      "username": "johndoe",
      "status": "Active"
    }
  }
  ```

#### PATCH `/api/v1/users/me/preferences`
* **Purpose:** Update user configuration preferences.
* **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "baseCurrency": "EUR",
    "timezone": "Europe/Paris",
    "language": "es"
  }
  ```
* **Validation Rules:** Currency must be standard ISO code. Timezone must be a valid timezone identifier.
* **Success Response (HTTP 200 OK):** Preference profile saved.
* **Rate Limit Category:** Standard Write.
* **Audit Requirement:** Yes.

#### GET `/api/v1/settings`
* **Purpose:** Retrieve global setting parameters.
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (HTTP 200 OK):** Returns settings payload (quiet hours, notifications toggles).

#### PATCH `/api/v1/settings`
* **Purpose:** Modify settings parameters.
* **Request Body:** Settings parameters fields.
* **Validation Rules:** Time ranges must be valid.
* **Audit Requirement:** Yes.

---

### 7.3 Dashboard Module

#### GET `/api/v1/dashboard`
* **Purpose:** Retrieve a unified daily summary card.
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "pendingTasksCount": 5,
      "overdueTasksCount": 1,
      "activeBudgetAlerts": ["Food budget reached 82%"],
      "dailyHabitCompletedCount": 2,
      "dailyHabitTotalCount": 4,
      "upcomingCalendarEvents": []
    }
  }
  ```
* **Rate Limit Category:** Standard Read.

---

### 7.4 Todo Module

#### GET `/api/v1/todos`
* **Purpose:** Fetch a paginated checklist of tasks.
* **Query Parameters:** `status` (pending/completed), `cursor`, `limit`.
* **Success Response (HTTP 200 OK):** Returns array of Todo items and cursor meta.

#### POST `/api/v1/todos`
* **Purpose:** Create a new task.
* **Request Body:**
  ```json
  {
    "title": "Buy milk",
    "priority": "High",
    "dueDate": "2026-07-30T12:00:00Z"
  }
  ```
* **Validation Rules:** `title` is mandatory (1-255 characters). `priority` must be Low, Medium, or High.
* **Success Response (HTTP 201 Created):** Returns created Todo payload.
* **Idempotency Rules:** Supports idempotency header checks.
* **Rate Limit Category:** Standard Write.

#### PATCH `/api/v1/todos/{id}/status`
* **Purpose:** Change completion status of a task.
* **Request Body:** `{"status": "Completed"}`
* **Success Response (HTTP 200 OK):** Updated task.

---

### 7.5 Reminders Module

#### POST `/api/v1/reminders`
* **Purpose:** Register a new reminder alert.
* **Request Body:**
  ```json
  {
    "text": "Call parent",
    "triggerTime": "2026-07-28T09:00:00Z",
    "recurrenceRule": "FREQ=DAILY;INTERVAL=1"
  }
  ```
* **Validation Rules:** `triggerTime` must be a future timestamp.
* **Success Response (HTTP 201 Created):** Created Reminder payload.

#### POST `/api/v1/reminders/{id}/snooze`
* **Purpose:** Delay a reminder alert trigger.
* **Request Body:** `{"durationMinutes": 15}`
* **Success Response (HTTP 200 OK):** Trigger rescheduled.

#### POST `/api/v1/reminders/{id}/dismiss`
* **Purpose:** Acknowledge and silence a reminder.
* **Success Response (HTTP 200 OK):** Status updated to Completed.

#### POST `/api/v1/reminders/{id}/pause`
* **Purpose:** Suspend triggers for a reminder.
* **Success Response (HTTP 200 OK):** Status updated to Paused.

#### POST `/api/v1/reminders/{id}/resume`
* **Purpose:** Reactivate triggers for a reminder.
* **Success Response (HTTP 200 OK):** Status updated to Active.

#### POST `/api/v1/reminders/bulk-action`
* **Purpose:** Execute updates across multiple reminders in a single request.
* **Request Body:**
  ```json
  {
    "reminderIds": ["uuid-1", "uuid-2"],
    "action": "pause"
  }
  ```
* **Success Response (HTTP 200 OK):** Array of updated IDs.

---

### 7.6 Calendar Module

#### GET `/api/v1/calendar/events`
* **Purpose:** Retrieve scheduled events.
* **Query Parameters:** `startDate` (ISO), `endDate` (ISO).
* **Success Response (HTTP 200 OK):** Array of calendar events.

---

### 7.7 Birthday Manager Module

#### POST `/api/v1/birthdays`
* **Purpose:** Record a contact birthday.
* **Request Body:** `{"name": "John Doe", "birthdate": "1990-10-15"}`
* **Validation Rules:** Birthdate must be a valid date in the past.
* **Success Response (HTTP 201 Created):** Saved birthday record.

---

### 7.8 Finance Modules

#### POST `/api/v1/finance/expenses`
* **Purpose:** Log a new expense.
* **Request Body:**
  ```json
  {
    "amount": 15.50,
    "currency": "USD",
    "description": "Lunch",
    "category": "Food"
  }
  ```
* **Validation Rules:** Amount must be positive. Currency code must match ISO standard.
* **Success Response (HTTP 201 Created):** Saved transaction.

#### GET `/api/v1/finance/expenses/analytics`
* **Purpose:** Retrieve spending analysis.
* **Query Parameters:** `startDate`, `endDate`, `category`.
* **Success Response (HTTP 200 OK):** Analysis values.

#### POST `/api/v1/finance/loans`
* **Purpose:** Log an active loan.
* **Request Body:**
  ```json
  {
    "principal": 5000,
    "interestRate": 4.5,
    "durationMonths": 12,
    "startDate": "2026-07-27"
  }
  ```
* **Success Response (HTTP 201 Created):** Returns logged loan details with calculated amortization metrics.

#### GET `/api/v1/finance/loans/{id}/emi-schedule`
* **Purpose:** Retrieve the payment schedule for a loan.
* **Success Response (HTTP 200 OK):** Monthly EMI values and dates.

#### POST `/api/v1/finance/subscriptions`
* **Purpose:** Log active billing subscription.
* **Request Body:** `{"name": "Streaming", "amount": 9.99, "cycle": "Monthly"}`
* **Success Response (HTTP 201 Created):** Logged subscription.

---

### 7.9 Expense Splitter Module

#### POST `/api/v1/splitter/groups`
* **Purpose:** Create a new expense sharing group.
* **Request Body:** `{"name": "Roadtrip"}`
* **Success Response (HTTP 201 Created):** Returns Group ID and invite token link.

#### POST `/api/v1/splitter/groups/{id}/members`
* **Purpose:** Join a group using an invite token.
* **Request Body:** `{"inviteToken": "token-123"}`
* **Success Response (HTTP 200 OK):** Added to roster.

#### POST `/api/v1/splitter/groups/{id}/expenses`
* **Purpose:** Log shared transaction.
* **Request Body:**
  ```json
  {
    "amount": 90.00,
    "description": "Dinner",
    "splitType": "Equal",
    "payerId": "member-uuid-1",
    "participants": ["member-uuid-1", "member-uuid-2"]
  }
  ```
* **Success Response (HTTP 201 Created):** Logged transaction.

#### GET `/api/v1/splitter/groups/{id}/balances`
* **Purpose:** Query current net balances for group members.
* **Success Response (HTTP 200 OK):** Net balance mapping.

#### POST `/api/v1/splitter/groups/{id}/settle`
* **Purpose:** Propose a settlement payment.
* **Request Body:** `{"recipientId": "uuid-2", "amount": 45.00}`
* **Success Response (HTTP 202 Accepted):** Settlement proposal pending.

---

### 7.10 Personal Vault Module

#### POST `/api/v1/vault/secure-notes`
* **Purpose:** Save an encrypted text snippet.
* **Request Body:** `{"title": "Codes", "ciphertext": "encrypted-payload"}`
* **Success Response (HTTP 201 Created):** Note logged.

#### POST `/api/v1/vault/passwords`
* **Purpose:** Save login credentials.
* **Request Body:** `{"title": "Site", "username": "user", "ciphertext": "encrypted-pass"}`
* **Success Response (HTTP 201 Created):** Credentials logged.

#### POST `/api/v1/vault/files`
* **Purpose:** Upload a file to the secure vault.
* **Headers:** `Content-Type: multipart/form-data`
* **Request Body:** File attachment.
* **Success Response (HTTP 202 Accepted):** Returns file UUID and status: `Scanning`.

#### GET `/api/v1/vault/files`
* **Purpose:** Retrieve files registry list.
* **Query Parameters:** `folderPath`, `cursor`, `limit`.
* **Success Response (HTTP 200 OK):** Files metadata list.

#### PATCH `/api/v1/vault/files/{id}/move`
* **Purpose:** Move a file across folders.
* **Request Body:** `{"destinationPath": "/documents/taxes"}`
* **Success Response (HTTP 200 OK):** Move completed.

---

### 7.11 Utilities Modules

#### POST `/api/v1/utilities/ocr/receipts`
* **Purpose:** Parse receipt details from image.
* **Headers:** `Content-Type: multipart/form-data`
* **Request Body:** Receipt image.
* **Success Response (HTTP 202 Accepted):** Returns parsing task ID.

#### POST `/api/v1/utilities/ocr/business-cards`
* **Purpose:** Parse business card details from image.
* **Headers:** `Content-Type: multipart/form-data`
* **Request Body:** Business card image.
* **Success Response (HTTP 202 Accepted):** Returns parsing task ID.

#### POST `/api/v1/utilities/pdf/merge`
* **Purpose:** Merge multiple images/PDFs.
* **Request Body:** `{"fileIds": ["uuid-1", "uuid-2"]}`
* **Success Response (HTTP 202 Accepted):** Processing task ID.

---

### 7.12 Search Modules

#### GET `/api/v1/search/global`
* **Purpose:** Find records across all active modules.
* **Query Parameters:** `q` (query text), `cursor`, `limit`.
* **Success Response (HTTP 200 OK):** Array of matched items.

---

### 7.13 Backup & Restore Module

#### POST `/api/v1/backup/export`
* **Purpose:** Compile and export user configuration archive.
* **Success Response (HTTP 202 Accepted):** Export job UUID.

#### POST `/api/v1/backup/import`
* **Purpose:** Upload data archive to restore system state.
* **Headers:** `Content-Type: multipart/form-data`
* **Success Response (HTTP 202 Accepted):** Import job UUID.

#### GET `/api/v1/backup/tasks/{id}`
* **Purpose:** Track status of asynchronous import/export jobs.
* **Success Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "taskId": "task-uuid-1",
      "status": "Completed",
      "progress": 100,
      "downloadUrl": "secure-download-url"
    }
  }
  ```

---

### 7.14 Plugin Management Module

#### GET `/api/v1/plugins`
* **Purpose:** List all active and available system plugins.
* **Success Response (HTTP 200 OK):** Plugins roster.

#### POST `/api/v1/plugins/{id}/enable`
* **Purpose:** Activate a specific plugin.
* **Success Response (HTTP 200 OK):** Plugin enabled.
* **Audit Requirement:** Yes.

---

### 7.15 Administration & System Module

#### GET `/api/v1/admin/audit-logs`
* **Purpose:** Query immutable system activity logs.
* **Query Parameters:** `userId`, `actionType`, `cursor`.
* **Success Response (HTTP 200 OK):** Audit records list.
* **Authorization Required:** Admin permissions scope.

#### GET `/api/v1/health`
* **Purpose:** System check status.
* **Success Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "status": "Healthy",
      "timestamp": "2026-07-27T01:23:00Z"
    }
  }
  ```
