"use client";

import { useSyncExternalStore } from "react";
import { AUTH_EVENT, localStorageAuthStore } from "@/lib/auth-store";
import type { Credential } from "@/lib/types";

// useSyncExternalStore compares snapshots with Object.is, and the store parses JSON on every read.
// Hand back the previous object while the stored value is unchanged, or React would re-render forever.
let lastKey: string | null = null;
let lastValue: Credential | null = null;

function getSnapshot(): Credential | null {
  const current = localStorageAuthStore.get();
  const key = current ? JSON.stringify(current) : null;
  if (key !== lastKey) {
    lastKey = key;
    lastValue = current;
  }
  return lastValue;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(AUTH_EVENT, onChange); // this tab: set/clear
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(AUTH_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The signed-in credential, `null` when signed out, `undefined` until the browser has mounted. */
export function useCredential(): Credential | null | undefined {
  return useSyncExternalStore<Credential | null | undefined>(subscribe, getSnapshot, () => undefined);
}
