import { apiFetch, LOGIN_URL } from "@/lib/api";
import { localStorageAuthStore } from "@/lib/auth-store";
import type { Credential } from "@/lib/types";

/** Sign in is a full-page navigation (API -> Keycloak -> API -> /auth/callback), never a fetch. */
export function startLogin(): void {
  window.location.href = LOGIN_URL;
}

/** Trade the one-time ticket from the callback URL for a credential and keep it. A ticket works only once. */
export async function exchangeTicket(ticket: string): Promise<Credential> {
  const credential = await apiFetch<Credential>("/auth/exchange", { method: "POST", body: { ticket }, auth: false });
  localStorageAuthStore.set(credential);
  return credential;
}

/** Tell the API to end the session (best effort), then forget the credential whatever happened. */
export async function logout(): Promise<void> {
  const refreshToken = localStorageAuthStore.get()?.refreshToken;
  try {
    if (refreshToken) await apiFetch<void>("/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
  } catch {
    // The server may be unreachable or the token already dead; signing out locally is what matters.
  } finally {
    localStorageAuthStore.clear();
  }
}
