import type { Credential } from "./types";

export interface AuthStore {
  get(): Credential | null;
  set(c: Credential): void;
  clear(): void;
}

const KEY = "bookingtable.credential";

/** Fired on `window` whenever the stored credential changes in this tab (the `storage` event covers other tabs). */
export const AUTH_EVENT = "bookingtable:auth";

function notify() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/**
 * Keeps the whole credential as one JSON value in localStorage. Every access is guarded: on the server there is
 * no window, and in private or locked-down browsers localStorage can throw. Failing means "signed out".
 */
export const localStorageAuthStore: AuthStore = {
  get() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Credential) : null;
    } catch {
      return null;
    }
  },
  set(c) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch {
      // Not stored: the user simply has to sign in again next time.
    }
    notify();
  },
  clear() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to remove.
    }
    notify();
  },
};
