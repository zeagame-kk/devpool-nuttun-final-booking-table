"use client";

import { useCredential } from "@/hooks/use-credential";

/** Leaves room under the page for the fixed bottom menu that signed-in people get on a phone. */
export function BottomNavSpacer() {
  const credential = useCredential();
  return credential ? <div aria-hidden="true" className="h-20 md:hidden" /> : null;
}
