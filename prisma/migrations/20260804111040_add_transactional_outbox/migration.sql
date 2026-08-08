-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "aggregate_type" VARCHAR(255),
    "aggregate_id" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "status" VARCHAR(50) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by" VARCHAR(255),
    "correlation_id" VARCHAR(255),
    "request_id" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "consumer_name" VARCHAR(255) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_locked_at_idx" ON "outbox_events"("status", "locked_at");

-- CreateIndex
CREATE INDEX "outbox_events_event_type_idx" ON "outbox_events"("event_type");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_created_at_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE INDEX "processed_events_event_id_idx" ON "processed_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_event_id_consumer_name_key" ON "processed_events"("event_id", "consumer_name");
