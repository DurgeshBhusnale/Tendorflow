export type UserRole = "admin" | "employee";

export interface User {
  id: string;
  full_name: string;
  /** The login credential. Set at onboarding and not editable afterwards. */
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UserUpdate {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

export interface AuthUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
}
