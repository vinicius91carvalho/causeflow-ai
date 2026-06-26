/**
 * Domain types for CauseFlow AI Authentication
 */

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tenantId: string | null;
  role: UserRole;
  profileComplete: boolean;
}

export interface Session {
  user: User;
  expires: string;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: Session }
  | { status: 'unauthenticated' };

/**
 * Extended JWT token fields stored in the Auth.js JWT
 */
export interface AuthToken {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  tenantId?: string | null;
  role?: UserRole;
  profileComplete?: boolean;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
}
