import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, getOrCreateUserId, setUserName, clearUserName } from "./api";

const DEMO_KEY = "revolo.demo_mode";
const DEMO_NAME = "Demo User";

type Ctx = {
  isDemo: boolean;
  ready: boolean;
  enableDemo: () => Promise<void>;
  disableDemo: () => Promise<void>;
  toggleDemo: () => Promise<void>;
  /** Bumped any time demo seed/reset succeeds — consumers can use this
   *  as a dependency to reload account data (purchases, saved jobs). */
  refreshTick: number;
  bumpRefresh: () => void;
};

const DemoCtx = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(DEMO_KEY);
        if (v === "1") setIsDemo(true);
      } catch {}
      setReady(true);
    })();
  }, []);

  const enableDemo = useCallback(async () => {
    try {
      const uid = await getOrCreateUserId();
      await setUserName(DEMO_NAME);
      // Seed sample data via backend (idempotent)
      await api("/demo/seed", {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      }).catch(() => {});
      await AsyncStorage.setItem(DEMO_KEY, "1");
      setIsDemo(true);
      bumpRefresh();
    } catch {}
  }, [bumpRefresh]);

  const disableDemo = useCallback(async () => {
    try {
      const uid = await getOrCreateUserId();
      await api("/demo/reset", {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      }).catch(() => {});
      await clearUserName();
      await AsyncStorage.removeItem(DEMO_KEY);
      setIsDemo(false);
      bumpRefresh();
    } catch {}
  }, [bumpRefresh]);

  const toggleDemo = useCallback(async () => {
    if (isDemo) await disableDemo();
    else await enableDemo();
  }, [isDemo, enableDemo, disableDemo]);

  return (
    <DemoCtx.Provider value={{ isDemo, ready, enableDemo, disableDemo, toggleDemo, refreshTick, bumpRefresh }}>
      {children}
    </DemoCtx.Provider>
  );
}

export function useDemo(): Ctx {
  const c = useContext(DemoCtx);
  if (c) return c;
  // Safe fallback (provider not mounted)
  const noop = async () => {};
  return {
    isDemo: false,
    ready: true,
    enableDemo: noop,
    disableDemo: noop,
    toggleDemo: noop,
    refreshTick: 0,
    bumpRefresh: () => {},
  };
}
