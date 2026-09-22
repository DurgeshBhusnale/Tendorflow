export type UserRole = "admin" | "employee";

export interface User {
  id: string;
  full_name: string;
  /** The login credential. Editable by an admin (CH-24). */
  username: string;
  /** Optional contact address (CH-25) — null when the account has none. */
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  full_name: string;
  username: string;
  /** Omit or send null when the account has no email. */
  email?: string | null;
  password: string;
  role: UserRole;
}

export interface UserUpdate {
  full_name?: string;
  username?: string;
  /** Null clears the stored address. */
  email?: string | null;
  role?: UserRole;
  is_active?: boolean;
  /** Only send this to change the password; omit it to leave it alone. */
  password?: string;
}

export interface AuthUser {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: UserRole;
}
