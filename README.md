# crisis-signal

Tiered crisis-risk signal for text and voice transcripts. Zero runtime dependencies, sync, edge-compatible.

> **This is a triage signal, not a clinical assessment.** It cannot diagnose and it cannot rank risk clinically. It must not be the only safeguard in a product, and every integration needs a defined human escalation path for tier 3 and above.

**Status: pre-alpha (M0).** Contract and evaluation harness only. No detector yet.

## Why this exists

Hosted moderation APIs return a self-harm score. That is not enough to act on:

- **A score is not a tier.** "I'm exhausted with life" and "I've got the pills, tonight" need opposite responses. One threshold serves neither.
- **Guardrail layers block.** Their whole vocabulary is allow/deny, so crisis disclosures get refused. A person in crisis hitting a refusal wall is the failure this library exists to prevent — `crisis-signal` returns `allow` for every tier and delivers the signal as an annotation. The single exception is method-seeking.
- **Context is most of the problem.** Idiom, negation scope, attribution, recovery talk and fiction framing decide the answer more often than keywords do.
- **Regional coverage is absent.** Indian English and Hinglish are unrepresented in every public dataset and every hosted API. `my office feels like a suicide point` false-positives on all of them.

## Design commitments

| | |
|---|---|
| Recall over precision | A false positive costs an awkward interstitial. A false negative can cost a life. |
| Attenuate, never veto | Context adjusts scores against a floor. `"I'm not going to hurt myself, I'm going to end it tonight"` must still fire. |
| Route, never block | One blocking path: method-seeking. Everything else stays conversational. |
| Explainable by construction | Rule table, not learned weights. Every output names the rules that produced it. |
| No scraped data ships | Public datasets are used for evaluation only, fetched locally, never vendored. |
| Level-only logging by default | A crisis flag is sensitive health data. Raw text retention is opt-in, written by the integrator. |

## Tiers

| | | action | blocks |
|---|---|---|---|
| 0 | none | `none` | no |
| 1 | passive ideation | `acknowledge` — **do not interrupt** | no |
| 2 | active ideation | `offer_resources` | no |
| 3 | plan or means | `surface_prominent` + escalate | no |
| 4 | imminent | `escalate_human` | no |
| — | method-seeking | `refuse_and_redirect` | **yes** |
| — | concern for another | `support_for_other` | no |

Tier 1 not interrupting is deliberate. A hotline card in response to *"I'm exhausted with life"* reads as the product flinching, and teaches people to stop talking to it.

## Evaluation

```bash
npm run eval         # golden suites
npm run eval:pairs   # minimal pairs
```

Accuracy is reported as a **capability matrix per suite**, never as one number. Published accuracy figures in this field come from class-balanced test sets; production base rates are nearer 0.1–1%, where the same model produces several false positives per true positive. That caveat ships alongside the metrics.

Gate metric is **recall at tier ≥3**. Everything else is a budget. See `eval/thresholds.json`.

## Known failure modes

Documented from the start, because an integrator can design around a known gap and cannot design around an inflated score.

- Metaphor and novel phrasing — templates have a hard recall ceiling. This is why the L4 model adapter exists.
- Long-context buildup with no single risky utterance — needs `Session`, not `evaluate()`.
- Sarcasm.
- Code-switching beyond Hinglish.
- Fiction framing — deliberately capped at one tier of attenuation, so expect false positives there rather than false negatives.
- Reddit-trained evaluation data is long-form posts; targets are chat turns and voice utterances. Domain shift is the largest threat to external validity of any number published here.

## Prior art

Tier boundaries follow the C-SSRS ideation/behaviour distinctions and the CDC *Self-Directed Violence Surveillance: Uniform Definitions*. Obfuscation handling follows the adversarial-robustness literature on toxicity classifiers, where character-level perturbation is shown to cut BERT detector recall by more than half.

## Licence

MIT.
