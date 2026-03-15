// API response envelope types

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string; // for validation errors
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

// Auth-specific API types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO 8601
}

export interface LoginRequest {
  phone?: string;
  email?: string;
  otpCode: string;
}

export interface RegisterRequest {
  phone?: string;
  email?: string;
  displayName: string;
  locale?: string;
}
