/**
 * crisis-signal
 *
 * M0: contract and evaluation harness only. No detector logic exists yet —
 * that is deliberate. The golden cases define what each tier means, and
 * everything downstream is tuned to them, so they are written and reviewed
 * before the first rule.
 */
export * from './types.js'

import type { Detector, Result } from './types.js'

/** Placeholder. The harness reports schema health against this until M1. */
export const notImplemented: Detector = (): Result => {
  throw new Error('crisis-signal: detector not implemented (M0 — harness only)')
}
