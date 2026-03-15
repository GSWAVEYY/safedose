import { create } from 'zustand';

interface UserState {
  isAuthenticated: boolean;
  userId: string | null;
  displayName: string | null;
  locale: string;
  setAuthenticated: (authenticated: boolean) => void;
  setUser: (userId: string, displayName: string) => void;
  setLocale: (locale: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  isAuthenticated: false,
  userId: null,
  displayName: null,
  locale: 'en',
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setUser: (userId, displayName) =>
    set({ userId, displayName, isAuthenticated: true }),
  setLocale: (locale) => set({ locale }),
  logout: () =>
    set({ isAuthenticated: false, userId: null, displayName: null }),
}));
