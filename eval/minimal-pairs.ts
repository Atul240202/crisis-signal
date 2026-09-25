/**
 * Minimal-pair runner.
 *
 * Golden cases do not catch context-layer regressions — widening a pattern to
 * fix one case silently buys false positives elsewhere. Pairs do catch it:
 * two inputs a short edit apart that must land on opposite sides of a boundary.
 *
 * CI rule: every rule id referenced in src/context/ must appear in >=1 pair.
 * A suppression rule with no pair does not ship.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Detector, MinimalPair } from '../src/types.js'
import { satisfies } from './harness.js'

const HERE = dirname(fileURLToPath(import.meta.url))

export function loadPairs(): MinimalPair[] {
  const raw = JSON.parse(readFileSync(join(HERE, 'minimal-pairs.json'), 'utf8'))
  return raw.pairs as MinimalPair[]
}

function run(pairs: MinimalPair[], detector?: Detector): number {
  console.log('\n  crisis-signal — minimal pairs\n')
  const rules = new Set(pairs.map((p) => p.rule))
  for (const r of [...rules].sort()) {
    const n = pairs.filter((p) => p.rule === r).length
    console.log(`    ${r.padEnd(34)} ${n}`)
  }
  console.log(`\n  ${pairs.length} pairs across ${rules.size} rules`)

  if (!detector) {
    console.log('  detector: not implemented (M0) — nothing scored\n')
    return 0
  }

  let fails = 0
  for (const p of pairs) {
    const ra = detector(p.a)
    const rb = detector(p.b)
    const okA = satisfies(ra, p.expect.a)
    const okB = satisfies(rb, p.expect.b)
    if (okA && okB) continue
    fails++
    console.log(`\n    ✗ ${p.rule}`)
    if (!okA) console.log(`      a: got ${ra.level}, want ${JSON.stringify(p.expect.a)} — "${p.a}"`)
    if (!okB) console.log(`      b: got ${rb.level}, want ${JSON.stringify(p.expect.b)} — "${p.b}"`)
    console.log(`      ${p.note}`)
  }
  console.log(fails ? `\n  ${fails} pair(s) failing\n` : '\n  all pairs pass\n')
  return fails ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run(loadPairs()))
}
