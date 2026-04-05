-- Application Configuration Management Platform Database Schema

-- Organizations (top-level tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Projects within organizations
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Environments within projects
CREATE TABLE environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Editor', 'Viewer')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Configuration keys
CREATE TABLE config_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  environment_id UUID NOT NULL REFERENCES environments(id),
  key_name VARCHAR(255) NOT NULL,
  value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('boolean', 'string', 'number', 'json')),
  current_value JSONB NOT NULL,
  schema JSONB,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, project_id, environment_id, key_name)
);

CREATE INDEX idx_config_keys_lookup ON config_keys(organization_id, project_id, environment_id, key_name) 
WHERE deleted_at IS NULL;

-- Configuration version history (immutable)
CREATE TABLE config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key_id UUID NOT NULL REFERENCES config_keys(id),
  value JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_config_versions_key ON config_versions(config_key_id, created_at DESC);

-- Rules for context-aware evaluation
CREATE TABLE rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key_id UUID NOT NULL REFERENCES config_keys(id),
  priority INTEGER NOT NULL,
  conditions JSONB NOT NULL,
  value JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(config_key_id, priority)
);

CREATE INDEX idx_rules_config ON rules(config_key_id, priority DESC) WHERE enabled = true;

-- API Keys for SDK authentication
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(255) NOT NULL,
  prefix VARCHAR(8) NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  environment_id UUID NOT NULL REFERENCES environments(id),
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_prefix ON api_keys(prefix) WHERE revoked = false;

-- Audit logs (append-only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK')),
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('CONFIG_KEY', 'CONFIG_VERSION', 'RULE', 'API_KEY', 'USER')),
  resource_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, timestamp DESC);

-- Prevent modifications to audit logs
CREATE OR REPLACE FUNCTION raise_exception() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION raise_exception();

CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION raise_exception();
