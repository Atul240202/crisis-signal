/**
 * Obfuscation mutators.
 *
 * Split by whether L0 is expected to undo them:
 *
 *  REVERSIBLE   — normalise(mutate(x)) must equal normalise(x). Testable now,
 *                 no detector required, and the strongest gate M1 has.
 *  LEXICAL      — normalisation cannot recover these (algospeak is a different
 *                 word, not a perturbed one). They belong to the lexicon, and
 *                 are checked at detector level from M2 as monotonicity:
 *                 level(mutate(x)) >= level(x).
 */
const LEET_OUT: Record<string, string> = {
  o: '0', i: '1', e: '3', a: '4', s: '5', t: '7', l: '|',
}
const HOMO_OUT: Record<string, string> = {
  a: 'а', e: 'е', o: 'о', c: 'с', p: 'р', i: 'і', s: 'ѕ', k: 'к', x: 'х',
}

export type Mutator = { name: string; apply: (s: string) => string }

/** Longest alphabetic token — the word obfuscation actually targets. */
const onTarget = (s: string, f: (w: string) => string): string => {
  const words = s.match(/[a-z]{3,}/g)
  if (!words?.length) return s
  const target = words.reduce((a, b) => (b.length >= a.length ? b : a))
  return s.replace(target, f(target))
}

export const REVERSIBLE: Mutator[] = [
  { name: 'leet', apply: (s) => onTarget(s, (w) => w.replace(/[oieastl]/g, (c) => LEET_OUT[c] ?? c)) },
  { name: 'leet_partial', apply: (s) => onTarget(s, (w) => w.replace(/[oie]/g, (c, i) => (i % 2 ? (LEET_OUT[c] ?? c) : c))) },
  { name: 'homoglyph', apply: (s) => s.replace(/[aeocpisk x]/g, (c) => HOMO_OUT[c] ?? c) },
  { name: 'zwsp', apply: (s) => [...s].join('​') },
  { name: 'repeat', apply: (s) => onTarget(s, (w) => [...w].map((c) => c.repeat(3)).join('')) },
  { name: 'spaceout', apply: (s) => onTarget(s, (w) => [...w].join(' ')) },
  { name: 'dots', apply: (s) => onTarget(s, (w) => [...w].join('.')) },
  { name: 'fullwidth', apply: (s) => s.replace(/[aeiklmosuy]/g, (c) => String.fromCodePoint(c.codePointAt(0)! + 0xfee0)) },
]

/** Composition — attackers and habitual slang both stack these. */
export const COMPOSED: Mutator[] = [
  { name: 'leet+zwsp', apply: (s) => REVERSIBLE[3]!.apply(REVERSIBLE[0]!.apply(s)) },
  { name: 'homoglyph+repeat', apply: (s) => REVERSIBLE[4]!.apply(REVERSIBLE[2]!.apply(s)) },
]

/** Not recoverable by normalisation. Lexicon work; checked from M2. */
export const LEXICAL: Mutator[] = [
  { name: 'algospeak', apply: (s) => s
      .replace(/\bsuicide\b/g, 'sewerslide')
      .replace(/\bkill myself\b/g, 'unalive myself')
      .replace(/\bdie\b/g, 'unalive') },
]
