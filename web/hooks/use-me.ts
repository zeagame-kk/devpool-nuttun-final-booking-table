"use client";

import { useAsync } from "@/hooks/use-async";
import { useCredential } from "@/hooks/use-credential";
import { apiFetch } from "@/lib/api";
import type { Me } from "@/lib/types";

/**
 * The signed-in person's profile (`GET /users/me`). It is fetched when someone signs in and dropped
 * when they sign out; changing person always goes through signed out, so nobody sees the previous profile.
 */
export function useMe() {
  const signedIn = Boolean(useCredential());
  const result = useAsync<Me | null>(() => (signedIn ? apiFetch<Me>("/users/me") : Promise.resolve(null)), [signedIn]);

  return { ...result, data: signedIn ? (result.data ?? undefined) : undefined };
}
