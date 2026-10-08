"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Settled<T> {
  key: string;
  data?: T;
  error?: unknown;
}

/**
 * Runs `fn` on mount and whenever `deps` change (compared by value) or `reload()` is called.
 * `data` keeps the last good result while a newer request is loading, so lists do not blink on reload.
 * A response that arrives after the inputs changed (or after unmount) is ignored.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [reloads, setReloads] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });

  const key = `${JSON.stringify(deps)}#${reloads}`;

  useEffect(() => {
    let current = true;
    latest
      .current()
      .then((data) => current && setSettled({ key, data }))
      .catch((error: unknown) => current && setSettled({ key, error }));
    return () => {
      current = false;
    };
  }, [key]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const done = settled?.key === key;
  return {
    data: settled?.data,
    error: done ? settled?.error : undefined,
    loading: !done,
    reload,
  };
}
