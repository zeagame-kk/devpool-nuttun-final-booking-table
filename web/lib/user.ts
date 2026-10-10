/** The name to show for a person: their name, or their email when Keycloak gave none. */
export function displayName(me: { name?: string; email: string }): string {
  const name = me.name?.trim();

  return name ? name : me.email;
}

// Thai vowels written before the consonant they follow in sound, so they make a poor initial.
const LEADING_VOWELS = /^[เแโใไ]+/u;

/** Up to two letters for an avatar: the first letter of the first two words, or "?" for an empty name. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word.replace(LEADING_VOWELS, "") || word)[0].toUpperCase());

  return letters.length > 0 ? letters.join("") : "?";
}
