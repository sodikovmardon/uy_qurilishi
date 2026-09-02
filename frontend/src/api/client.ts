const BASE_URL = '/api';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

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
  features?: string[];
  source: string;
  created_at: string;
  ai_summary?: string;
  storeys?: number;
  /** Technical drawings (texnik chizmalar); absent for seeded/local projects. */
  technical_drawings?: TechnicalDrawing[];
}

export type DrawingType = 'fasad' | 'plan' | 'kesim' | 'kommunikatsiya' | 'fundament';
export type DrawingSubtype = '' | 'elektr' | 'vodoprovod';

/** One technical drawing attached to a project (see api/drawings.py). */
export interface TechnicalDrawing {
  type: DrawingType;
  subtype?: DrawingSubtype;
  title: string;
  file_url: string;
  /** First-page thumbnail for PDFs; '' for images/CAD (client shows the file itself). */
  preview_url: string;
  file_ext: string;
  floor_number: number | null;
  uploaded_date: string;
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

// ---- Site Admin Panel types ----
export interface SiteAdminStatus {
  authenticated: boolean;
  is_admin: boolean;
  user: {
    id: number;
    name: string;
    phone: string;
    is_staff: boolean;
    is_superuser: boolean;
  } | null;
}

export interface SiteAdminStats {
  users_total: number;
  users_today: number;
  users_active_week: number;
  projects_total: number;
  projects_pending: number;
  projects_approved: number;
  projects_rejected: number;
  projects_today: number;
  products_total: number;
  orders_total: number;
}

export interface SiteAdminDashboard {
  stats: SiteAdminStats;
  daily_signups: { date: string; count: number }[];
  daily_projects: { date: string; count: number }[];
  pending_projects: {
    id: number;
    user_name: string;
    area: number;
    rooms: number;
    created_at: string;
  }[];
  unread_notifications: number;
}

export interface SiteAdminProjectRow {
  id: number;
  user_name: string;
  area: number;
  rooms: number;
  bathrooms: number;
  status: 'pending' | 'approved' | 'rejected';
  features: string[];
  source: string;
  created_at: string;
  has_pool: boolean;
  has_garage: boolean;
  has_terrace: boolean;
  images: string[];
}

export interface SiteAdminProjectList {
  total: number;
  page: number;
  per_page: number;
  results: SiteAdminProjectRow[];
}

export interface SiteAdminProject {
  id: number;
  user_name: string;
  area: number;
  rooms: number;
  bathrooms: number;
  status: string;
  features: string[];
  source: string;
  images: string[];
  technical_drawings: TechnicalDrawing[];
  ai_summary: string;
  has_pool: boolean;
  has_garage: boolean;
  has_terrace: boolean;
  created_at: string;
}

export interface SiteAdminUserRow {
  id: number;
  name: string;
  phone: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  project_count: number;
}

export interface SiteAdminUserList {
  total: number;
  page: number;
  per_page: number;
  results: SiteAdminUserRow[];
}

export interface SiteAdminUser {
  id: number;
  name: string;
  phone: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  projects: { id: number; area: number; rooms: number; status: string; created_at: string }[];
}

export interface SiteAdminReviewList {
  total: number;
  results: unknown[];
}

export interface SiteSettingsData {
  site_name: string;
  tagline: string;
  contact_phone: string;
  contact_email: string;
  maintenance_mode: boolean;
  allow_new_projects: boolean;
  allow_reviews: boolean;
  allow_ai_chat: boolean;
  allow_store: boolean;
  store_api_url: string;
  store_api_key: boolean;
  anthropic_api_key: boolean;
  groq_api_key: boolean;
  updated_at: string;
}

export interface SiteAdminAuditRow {
  id: number;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

export interface SiteAdminAuditList {
  total: number;
  page: number;
  per_page: number;
  results: SiteAdminAuditRow[];
}

export interface SiteAdminNotification {
  id: number;
  type: string;
  title: string;
  target_type: string;
  target_id: string;
  is_read: boolean;
  created_at: string;
}

export interface SiteAdminNotificationList {
  results: SiteAdminNotification[];
}

/** Parsed API error with machine-readable status + human message + field errors. */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Human-readable fallback messages per HTTP status (Uzbek). */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'So\'rov noto\'g\'ri kiritildi',
  401: 'Login yoki parol noto\'g\'ri',
  403: 'Ruxsat berilmadi',
  404: 'Ma\'lumot topilmadi',
  409: 'Bu telefon raqami allaqachon ro\'yxatdan o\'tgan',
  429: 'Juda ko\'p so\'rov yuborildi. Iltimos, birozdan so\'ng qayta urinib ko\'ring',
  500: 'Xatolik yuz berdi, birozdan so\'ng qaytadan urinib ko\'ring',
  502: 'Server bilan bog\'lanishda xatolik',
  503: 'Servis vaqtincha ishlamayapti',
};

function firstMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstMessage(value[0]);
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return firstMessage(v.message ?? v.detail ?? Object.values(v)[0]);
  }
  return '';
}

/** Build an ApiError from a DRF/JSON response — handles error/detail/field dict shapes. */
async function toApiError(res: Response): Promise<ApiError> {
  const statusFallback = STATUS_MESSAGES[res.status] || 'Xatolik yuz berdi, birozdan so\'ng qaytadan urinib ko\'ring';
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return new ApiError(statusFallback, res.status);
  }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.error === 'string' && b.error) {
      return new ApiError(b.error, res.status);
    }
    if (typeof b.detail === 'string' && b.detail) {
      let msg = b.detail;
      // Map DRF's English throttle detail to a friendly Uzbek message.
      if (/throttl/i.test(msg) || /expected available/i.test(msg)) {
        msg = STATUS_MESSAGES[429] || 'Juda ko\'p so\'rov yuborildi. Iltimos, birozdan so\'ng qayta urinib ko\'ring';
      }
      return new ApiError(msg, res.status);
    }
    // Field-level validation dict, e.g. {"phone": ["..."]}.
    const fieldErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(b)) {
      if (key === 'non_field_errors') continue;
      const m = firstMessage(value);
      if (m) fieldErrors[key] = m;
    }
    const nonField = firstMessage(b.non_field_errors);
    const combined = Object.values(fieldErrors).join(', ') || nonField || statusFallback;
    return new ApiError(combined, res.status, fieldErrors);
  }
  return new ApiError(statusFallback, res.status);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRFToken'] = csrf;
  }
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers, credentials: 'same-origin' });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json();
}

/** Like `request` but without the JSON header — used for multipart (image uploads). */
async function requestForm<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRFToken'] = csrf;
  }
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers, credentials: 'same-origin' });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json();
}

export interface UploadImage {
  file: Blob;
  name: string;
}

/**
 * Multipart file upload with per-file progress. Uses XMLHttpRequest because
 * fetch has no upload-progress events. Returns the parsed JSON response.
 */
function uploadFilesXhr(
  url: string,
  field: string,
  files: UploadImage[],
  extraFields: Record<string, string>,
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));
    files.forEach((f) => fd.append(field, f.file, f.name));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${url}`);
    const csrf = getCsrfToken();
    if (csrf) xhr.setRequestHeader('X-CSRFToken', csrf);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Record<string, unknown>);
      } else {
        const msg = xhr.response?.error ?? 'Yuklashda xato';
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Serverga ulanishda xato'));
    xhr.send(fd);
  });
}

function uploadImagesXhr(
  url: string,
  files: UploadImage[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ images: string[] }> {
  return uploadFilesXhr(url, 'images', files, {}, onProgress).then(
    (r) => r as { images: string[] },
  );
}

export interface StoreProduct {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_quantity: number;
  stock_status: string;
  image_url: string | null;
  images: string[];
  description: string;
  sku: string;
  last_updated: string;
}

export interface StoreCategory {
  category: string;
  product_count: number;
}

export interface StoreDashboard {
  totals: { total: number; in_stock: number; low_stock: number; out_of_stock: number; orders: number };
  low_stock_threshold: number;
  low_stock: { id: number; name: string; category: string; stock_quantity: number; status: string }[];
  recent: StoreProduct[];
}

export interface StoreOrder {
  id: number;
  product_id: number;
  product: string;
  quantity: number;
  customer_name: string;
  phone: string;
  note: string;
  created_at: string;
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

  // ---- Project images ----
  uploadProjectImages(id: number, files: UploadImage[], onProgress?: (done: number, total: number) => void) {
    return uploadImagesXhr(`/projects/${id}/images/`, files, onProgress);
  },

  reorderProjectImages(id: number, images: string[]) {
    return request<{ images: string[] }>(`/projects/${id}/images/reorder/`, {
      method: 'POST',
      body: JSON.stringify({ images }),
    });
  },

  // ---- Technical drawings (texnik chizmalar) ----
  uploadProjectDrawings(
    id: number,
    files: UploadImage[],
    meta: { type: string; title: string; floor_number: number | null; subtype?: string }[],
    onProgress?: (done: number, total: number) => void,
  ) {
    return uploadFilesXhr(`/projects/${id}/drawings/`, 'files', files, { meta: JSON.stringify(meta) }, onProgress)
      .then((r) => r as { drawings: TechnicalDrawing[] });
  },

  saveProjectDrawings(id: number, drawings: Partial<TechnicalDrawing>[]) {
    return request<{ drawings: TechnicalDrawing[] }>(`/projects/${id}/drawings/update/`, {
      method: 'POST',
      body: JSON.stringify({ drawings }),
    });
  },

  projectDrawingsZipUrl(id: number) {
    return `${BASE_URL}/projects/${id}/drawings/zip/`;
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

  googleAuth(credential: string) {
    return request<AuthResponse & { email?: string; picture?: string; created?: boolean }>('/auth/google/', {
      method: 'POST',
      body: JSON.stringify({ credential }),
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

  // ---- Public store API (v1) ----
  getStoreProducts(params?: { category?: string; search?: string; inStock?: boolean }) {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.inStock) q.set('in_stock', 'true');
    const qs = q.toString();
    return request<StoreProduct[]>(`/v1/products/${qs ? `?${qs}` : ''}`);
  },

  getStoreProduct(id: number) {
    return request<StoreProduct>(`/v1/products/${id}/`);
  },

  getStoreCategories() {
    return request<StoreCategory[]>('/v1/categories/');
  },

  createOrder(data: { product_id: number; quantity: number; name?: string; phone: string; note?: string }) {
    return request<{ ok: boolean; id: number; product: string; quantity: number; total: number }>(
      '/orders/create/',
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  /** Calculator → store: one bundled inquiry for many materials. */
  calcInquiry(data: {
    name?: string;
    phone: string;
    note?: string;
    items: { product_id: number; quantity: number }[];
  }) {
    return request<{ ok: boolean; count: number; items: { id: number; product: string; quantity: number }[] }>(
      '/calc/inquiry/',
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  // ---- Store-owner admin API ----
  storeLogin(username: string, password: string) {
    return request<{ id: number; username: string; name: string }>('/admin/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  storeLogout() {
    return request<{ ok: boolean }>('/admin/auth/logout/', { method: 'POST' });
  },

  storeStatus() {
    return request<{ authenticated: boolean; owner: { id: number; username: string; name: string } | null }>(
      '/admin/auth/status/',
    );
  },

  adminDashboard() {
    return request<StoreDashboard>('/admin/dashboard/');
  },

  adminProducts(params?: { search?: string; category?: string }) {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    const qs = q.toString();
    return request<StoreProduct[]>(`/admin/products/${qs ? `?${qs}` : ''}`);
  },

  adminCategories() {
    return request<string[]>('/admin/categories/');
  },

  adminCreateProduct(form: FormData) {
    return requestForm<StoreProduct>('/admin/products/', { method: 'POST', body: form });
  },

  adminUpdateProduct(id: number, form: FormData) {
    return requestForm<StoreProduct>(`/admin/products/${id}/`, { method: 'PUT', body: form });
  },

  adminDeleteProduct(id: number) {
    return request<{ ok: boolean }>(`/admin/products/${id}/`, { method: 'DELETE' });
  },

  adminStockBulk(updates: { id: number; quantity: number }[]) {
    return request<{ updated: number }>('/admin/stock/bulk/', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  },

  adminUploadProductImages(id: number, files: UploadImage[], onProgress?: (done: number, total: number) => void) {
    return uploadImagesXhr(`/admin/products/${id}/images/`, files, onProgress);
  },

  adminReorderProductImages(id: number, images: string[]) {
    return request<{ images: string[] }>(`/admin/products/${id}/images/reorder/`, {
      method: 'POST',
      body: JSON.stringify({ images }),
    });
  },

  adminPriceBulk(category: string, percent: number) {
    return request<{ updated: number }>('/admin/price/bulk/', {
      method: 'POST',
      body: JSON.stringify({ category, percent }),
    });
  },

  adminOrders() {
    return request<StoreOrder[]>('/admin/orders/');
  },

  // ---- Site Admin Panel API (guarded by is_staff server-side) ----
  adminStatus() {
    return request<SiteAdminStatus>('/site-admin/auth/status/');
  },
  siteAdminDashboard() {
    return request<SiteAdminDashboard>('/site-admin/dashboard/');
  },
  siteAdminProjects(params: { status?: string; search?: string; sort?: string; page?: number; per_page?: number } = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<SiteAdminProjectList>(`/site-admin/projects/${qs ? `?${qs}` : ''}`);
  },
  siteAdminProjectDetail(id: number) {
    return request<SiteAdminProject>(`/site-admin/projects/${id}/`);
  },
  siteAdminProjectUpdate(id: number, data: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/site-admin/projects/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  },
  siteAdminProjectBulkAction(action: 'approve' | 'reject', ids: number[], reason = '') {
    return request<{ updated: number }>('/site-admin/projects/', {
      method: 'POST',
      body: JSON.stringify({ action, ids, reason }),
    });
  },
  siteAdminProjectDelete(id: number) {
    return request<{ ok: boolean }>(`/site-admin/projects/${id}/`, { method: 'DELETE' });
  },
  siteAdminUsers(params: { search?: string; status?: string; sort?: string; page?: number; per_page?: number } = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<SiteAdminUserList>(`/site-admin/users/${qs ? `?${qs}` : ''}`);
  },
  siteAdminUserDetail(id: number) {
    return request<SiteAdminUser>(`/site-admin/users/${id}/`);
  },
  siteAdminUserUpdate(id: number, data: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/site-admin/users/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  },
  siteAdminUserDelete(id: number) {
    return request<{ ok: boolean }>(`/site-admin/users/${id}/delete/`, { method: 'DELETE' });
  },
  siteAdminReviews() {
    return request<SiteAdminReviewList>('/site-admin/reviews/');
  },
  siteAdminCategories() {
    return request<{ results: { name: string; count: number }[] }>('/site-admin/categories/');
  },
  siteAdminRegions() {
    return request<{ results: { name: string; code: string }[] }>('/site-admin/regions/');
  },
  siteAdminSettings() {
    return request<SiteSettingsData>('/site-admin/settings/');
  },
  siteAdminUpdateSettings(data: Record<string, unknown>) {
    return request<{ ok: boolean }>('/site-admin/settings/', { method: 'PUT', body: JSON.stringify(data) });
  },
  siteAdminAudit(params: { action?: string; admin?: string; page?: number } = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<SiteAdminAuditList>(`/site-admin/audit/${qs ? `?${qs}` : ''}`);
  },
  siteAdminNotifications(unread = false) {
    return request<SiteAdminNotificationList>(`/site-admin/notifications/${unread ? '?unread=true' : ''}`);
  },
  siteAdminMarkNotificationsRead(ids: number[] = []) {
    return request<{ ok: boolean }>('/site-admin/notifications/read/', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};
