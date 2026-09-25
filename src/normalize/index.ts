/**
 * L0 — normalisation.
 *
 * Every downstream layer matches against the normalised string, but every span
 * reported to the caller must point into the RAW input. So normalisation is
 * carried out over an array of pieces, each remembering the source range it
 * came from, and the offset map is derived from that rather than reconstructed
 * afterwards.
 *
 * No dependencies, no I/O, no Node builtins — this runs in Workers and Deno.
 */
import { HOMOGLYPHS, INVISIBLE } from './homoglyphs.js'
import { LEET, isAsciiLetter } from './leet.js'
import { HINGLISH_VARIANTS, foldLongVowels } from './hinglish.js'

export interface Normalized {
  /** Normalised text. All matching happens against this. */
  text: string
  /** normalised index → raw index. Length equals text.length. */
  offsetMap: number[]
  /** Raw input, retained so spans can be sliced without the caller passing it back. */
  raw: string
  /** Which steps changed anything. Useful when a raw/normalised score diverges. */
  applied: string[]
}

export interface NormalizeOptions {
  /** 'hi-Latn' enables romanised Hindi spelling folding. */
  locales?: string[]
  /**
   * Internal. When a spaced-letter run begins with a lone 'a' or 'i', that
   * letter may be a real English word rather than part of the run. Both
   * readings are produced; see normalizeAll.
   */
  loneStart?: 'absorb' | 'keep'
}

interface Piece {
  ch: string
  start: number
  end: number
}

const SEP = /[\s.\-_*·•]/

/** Map a raw string to pieces, one per code point (so surrogate pairs survive). */
function toPieces(raw: string): Piece[] {
  const out: Piece[] = []
  let i = 0
  for (const ch of raw) {
    out.push({ ch, start: i, end: i + ch.length })
    i += ch.length
  }
  return out
}

function join(pieces: Piece[]): Normalized['text'] {
  let s = ''
  for (const p of pieces) s += p.ch
  return s
}

function buildMap(pieces: Piece[]): number[] {
  const map: number[] = []
  for (const p of pieces) for (let k = 0; k < p.ch.length; k++) map.push(p.start)
  return map
}

export function normalize(raw: string, opts: NormalizeOptions = {}): Normalized {
  const applied: string[] = []
  let pieces = toPieces(raw)

  // 1. NFKC per piece. Keeps the source range even when a piece expands.
  let changed = false
  pieces = pieces.map((p) => {
    const n = p.ch.normalize('NFKC')
    if (n !== p.ch) changed = true
    return { ...p, ch: n }
  })
  if (changed) applied.push('nfkc')

  // 2. Homoglyph fold.
  changed = false
  pieces = pieces.map((p) => {
    const lower = p.ch.toLowerCase()
    const h = HOMOGLYPHS[lower]
    if (h) { changed = true; return { ...p, ch: h } }
    return p
  })
  if (changed) applied.push('homoglyph')

  // 3. Strip invisibles. Emptied, not removed — the span still resolves.
  changed = false
  pieces = pieces.map((p) => {
    if (INVISIBLE.test(p.ch)) { changed = true; return { ...p, ch: '' } }
    return p
  })
  if (changed) applied.push('invisible')

  // 4. Lowercase. No-op for Devanagari.
  pieces = pieces.map((p) => ({ ...p, ch: p.ch.toLowerCase() }))

  // 5. Deleet. Decided per TOKEN, not per character: a token is leet if it
  //    contains at least one ASCII letter. Character adjacency fails on runs
  //    like "ki||" and would rewrite bare numerals such as "3 kids".
  {
    const tokenHasLetter: boolean[] = new Array(pieces.length).fill(false)
    let s0 = 0
    const isSpace = (c: string) => c !== '' && /\s/.test(c)
    while (s0 < pieces.length) {
      if (isSpace(pieces[s0]!.ch)) { s0++; continue }
      let e0 = s0
      let has = false
      while (e0 < pieces.length && !isSpace(pieces[e0]!.ch)) {
        if (isAsciiLetter(pieces[e0]!.ch)) has = true
        e0++
      }
      for (let k = s0; k < e0; k++) tokenHasLetter[k] = has
      s0 = e0
    }
    changed = false
    pieces = pieces.map((p, i) => {
      const sub = LEET[p.ch]
      if (sub && tokenHasLetter[i]) { changed = true; return { ...p, ch: sub } }
      return p
    })
    if (changed) applied.push('leet')
  }

  // 6. Collapse spaced-out letters: "k i l l" -> "kill". A run is >=3 single
  //    ASCII letters each separated by exactly one separator, beginning at a
  //    token boundary. Below 3 this would eat "u r ok". Only the separators
  //    BETWEEN letters are blanked — consuming the trailing one would weld the
  //    run onto the next word.
  {
    const out: Piece[] = []
    let i = 0
    changed = false

    /** Token boundary check. Emptied pieces (stripped invisibles) are skipped. */
    const atTokenStart = (idx: number): boolean => {
      for (let k = idx - 1; k >= 0; k--) {
        const c = pieces[k]!.ch
        if (c === '') continue
        return /\s/.test(c)
      }
      return true
    }
    const isLetter = (idx: number): boolean => {
      const c = pieces[idx]?.ch
      return c !== undefined && c.length === 1 && isAsciiLetter(c)
    }
    const isSep = (idx: number): boolean => {
      const c = pieces[idx]?.ch
      return c !== undefined && c.length === 1 && SEP.test(c)
    }

    while (i < pieces.length) {
      if (!isLetter(i) || !atTokenStart(i)) { out.push(pieces[i]!); i++; continue }

      // 'a' and 'i' are the only real single-letter English words, so a run
      // beginning with one is genuinely ambiguous: "like a s u i c i d e" reads
      // as both "a suicide" and "asuicide". Rather than guess, the caller gets
      // both readings via normalizeAll and the matcher tries each.
      if (opts.loneStart === 'keep' && /^[ai]$/.test(pieces[i]!.ch) && isSep(i + 1)) {
        out.push(pieces[i]!)
        i++
        continue
      }

      // Walk letter, sep, letter, sep, ... recording where the last letter sits.
      let j = i
      let letters = 0
      let lastLetter = i
      const letterIdx: number[] = []
      while (isLetter(j)) {
        letters++
        lastLetter = j
        letterIdx.push(j)
        // Continue only into another SINGLE-letter token. Without the j+3
        // check the run runs on into the next real word: "a n y m o r e you"
        // would take the 'y' of "you" and weld the two together. The token may
        // be closed by any non-letter, not just a separator, so that a run
        // ending in punctuation ("m u j h s e,") completes.
        const nextIsLone = isLetter(j + 2) && (j + 3 >= pieces.length || !isLetter(j + 3))
        if (!isSep(j + 1) || !nextIsLone) break
        j += 2
      }

      // The same lone-word ambiguity applies at the end of a run:
      // "i t h o u g h t i was" has a real 'i' on both sides.
      if (opts.loneStart === 'keep' && letters >= 4 && /^[ai]$/.test(pieces[lastLetter]!.ch)) {
        letters--
        lastLetter = letterIdx[letters - 1]!
      }

      if (letters >= 3) {
        for (let k = i; k <= lastLetter; k++) {
          const p = pieces[k]!
          out.push(isSep(k) ? { ...p, ch: '' } : p)
        }
        changed = true
        i = lastLetter + 1
      } else {
        out.push(pieces[i]!)
        i++
      }
    }
    pieces = out
    if (changed) applied.push('despace')
  }

  // 7. Squash every repeat run to a single character. Squashing to two cannot
  //    recover a source that had one, which makes repetition unrecoverable by
  //    construction. Lexicon entries are squashed the same way, so the only
  //    cost is a handful of harmless collisions ("bee" and "be" coincide).
  {
    const squashed: Piece[] = []
    let last = ''
    changed = false
    for (const p of pieces) {
      if (p.ch && p.ch === last) { squashed.push({ ...p, ch: '' }); changed = true; continue }
      if (p.ch) last = p.ch
      squashed.push(p)
    }
    pieces = squashed
    if (changed) applied.push('repeat')
  }

  // 8. Hinglish spelling folding, locale-gated. Word-level, so it runs on the
  //    joined string and remaps by word start.
  let text = join(pieces)
  let offsetMap = buildMap(pieces)

  if (opts.locales?.includes('hi-Latn')) {
    const res = foldHinglish(text, offsetMap)
    if (res.text !== text) applied.push('hinglish')
    text = res.text
    offsetMap = res.offsetMap
  }

  return { text, offsetMap, raw, applied }
}

/** Word-level folding. Each output char maps to the input word's start offset. */
function foldHinglish(text: string, map: number[]): { text: string; offsetMap: number[] } {
  let out = ''
  const outMap: number[] = []
  const re = /[a-z]+|[^a-z]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const tok = m[0]
    const at = m.index
    if (!/^[a-z]+$/.test(tok)) {
      out += tok
      for (let k = 0; k < tok.length; k++) outMap.push(map[at + k] ?? map[at] ?? 0)
      continue
    }
    const folded = HINGLISH_VARIANTS[tok] ?? foldLongVowels(tok)
    out += folded
    // Whole folded word attributes to the source word's first character.
    for (let k = 0; k < folded.length; k++) {
      outMap.push(k < tok.length ? (map[at + k] ?? map[at] ?? 0) : (map[at] ?? 0))
    }
  }
  return { text: out, offsetMap: outMap }
}

/**
 * Every reading of the input. The first is primary; a second appears only when
 * a spaced-letter run starts with a lone 'a' or 'i'. Downstream layers match
 * against all of them and take the MAX, consistent with how dimensions
 * aggregate elsewhere — a reading that fires is evidence, one that does not is
 * merely silent.
 */
export function normalizeAll(raw: string, opts: NormalizeOptions = {}): Normalized[] {
  const primary = normalize(raw, { ...opts, loneStart: 'absorb' })
  const alt = normalize(raw, { ...opts, loneStart: 'keep' })
  return alt.text === primary.text ? [primary] : [primary, alt]
}

/** Slice the RAW input for a span expressed in normalised coordinates. */
export function rawSpan(n: Normalized, start: number, end: number): [number, number] {
  const a = n.offsetMap[start] ?? 0
  const lastIdx = Math.min(end, n.offsetMap.length) - 1
  const b = lastIdx >= 0 ? (n.offsetMap[lastIdx] ?? a) + 1 : a
  return [a, Math.max(a, b)]
}
