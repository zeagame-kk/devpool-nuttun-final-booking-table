import { localStorageAuthStore, type AuthStore } from "./auth-store";
import type { Credential } from "./types";

export const API_BASE: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiDeps {
  fetchFn: typeof fetch;
  store: AuthStore;
  baseUrl: string;
  /** Called when the session cannot be recovered (no refresh token, or refresh refused). */
  onAuthLost: () => void;
}

export interface ApiRequest {
  method?: string;
  /** A plain value is sent as JSON; FormData is sent as is. */
  body?: unknown | FormData;
  /** `false` for /auth/* calls: no Bearer header and no refresh on 401. */
  auth?: boolean;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { message?: string; code?: string };
    return new ApiError(res.status, body.message ?? res.statusText, body.code);
  } catch {
    return new ApiError(res.status, res.statusText || `HTTP ${res.status}`);
  }
}

export function createApiFetch(deps: ApiDeps) {
  const { fetchFn, store, baseUrl } = deps;

  function send(path: string, init: ApiRequest, token: string | null): Promise<Response> {
    const headers = new Headers();
    let body: BodyInit | undefined;
    if (init.body instanceof FormData) {
      // Never set Content-Type here: the browser adds the multipart boundary itself.
      body = init.body;
    } else if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }
    if (init.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
    return fetchFn(baseUrl + path, { method: init.method ?? "GET", headers, body });
  }

  // One refresh at a time. The refresh token rotates, so a second refresh with the old one would fail
  // and sign the user out; every request that hits a 401 meanwhile waits for this same promise.
  let refreshing: Promise<string | null> | null = null;

  function sessionLost(): null {
    store.clear();
    deps.onAuthLost();
    return null;
  }

  async function refresh(): Promise<string | null> {
    const refreshToken = store.get()?.refreshToken;
    if (!refreshToken) return sessionLost();
    const res = await send("/auth/refresh-token", { method: "POST", body: { refreshToken }, auth: false }, null);
    if (!res.ok) return sessionLost();
    const credential = (await res.json()) as Credential;
    store.set(credential);
    return credential.accessToken;
  }

  /** A usable access token after `staleToken` was refused, or null when the user has to sign in again. */
  function renewToken(staleToken: string): Promise<string | null> {
    const current = store.get();
    if (!current) return Promise.resolve(null); // already signed out by an earlier failure
    // Another request renewed the token while this one was in flight: use that one, do not refresh again.
    if (current.accessToken !== staleToken) return Promise.resolve(current.accessToken);
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  return async function apiFetch<T>(path: string, init: ApiRequest = {}): Promise<T> {
    const sentToken = store.get()?.accessToken ?? null;
    let res = await send(path, init, sentToken);
    if (res.status === 401 && init.auth !== false && sentToken) {
      const token = await renewToken(sentToken);
      if (token === null) throw new ApiError(401, "Session expired");
      res = await send(path, init, token); // retried once, never in a loop
    }
    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };
}

/** The shared client used by pages: real fetch, localStorage credential, full-page sign-in on lost session. */
export const apiFetch = createApiFetch({
  fetchFn: (...args) => fetch(...args),
  store: localStorageAuthStore,
  baseUrl: API_BASE,
  onAuthLost: () => {
    localStorageAuthStore.clear();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- API_BASE is an absolute URL on the API, not a Next route
    if (typeof window !== "undefined") window.location.href = `${API_BASE}/auth/login`;
  },
});

/** Pictures are public files served by the API: prepend the API base. `null` stays `null` (show a placeholder). */
export function assetUrl(imageUrl: string | null): string | null {
  return imageUrl ? API_BASE + imageUrl : null;
}
