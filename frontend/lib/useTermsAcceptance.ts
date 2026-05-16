import React, { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TC_VERSION } from "../lib/legalContent";

const KEY_OK = "revolo.tc.accepted";
const KEY_VER = "revolo.tc.version";
const KEY_AT = "revolo.tc.acceptedAt";
const KEY_PURCHASES = "revolo.purchases.acceptances";

export interface PurchaseAcceptance {
  timestamp: string;
  service: string;
  tcVersion: string;
  userId?: string;
}

export function useTermsAcceptance() {
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ok, ver, at] = await Promise.all([
          AsyncStorage.getItem(KEY_OK),
          AsyncStorage.getItem(KEY_VER),
          AsyncStorage.getItem(KEY_AT),
        ]);
        // Re-prompt when the stored version is older than the current TC_VERSION.
        if (ok === "true" && ver === TC_VERSION) {
          setAccepted(true);
          setVersion(ver);
          setAcceptedAt(at);
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const accept = useCallback(async () => {
    const ts = new Date().toISOString();
    setAccepted(true);
    setVersion(TC_VERSION);
    setAcceptedAt(ts);
    try {
      await Promise.all([
        AsyncStorage.setItem(KEY_OK, "true"),
        AsyncStorage.setItem(KEY_VER, TC_VERSION),
        AsyncStorage.setItem(KEY_AT, ts),
      ]);
    } catch {}
  }, []);

  const decline = useCallback(async () => {
    setAccepted(false);
    try {
      await Promise.all([
        AsyncStorage.removeItem(KEY_OK),
        AsyncStorage.removeItem(KEY_VER),
        AsyncStorage.removeItem(KEY_AT),
      ]);
    } catch {}
  }, []);

  const reset = decline;

  return { ready, accepted, version, acceptedAt, accept, decline, reset, currentVersion: TC_VERSION };
}

/**
 * Record a per-purchase acceptance (T&C version + service id + timestamp).
 * Stored in AsyncStorage only — no new backend endpoint is created.
 */
export async function recordPurchaseAcceptance(entry: Omit<PurchaseAcceptance, "timestamp" | "tcVersion"> & { tcVersion?: string }) {
  const row: PurchaseAcceptance = {
    timestamp: new Date().toISOString(),
    tcVersion: entry.tcVersion || TC_VERSION,
    service: entry.service,
    userId: entry.userId,
  };
  try {
    const raw = (await AsyncStorage.getItem(KEY_PURCHASES)) || "[]";
    const arr = JSON.parse(raw);
    arr.push(row);
    // Keep the last 200 only — prevent unbounded growth.
    await AsyncStorage.setItem(KEY_PURCHASES, JSON.stringify(arr.slice(-200)));
  } catch {}
  return row;
}
