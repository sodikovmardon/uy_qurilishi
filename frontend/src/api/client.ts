const BASE_URL = '/api';

interface User {
  id: number;
  name: string;
  phone: string;
}

interface Project {
  id: number;
  user_name: string;
  area: number;
  rooms: number;
  bathrooms: number;
  has_pool: boolean;
  has_garage: boolean;
  has_terrace: boolean;
  source: string;
  created_at: string;
  ai_summary?: string;
  storeys?: number;
}

interface ProjectCreateData {
  area: number;
  rooms: number;
  bathrooms: number;
  has_pool: boolean;
  has_garage: boolean;
  has_terrace: boolean;
  user_name?: string;
}

interface CalculationResult {
  bricks: number;
  cement: number;
  sand: number;
  storeys: number;
}

interface ProjectListResponse {
  results: Project[];
  total: number;
  page: number;
}

interface DashboardData {
  total_projects: number;
  web_projects: number;
  bot_projects: number;
  ai_assisted: number;
}

interface AuthResponse {
  id: number;
  name: string;
  phone: string;
}

interface AuthStatusResponse {
  authenticated: boolean;
  user: User | null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Server xatosi');
  }
  return res.json();
}

export const api = {
  calculate(data: { area: number; rooms: number }) {
    return request<CalculationResult>('/calculate/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getProjects(page = 1) {
    return request<ProjectListResponse>(`/projects/?page=${page}`);
  },

  getProject(id: number) {
    return request<Project & { ai_summary: string; storeys: number }>(`/projects/${id}/`);
  },

  createProject(data: ProjectCreateData) {
    return request<Project>('/projects/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProject(id: number, data: Partial<ProjectCreateData>) {
    return request<Project>(`/projects/${id}/update/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  signup(data: { name: string; phone: string; password: string }) {
    return request<AuthResponse>('/auth/signup/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login(username: string, password: string) {
    return request<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout() {
    return request<{ ok: boolean }>('/auth/logout/', {
      method: 'POST',
    });
  },

  authStatus() {
    return request<AuthStatusResponse>('/auth/status/');
  },

  getDashboard() {
    return request<DashboardData>('/dashboard/');
  },
};
