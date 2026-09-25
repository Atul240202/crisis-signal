/**
 * L0 property runner.
 *
 * Properties that need no detector run now and gate M1. Properties that need a
 * detector are listed as pending so the gap is visible rather than forgotten.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { normalize, normalizeAll } from '../../src/normalize/index.js'
import { REVERSIBLE, COMPOSED, LEXICAL } from './mutators.js'
import type { Suite } from '../../src/types.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUITES = join(HERE, '..', 'suites')

const HI = { locales: ['hi-Latn'] }

function corpus(): { text: string; suite: string }[] {
  return readdirSync(SUITES)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const s = JSON.parse(readFileSync(join(SUITES, f), 'utf8')) as Suite
      return s.cases.map((c) => ({ text: c.text, suite: s.suite }))
    })
}

interface Fail { prop: string; detail: string }

function run(): number {
  const all = corpus()
  const fails: Fail[] = []
  let checks = 0

  // P1 — idempotence.
  for (const { text } of all) {
    const once = normalize(text).text
    const twice = normalize(once).text
    checks++
    if (once !== twice) fails.push({ prop: 'idempotence', detail: `"${text}" → "${once}" → "${twice}"` })
  }

  // P2 — offset integrity. Map is the right length, in range, non-decreasing.
  for (const { text } of all) {
    const n = normalize(text)
    checks++
    if (n.offsetMap.length !== n.text.length) {
      fails.push({ prop: 'offset.length', detail: `"${text}" map ${n.offsetMap.length} vs text ${n.text.length}` })
      continue
    }
    for (let i = 0; i < n.offsetMap.length; i++) {
      const v = n.offsetMap[i]!
      if (v < 0 || v > text.length) { fails.push({ prop: 'offset.range', detail: `"${text}" idx ${i} → ${v}` }); break }
      if (i && v < n.offsetMap[i - 1]!) { fails.push({ prop: 'offset.monotonic', detail: `"${text}" idx ${i}` }); break }
    }
  }

  // P3 — Devanagari survives untouched.
  const dev = /[ऀ-ॿ]/
  for (const { text } of all.filter((c) => dev.test(c.text))) {
    const n = normalize(text, HI)
    const before = [...text].filter((c) => dev.test(c)).join('')
    const after = [...n.text].filter((c) => dev.test(c)).join('')
    checks++
    if (before !== after) fails.push({ prop: 'devanagari.preserved', detail: `"${text}" → "${n.text}"` })
  }

  // P4 — reversible mutators normalise back to the same string. The real gate.
  const ascii = all.filter((c) => /^[\x20-\x7E]+$/.test(c.text))
  for (const { text } of ascii) {
    const base = normalize(text).text
    for (const m of [...REVERSIBLE, ...COMPOSED]) {
      // A mutated input may be legitimately ambiguous, so the property is that
      // SOME reading recovers the base, not that the primary one does.
      const got = normalizeAll(m.apply(text)).map((n) => n.text)
      checks++
      if (!got.includes(base)) {
        fails.push({ prop: `reversible.${m.name}`, detail: `"${text}"\n         base "${base}"\n         got  ${got.map((g) => `"${g}"`).join(' | ')}` })
      }
    }
  }

  // Report.
  console.log('\n  crisis-signal — L0 properties\n')
  const byProp = new Map<string, number>()
  for (const f of fails) byProp.set(f.prop, (byProp.get(f.prop) ?? 0) + 1)

  console.log(`    corpus      ${all.length} strings`)
  console.log(`    checks      ${checks}`)
  console.log(`    failures    ${fails.length}\n`)

  if (fails.length) {
    for (const [p, n] of [...byProp].sort((a, b) => b[1] - a[1])) {
      console.log(`    ✗ ${p.padEnd(28)} ${n}`)
    }
    console.log('\n  first 12:\n')
    for (const f of fails.slice(0, 12)) console.log(`    ${f.prop}: ${f.detail}`)
    console.log()
  } else {
    console.log('    all L0 properties hold\n')
  }

  console.log(`  pending until a detector exists (M2):`)
  console.log(`    monotonicity   level(mutate(x)) >= level(x)   ${[...REVERSIBLE, ...COMPOSED, ...LEXICAL].length} mutators`)
  console.log(`    script         level(devanagari) == level(romanised)`)
  console.log(`    distractor     level(benign_prefix + x) >= level(x)\n`)

  return fails.length ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(run())
