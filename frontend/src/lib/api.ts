import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'https://drop-shop-production.up.railway.app/api/v1';
export const api = axios.create({ baseURL, withCredentials: true });

let accessToken: string | null = null;
let refreshRequest: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retried ||
      String(request.url).includes('/auth/refresh') ||
      String(request.url).includes('/auth/login') ||
      String(request.url).includes('/auth/register')
    ) {
      return Promise.reject(error);
    }

    request._retried = true;
    refreshRequest ??= axios
      .post<{ accessToken: string }>(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshRequest = null;
      });

    const token = await refreshRequest;
    if (!token) return Promise.reject(error);
    request.headers.Authorization = `Bearer ${token}`;
    return api(request);
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data as { message?: string | string[] } | undefined;
    return Array.isArray(message?.message)
      ? message.message.join(', ')
      : message?.message ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }
  return error instanceof Error ? error.message : 'Произошла непредвиденная ошибка.';
}

export const formatMoney = (value: string | number): string =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value))} сум`;

export const statusLabels: Record<string, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  PACKING: 'Собирается',
  DELIVERY: 'В доставке',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
};
