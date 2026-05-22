export interface SyncStats {
  bases: number;
  tables: number;
  pages: number;
  users: number;
  errors: any[];
  completedAt?: string;
}

export interface AuthStatus {
  connected: boolean;
}

export interface CookieStatus {
  valid: boolean;
  reason: string;
}

export interface ScraperLoginResult {
  status: 'authenticated' | 'mfa_required' | 'login_failed' | 'mfa_failed';
  message?: string;
  cookieCount?: number;
}

export interface CollectionItem {
  [key: string]: any;
}
