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
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Server xatosi');
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
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Server xatosi');
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
};
