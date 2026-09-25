#!/usr/bin/env bash
# Fetch the public holdout corpora. Data lands in this directory, which is
# gitignored — these are real people's crisis posts, largely scraped without
# consent for this use. Do not vendor them, do not quote them in issues.
set -euo pipefail
cd "$(dirname "$0")"

echo "RSD_15K — 14,613 Reddit posts, ordinal C-SSRS labels"
curl -sL -o rsd15k.csv \
  "https://raw.githubusercontent.com/aascode/RSD_15K/main/Anonymizing%20suicide%20datasets.csv"

echo "negatives — non-suicide class, Ram07/Detection-for-Suicide"
python3 - <<'PY'
import json, urllib.request
out, off = [], 0
base = ("https://datasets-server.huggingface.co/rows?dataset=Ram07%2FDetection-for-Suicide"
        "&config=default&split=train&offset={}&length=100")
while len(out) < 2500 and off < 12000:
    try: r = json.load(urllib.request.urlopen(base.format(off), timeout=30))
    except Exception: break
    rows = r.get("rows", [])
    if not rows: break
    out += [v["row"]["text"] for v in rows
            if str(v["row"].get("class","")).lower().startswith("non")
            and len(v["row"].get("text","")) > 20]
    off += 100
json.dump(out, open("negatives.json","w"))
print(f"  {len(out)} negatives")
PY
echo "done"
