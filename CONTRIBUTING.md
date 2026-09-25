# Contributing

## Every bug fix adds four cases, not one

The failing case, plus **three near-neighbours that must not fire**. Fixing by widening a pattern silently buys false positives; the neighbours are what catch that.

New cases from bug reports go to the `gate` split, not `dev`.

## Every suppression rule ships with a minimal pair

A rule id in `src/context/` with no entry in `eval/minimal-pairs.json` fails CI. Golden cases do not catch context-layer regressions.

## Do not tune against holdout data

`eval/holdout/` is fetched locally and gitignored. Look at it at release time only. Iterating against it makes any published number overfit by an unknown margin.

Those datasets are real people's crisis posts, largely scraped without consent for this use. Do not vendor them into the repo, and do not quote them in issues.

## Dual-use boundary

`means` and method-seeking detection need *some* method vocabulary to function. The line:

- **In scope:** abstracted patterns sufficient to detect that a method or means is being referenced.
- **Out of scope:** lethality rankings, specific quantities, comparative method detail, anything that is instructional if read directly.

A PR that improves recall by adding instructional specificity will be declined regardless of the metric gain. Raise an issue first if you think a case needs it.

## Clinical review

Tier boundaries reimplement a clinical instrument. Changes to tier semantics, the scoring table, or `examples/` reference copy need review by someone with clinical background before release — not just a passing test suite. The ideation/plan boundary is where clinical judgement diverges most from programmer intuition, and it is exactly where the gate metric sits.

## Resources registry

A dead or wrong-country helpline number converts a correct detection into a person calling a line that does not answer. It is the highest-severity defect class in this project. Entries carry `lastVerified`; CI warns past 180 days. Verify by calling.
