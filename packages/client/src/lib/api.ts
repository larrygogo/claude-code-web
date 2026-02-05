import { ApiResponse } from '@claude-web/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  const { AuthResponse } = await import('@claude-web/shared');
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

export async function forkSession(sessionId: string, messageIndex: number) {
  return apiClient.post<import('@claude-web/shared').Session>(`/api/sessions/${sessionId}/fork`, {
    messageIndex,
  });
}

export async function getProjects() {
  return apiClient.get<import('@claude-web/shared').ProjectListItem[]>('/api/projects');
}

export async function createProject(name: string, path: string) {
  return apiClient.post<import('@claude-web/shared').Project>('/api/projects', {
    name,
    path,
  });
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
