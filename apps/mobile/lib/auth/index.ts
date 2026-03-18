/**
 * SafeDose mobile auth service.
 *
 * Handles:
 * - register / login / logout via API
 * - Token storage in expo-secure-store
 * - Refresh token rotation
 * - Optional biometric unlock (preference stored; biometric never replaces password — it
 *   gates access to stored tokens, not the server session)
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { apiClient, TOKEN_KEYS, ApiError } from '../api/client';

export { ApiError };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
}

interface AuthResponse {
  success: boolean;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface RefreshResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

const BIOMETRIC_PREF_KEY = 'auth_biometric_enabled';
const EMERGENCY_QR_TOKEN_KEY = 'auth_emergency_qr_token';

// ─── Token Storage ────────────────────────────────────────────────────────────

export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEYS.access).catch(() => null),
    SecureStore.getItemAsync(TOKEN_KEYS.refresh).catch(() => null),
  ]);
  return { accessToken, refreshToken };
}

async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEYS.access, accessToken),
    SecureStore.setItemAsync(TOKEN_KEYS.refresh, refreshToken),
  ]);
}

async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEYS.access).catch(() => undefined),
    SecureStore.deleteItemAsync(TOKEN_KEYS.refresh).catch(() => undefined),
    SecureStore.deleteItemAsync(EMERGENCY_QR_TOKEN_KEY).catch(() => undefined),
  ]);
}

/**
 * Fetch the emergency QR token from the server.
 * The token is no longer cached in SecureStore — it is fetched on demand
 * so that the emergency QR screen always reflects the current server value.
 * Returns null if the request fails or the user is not authenticated.
 */
export async function getStoredEmergencyQrToken(): Promise<string | null> {
  try {
    const data = await apiClient<{ success: boolean; emergencyQrToken: string }>(
      '/users/me/emergency-token'
    );
    return data.emergencyQrToken ?? null;
  } catch {
    return null;
  }
}

// ─── Auth Operations ──────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const data = await apiClient<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
    authenticated: false,
  });

  await storeTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const data = await apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    authenticated: false,
  });

  await storeTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout(): Promise<void> {
  const { refreshToken } = await getStoredTokens();

  // Best-effort API call — clear locally regardless of server response
  if (refreshToken) {
    await apiClient('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      authenticated: false,
    }).catch(() => undefined);
  }

  await clearTokens();
}

/**
 * Rotate refresh token. Returns new access token on success, throws on failure.
 * Callers should catch ApiError with code 'INVALID_REFRESH_TOKEN' and redirect to login.
 */
export async function refreshToken(): Promise<string> {
  const { refreshToken: stored } = await getStoredTokens();

  if (!stored) {
    throw new ApiError(401, 'NO_REFRESH_TOKEN', 'No refresh token stored.');
  }

  const data = await apiClient<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: stored },
    authenticated: false,
  });

  await storeTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// ─── Auth State ───────────────────────────────────────────────────────────────

/**
 * Returns true if a non-empty access token exists in secure storage.
 * Does NOT validate the token signature — that happens at the API boundary.
 */
export async function isAuthenticated(): Promise<boolean> {
  const { accessToken } = await getStoredTokens();
  return accessToken !== null && accessToken.length > 0;
}

// ─── Biometric ────────────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function enableBiometric(): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm biometric to enable quick unlock',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (result.success) {
    await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'true');
    return true;
  }

  return false;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const pref = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY).catch(() => null);
  return pref === 'true';
}

/**
 * Prompt biometric authentication. Returns true if successful.
 * This gates access to locally stored tokens — it does NOT issue new server tokens.
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock SafeDose',
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
  });

  return result.success;
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY).catch(() => undefined);
}
