import axios, { AxiosRequestConfig } from 'axios';
import { clearAuth, getAccessToken, setAccessToken } from './auth';

const SAFE_METHODS = new Set(['get', 'head', 'options']);

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // necessário para enviar/receber cookies (refresh token, csrf)
});

// Injeta access token e CSRF em cada pedido
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  if (!SAFE_METHODS.has((config.method ?? 'get').toLowerCase())) {
    const csrf = getCsrfToken();
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  refreshQueue.forEach((cb) => cb(newToken));
  refreshQueue = [];
}

// Intercept 401 — tenta refresh automático antes de redirecionar para login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !original._retry &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login' &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            original._retry = true;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post<{ access_token: string }>('/auth/refresh');
        setAccessToken(data.access_token);
        processQueue(data.access_token);
        original.headers = { ...original.headers, Authorization: `Bearer ${data.access_token}` };
        return api(original);
      } catch {
        refreshQueue = [];
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
