"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, auth } from "./api";

type User = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: "PLAYER" | "ADMIN" | "FINANCE" | "SUPER_ADMIN";
  roleRef?: { id: string; name: string } | null;
  isBanned?: boolean;
  isLocked?: boolean;
  sessionVersion?: number;
  createdAt?: string;
  referralCode?: string | null;
  profile?: any;
  wallet?: any;
} | null;

const Ctx = createContext<{
  user: User;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}>({ user: null, loading: true, refresh: async () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!auth.token()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<(NonNullable<User> & { token?: string }) | null>("/auth/me");
      if (me?.token) auth.setToken(me.token);
      if (me) {
        const { token: _token, ...userData } = me;
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      auth.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        refresh,
        logout: () => {
          auth.clear();
          setUser(null);
          window.location.href = "/";
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
