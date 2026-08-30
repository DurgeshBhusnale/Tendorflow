import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "@/api/auth";
import { clearAuth, getRefreshToken, setAccessToken, setRefreshToken } from "@/auth/tokenStore";
import type { AuthUser } from "@/types/user";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const { access_token } = await authApi.refresh(refreshToken);
        setAccessToken(access_token);
        const me = await authApi.me();
        setUser(me);
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    }
    void hydrate();
  }, []);

  async function login(email: string, password: string) {
    const data = await authApi.login({ email, password });
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    setUser(data.user);
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // logout is a no-op server-side today; client-side cleanup below is what matters
    }
    clearAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isAdmin: user?.role === "admin",
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
