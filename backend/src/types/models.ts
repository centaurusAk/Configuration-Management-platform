/**
 * TypeScript interfaces for all data models
 * Aligned with database schema in backend/database/schema.sql
 */

/**
 * Organization - Top-level tenant entity
 * Requirements: 13.1, 13.2
 */
export interface Organization {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Project - Logical grouping within an organization
 * Requirements: 13.3, 13.4
 */
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Environment - Deployment stage within a project (development, staging, production)
 * Requirements: 13.5, 13.6
 */
export interface Environment {
  id: string;
  project_id: string;
  name: string;
  created_at: Date;
}

/**
 * ConfigKey - A named configuration setting
 * Requirements: 1.1, 1.3, 1.6
 */
export interface ConfigKey {
  id: string;
  organization_id: string;
  project_id: string;
  environment_id: string;
  key_name: string;
  value_type: 'boolean' | 'string' | 'number' | 'json';
  current_value: any;
  schema?: object;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * ConfigVersion - Immutable snapshot of a configuration value
 * Requirements: 1.2, 1.4, 2.5
 */
export interface ConfigVersion {
  id: string;
  config_key_id: string;
  value: any;
  created_by: string;
  created_at: Date;
}

/**
 * Rule - Conditional expression for context-aware configuration
 * Requirements: 4.1, 4.2, 4.5, 4.6
 */
export interface Rule {
  id: string;
  config_key_id: string;
  priority: number;
  conditions: Condition[];
  value: any;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Condition - A single condition within a rule
 * Requirements: 4.5, 4.6
 */
export interface Condition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'in_list' | 'not_in_list' | 
            'greater_than' | 'less_than' | 'regex_match';
  value: any;
}

/**
 * User - System user with role-based access
 * Requirements: 7.1, 7.2, 13.7
 */
export interface User {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  created_at: Date;
  updated_at: Date;
}

/**
 * ApiKey - Authentication key for SDK access
 * Requirements: 14.1, 14.3, 14.4, 14.6, 14.7
 */
export interface ApiKey {
  id: string;
  key_hash: string;
  prefix: string;
  project_id: string;
  environment_id: string;
  created_by: string;
  expires_at?: Date;
  revoked: boolean;
  created_at: Date;
}

/**
 * AuditLog - Immutable record of all changes
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export interface AuditLog {
  id: string;
  timestamp: Date;
  user_id: string;
  organization_id: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';
  resource_type: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER';
  resource_id: string;
  old_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
}

/**
 * Context - User or request attributes for rule evaluation
 * Requirements: 4.1, 5.3
 */
export interface Context {
  user_id?: string;
  region?: string;
  app_version?: string;
  tier?: string;
  custom_attributes?: Record<string, any>;
}
