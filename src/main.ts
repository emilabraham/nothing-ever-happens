import { getUserBets, getAllMarkets, getFullMarket } from "./api";

const PROBABILITY_THRESHOLD: number = 0.10;

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

  let fullMarkets: FullMarket[] = await retrieveFullMarkets(markets);

  console.log(`There are ${fullMarkets.length} full markets`);
  let filteredFullMarkets: FullMarket[] = fullMarkets.filter((market) => !containsIneligibleSlug(market));
  console.log(`There are ${filteredFullMarkets.length} full markets without inelligible slugs`);

  // Retrieve bets
  let bets: Bet[] = await getUserBets(username);
  let marketsFromBets = bets.map((bet) => bet.contractId);
  console.log(`Retrieving full markets for small sample of markets that I have already bet on.`);
  let smallSampleFullMarketsFromBets: FullMarket[] = await retrieveSmallSampleFullMarkets(marketsFromBets);

  filteredFullMarkets.concat(smallSampleFullMarketsFromBets);

  categorizeMarkets(filteredFullMarkets, bets);
  let alreadyBetMarkets: LiteMarket[] = marketsIHaveAlreadyBetOn(markets, bets);
  alreadyBetMarkets = sortByVolume(alreadyBetMarkets);
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

function filterAndSortLightMarkets(markets: LiteMarket[]): LiteMarket[] {
  console.log(`There are ${markets.length} markets in total!`);
  markets = filterOutIneligibleMarkets(markets);
  markets = sortByVolume(markets);
  console.log(`There are ${markets.length} filtered markets`);
  return markets;
}

function filterOutIneligibleMarkets(markets: LiteMarket[]): LiteMarket[] {
  const filteredMarkets = markets
  .filter((market: LiteMarket) => !market.isResolved)
  .filter((market: LiteMarket) => market.outcomeType == `BINARY`)
  .filter((market: LiteMarket) => market.probability >= .25 && market.probability <= .75);
  console.log(`Filtered down to ${filteredMarkets.length} markets`);
  return filteredMarkets;
}

function sortByVolume(markets: LiteMarket[]): LiteMarket[] {
  return markets.sort((a: LiteMarket, b: LiteMarket) => b.volume - a.volume);
}

/**
 * Retrieve the fullmarket for each given lite market.
 * Does it in batches of 400 every minute.
 * There is an API rate limit of 500 requests per minute.
 **/
async function retrieveFullMarkets(markets: LiteMarket[]): Promise<FullMarket[]> {
  let fullMarkets: FullMarket[] = [];
  //let marketCount = markets.length;
  let marketCount = 800;
  let marketIndex = 0;
  while (marketIndex < marketCount) {

    let batchMax = marketIndex + 400; //Grab in batches of 400 to avoid rate limit
    batchMax = batchMax >= marketCount ? marketCount : batchMax;
    let startTime = performance.now();
    console.log(`Handling batch with markets ${marketIndex} to ${batchMax}`);

    for (let step = marketIndex; step <= batchMax; step++) {
      let retrievedFullMarket: FullMarket = await getFullMarket(markets[step]?.id);
      fullMarkets.push(retrievedFullMarket);
      marketIndex = step;
    }

    let endTime = performance.now();
    let elapsedTime = (endTime-startTime)/1000
    console.log(`Batch completed in ${elapsedTime} seconds`);

    //sleep for the remaining minute
    if (elapsedTime < 60) {
      let sleepTimeMs: number = ((60-elapsedTime) * 1000);
      console.log(`Going to sleep for ${sleepTimeMs/1000} seconds`);
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

function categorizeMarkets(markets: FullMarket[], bets: Bet[]) {
  let marketIdsWithBets: string[] = marketsIHaveAlreadyBetOn(markets, bets)
  .map((market) => market?.id);

  let highPriorityMarkets = markets.filter((market) => marketIdsWithBets.includes(market?.id))
  .filter((market) => market?.probability - getLastBetProbabilityForMarket(market?.id, bets) >= PROBABILITY_THRESHOLD);
  printLiteMarkets(highPriorityMarkets);
  debugger;
  let normalPriorityMarkets = markets.filter((market) => !marketIdsWithBets.includes(market?.id))
  let skippableMarkets = markets.filter((market) => marketIdsWithBets.includes(market?.id))
  .filter((market) => getLastBetProbabilityForMarket(market?.id, bets) - market?.probability >= PROBABILITY_THRESHOLD);
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
