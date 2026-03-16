import { create } from 'zustand';
import {
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  refreshToken,
  isAuthenticated,
  authenticateWithBiometric,
  isBiometricEnabled,
  ApiError,
} from '../lib/auth/index';
import { apiClient } from '../lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  locale: string;
  error: string | null;

  // Basic setters (internal use)
  setLocale: (locale: string) => void;
  clearError: () => void;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  biometricUnlock: () => Promise<boolean>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  userId: null,
  displayName: null,
  email: null,
  phone: null,
  locale: 'en',
  error: null,

  setLocale: (locale) => set({ locale }),
  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authLogin(email, password);
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'An unexpected error occurred. Please try again.';
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw err;
    }
  },

  register: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authRegister(email, password, displayName);
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Registration failed. Please try again.';
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authLogout();
    } finally {
      set({
        isAuthenticated: false,
        isLoading: false,
        userId: null,
        displayName: null,
        email: null,
        phone: null,
        error: null,
      });
    }
  },

  /**
   * Called on app start. Checks for a stored access token, attempts refresh if
   * needed, and hydrates the store with the user's profile if successful.
   */
  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Attempt to fetch the current user profile (validates that the token works)
      try {
        const profile = await apiClient<{
          id: string;
          displayName: string;
          email: string | null;
          phone: string | null;
          locale: string;
        }>('/users/me', { authenticated: true });

        set({
          isAuthenticated: true,
          isLoading: false,
          userId: profile.id,
          displayName: profile.displayName,
          email: profile.email,
          phone: profile.phone,
          locale: profile.locale,
        });
      } catch (profileErr: unknown) {
        // 401 means access token expired — try to refresh
        if (profileErr instanceof ApiError && profileErr.statusCode === 401) {
          try {
            await refreshToken();
            // Re-fetch profile with new token
            const profile = await apiClient<{
              id: string;
              displayName: string;
              email: string | null;
              phone: string | null;
              locale: string;
            }>('/users/me', { authenticated: true });

            set({
              isAuthenticated: true,
              isLoading: false,
              userId: profile.id,
              displayName: profile.displayName,
              email: profile.email,
              phone: profile.phone,
              locale: profile.locale,
            });
          } catch {
            // Refresh failed — force re-login
            set({ isAuthenticated: false, isLoading: false });
          }
        } else {
          // Network error or other — don't force logout, stay optimistic
          // The app can work offline with local SQLite data
          set({ isLoading: false });
        }
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  biometricUnlock: async () => {
    const { isAuthenticated: alreadyAuthed } = get();
    if (alreadyAuthed) return true;

    const biometricEnabled = await isBiometricEnabled();
    if (!biometricEnabled) return false;

    const success = await authenticateWithBiometric();
    if (success) {
      // Biometric passed — now validate stored tokens to restore session
      await get().checkAuth();
    }
    return success;
  },
}));
