# Plan: Implement NO Betting Logic

## Context

The trader has identified that NO resolves ~55% of the time in binary markets (49k NO vs 39k YES). The pipeline is built out through filtering and fetching, but no bets are being placed yet. The next step is to score/prioritize the filtered markets and actually place NO bets.

## Research Summary

From THOUGHTS.md and current code:
- Base rate: NO wins ~55% of resolved binary markets
- Sports tags are already filtered via `ineligibleGroupSlugs`
- `new-years-resolutions-2024` was identified as a high-volume anomalous tag — needs to be added to the exclusion list
- Markets where prob is already very low (<0.25) have little upside betting NO; markets above 0.75 are already near-certain YES, also risky
- Most interesting bets are in the 0.25–0.75 probability range where the market is genuinely uncertain but the base rate still favors NO

## Implementation Steps

### 1. Add `new-years-resolutions-2024` to `ineligibleGroupSlugs`
In `src/main.ts`, append `'new-years-resolutions-2024'` to the existing `ineligibleGroupSlugs` array.

### 2. Filter by probability range
After `filteredFullMarkets`, add a step that keeps only markets with `0.25 <= probability <= 0.75`. This targets genuinely uncertain markets where the NO edge is most exploitable.

```ts
const bettableMarkets = filteredFullMarkets.filter(
  (m) => m.probability >= 0.25 && m.probability <= 0.75
);
```

### 3. Sort by volume (descending)
Higher-volume markets have more reliable price discovery, so prioritize them:

```ts
bettableMarkets.sort((a, b) => b.volume - a.volume);
```

### 4. Identify which markets to bet on, and prioritize them

For each candidate market (post-sort), call `getBets({ contractId, userId: username })` to load our existing bets. The direction of any probability shift since our last bet determines priority — because the goal is always to get the best NO odds:

- **High priority** — prior bet exists and `currentProb - lastBetProbAfter >= PROB_THRESHOLD`: the market moved toward YES, so NO odds are now *better* than our last entry. Re-bet.
- **Normal priority** — no prior bets: standard new opportunity at base odds.
- **Skip** — prior bet exists and `lastBetProbAfter - currentProb >= PROB_THRESHOLD`: the market has already drifted our way. Odds are worse now; let existing position ride.

Process high-priority markets first, then new markets:

```ts
type ScoredMarket = { market: FullMarket; priority: 'high' | 'normal' };

async function score(market: FullMarket, username: string): Promise<ScoredMarket | null> {
  const myBets = await getBets({ contractId: market.id, userId: username });
  if (myBets.length === 0) return { market, priority: 'normal' };
  const lastBet = myBets[0]; // API returns newest first
  const shift = market.probability - lastBet.probAfter;
  if (shift >= PROB_THRESHOLD) return { market, priority: 'high' };
  return null; // skip
}

const scored = (await Promise.all(bettableMarkets.map(m => score(m, username))))
  .filter((s): s is ScoredMarket => s !== null)
  .sort((a, b) => (a.priority === 'high' ? -1 : 1));
```

Note: `PROB_THRESHOLD` is already declared in `main.ts` — update its value to `0.10` (the current `0.02` was for the old mean-reversion bot).

### 5. Place a NO limit order to add liquidity

A NO limit order at `limitProb` fills when the market probability is at or above that level — meaning we're a standing counterparty for YES buyers who push the price up. Setting `limitProb` just above the current probability creates a resting order rather than an immediate market buy, which is how we add liquidity rather than consume it.

```ts
const limitProb = Math.min(
  Math.round((market.probability + 0.02) * 100) / 100,
  0.95
);
await placeBet({
  contractId: market.id,
  amount: BET_AMOUNT,
  outcome: 'NO',
  limitProb,
});
```

The `+0.02` offset means: "I'll buy NO if the price reaches 2 points above where it is now." The `Math.min(..., 0.95)` cap avoids placing orders on markets that are already almost certain YES.

## Files to Modify

- `src/main.ts` — all changes go here; no new files needed

## Verification

1. Run the bot in dry-run mode first: comment out the `placeBet` call and log what would be bet on
2. Confirm the printed markets are within the 0.25–0.75 probability range and sorted by volume
3. Uncomment `placeBet` and run for real with `MAX_BETS = 1` to confirm a single bet lands on the Manifold dashboard
4. Scale up `MAX_BETS` gradually
