export interface SessionUser {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
}

export interface DbProvider {
  getSessionUser(): Promise<SessionUser | null>;
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  hasCompanyAccess(userId: string, companyId: string): Promise<boolean>;
  transaction<T>(fn: (tx: { query<U = any>(text: string, params?: any[]): Promise<{ rows: U[]; rowCount: number }> }) => Promise<T>): Promise<T>;
}
