# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/chrihh/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/chrihh/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Launch Radar** — a token launch radar that prices protocols with no token yet against the peers in their own category that already trade.

The board covers all 40 watchlist protocols (≥ $50M TVL, no token on record, not a wrapped/staked product of a traded one) and adds every clean pre-token protocol below that floor the snapshot carries — 178 rows in all. Each row's implied value is:

```
implied = TVL × peer multiple × launch factor × growth × maturity × breadth
```

- **Peer multiple** — the median market-cap / TVL of traded protocols in the same category, shrunk toward the market-wide median by the peer count, so thin categories borrow strength instead of inventing a price.
- **Launch factor** — how often that category has actually issued a token (its tokenised share, shrunk the same way), as a factor between about 0.8 and 1.25.
- **Growth / maturity / breadth** — the 7-day TVL change clamped to [-40%, +60%] and lightly weighted; a three-year ramp for time run with no token; and a small premium per extra chain, capped at six.

The dashboard (static, fully offline) shows the ranked board with search and category / chain / tier filters, sortable columns, a peer table with the multiple and launch rate behind every category, a live-token view of the traded peers themselves, and a detail view for every protocol with its step-by-step pricing and a seven-step farm plan — each step with a cost and a time, derived from the protocol's category, chains, TVL and age. A separate 0–100 launch score (Prime / Strong / Watch / Early) is shown but orders nothing: the ranking is the implied value alone.

An implied value is this model's estimate of what a launch could be worth if the protocol's record held. It is not a prediction that a token will be issued, and it is not financial advice.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 22.18 or later, standard library only. The program writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory, deterministically: the same snapshot always produces the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=44n6pkpv&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
