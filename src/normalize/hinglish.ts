/**
 * Romanised Hindi orthographic folding. Locale-gated behind 'hi-Latn'.
 *
 * This is NOT obfuscation handling — it is ordinary spelling variance. Romanised
 * Hindi has no standard orthography, so nahi/nahin/nhi/nai are the same word
 * typed by four people. Left unfolded, the lexicon would need every variant of
 * every entry.
 *
 * Deliberate consequence: folding 'aa' to 'a' collapses maarna (to hit) into
 * marna (to die). That distinction is already lost in romanisation for most
 * writers, so the library never relies on spelling to separate them — the
 * hi.maarna_vs_marna rule disambiguates on subject and object instead.
 */
export const HINGLISH_VARIANTS: Record<string, string> = {
  nahin: 'nahi', nhi: 'nahi', nai: 'nahi', nahe: 'nahi',
  hoon: 'hu', hun: 'hu', hoo: 'hu', hu: 'hu',
  mann: 'man', kr: 'kar', kre: 'kare', krna: 'karna',
  kyun: 'kyu', q: 'kyu', bi: 'bhi',
  mai: 'main', mei: 'main', mein: 'main',
  jindagi: 'zindagi', jeevan: 'jeene',
  khtm: 'khatam', khatm: 'khatam',
  golian: 'goliyan', goliya: 'goliyan',
  khudkhushi: 'khudkushi', khudkushee: 'khudkushi',
  atmahatya: 'aatmahatya',
  plz: 'please', pls: 'please',
}

/** Long-vowel folding. Conservative: only 'aa', which is the frequent variant. */
export const foldLongVowels = (w: string): string => w.replace(/aa+/g, 'a')
