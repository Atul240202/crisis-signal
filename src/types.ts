/**
 * crisis-signal — core contract.
 *
 * This library produces a TRIAGE SIGNAL. It is not a clinical assessment,
 * it cannot diagnose, and it must not be the only safeguard in a product.
 * Every consumer needs a human escalation path for tier 3 and above.
 */

/**
 * Risk tiers, derived from the C-SSRS ideation/behaviour distinctions and the
 * CDC Self-Directed Violence Surveillance uniform definitions.
 *
 * Boundaries are genuinely fuzzy. Golden cases assert RANGES, not exact tiers.
 */
export const enum Tier {
  /** No risk signal. */
  None = 0,
  /** Passive ideation: wish to be dead, to not wake up. No intent to act. */
  Passive = 1,
  /** Active ideation: thoughts of killing oneself. No method or means. */
  Active = 2,
  /** A method is identified, or means have been accessed. */
  PlanOrMeans = 3,
  /** Plan plus timeline, or farewell behaviour alongside intent. */
  Imminent = 4,
}

export type TierName = 'none' | 'passive' | 'active' | 'plan' | 'imminent'

/**
 * Independent evidence channels. These CO-OCCUR — this is a profile, not a
 * classification. Aggregated across clauses with MAX, never summed: summing
 * lets several weak signals manufacture a high tier, and lets one strong
 * signal be diluted by a long benign message.
 */
export interface Dimensions {
  passive_ideation: number
  active_ideation: number
  plan: number
  means: number
  timeline: number
  farewell: number
  burden: number
  hopeless: number
  /** Lowers score. Reasons to live, help-seeking. */
  protective: number
  /**
   * A prior attempt. Raises BASELINE risk without firing an acute alert.
   * Must never be suppressed to zero by past-tense marking — a previous
   * attempt is the strongest known predictor of a future one.
   */
  history_attempt: number
}

/** A context rule's effect. Attenuates with a floor — never a veto. */
export interface Modifier {
  /** Stable rule id, e.g. 'negation.clause_scope'. Appears in minimal pairs. */
  rule: string
  /** 0..1 multiplier applied to the raw score. */
  scale: number
  /** Tier this modifier may never reduce below. */
  floor: Tier
  /** Span in RAW input coordinates, via the L0 offset map. */
  span: [number, number]
}

/** A trigger token neutralised by an idiom/MWE rule. Cannot score afterwards. */
export interface Consumed {
  rule: string
  token: string
  span: [number, number]
}

/** What the integrator should do. Advisory; overridable via policy. */
export type Action =
  | 'none'
  /** Tier 1. Do NOT interrupt. Keep the conversation open. */
  | 'acknowledge'
  | 'offer_resources'
  | 'surface_prominent'
  | 'escalate_human'
  /** The ONLY action that blocks. Reserved for method-seeking. */
  | 'refuse_and_redirect'
  /** Third-party disclosure. Different copy, different resources. */
  | 'support_for_other'

export interface Resource {
  name: string
  phone?: string
  text?: string
  url?: string
  hours: string
  languages: string[]
  type: 'govt' | 'ngo' | 'volunteer'
  /** ISO date. CI warns past 180 days. A dead number is this package's worst defect. */
  lastVerified: string
}

/** Someone disclosing concern about another person. Not a false positive. */
export interface ConcernForOther {
  level: Tier
  relation: string | null
}

export interface Result {
  level: Tier
  label: TierName
  action: Action
  escalate: boolean
  /** True only for method-seeking. */
  block: boolean
  dimensions: Partial<Dimensions>
  modifiers: Modifier[]
  consumed: Consumed[]
  concernForOther: ConcernForOther | null
  resources: Resource[]
  /** Which floor decided the outcome, if any. First thing to check on a bad flag. */
  floorApplied: string | null
  /** Human-readable reasoning. Shown in bug reports instead of the raw message. */
  explain: string
  latencyMs: number
}

export type Threshold = Exclude<TierName, 'none'>
export type Medium = 'chat' | 'voice' | 'form'
export type Role = 'user' | 'assistant'

export interface DetectorOptions {
  /** REQUIRED, no default. Forces the policy decision to be made consciously. */
  threshold: Threshold
  locale?: string
  medium?: Medium
  /** Partial override, merged over defaults. */
  policy?: Partial<Record<Tier, Action>>
  /** Required when policy maps any tier to 'escalate_human'. Constructor throws otherwise. */
  onEscalate?: (r: Result, ctx?: unknown) => void | Promise<void>
  /** Only sensible value is 'allow'. Never block a user because the detector crashed. */
  onError?: 'allow' | 'deny'
  onErrorNotify?: (e: unknown) => void
}

/* ------------------------------------------------------------------ *
 * Evaluation types. The harness runs against these.
 * ------------------------------------------------------------------ */

/** Ranges, not exact tiers — tier boundaries are fuzzy and exact asserts rot. */
export interface Expectation {
  min?: Tier
  max?: Tier
  concernForOther?: Tier
  historyAttempt?: boolean
  block?: boolean
}

export interface GoldenCase {
  text: string
  expect: Expectation
  /** Why this case is here, and why it is hard. Required — no unexplained cases. */
  note: string
  /** Rule id this case exercises, where one applies. */
  rule?: string
}

export interface Suite {
  suite: string
  description: string
  /** 'dev' is iterated against freely. 'gate' is touched only at release. */
  split: 'dev' | 'gate'
  cases: GoldenCase[]
}

/** Two inputs one token apart that must land on opposite sides of a boundary. */
export interface MinimalPair {
  rule: string
  a: string
  b: string
  expect: { a: Expectation; b: Expectation }
  note: string
}

export type Detector = (text: string) => Result
