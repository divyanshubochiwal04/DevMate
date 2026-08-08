# OpenAPI 3.1 Review Notes
## Project Name: DevMate — The Telegram-based Personal Operating System

---

## 1. Executive Summary & Global Metadata Improvements

This review establishes the standardized global properties, environments list, security definitions, and common parameters that must be appended to the DevMate OpenAPI configuration components, upgrading the schema to fully compliant **OpenAPI 3.1** specification guidelines.

### 1.1 Global Info Block Updates
```yaml
info:
  title: DevMate Core API Specification
  description: |
    Production-ready REST and RPC API contract for the DevMate platform.
    Integrates Telegram delivery adapters, secure personal storage, and financial ledger services.
  version: 1.0.0
  termsOfService: https://devmate.internal/terms
  contact:
    name: DevMate API Platform Team
    email: platform-api@devmate.internal
    url: https://devmate.internal/support
  license:
    name: Proprietary License
    url: https://devmate.internal/license
externalDocs:
  description: Platform Architecture & FSD References
  url: https://devmate.internal/docs/architecture
```

### 1.2 Target Environments Configuration
```yaml
servers:
  - url: https://api.devmate.internal/v1
    description: Production Server Gateway
  - url: https://staging-api.devmate.internal/v1
    description: Staging Environment Server
  - url: https://dev-api.devmate.internal/v1
    description: Development Integration Server
  - url: http://localhost:8080/v1
    description: Local Developer Container Server
```

---

## 2. Global Security Schemes Additions

These components register all authentication modes supported by the platform core:

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Short-lived session access token passed in Authorization headers.
    RefreshTokenCookie:
      type: apiKey
      in: cookie
      name: refresh_token
      description: Secure HTTP-only refresh token used to request new access tokens.
    TelegramSecretVerification:
      type: apiKey
      in: header
      name: X-Telegram-Bot-Api-Secret-Token
      description: Shared bot secret payload validating inbound Webhook calls.
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: Reserved API key token for external script integrations.
    OAuth2Placeholder:
      type: oauth2
      description: Reserved for future multi-tenant authorization integrations.
      flows:
        authorizationCode:
          authorizationUrl: https://auth.devmate.internal/oauth/authorize
          tokenUrl: https://auth.devmate.internal/oauth/token
          scopes:
            read: Grant view permissions on owned resources.
            write: Grant modification permissions on owned resources.
```

---

## 3. Reusable Parameter Components

```yaml
components:
  parameters:
    PageParam:
      name: page
      in: query
      description: Target page index.
      required: false
      schema:
        type: integer
        minimum: 1
        default: 1
    LimitParam:
      name: limit
      in: query
      description: Max record items count.
      required: false
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    CursorParam:
      name: cursor
      in: query
      description: Encoded cursor pointer for page offsets.
      required: false
      schema:
        type: string
    SortParam:
      name: sortBy
      in: query
      description: Column name path filter.
      required: false
      schema:
        type: string
    OrderParam:
      name: sortOrder
      in: query
      description: Sort direction.
      required: false
      schema:
        type: string
        enum: [asc, desc]
        default: desc
    SearchParam:
      name: q
      in: query
      description: Keyword search term.
      required: false
      schema:
        type: string
        minLength: 1

    CorrelationIdHeader:
      name: X-Correlation-ID
      in: header
      description: Trace correlation ID UUID.
      required: false
      schema:
        type: string
        format: uuid
    TraceIdHeader:
      name: X-Trace-ID
      in: header
      description: Performance trace span ID UUID.
      required: false
      schema:
        type: string
        format: uuid
    RequestIdHeader:
      name: X-Request-ID
      in: header
      description: Telemetry HTTP request socket ID.
      required: false
      schema:
        type: string
        format: uuid
    AcceptLanguageHeader:
      name: Accept-Language
      in: header
      description: Preferred translation locale.
      required: false
      schema:
        type: string
        default: en
```

---

## 4. Reusable Header Components

These headers are injected automatically into outgoing responses:

```yaml
components:
  headers:
    CorrelationIdResponseHeader:
      description: Ingress trace correlation tracker ID UUID.
      schema:
        type: string
        format: uuid
    RequestIdResponseHeader:
      description: Request socket tracker ID UUID.
      schema:
        type: string
        format: uuid
    RateLimitLimit:
      description: Request limit count allotted per window.
      schema:
        type: integer
    RateLimitRemaining:
      description: Remaining requests left in window.
      schema:
        type: integer
    RateLimitReset:
      description: Remaining seconds until rate window reset.
      schema:
        type: integer
```

---

## 5. Reusable Response Wrappers

Standardized wrappers formatting success envelopes and error payloads:

```yaml
components:
  responses:
    ValidationError:
      description: Input validation constraints violations.
      headers:
        X-Correlation-ID:
          $ref: '#/components/headers/CorrelationIdResponseHeader'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ValidationErrorEnvelope'
    BusinessError:
      description: Core business rules logic violation.
      headers:
        X-Correlation-ID:
          $ref: '#/components/headers/CorrelationIdResponseHeader'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    Unauthorized:
      description: Authentication failure due to missing or expired tokens.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    Forbidden:
      description: Action denied due to insufficient scope permissions.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    NotFound:
      description: The requested resource could not be found.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    RateLimitError:
      description: Too many requests processed in window.
      headers:
        Retry-After:
          description: Wait seconds before retrying.
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'
    ServerError:
      description: Internal system error log tracker.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorEnvelope'

  schemas:
    ErrorEnvelope:
      type: object
      required:
        - success
        - error
        - meta
      properties:
        success:
          type: boolean
          const: false
        error:
          type: object
          required:
            - code
            - message
            - timestamp
          properties:
            code:
              type: string
              example: RESOURCE_NOT_FOUND
            message:
              type: string
              example: The requested todo item was not found.
            timestamp:
              type: string
              format: date-time
            details:
              type: array
              items:
                type: string
        meta:
          $ref: '#/components/schemas/ResponseMeta'

    ValidationErrorEnvelope:
      type: object
      required:
        - success
        - error
        - meta
      properties:
        success:
          type: boolean
          const: false
        error:
          type: object
          required:
            - code
            - message
            - timestamp
            - details
          properties:
            code:
              type: string
              const: VALIDATION_FAILED
            message:
              type: string
              example: Invalid input parameters.
            timestamp:
              type: string
              format: date-time
            details:
              type: array
              items:
                type: object
                required:
                  - field
                  - issue
                properties:
                  field:
                    type: string
                    example: amount.value
                  issue:
                    type: string
                    example: Amount must be a positive decimal string.
        meta:
          $ref: '#/components/schemas/ResponseMeta'
```

---

## 6. Webhooks & Callbacks Definitions

These endpoints document outbound events pushed asynchronously by the system.

### 6.1 Webhook: Inbound Telegram Update
```yaml
webhooks:
  telegramUpdate:
    post:
      summary: Telegram Webhook Update Receiver
      description: Inbound updates delivered asynchronously by the Telegram servers.
      security:
        - TelegramSecretVerification: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - update_id
              properties:
                update_id:
                  type: integer
                message:
                  type: object
                  properties:
                    message_id:
                      type: integer
                    text:
                      type: string
      responses:
        '200':
          description: Acknowledged immediately to prevent message looping retries.
```

### 6.2 Callback: Background Job Processing Callback
```yaml
components:
  callbacks:
    JobCompletedCallback:
      '{$request.body#/callbackUrl}':
        post:
          summary: Background Job State Update Callback
          description: Alerts caller application when async jobs (OCR, PDF, Backups) finish execution.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required:
                    - jobId
                    - status
                    - completedAt
                  properties:
                    jobId:
                      type: string
                      format: uuid
                    status:
                      type: string
                      enum: [COMPLETED, FAILED]
                    completedAt:
                      type: string
                      format: date-time
                    resultUrl:
                      type: string
                      format: uri
          responses:
            '200':
              description: Callback acknowledged by client application.
```
