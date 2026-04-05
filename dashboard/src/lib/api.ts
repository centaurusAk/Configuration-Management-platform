import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
    });

    // Dynamically attach token to every request from localStorage
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Add interceptor to handle 401 Unauthorized globally
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear local auth state
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          // Redirect to login if we're not already there
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    // Left for backwards compatibility, handled by request interceptor now
  }

  clearToken() {
    // Left for backwards compatibility, handled by request interceptor now
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, organizationName: string) {
    const response = await this.client.post('/auth/register', {
      email,
      password,
      organizationName
    });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Projects & Environments
  async getProjects() {
    const response = await this.client.get('/projects');
    return response.data;
  }

  async getEnvironments(projectId: string) {
    const response = await this.client.get(`/projects/${projectId}/environments`);
    return response.data;
  }

  // Configs
  async getConfigs() {
    const response = await this.client.get('/configs');
    return response.data;
  }

  async getConfig(id: string) {
    const response = await this.client.get(`/configs/${id}`);
    return response.data;
  }

  async createConfig(data: {
    projectId: string;
    environmentId: string;
    keyName: string;
    valueType: 'boolean' | 'string' | 'number' | 'json';
    defaultValue: any;
    schema?: object;
  }) {
    const response = await this.client.post('/configs', data);
    return response.data;
  }

  async updateConfig(id: string, data: { value: any }) {
    const response = await this.client.put(`/configs/${id}`, data);
    return response.data;
  }

  async deleteConfig(id: string) {
    const response = await this.client.delete(`/configs/${id}`);
    return response.data;
  }

  async getVersionHistory(id: string) {
    const response = await this.client.get(`/configs/${id}/versions`);
    return response.data;
  }

  async rollbackConfig(id: string, versionId: string) {
    const response = await this.client.post(`/configs/${id}/rollback`, { versionId });
    return response.data;
  }

  // Rules
  async getRules(configId: string) {
    const response = await this.client.get(`/rules/config/${configId}`);
    return response.data;
  }

  async createRule(data: any) {
    const response = await this.client.post('/rules', data);
    return response.data;
  }

  async updateRule(id: string, data: any) {
    const response = await this.client.put(`/rules/${id}`, data);
    return response.data;
  }

  async deleteRule(id: string) {
    const response = await this.client.delete(`/rules/${id}`);
    return response.data;
  }

  async testRule(configId: string, context: any) {
    const response = await this.client.post('/rules/test', {
      config_key_id: configId,
      context,
    });
    return response.data;
  }

  // Audit Logs
  async getAuditLogs(filters?: {
    userId?: string;
    actionType?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const response = await this.client.get('/audit-logs', { params: filters });
    return response.data;
  }

  // API Keys
  async getApiKeys() {
    const response = await this.client.get('/api-keys');
    return response.data;
  }

  async createApiKey(data: {
    projectId: string;
    environmentId: string;
    expiresAt?: string;
  }) {
    const response = await this.client.post('/api-keys', data);
    return response.data;
  }

  async revokeApiKey(id: string) {
    const response = await this.client.delete(`/api-keys/${id}`);
    return response.data;
  }

  // Export/Import
  async exportConfigs(organizationId: string, projectId: string, environmentId: string) {
    const response = await this.client.get('/configs/export', {
      params: { organizationId, projectId, environmentId },
    });
    return response.data;
  }

  async importConfigs(data: any) {
    const response = await this.client.post('/configs/import', {
      data,
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
