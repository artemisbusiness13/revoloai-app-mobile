import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const API = `${BACKEND}/api`;

export const AVATARS = {
  maya: `${BACKEND}/api/avatars/maya`,
  sofia: `${BACKEND}/api/avatars/sofia`,
  aria: `${BACKEND}/api/avatars/aria`,
} as const;

export type AvatarKey = "maya" | "sofia" | "aria";

export const AVATAR_META: Record<AvatarKey, { name: string; role: string; color: string; soft: string }> = {
  maya: { name: "Maya", role: "Job Finder", color: "#0EA5E9", soft: "#E6F6FE" },
  sofia: { name: "Sofia", role: "Interview Coach", color: "#EC4899", soft: "#FDECF5" },
  aria: { name: "Aria", role: "Career Coach", color: "#8B5CF6", soft: "#F1ECFE" },
};

const USER_KEY = "revolo.user_id";
const NAME_KEY = "revolo.user_name";

export async function getOrCreateUserId(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(USER_KEY);
    if (v) return v;
    const id = `g_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    await AsyncStorage.setItem(USER_KEY, id);
    return id;
  } catch {
    return "guest";
  }
}

export async function getUserName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export async function setUserName(name: string) {
  try {
    await AsyncStorage.setItem(NAME_KEY, name);
  } catch {}
}

export async function clearUserName() {
  try {
    await AsyncStorage.removeItem(NAME_KEY);
  } catch {}
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`API ${path} failed: ${r.status} ${text}`);
  }
  return r.json();
}
