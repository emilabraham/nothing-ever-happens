# nothing-ever-happens
Simple trading bot using Manifold API.

The strategy implemented here polls for binary markets that predict something interesting will happen.
It bets against that. It bets that status quo will remain.

It specifically avoids sports markets since those typically always have a winner. So there can never be a status quo.

# Run this bot!

1. Clone the repository
2. Locate your Manifold API Key. You can find it in Your profile => Edit => Api key.
3. Create a `.env` file in the root directory with your api key, replacing the `xxx`'s, and your username.

   ```
   MANIFOLD_API_KEY=xxxxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   MANIFOLD_USERNAME=YourUsername
   MANIFOLD_MARKET_SLUG=slug-for-market
   ```

4. Create a `bot.log` file in the root directory of this repo to store logs
4. Install npm packages with `yarn`
5. Run `yarn start`

