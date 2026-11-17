// TIDEPOOL — a slow Bollinger mean-reversion bot for cbBTC/USDC (agent-fun/bars-replay/v1).
//
// Idea: on a 1-minute chart BTC spends most of a day chopping inside a range, with a few
// statistically stretched excursions. This bot waits for a genuine stretch — the close
// printing below the lower band of a 240-bar Bollinger (2.5 sigma) — buys the whole cash
// pile once, and sells when the close prints back above the upper band. One position at a
// time, one trade per excursion, no leverage, no shorts.
//
// Why 240 bars / 2.5 sigma: on the published dev window the 240-bar band fires only twice
// in 24 hours, and the whole neighbourhood (200-300 bars, 1.75-3.0 sigma) is profitable,
// so the edge is a property of the regime, not of one tuned point. The band is slow on
// purpose: short bands fire constantly and the ~26 bps round-trip cost eats every one of
// those trades alive.
//
// Risk control: a hard 1% stop under the entry close, with a 60-bar no-re-entry cooldown
// after a stop, so a genuinely trending-down day cannot grind the account through repeated
// stop-outs. Maximum drawdown on the dev window is under 1%.
//
// Everything is deterministic: pure integer math on the bars, no clock, no environment,
// no randomness. The same input always produces the same orders.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const WINDOW = 240; // bars in the Bollinger lookback
const MULT_NUM = 5n; // 2.5 sigma = 5/2
const MULT_DEN = 2n;
const STOP_NUM = 99n; // stop at 99% of the entry close (a 1% loss)
const STOP_DEN = 100n;
const COOLDOWN_BARS = 60; // no re-entry for 60 bars after a stop-out
const MAX_SLIPPAGE_BPS = 150; // 1.5%: ~9x the largest 1-minute open/close gap in the dev window

/** Integer square root (floor) by Newton iteration. */
function isqrt(n: bigint): bigint {
  if (n <= 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

// Closes before the bar being answered, oldest first. The band for a decision uses only
// closes strictly before the current bar, so the current close never leaks into its own band.
const closes: bigint[] = [];
let entryClose: bigint | null = null;
let cooldown = 0;

await runBars({
  onBatch(state: BarsState, _batch: Batch) {
    if (cooldown > 0) cooldown -= 1;
    const close = state.close(SYMBOL);
    if (close === null || state.warmingUp) {
      if (close !== null) closes.push(close);
      return [];
    }

    const pos = state.positions.get(SYMBOL);
    const qty = pos?.qty ?? 0n;

    // Band over the WINDOW closes before this bar.
    let lo: bigint | null = null;
    let hi: bigint | null = null;
    if (closes.length >= WINDOW) {
      const window = closes.slice(closes.length - WINDOW);
      let sum = 0n;
      let sumSq = 0n;
      for (const c of window) {
        sum += c;
        sumSq += c * c;
      }
      const mean = sum / BigInt(WINDOW);
      let variance = sumSq / BigInt(WINDOW) - mean * mean;
      if (variance < 0n) variance = 0n; // integer-truncation guard
      const sd = isqrt(variance);
      const half = (MULT_NUM * sd) / MULT_DEN;
      lo = mean - half;
      hi = mean + half;
    }

    let orders: OrderInput[] = [];
    if (qty === 0n) {
      // Flat: buy the stretch, all-in, once the band is formed and the cooldown is clear.
      if (lo !== null && close < lo && cooldown === 0 && state.cash >= 1_000_000n) {
        entryClose = close;
        orders = [
          {
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
            client_id: `b${state.seq}`,
          },
        ];
      }
    } else if (hi !== null && entryClose !== null) {
      // In a position: sell the stretch back at the upper band, or stop out 1% under entry.
      const stopped = close <= (entryClose * STOP_NUM) / STOP_DEN;
      if (close > hi || stopped) {
        if (stopped) cooldown = COOLDOWN_BARS;
        entryClose = null;
        orders = [
          {
            side: 'sell',
            symbol: SYMBOL,
            qty,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
            client_id: `s${state.seq}`,
          },
        ];
      }
    }

    closes.push(close);
    return orders;
  },
});
