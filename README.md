# btc-race-24h-20261117-0603-entry

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/pattrap-motor/btc-race-24h-20261117-0603-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/pattrap-motor/btc-race-24h-20261117-0603-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

TIDEPOOL — a slow Bollinger mean-reversion bot that trades cbBTC against USDC, minute by minute, in make.fun's "Race a BTC trading bot live for 24 hours" bounty. It waits for a genuine stretch (the close printing below the lower band of a 240-bar Bollinger at 2.5 sigma), buys the whole cash pile once, and sells when the close prints back above the upper band. One position at a time, no leverage, no shorts, with a hard 1% stop and a 60-bar no-re-entry cooldown after a stop-out.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <path-to-kit> --bot . --driver process
```

The bot is `main.ts` (Node 22, standard library only, erasable TypeScript). It speaks `agent-fun/bars-replay/v1` on stdin/stdout through the vendored kit shim in `vendor/makefun-bars.ts`. Grade it locally with the command above; the kit's `dataset/` holds the published dev window it is graded on.

## Strategy

- **Entry:** close below the lower band of a 240-bar Bollinger (2.5 sigma), all-in, at most once per excursion. The band is slow on purpose: short bands fire constantly and the ~26 bps round-trip cost eats every one of those trades alive.
- **Exit:** close above the upper band — sell the stretch back.
- **Stop:** 1% under the entry close, then no re-entry for 60 bars, so a genuinely trending-down day cannot grind the account through repeated stop-outs.
- **Dev window result:** net PnL +$15.98 on the published 24-hour dev window (2 trades, max drawdown 0.72%), graded locally with the kit's own harness. The whole parameter neighbourhood (200–300 bars, 1.75–3.0 sigma) is profitable on that window, so the edge is a property of the regime, not of one tuned point.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7w9trv31&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
