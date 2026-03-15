// User domain types

export type UserLocale = 'en' | 'es' | 'fr' | 'pt' | 'zh' | 'ar' | 'hi';

export interface User {
  id: string;
  phone?: string;
  email?: string;
  displayName: string;
  locale: UserLocale;
  emergencyQrToken: string;
  createdAt: string;
  lastSeen: string;
}

export interface UserCreate {
  phone?: string;
  email?: string;
  displayName: string;
  locale?: UserLocale;
}

export interface UserProfile extends Omit<User, 'emergencyQrToken'> {
  // Public-facing profile — QR token excluded
  medicationCount: number;
}
