import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const TOKEN_KEY = "revolo.auth_token";
const USER_KEY = "revolo.auth_user";

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
};

type Ctx = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  profileCompleted: boolean;
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  setProfileCompleted: (b: boolean) => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(TOKEN_KEY);
        const u = await AsyncStorage.getItem(USER_KEY);
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u));
          // Validate token + fetch profile completion
          try {
            const me = await api("/auth/me", { headers: { Authorization: `Bearer ${t}` } });
            if (me?.user) {
              setUser(me.user);
              setProfileCompleted(!!me.profile_completed);
              await AsyncStorage.setItem(USER_KEY, JSON.stringify(me.user));
            }
          } catch {
            // Token expired/invalid — clear
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
            setToken(null);
            setUser(null);
          }
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const r = await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (!r?.ok) return { ok: false, error: r?.detail || "Signup failed" };
      await AsyncStorage.setItem(TOKEN_KEY, r.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(r.user));
      setToken(r.token);
      setUser(r.user);
      setProfileCompleted(!!r.profile_completed);
      return { ok: true };
    } catch (e: any) {
      const msg = String(e?.message || e || "Signup failed");
      return { ok: false, error: msg };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const r = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!r?.ok) return { ok: false, error: r?.detail || "Login failed" };
      await AsyncStorage.setItem(TOKEN_KEY, r.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(r.user));
      setToken(r.token);
      setUser(r.user);
      setProfileCompleted(!!r.profile_completed);
      return { ok: true };
    } catch (e: any) {
      const msg = String(e?.message || e || "Login failed");
      return { ok: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) await api("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    } catch {}
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
    setProfileCompleted(false);
  }, [token]);

  return (
    <AuthCtx.Provider
      value={{ user, token, ready, profileCompleted, signup, login, logout, setProfileCompleted }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (c) return c;
  return {
    user: null,
    token: null,
    ready: true,
    profileCompleted: false,
    signup: async () => ({ ok: false, error: "Auth not mounted" }),
    login: async () => ({ ok: false, error: "Auth not mounted" }),
    logout: async () => {},
    setProfileCompleted: () => {},
  };
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
