export interface SDKConfig {
  apiKey: string;
  apiUrl: string;
  projectId: string;
  environmentId: string;
  refreshInterval?: number;
  diskCachePath?: string;
  enableRealtime?: boolean;
}

export interface Context {
  user_id?: string;
  region?: string;
  app_version?: string;
  tier?: string;
  custom_attributes?: Record<string, any>;
}
