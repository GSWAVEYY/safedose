import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_API_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

const API_BASE_URL =
  (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
  `http://${DEFAULT_API_HOST}:3001`;

export const TOKEN_KEYS = {
  access: 'auth_access_token',
  refresh: 'auth_refresh_token',
} as const;

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
}

async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.access);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, authenticated = true } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (authenticated) {
    const token = await getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN_ERROR', message: 'Request failed' },
    })) as { error?: { code?: string; message?: string } };

    const code = errorBody.error?.code ?? 'UNKNOWN_ERROR';
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(response.status, code, message);
  }

  return response.json() as Promise<T>;
}
