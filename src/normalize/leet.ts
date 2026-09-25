/**
 * Leetspeak folding.
 *
 * Applied ONLY when the character is adjacent to an ASCII letter. Without that
 * guard "i have 3 kids" becomes "i have e kids" and every numeric in the corpus
 * turns into a vowel.
 */
export const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't',
}

export const isAsciiLetter = (c: string | undefined): boolean =>
  c !== undefined && c.length === 1 && /[a-z]/i.test(c)
