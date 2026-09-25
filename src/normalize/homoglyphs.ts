/**
 * Unicode confusables → ASCII.
 *
 * Homoglyph substitution is the one obfuscation that survives NFKC, defeats
 * WordPiece tokenisation outright, and is invisible to a human reader. It is
 * also the only class the vision-transformer papers had to reach for, which
 * is a reasonable signal that a lookup table is the cheap win here.
 */
export const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  'а': 'a', 'в': 'b', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o',
  'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'і': 'i', 'ѕ': 's', 'ј': 'j',
  // Greek
  'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o', 'ρ': 'p',
  'τ': 't', 'υ': 'u', 'χ': 'x', 'ν': 'v', 'μ': 'u',
  // Latin lookalikes and dotless forms
  'ı': 'i', 'ɩ': 'i', 'ⅰ': 'i', 'ⅼ': 'l', 'ǀ': 'l', 'ɑ': 'a', 'ɡ': 'g',
  'ѐ': 'e', 'ё': 'e', 'ø': 'o', 'ō': 'o', 'ǫ': 'o', 'ạ': 'a', 'ɛ': 'e',
  // Fullwidth
  'ａ': 'a', 'ｅ': 'e', 'ｉ': 'i', 'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm',
  'ｏ': 'o', 'ｓ': 's', 'ｕ': 'u', 'ｙ': 'y',
}

/** Zero-width and invisible separators. Stripped entirely. */
export const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿­]/
