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

// ── Shared singleton store ──────────────────────────────────────────
// Multiple components mount `useTermsAcceptance` (e.g. the global
// PostAuthTermsGuard AND the gate modal itself). If each instance keeps
// its own React state, calling `accept()` in one instance won't update
// the others — so the modal would never auto-dismiss after acceptance.
// This tiny pub/sub keeps every hook instance in sync.
type Snapshot = {
  ready: boolean;
  accepted: boolean;
  version: string | null;
  acceptedAt: string | null;
};
let snap: Snapshot = { ready: false, accepted: false, version: null, acceptedAt: null };
const listeners = new Set<(s: Snapshot) => void>();
const emit = () => listeners.forEach((l) => l(snap));

let loadPromise: Promise<void> | null = null;
function loadFromStorage(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const [ok, ver, at] = await Promise.all([
        AsyncStorage.getItem(KEY_OK),
        AsyncStorage.getItem(KEY_VER),
        AsyncStorage.getItem(KEY_AT),
      ]);
      const ok2 = ok === "true" && ver === TC_VERSION;
      snap = {
        ready: true,
        accepted: ok2,
        version: ok2 ? ver : null,
        acceptedAt: ok2 ? at : null,
      };
    } catch {
      snap = { ready: true, accepted: false, version: null, acceptedAt: null };
    }
    emit();
  })();
  return loadPromise;
}

async function acceptShared(): Promise<void> {
  const ts = new Date().toISOString();
  try {
    await Promise.all([
      AsyncStorage.setItem(KEY_OK, "true"),
      AsyncStorage.setItem(KEY_VER, TC_VERSION),
      AsyncStorage.setItem(KEY_AT, ts),
    ]);
  } catch {}
  snap = { ready: true, accepted: true, version: TC_VERSION, acceptedAt: ts };
  emit();
}

async function clearShared(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_OK, KEY_VER, KEY_AT]);
  } catch {}
  snap = { ready: true, accepted: false, version: null, acceptedAt: null };
  emit();
}

// ── React hook ──────────────────────────────────────────────────────
export function useTermsAcceptance() {
  const [, force] = useState(0);

  useEffect(() => {
    const sub = () => force((n) => n + 1);
    listeners.add(sub);
    loadFromStorage(); // idempotent — only fetches once
    return () => {
      listeners.delete(sub);
    };
  }, []);

  const accept = useCallback(async () => {
    await acceptShared();
  }, []);

  const clear = useCallback(async () => {
    await clearShared();
  }, []);

  // Read from the singleton on every render so each consumer sees the
  // latest values immediately after `acceptShared` notifies subscribers.
  return {
    ready: snap.ready,
    accepted: snap.accepted,
    version: snap.version,
    acceptedAt: snap.acceptedAt,
    accept,
    clear,
  };
}

/**
 * Record an explicit per-purchase acceptance (Service Info Modal).
 * Append-only audit log persisted to AsyncStorage.
 */
export async function recordPurchaseAcceptance(
  service: string,
  userId?: string,
): Promise<PurchaseAcceptance> {
  const row: PurchaseAcceptance = {
    timestamp: new Date().toISOString(),
    service,
    tcVersion: TC_VERSION,
    userId,
  };
  try {
    const raw = await AsyncStorage.getItem(KEY_PURCHASES);
    const arr: PurchaseAcceptance[] = raw ? JSON.parse(raw) : [];
    arr.push(row);
    await AsyncStorage.setItem(KEY_PURCHASES, JSON.stringify(arr.slice(-200)));
  } catch {}
  return row;
}
