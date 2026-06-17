# nothing-ever-happens
Simple trading bot using Manifold API.

The strategy implemented here polls for binary markets that predict something interesting will happen,
then bets against it.

Some [basic analysis and thoughts](https://github.com/emilabraham/manifold-analysis/blob/main/THOUGHTS.md) I had before creating this bot.

[Inspiration for the concept](https://github.com/sterlingcrispin/nothing-ever-happens).

# Strategy

NO resolves ~55% of the time in binary Manifold markets. The bot exploits this base rate by finding genuinely uncertain markets (not already near-certain either way) and systematically betting NO against them. Sports markets are excluded because they always produce a winner — there's no status quo to return to.

## Step-by-step

### 1. Fetch all markets

`getAllMarkets()` pulls the full list of Manifold binary markets. The initial pass filters for markets that are:
- Not yet resolved
- Binary outcome type (YES/NO only)
- Probability between 0.25 and 0.75 — the uncertain middle where the NO base rate is exploitable without the market already being near-certain

The surviving markets are then sorted by volume descending. Higher volume means more reliable price discovery.

### 2. Retrieve full market data (in batches)

Manifold's API rate limit is ~500 requests/minute. `retrieveFullMarkets()` fetches full details for each lite market in batches of 400, sleeping for the remainder of each 60-second window between batches.

### 3. Filter by group slugs

Full market objects include `groupSlugs` — tags that categorize each market. A second filter pass removes markets tagged with any sports or otherwise ineligible slug (football, NBA, chess, new-years-resolution-2024, etc.) via `containsIneligibleSlug()`. The slug-based filter can only run on full markets because lite markets don't include group data.

### 4. Load existing bets and categorize

`getUserBets()` fetches all bets the bot has previously placed. `categorizeMarkets()` then buckets the remaining markets into two priority tiers:

- **High priority** — the bot has already bet on this market, and the probability has since drifted upward by ≥ 0.10 since the last bet. The market moved toward YES, so NO is now cheaper. Re-bet.
- **Normal priority** — no prior bet exists. Standard new opportunity.
- **Skipped** — already bet on, but probability has drifted our way (odds are worse now). Let the existing position ride.

The probability shift is computed as `currentProb - probAfter` from the most recent bet on that market.

### 5. Place a NO limit order

`placeLimitBet()` picks the top market (high priority first, then normal) and places a NO limit order at `currentProb + 0.02`. A NO limit order at `limitProb` fills when the market probability reaches that level — setting it slightly above current price creates a resting liquidity order rather than an immediate market buy, which means the bot adds liquidity rather than consuming it.

```
limitProb = round((market.probability + 0.02) × 100) / 100
```

Bet amount is a fixed $5 per run.

# Run this bot!

1. Clone the repository
2. Locate your Manifold API Key. You can find it in Your profile => Edit => Api key.
3. Create a `.env` file in the root directory with your api key, replacing the `xxx`'s, and your username.

   ```
   MANIFOLD_API_KEY=xxxxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   MANIFOLD_USERNAME=YourUsername
   ```

4. (Optional) Set up Telegram notifications. The bot will send a message whenever it places a bet.

   a. Create a bot via [@BotFather](https://t.me/botfather) on Telegram and copy the token it gives you.
   b. Start a chat with your bot, then get your chat ID by visiting `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` and looking for the `chat.id` field in the response.
   c. Add both values to your `.env`:

   ```
   TELEGRAM_BOT_TOKEN=123456789:ABCdef...
   TELEGRAM_CHAT_ID=123456789
   ```

   If these variables are absent, the bot runs normally without sending any notifications.

5. Create a `bot.log` file in the root directory of this repo to store logs
6. Install npm packages with `yarn`
7. Run `yarn start`

