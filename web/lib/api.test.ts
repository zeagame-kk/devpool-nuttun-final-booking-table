import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiFetch } from "./api";
import type { AuthStore } from "./auth-store";
import type { Credential } from "./types";

const BASE = "http://api.test/v1";

function credential(access: string, refresh = "r1"): Credential {
  return { accessToken: access, refreshToken: refresh, bearerType: "Bearer", expiresAt: "2026-10-12T12:00:00Z" };
}

function memoryStore(initial: Credential | null): AuthStore {
  let current = initial;
  return {
    get: () => current,
    set: (c) => {
      current = c;
    },
    clear: () => {
      current = null;
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(initial: Credential | null, ...responses: Response[]) {
  const queue = [...responses];
  const fetchFn = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra request");
    return next;
  });
  const store = memoryStore(initial);
  const onAuthLost = vi.fn();
  const api = createApiFetch({ fetchFn: fetchFn as unknown as typeof fetch, store, baseUrl: BASE, onAuthLost });
  return { api, fetchFn, store, onAuthLost };
}

// What the fake fetch saw for call number `n`.
function sent(fetchFn: ReturnType<typeof setup>["fetchFn"], n = 0) {
  const [url, init] = fetchFn.mock.calls[n] as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

// The error a call rejects with; fails the test if the call succeeds instead.
async function rejection(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error("expected the call to reject");
}

describe("apiFetch basics", () => {
  it("attaches the bearer token", async () => {
    const { api, fetchFn } = setup(credential("t1"), json(200, { ok: true }));
    await api("/restaurants");
    expect(sent(fetchFn).url).toBe(`${BASE}/restaurants`);
    expect(sent(fetchFn).headers.get("Authorization")).toBe("Bearer t1");
  });

  it("sends no Authorization header when signed out", async () => {
    const { api, fetchFn } = setup(null, json(200, {}));
    await api("/restaurants");
    expect(sent(fetchFn).headers.has("Authorization")).toBe(false);
  });

  it("returns undefined for 204 without parsing json", async () => {
    const noBody = {
      ok: true,
      status: 204,
      json: () => {
        throw new Error("json() must not be called for 204");
      },
    } as unknown as Response;
    const { api } = setup(credential("t1"), noBody);
    await expect(api("/reservations/1/cancel", { method: "POST" })).resolves.toBeUndefined();
  });

  it("maps an error body to ApiError", async () => {
    const { api } = setup(credential("t1"), json(409, { message: "x", code: "capacity_exceeded" }));
    const err = await rejection(api("/restaurants/1/reservations", { method: "POST", body: {} }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "capacity_exceeded", message: "x" });
  });

  it("keeps the status when the error body cannot be read", async () => {
    const { api } = setup(credential("t1"), new Response("<html>bad gateway</html>", { status: 502 }));
    const err = await rejection(api("/restaurants"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBeUndefined();
  });

  it("sends FormData as is, without a Content-Type of its own", async () => {
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "image/png" }), "a.png");
    const { api, fetchFn } = setup(credential("t1"), json(200, {}));
    await api("/restaurants/1/image", { method: "POST", body: form });
    expect(sent(fetchFn).init.body).toBe(form);
    expect(sent(fetchFn).headers.has("Content-Type")).toBe(false);
  });

  it("sends json with a content type", async () => {
    const { api, fetchFn } = setup(credential("t1"), json(201, { id: 1 }));
    await api("/restaurants", { method: "POST", body: { name: "ชาบู" } });
    expect(sent(fetchFn).init.method).toBe("POST");
    expect(sent(fetchFn).headers.get("Content-Type")).toBe("application/json");
    expect(sent(fetchFn).init.body).toBe(JSON.stringify({ name: "ชาบู" }));
  });
});

describe("apiFetch session refresh", () => {
  it("refreshes once and retries on 401", async () => {
    const { api, fetchFn, store } = setup(
      credential("t1", "r1"),
      json(401, { message: "expired" }),
      json(200, credential("t2", "r2")),
      json(200, { ok: true }),
    );
    await expect(api("/restaurants")).resolves.toEqual({ ok: true });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    const refresh = sent(fetchFn, 1);
    expect(refresh.url).toBe(`${BASE}/auth/refresh-token`);
    expect(refresh.init.method).toBe("POST");
    expect(refresh.init.body).toBe(JSON.stringify({ refreshToken: "r1" }));
    expect(refresh.headers.has("Authorization")).toBe(false);
    expect(sent(fetchFn, 2).headers.get("Authorization")).toBe("Bearer t2");
    expect(store.get()?.accessToken).toBe("t2");
  });

  it("refreshes once for concurrent 401s", async () => {
    let refreshCalls = 0;
    const store = memoryStore(credential("t1", "r1"));
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh-token")) {
        refreshCalls++;
        await Promise.resolve();
        return json(200, credential("t2", "r2"));
      }
      const bearer = new Headers(init.headers).get("Authorization");
      return bearer === "Bearer t2" ? json(200, { ok: url }) : json(401, { message: "expired" });
    });
    const api = createApiFetch({ fetchFn: fetchFn as unknown as typeof fetch, store, baseUrl: BASE, onAuthLost: vi.fn() });

    const [a, b] = await Promise.all([api("/restaurants"), api("/reservations")]);

    expect(refreshCalls).toBe(1);
    expect(a).toEqual({ ok: `${BASE}/restaurants` });
    expect(b).toEqual({ ok: `${BASE}/reservations` });
  });

  it("does not refresh again when another request has already renewed the token", async () => {
    let refreshCalls = 0;
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => (releaseSlow = resolve));
    const store = memoryStore(credential("t1", "r1"));
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      const bearer = new Headers(init.headers).get("Authorization");
      if (url.endsWith("/auth/refresh-token")) {
        refreshCalls++;
        return json(200, credential("t2", "r2"));
      }
      if (url.endsWith("/slow") && bearer === "Bearer t1") {
        await slowGate; // its 401 only arrives after the other request has refreshed
        return json(401, { message: "expired" });
      }
      return bearer === "Bearer t2" ? json(200, { ok: url }) : json(401, { message: "expired" });
    });
    const api = createApiFetch({ fetchFn: fetchFn as unknown as typeof fetch, store, baseUrl: BASE, onAuthLost: vi.fn() });

    const slow = api("/slow");
    await api("/fast");
    releaseSlow();

    await expect(slow).resolves.toEqual({ ok: `${BASE}/slow` });
    expect(refreshCalls).toBe(1);
  });

  it("clears the store and calls onAuthLost once when refresh fails", async () => {
    const { api, fetchFn, store, onAuthLost } = setup(
      credential("t1", "r1"),
      json(401, { message: "expired" }),
      json(401, { message: "invalid refresh token" }),
    );
    const err = await rejection(api("/restaurants"));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(store.get()).toBeNull();
    expect(onAuthLost).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2); // original + refresh, no retry
  });

  it("gives up without refreshing when there is no refresh token", async () => {
    const { api, fetchFn, store, onAuthLost } = setup(credential("t1", ""), json(401, { message: "expired" }));
    await expect(api("/restaurants")).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(store.get()).toBeNull();
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the retried request is still 401", async () => {
    const { api, fetchFn } = setup(
      credential("t1", "r1"),
      json(401, { message: "expired" }),
      json(200, credential("t2", "r2")),
      json(401, { message: "still no" }),
    );
    await expect(api("/restaurants")).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("does not refresh when auth is false", async () => {
    const { api, fetchFn, onAuthLost } = setup(credential("t1", "r1"), json(401, { message: "bad ticket" }));
    await expect(api("/auth/exchange", { method: "POST", body: { ticket: "x" }, auth: false })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sent(fetchFn).headers.has("Authorization")).toBe(false);
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it("does not touch the session for a 401 sent without a token", async () => {
    const { api, fetchFn, onAuthLost } = setup(null, json(401, { message: "no token" }));
    await expect(api("/restaurants")).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onAuthLost).not.toHaveBeenCalled();
  });
});
