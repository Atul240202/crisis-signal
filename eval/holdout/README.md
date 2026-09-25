# Holdout

**Look at this once, at release. Never during iteration.**

Tuning against these numbers makes them overfit by an unknown margin, and an
unknown margin is worse than no number — you cannot caveat what you cannot
measure. The golden suites in `eval/suites/` are what you iterate against.

`./fetch.sh` downloads the corpora. They are gitignored and must stay that way:
real posts by real people in crisis, scraped without consent for this use.

## What is here

| corpus | rows | labels |
|---|---|---|
| RSD_15K | 14,613 | ordinal: Indicator / Ideation / Behavior / Attempt |
| Ram07 non-suicide | ~2,500 | negative only |

RSD_15K has **no negative class** — every row is somewhere on the risk
spectrum. It measures recall and tier calibration and says nothing whatsoever
about false positives. That is why the second corpus exists.

## Why these numbers are weaker than they look

**Domain shift is severe.** These are long-form Reddit posts (median 276
characters, p90 1,101). The library targets chat turns and voice utterances.
A long post gives MAX aggregation many independent chances to fire, which
inflates recall AND false-positive rate relative to production.

**The Attempt label is mostly retrospective.** Many Attempt posts describe a
past attempt, which the tense rules correctly attenuate to a low tier with
`history_attempt` set. Scoring those as acute misses would penalise the library
for being right, so the runner accepts either reading.

**Label boundaries are not our boundaries.** C-SSRS Behavior covers preparatory
acts and aborted attempts, which straddle tiers 2 through 4. Bands are wide on
purpose; a narrow band here would measure agreement with one annotator's
judgement, not correctness.

**English only, Reddit only.** Says nothing about the Hinglish or voice paths.
