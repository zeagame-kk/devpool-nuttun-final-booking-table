import { afterEach, describe, expect, it, vi } from "vitest";
import { localStorageAuthStore } from "@/lib/auth-store";
import type { Credential } from "@/lib/types";

const credential: Credential = {
  accessToken: "a1",
  refreshToken: "r1",
  bearerType: "Bearer",
  expiresAt: "2026-10-12T12:00:00Z",
};

// A minimal browser: a Map-backed localStorage and a window that records dispatched events.
function stubBrowser(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const events: string[] = [];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  vi.stubGlobal("window", { dispatchEvent: (e: Event) => void events.push(e.type) });
  return { data, events };
}

afterEach(() => vi.unstubAllGlobals());

describe("localStorageAuthStore", () => {
  it("is safe on the server: get() is null and set/clear do not throw", () => {
    expect(localStorageAuthStore.get()).toBeNull();
    expect(() => localStorageAuthStore.set(credential)).not.toThrow();
    expect(() => localStorageAuthStore.clear()).not.toThrow();
  });

  it("stores the whole credential under one key and reads it back", () => {
    const { data } = stubBrowser();
    localStorageAuthStore.set(credential);
    expect([...data.keys()]).toEqual(["bookingtable.credential"]);
    expect(localStorageAuthStore.get()).toEqual(credential);
  });

  it("treats damaged JSON as signed out", () => {
    stubBrowser({ "bookingtable.credential": "{not json" });
    expect(localStorageAuthStore.get()).toBeNull();
  });

  it("clear() removes it", () => {
    stubBrowser();
    localStorageAuthStore.set(credential);
    localStorageAuthStore.clear();
    expect(localStorageAuthStore.get()).toBeNull();
  });

  it("announces set and clear with a bookingtable:auth event", () => {
    const { events } = stubBrowser();
    localStorageAuthStore.set(credential);
    localStorageAuthStore.clear();
    expect(events).toEqual(["bookingtable:auth", "bookingtable:auth"]);
  });

  it("survives a localStorage that throws (private mode, blocked storage)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    vi.stubGlobal("window", { dispatchEvent: () => undefined });
    expect(localStorageAuthStore.get()).toBeNull();
    expect(() => localStorageAuthStore.set(credential)).not.toThrow();
    expect(() => localStorageAuthStore.clear()).not.toThrow();
  });
});
