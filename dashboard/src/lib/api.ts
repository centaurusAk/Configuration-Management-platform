import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiClient {
  private client: AxiosInstance;

  constructor(token?: string) {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  setToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    delete this.client.defaults.headers.common['Authorization'];
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

  async getConfigs(projectId: string, environmentId: string) {
    const response = await this.client.get('/configs', {
      params: { projectId, environmentId },
    });
    return response.data;
  }

  async getConfig(id: string) {
    const response = await this.client.get(`/configs/${id}`);
    return response.data;
  }

  async createConfig(data: any) {
    const response = await this.client.post('/configs', data);
    return response.data;
  }

  async updateConfig(id: string, data: any) {
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

  async rollbackConfig(id: string, versionId: string, rolledBackBy: string) {
    const response = await this.client.post(`/configs/${id}/rollback`, { versionId, rolledBackBy });
    return response.data;
  }

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

  async getAuditLogs(filters?: {
    dateRange?: { start: string; end: string };
    userId?: string;
    actionType?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await this.client.get('/audit-logs', { params: filters });
    return response.data;
  }

  async getApiKeys(projectId: string, environmentId: string) {
    const response = await this.client.get('/api-keys', {
      params: { projectId, environmentId },
    });
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

  async exportConfigs(projectId: string, environmentId: string) {
    const response = await this.client.get('/configs/export', {
      params: { projectId, environmentId },
    });
    return response.data;
  }

  async importConfigs(data: any) {
    const response = await this.client.post('/configs/import', data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
