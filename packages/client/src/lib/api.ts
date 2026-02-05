import { ApiResponse, SystemConfig } from '@claude-web/shared';

// 运行时环境变量支持（Docker 部署时通过 env-config.js 注入）
declare global {
  interface Window {
    __ENV__?: {
      VITE_API_URL?: string;
    };
  }
}

function getApiBaseUrl(): string {
  // 优先使用运行时注入的环境变量（Docker 部署）
  if (typeof window !== 'undefined' && window.__ENV__?.VITE_API_URL) {
    return window.__ENV__.VITE_API_URL;
  }
  // 回退到构建时的环境变量
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
}

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      const error = new Error(data.error?.message || 'Request failed');
      (error as Error & { code?: string }).code = data.error?.code;
      throw error;
    }

    return data.data as T;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

export async function login(email: string, password: string) {
  return apiClient.post<import('@claude-web/shared').AuthResponse>('/api/auth/login', {
    email,
    password,
  });
}

export async function register(email: string, username: string, password: string) {
  return apiClient.post<import('@claude-web/shared').AuthResponse>('/api/auth/register', {
    email,
    username,
    password,
  });
}

export async function refreshToken(refreshToken: string) {
  return apiClient.post<{ tokens: import('@claude-web/shared').AuthTokens }>('/api/auth/refresh', {
    refreshToken,
  });
}

export async function logout(refreshToken: string) {
  return apiClient.post('/api/auth/logout', { refreshToken });
}

export async function getCurrentUser() {
  return apiClient.get<import('@claude-web/shared').User>('/api/auth/me');
}

export async function updateUserSettings(settings: Partial<import('@claude-web/shared').UserSettings>) {
  return apiClient.patch<import('@claude-web/shared').UserSettings>('/api/auth/settings', settings);
}

export async function getSessions(projectId?: string) {
  const query = projectId ? `?projectId=${projectId}` : '';
  return apiClient.get<import('@claude-web/shared').SessionListItem[]>(`/api/sessions${query}`);
}

export async function getSession(sessionId: string) {
  return apiClient.get<import('@claude-web/shared').SessionWithMessages>(`/api/sessions/${sessionId}`);
}

export async function createSession(projectId?: string, title?: string) {
  return apiClient.post<import('@claude-web/shared').Session>('/api/sessions', {
    projectId,
    title,
  });
}

export async function deleteSession(sessionId: string) {
  return apiClient.delete(`/api/sessions/${sessionId}`);
}

export async function updateSession(sessionId: string, input: import('@claude-web/shared').SessionUpdateInput) {
  return apiClient.patch<import('@claude-web/shared').Session>(`/api/sessions/${sessionId}`, input);
}

export async function forkSession(sessionId: string, messageIndex: number) {
  return apiClient.post<import('@claude-web/shared').Session>(`/api/sessions/${sessionId}/fork`, {
    messageIndex,
  });
}

export async function getProjects() {
  return apiClient.get<import('@claude-web/shared').ProjectListItem[]>('/api/projects');
}

export async function getProject(projectId: string) {
  return apiClient.get<import('@claude-web/shared').Project>(`/api/projects/${projectId}`);
}

export async function createProject(input: import('@claude-web/shared').ProjectCreateInput) {
  return apiClient.post<import('@claude-web/shared').Project>('/api/projects', input);
}

export async function updateProject(projectId: string, input: import('@claude-web/shared').ProjectUpdateInput) {
  return apiClient.put<import('@claude-web/shared').Project>(`/api/projects/${projectId}`, input);
}

export async function deleteProject(projectId: string) {
  return apiClient.delete(`/api/projects/${projectId}`);
}

export async function getProjectContext(projectId: string) {
  return apiClient.get<import('@claude-web/shared').ProjectContext>(`/api/projects/${projectId}/context`);
}

export async function getPlans(sessionId?: string) {
  const query = sessionId ? `?sessionId=${sessionId}` : '';
  return apiClient.get<import('@claude-web/shared').PlanListItem[]>(`/api/plans${query}`);
}

export async function getPlan(planId: string) {
  return apiClient.get<import('@claude-web/shared').Plan>(`/api/plans/${planId}`);
}

export async function updatePlan(planId: string, updates: import('@claude-web/shared').PlanUpdateInput) {
  return apiClient.patch<import('@claude-web/shared').Plan>(`/api/plans/${planId}`, updates);
}

export async function executePlan(planId: string) {
  return apiClient.post<import('@claude-web/shared').Plan>(`/api/plans/${planId}/execute`);
}

export async function abortChat(sessionId: string) {
  return apiClient.post<{ aborted: boolean }>(`/api/chat/abort/${sessionId}`);
}

export async function searchProjectPath(description: string) {
  return apiClient.post<{ paths: string[]; message: string }>('/api/projects/search-path', {
    description,
  });
}

// ==================== Admin API ====================

export async function getAdminDashboard() {
  return apiClient.get<import('@claude-web/shared').DashboardStats>('/api/admin/dashboard');
}

export async function getAdminUsers(page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  return apiClient.get<import('@claude-web/shared').UserListResponse>(`/api/admin/users?${params}`);
}

export async function updateUserStatus(userId: string, status: import('@claude-web/shared').UserStatus) {
  return apiClient.patch<import('@claude-web/shared').UserListItem>(`/api/admin/users/${userId}/status`, { status });
}

export async function updateUserRole(userId: string, role: import('@claude-web/shared').UserRole) {
  return apiClient.patch<import('@claude-web/shared').UserListItem>(`/api/admin/users/${userId}/role`, { role });
}

export async function resetUserPassword(userId: string, newPassword: string) {
  return apiClient.post<{ message: string }>(`/api/admin/users/${userId}/reset-password`, { newPassword });
}

export async function deleteAdminUser(userId: string) {
  return apiClient.delete<{ message: string }>(`/api/admin/users/${userId}`);
}

export async function getAdminModels() {
  return apiClient.get<import('@claude-web/shared').ModelConfigListItem[]>('/api/admin/models');
}

export async function createAdminModel(input: import('@claude-web/shared').ModelConfigInput) {
  return apiClient.post<import('@claude-web/shared').ModelConfigListItem>('/api/admin/models', input);
}

export async function updateAdminModel(id: string, input: import('@claude-web/shared').ModelConfigUpdateInput) {
  return apiClient.patch<import('@claude-web/shared').ModelConfigListItem>(`/api/admin/models/${id}`, input);
}

export async function deleteAdminModel(id: string) {
  return apiClient.delete<{ message: string }>(`/api/admin/models/${id}`);
}

// ==================== System API ====================

export async function getSystemConfig() {
  return apiClient.get<SystemConfig>('/api/system/config');
}
