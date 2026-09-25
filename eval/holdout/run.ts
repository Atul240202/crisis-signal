/**
 * Holdout runner — release only.
 *
 * Reports what is true against domain-shifted public data, with the caveats
 * attached to the numbers rather than buried in a README nobody opens. See
 * ./README.md for why these figures are weaker than they look.
 *
 *   npx tsx eval/holdout/run.ts [--data <dir>]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Detector, Tier } from '../../src/types.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * C-SSRS label → acceptable tier band.
 *
 * Bands are wide deliberately. A narrow band would measure agreement with one
 * annotator's judgement rather than correctness, and the label boundaries are
 * not the library's boundaries: C-SSRS Behavior spans preparatory acts and
 * aborted attempts, which straddle tiers 2 to 4.
 */
const BANDS: Record<string, { min: Tier; max: Tier; note: string }> = {
  Indicator: { min: 0 as Tier, max: 2 as Tier, note: 'risk factors present, ideation not necessarily stated' },
  Ideation:  { min: 1 as Tier, max: 4 as Tier, note: 'passive or active' },
  Behavior:  { min: 2 as Tier, max: 4 as Tier, note: 'preparatory acts through aborted attempt' },
  Attempt:   { min: 1 as Tier, max: 4 as Tier, note: 'often retrospective — history_attempt at a low tier is CORRECT' },
}

interface Row { text: string; label: string }

function loadPositives(dir: string): Row[] {
  const raw = readFileSync(join(dir, 'rsd15k.csv'), 'utf8').replace(/^﻿/, '')
  const rows: Row[] = []
  // Minimal CSV reader — the file has quoted fields containing commas and newlines.
  let i = 0, field = '', rec: string[] = [], inQ = false
  const push = () => { rec.push(field); field = '' }
  const end = () => {
    if (rec.length >= 3 && rec[0] !== 'users') rows.push({ text: rec[1]!, label: rec[2]! })
    rec = []
  }
  while (i < raw.length) {
    const c = raw[i]!
    if (inQ) {
      if (c === '"' && raw[i + 1] === '"') { field += '"'; i += 2; continue }
      if (c === '"') { inQ = false; i++; continue }
      field += c; i++; continue
    }
    if (c === '"') { inQ = true; i++; continue }
    if (c === ',') { push(); i++; continue }
    if (c === '\n') { push(); end(); i++; continue }
    if (c === '\r') { i++; continue }
    field += c; i++
  }
  if (field || rec.length) { push(); end() }
  return rows
}

function pct(n: number, d: number): string {
  return d === 0 ? '   n/a' : `${((100 * n) / d).toFixed(1).padStart(5)}%`
}

export function report(detector: Detector, dir: string): number {
  const pos = loadPositives(dir)
  const neg: string[] = JSON.parse(readFileSync(join(dir, 'negatives.json'), 'utf8'))

  console.log('\n  crisis-signal — HOLDOUT (release only)\n')
  console.log(`    positives  ${pos.length} (RSD_15K, ordinal C-SSRS)`)
  console.log(`    negatives  ${neg.length} (Ram07 non-suicide)\n`)

  // Per-label recall against the band.
  const stat = new Map<string, { n: number; inBand: number; fired: number; hist: number }>()
  const confusion = new Map<string, number[]>()

  for (const r of pos) {
    const band = BANDS[r.label]
    if (!band) continue
    const s = stat.get(r.label) ?? { n: 0, inBand: 0, fired: 0, hist: 0 }
    const c = confusion.get(r.label) ?? [0, 0, 0, 0, 0]
    const res = detector(r.text)
    s.n++
    c[res.level]! += 1
    if (res.level >= band.min && res.level <= band.max) s.inBand++
    if (res.level >= 1) s.fired++
    if (res.dimensions.history_attempt) s.hist++
    stat.set(r.label, s)
    confusion.set(r.label, c)
  }

  console.log('    label       n      in-band   fired>=1   hist_attempt')
  for (const label of ['Indicator', 'Ideation', 'Behavior', 'Attempt']) {
    const s = stat.get(label)
    if (!s) continue
    console.log(`    ${label.padEnd(10)} ${String(s.n).padStart(5)}    ${pct(s.inBand, s.n)}     ${pct(s.fired, s.n)}        ${pct(s.hist, s.n)}`)
  }

  console.log('\n    tier distribution per label')
  console.log('                  t0     t1     t2     t3     t4')
  for (const label of ['Indicator', 'Ideation', 'Behavior', 'Attempt']) {
    const c = confusion.get(label)
    if (!c) continue
    console.log(`    ${label.padEnd(10)} ${c.map((v) => String(v).padStart(6)).join(' ')}`)
  }

  // False positives on the negative corpus.
  let fp1 = 0, fp2 = 0, fp3 = 0
  for (const t of neg) {
    const lvl = detector(t).level
    if (lvl >= 1) fp1++
    if (lvl >= 2) fp2++
    if (lvl >= 3) fp3++
  }
  console.log(`\n    false positives on ${neg.length} negatives`)
  console.log(`      >= tier 1   ${pct(fp1, neg.length)}`)
  console.log(`      >= tier 2   ${pct(fp2, neg.length)}`)
  console.log(`      >= tier 3   ${pct(fp3, neg.length)}`)

  // Base-rate correction. The number that actually predicts the product experience.
  const fpr2 = fp2 / neg.length
  const recall2 = (stat.get('Ideation')?.inBand ?? 0) / Math.max(1, stat.get('Ideation')?.n ?? 1)
  console.log('\n    projected precision at tier>=2 by production base rate')
  for (const base of [0.001, 0.005, 0.01, 0.05]) {
    const tp = base * recall2
    const fp = (1 - base) * fpr2
    const prec = tp + fp === 0 ? 0 : tp / (tp + fp)
    const perTp = tp === 0 ? Infinity : fp / tp
    console.log(`      base ${(base * 100).toFixed(1).padStart(4)}%   precision ${(prec * 100).toFixed(1).padStart(5)}%   ${perTp === Infinity ? '—' : perTp.toFixed(1)} false positives per true positive`)
  }

  console.log(`
    READ THESE NUMBERS WITH THE CAVEATS:
      - Long-form Reddit posts, median 276 chars. The library targets chat
        turns and voice utterances. MAX aggregation over a long post gets many
        independent chances to fire, inflating BOTH recall and FPR.
      - RSD_15K has no negative class; FPR comes from a different corpus with
        different collection, so the two halves are not directly comparable.
      - Attempt is largely retrospective. A low tier with history_attempt set
        is the correct output, not a miss.
      - English, Reddit. Says nothing about the Hinglish or voice paths.
`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--data')
  const dir = i > 0 ? process.argv[i + 1]! : HERE
  if (!existsSync(join(dir, 'rsd15k.csv'))) {
    console.error(`\n  no corpus at ${dir} — run eval/holdout/fetch.sh first\n`)
    process.exit(1)
  }
  const { notImplemented } = await import('../../src/index.js')
  report(notImplemented, dir)
}
