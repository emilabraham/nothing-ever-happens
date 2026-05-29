import { getUserBets, getAllMarkets, getFullMarket, placeBet } from "./api";

const PROBABILITY_THRESHOLD: number = 0.10;
const BET_AMOUNT: number = 5;

const main = async () => {
  const username = process.env.MANIFOLD_USERNAME;
  const key = process.env.MANIFOLD_API_KEY;
  const slug = process.env.MANIFOLD_MARKET_SLUG;

  if (!username)
    throw new Error("Please set MANIFOLD_USERNAME variable in .env file.");
  if (!key)
    throw new Error("Please set MANIFOLD_API_KEY variable in .env file.");
  if (!slug)
    throw new Error("Please set MANIFOLD_MARKET_SLUG variable in .env file.");

  console.log("Starting nothing-ever-happens trading bot...");

  let markets: LiteMarket[] = await getAllMarkets();

  markets = filterAndSortLightMarkets(markets);

  console.log(`There are ${markets.length} markets remaining`);

  let fullMarkets: FullMarket[] = await retrieveFullMarkets(markets);

  console.log(`Filtering out markets with inelligible slugs`);
  let filteredFullMarkets: FullMarket[] = fullMarkets.filter((market) => !containsIneligibleSlug(market));
  console.log(`There are ${filteredFullMarkets.length} full markets left`);

  // Retrieve bets
  let bets: Bet[] = await getUserBets(username);

  //For testing, we are making sure to include markets that I have bet on.
  //TODO: Remove this chunk when we are ready to deploy
  let marketsFromBets = bets.map((bet) => bet.contractId);
  console.log(`Retrieving full markets for small sample of markets that I have already bet on.`);
  let smallSampleFullMarketsFromBets: FullMarket[] = await retrieveSmallSampleFullMarkets(marketsFromBets);
  filteredFullMarkets.concat(smallSampleFullMarketsFromBets);

  let bettableMarkets: CategorizedMarkets = categorizeMarkets(filteredFullMarkets, bets);

  await placeLimitBet(bettableMarkets);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ineligibleGroupSlugs: string[] = [
  'sports-default',
  'soccer',
  'football',
  'nfl',
  'nba',
  'college-football',
  'basketball',
  'premiere-league',
  '2022-fifa-world-cup',
  'motorsports',
  'hockey',
  'nhl',
  'baseball',
  'soccer-friendlies',
  'chess',
  'road-bicycle-racing',
  'mlb',
  'uefa-champions-league',
  'college-basketball',
  'new-years-resolution-2024'
];

async function placeLimitBet(markets: CategorizedMarkets): Promise<void> {
  let market: FullMarket = null;
  let limitProbability: number = 0;

  if (markets?.highPriorityMarkets?.length != 0) {
    market = markets.highPriorityMarkets[0].market;
  } else if (markets?.normalPriorityMarkets?.length != 0) {
    market = markets.normalPriorityMarkets[0];
  }

  if (market != null) {
    limitProbability = Math.round((market.probability + .02) * 100)/100;
    await placeBet({
      contractId: market?.id,
      amount: BET_AMOUNT,
      outcome: 'NO',
      limitProb: limitProbability
    });
    console.log(`Placed a bet on ${market?.question}`);
  }
}

function filterAndSortLightMarkets(markets: LiteMarket[]): LiteMarket[] {
  markets = filterOutIneligibleMarkets(markets);
  markets = sortByVolume(markets);
  return markets;
}

function filterOutIneligibleMarkets(markets: LiteMarket[]): LiteMarket[] {
  console.log(`Filtering out irrelevant markets...`);
  const filteredMarkets = markets
  .filter((market: LiteMarket) => !market.isResolved)
  .filter((market: LiteMarket) => market.outcomeType == `BINARY`)
  .filter((market: LiteMarket) => market.probability >= .25 && market.probability <= .75);
  return filteredMarkets;
}

function sortByVolume(markets: LiteMarket[]): LiteMarket[] {
  console.log(`Sorting markets by volume...`);
  return markets.sort((a: LiteMarket, b: LiteMarket) => b.volume - a.volume);
}

/**
 * Retrieve the fullmarket for each given lite market.
 * Does it in batches of 400 every minute.
 * There is an API rate limit of 500 requests per minute.
 **/
async function retrieveFullMarkets(markets: LiteMarket[]): Promise<FullMarket[]> {
  console.log(`Retrieving full market data for ${markets.length} markets...`);
  let fullMarkets: FullMarket[] = [];
  //TODO: Temporary to speed up testing. Remove when ready to deploy
  //let marketCount = markets.length;
  let marketCount = 800;
  let marketIndex = 0;
  while (marketIndex < marketCount) {

    let batchMax = marketIndex + 400; //Grab in batches of 400 to avoid rate limit
    batchMax = batchMax >= marketCount ? marketCount : batchMax;
    let startTime = performance.now();
    console.log(`Retrieving markets ${marketIndex} to ${batchMax}`);

    for (let step = marketIndex; step <= batchMax; step++) {
      let retrievedFullMarket: FullMarket = await getFullMarket(markets[step]?.id);
      fullMarkets.push(retrievedFullMarket);
      marketIndex = step;
    }

    let endTime = performance.now();
    let elapsedTime = (endTime-startTime)/1000
    console.log(`Batch completed in ${elapsedTime.toFixed(2)} seconds`);

    //sleep for the remaining minute
    if (elapsedTime < 60) {
      let sleepTimeMs: number = ((60-elapsedTime) * 1000);
      console.log(`Going to sleep for ${(sleepTimeMs/1000).toFixed(2)} seconds`);
      sleep(sleepTimeMs);
    }
  }

  return fullMarkets;
}

//TODO: Smaller sample set for testing. Should remove after testing.
async function retrieveSmallSampleFullMarkets(marketIds: string[]): Promise<FullMarket[]> {
  let smallSampleFullMarkets: FullMarket[] = [];
  for (let i = 0; i < 400; i++) {
    let retrievedFullMarket: FullMarket = await getFullMarket(marketIds[i]);
    smallSampleFullMarkets.push(retrievedFullMarket);
  }

  return smallSampleFullMarkets;
}

function containsIneligibleSlug(market: FullMarket): boolean {
  let result: boolean = ineligibleGroupSlugs.some(slug => market?.groupSlugs?.includes(slug));
  return result
}

function marketsIHaveAlreadyBetOn(markets: LiteMarket[], bets: Bet[]): LiteMarket[] {
  let betContractIds: string[] = bets.map((bet: Bet) => bet.contractId);
  return markets.filter((market: LiteMarket) => betContractIds.includes(market?.id));
}

function categorizeMarkets(markets: FullMarket[], bets: Bet[]): CategorizedMarkets {
  let marketIdsWithBets: string[] = marketsIHaveAlreadyBetOn(markets, bets)
  .map((market) => market?.id);

  //High Priority markets are ones that I have already bet on that have had their probability shift away from our initial direction.
  //This means there is more opportunity to dig deeper into our strategy.
  let highPriorityMarkets: FullMarketProbabilityChange[] = markets.filter((market) => marketIdsWithBets.includes(market?.id))
  .filter((market) => market?.probability - getLastBetProbabilityForMarket(market?.id, bets) >= PROBABILITY_THRESHOLD)
  .map((market) => { return {
    market: market,
    probabilityChange: market?.probability - getLastBetProbabilityForMarket(market?.id, bets)
  }});

  //Normal Priority markets are ones that I have not bet on yet.
  let normalPriorityMarkets = markets.filter((market) => !marketIdsWithBets.includes(market?.id))

  return { highPriorityMarkets, normalPriorityMarkets }
}

function getLastBetProbabilityForMarket(marketId: string, bets: Bet[]): number {
  let betsForMarketOrdered = bets.filter((bet) => bet.contractId == marketId)
  .sort((a, b) => b.createdTime - a.createdTime);
  return betsForMarketOrdered[0]?.probAfter;
}

function printLiteMarket(market: LiteMarket): void {
  console.log(`Question: ${market.question} |
              Volume: ${market.volume} |
              Probability: ${market.probability} |
              Created: ${new Date(market.createdTime)} |
              Close: ${new Date(market.closeTime)}`);
}

function printLiteMarkets(markets: LiteMarket[]): void {
  markets.forEach((market) => printLiteMarket(market));
}

if (require.main === module) {
  main();
}
