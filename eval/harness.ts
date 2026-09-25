/**
 * Golden-suite runner.
 *
 * Runs before a detector exists. With no detector it validates suite schemas
 * and reports coverage, which is the M0 deliverable. Once src/ lands, pass a
 * detector and it scores against eval/thresholds.json.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Detector, Suite, GoldenCase, Expectation, Result } from '../src/types.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUITES = join(HERE, 'suites')

export function loadSuites(): Suite[] {
  return readdirSync(SUITES)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SUITES, f), 'utf8')) as Suite)
}

/** Schema health. A case with no note is a case nobody can maintain. */
export function validate(suites: Suite[]): string[] {
  const errs: string[] = []
  const seen = new Set<string>()
  for (const s of suites) {
    if (!['dev', 'gate'].includes(s.split)) errs.push(`${s.suite}: bad split "${s.split}"`)
    for (const [i, c] of s.cases.entries()) {
      const at = `${s.suite}[${i}]`
      if (!c.text?.trim()) errs.push(`${at}: empty text`)
      if (!c.note?.trim()) errs.push(`${at}: missing note — every case must say why it is hard`)
      if (c.expect.min === undefined && c.expect.max === undefined)
        errs.push(`${at}: expectation must set min, max, or both`)
      if (c.expect.min !== undefined && c.expect.max !== undefined && c.expect.min > c.expect.max)
        errs.push(`${at}: min > max`)
      const key = `${s.suite}::${c.text}`
      if (seen.has(key)) errs.push(`${at}: duplicate text within suite`)
      seen.add(key)
    }
  }
  return errs
}

export function satisfies(r: Result, e: Expectation): boolean {
  if (e.min !== undefined && r.level < e.min) return false
  if (e.max !== undefined && r.level > e.max) return false
  if (e.block !== undefined && r.block !== e.block) return false
  if (e.historyAttempt !== undefined && Boolean(r.dimensions.history_attempt) !== e.historyAttempt) return false
  if (e.concernForOther !== undefined && (r.concernForOther?.level ?? -1) < e.concernForOther) return false
  return true
}

function report(suites: Suite[], detector?: Detector): number {
  const errs = validate(suites)
  const total = suites.reduce((n, s) => n + s.cases.length, 0)

  console.log('\n  crisis-signal — golden suites\n')
  for (const s of suites) {
    const tag = s.split === 'gate' ? 'GATE' : 'dev '
    console.log(`  ${tag}  ${s.suite.padEnd(22)} ${String(s.cases.length).padStart(3)} cases`)
  }
  console.log(`  ${''.padEnd(6)}${'TOTAL'.padEnd(22)} ${String(total).padStart(3)}`)

  if (errs.length) {
    console.log('\n  SCHEMA ERRORS\n')
    for (const e of errs) console.log(`    ✗ ${e}`)
    console.log()
    return 1
  }
  console.log('\n  schema: ok')

  if (!detector) {
    console.log('  detector: not implemented (M0) — nothing scored\n')
    return 0
  }

  let pass = 0
  const failures: Array<{ suite: string; c: GoldenCase; got: number }> = []
  for (const s of suites) {
    for (const c of s.cases) {
      const r = detector(c.text)
      if (satisfies(r, c.expect)) pass++
      else failures.push({ suite: s.suite, c, got: r.level })
    }
  }
  console.log(`  scored: ${pass}/${total}\n`)
  for (const f of failures) {
    console.log(`    ✗ ${f.suite}: got ${f.got}, want ${JSON.stringify(f.c.expect)}`)
    console.log(`      "${f.c.text}"`)
    console.log(`      ${f.c.note}\n`)
  }
  return failures.length ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(report(loadSuites()))
}
