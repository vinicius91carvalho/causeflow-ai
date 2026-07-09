-- CauseFlow OSS Runtime — Postgres schema
-- Creates the `causeflow` schema with 31 tables (one per ElectroDB entity).
-- Each table uses a composite primary key (tenant_id, entity_id) plus
-- a JSONB `data` column for entity-specific attributes.
-- Run via: node infra/postgres/run-migrations.js

CREATE SCHEMA IF NOT EXISTS causeflow;

-- 1. tenants
CREATE TABLE IF NOT EXISTS causeflow.tenants (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL DEFAULT 'tenant',
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 2. users
CREATE TABLE IF NOT EXISTS causeflow.users (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 3. incidents
CREATE TABLE IF NOT EXISTS causeflow.incidents (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 4. integrations
CREATE TABLE IF NOT EXISTS causeflow.integrations (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 5. evidence
CREATE TABLE IF NOT EXISTS causeflow.evidence (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 6. audit_entries
CREATE TABLE IF NOT EXISTS causeflow.audit_entries (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 7. remediation
CREATE TABLE IF NOT EXISTS causeflow.remediation (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 8. patterns
CREATE TABLE IF NOT EXISTS causeflow.patterns (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 9. feedback
CREATE TABLE IF NOT EXISTS causeflow.feedback (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 10. service_nodes
CREATE TABLE IF NOT EXISTS causeflow.service_nodes (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 11. service_edges
CREATE TABLE IF NOT EXISTS causeflow.service_edges (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 12. change_events
CREATE TABLE IF NOT EXISTS causeflow.change_events (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 13. notifications
CREATE TABLE IF NOT EXISTS causeflow.notifications (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 14. approvals
CREATE TABLE IF NOT EXISTS causeflow.approvals (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 15. api_keys
CREATE TABLE IF NOT EXISTS causeflow.api_keys (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 16. repo_nodes
CREATE TABLE IF NOT EXISTS causeflow.repo_nodes (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 17. package_dependencies
CREATE TABLE IF NOT EXISTS causeflow.package_dependencies (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 18. repo_service_maps
CREATE TABLE IF NOT EXISTS causeflow.repo_service_maps (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 19. billing_accounts
CREATE TABLE IF NOT EXISTS causeflow.billing_accounts (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 20. usage_records
CREATE TABLE IF NOT EXISTS causeflow.usage_records (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 21. triggers
CREATE TABLE IF NOT EXISTS causeflow.triggers (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 22. widget_sessions
CREATE TABLE IF NOT EXISTS causeflow.widget_sessions (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 23. chat_messages
CREATE TABLE IF NOT EXISTS causeflow.chat_messages (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 24. tool_calls
CREATE TABLE IF NOT EXISTS causeflow.tool_calls (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 25. invites
CREATE TABLE IF NOT EXISTS causeflow.invites (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 26. user_settings
CREATE TABLE IF NOT EXISTS causeflow.user_settings (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 27. slack_notifications
CREATE TABLE IF NOT EXISTS causeflow.slack_notifications (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 28. slack_oauth_states
CREATE TABLE IF NOT EXISTS causeflow.slack_oauth_states (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 29. oauth_tokens
CREATE TABLE IF NOT EXISTS causeflow.oauth_tokens (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 30. hypotheses
CREATE TABLE IF NOT EXISTS causeflow.hypotheses (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- 31. runbook_registry
CREATE TABLE IF NOT EXISTS causeflow.runbook_registry (
    tenant_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, entity_id)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_incidents_data_severity ON causeflow.incidents USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_incidents_data_status ON causeflow.incidents USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON causeflow.incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entries_created_at ON causeflow.audit_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_data_email ON causeflow.users USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_tenants_data_slug ON causeflow.tenants USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_api_keys_data_key ON causeflow.api_keys USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_evidence_data_incident ON causeflow.evidence USING gin (data jsonb_path_ops);
