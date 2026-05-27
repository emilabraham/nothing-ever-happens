import { getUserBets, getAllMarkets, getFullMarket } from "./api";

const BET_AMOUNT = 25;
const PROB_THESHOLD = 0.10;
const REVERSION_FACTOR = 0.5;

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

  let allMarkets: LiteMarket[] = await getAllMarkets();

  console.log(`There are ${allMarkets.length} markets in total!`);
  let filteredMarkets: LiteMarket[] = filterOutIneligibleMarkets(allMarkets);
  filteredMarkets = sortByVolume(filteredMarkets);
  console.log(`There are ${filteredMarkets.length} filtered markets`);

  // Retrieve full markets
  let fullMarkets: FullMarket[] = [];
  //TODO: Need to respect 500/minute rate limit
  let marketCount = filteredMarkets.length;
  let marketIndex = 0;
  while (marketIndex < marketCount) {
    let batchMax = marketIndex + 400;
    batchMax = batchMax >= marketCount ? marketCount : batchMax;
    let startTime = performance.now();
    console.log(`Handling batch with markets ${marketIndex} to ${batchMax}`);
    for (let step = marketIndex; step <= batchMax; step++) {
      let retrievedFullMarket: FullMarket = await getFullMarket(filteredMarkets[step]?.id);
      fullMarkets.push(retrievedFullMarket);
      marketIndex = step;
    }
    let endTime = performance.now();
    let elapsedTime = (endTime-startTime)/1000
    console.log(`Batch completed in ${elapsedTime} seconds`);
    if (elapsedTime < 60) {
      let sleepTimeMs: number = ((60-elapsedTime) * 1000); //sleep for the remaining minute
      console.log(`Going to sleep for ${sleepTimeMs/1000} seconds`);
      sleep(sleepTimeMs);
    }
  }
  console.log(`Made it out of the while loop`);
  //for(let i = 0; i < 400; i++) {
  //  let retrievedFullMarket: FullMarket = await getFullMarket(filteredMarkets[i].id);
  //  console.log(`Retrieved full market ${i}`);
  //  fullMarkets.push(retrievedFullMarket);
  //}

  console.log(`There are ${fullMarkets.length} full markets`);
  let filteredFullMarkets: FullMarket[] = fullMarkets.filter((market) => !containsIneligibleSlug(market));
  console.log(`There are ${filteredFullMarkets.length} full markets without inelligible slugs`);

  // Retrieve bets
  let bets: Bet[] = await getUserBets(username);
  console.log(`I have made ${bets.length} bets`);

  //TODO: Should we change this to using the filtered full markets?
  let alreadyBetMarkets: LiteMarket[] = marketsIHaveAlreadyBetOn(filteredMarkets, bets);

  console.log(`I have made bets on ${alreadyBetMarkets.length} markets that we have filtered`);

  //filteredFullMarkets.forEach((market) => printFullMarket(market));

  //let fullMarkets: FullMarket[] = toFullMarkets(filteredMarkets);

  //let searchedMarkets: LiteMarket[] = await searchMarkets(`open`, `BINARY`, 1000);
  //console.log(`size of searched markets: ${searchedMarkets.length}`);
  //let filteredSearchedMarkets =  searchedMarkets.filter((market) => !market.isResolved);
  //console.log(`size of filtered markets: ${filteredSearchedMarkets.length}`);

//  const contractId = market.id;
//
//  let lastBetId: string | undefined = undefined;
//  let lastProbability: number | undefined = undefined;

//  while (true) {
//    // poll every 15 seconds
//    if (lastBetId !== undefined) await sleep(15 * 1000);
//
//    const loadedBets = await getBets({
//      contractSlug: slug,
//      limit: 5,
//    });
//
//    // filter out limit orders, redemptions, and antes
//    const newBets = loadedBets.filter(
//      (bet) => bet.amount > 0 && !bet.isRedemption && !bet.isAnte
//    );
//
//    if (newBets.length === 0) {
//      console.log("No new bets found. Continuing");
//      continue;
//    }
//
//    const newestBet = newBets[0];
//    if (
//      newestBet.id === lastBetId ||
//      newestBet.userUsername === username // exclude own bets
//    )
//      continue;
//
//    console.log(
//      `Loaded bet:`,
//      newestBet.userUsername,
//      newestBet.outcome,
//      `M${newestBet.amount}`,
//      `${roundProb(lastProbability ?? NaN) * 100}% => ${
//        roundProb(newestBet.probAfter) * 100
//      }%`,
//      new Date().toLocaleTimeString()
//    );
//
//    if (lastProbability) {
//      const diff = newestBet.probAfter - lastProbability;
//
//      if (Math.abs(diff) >= PROB_THESHOLD) {
//        const outcome = diff > 0 ? "NO" : "YES";
//        const limitProb = roundProb(REVERSION_FACTOR * diff + lastProbability);
//
//        const resultBet = await placeBet({
//          contractId,
//          amount: BET_AMOUNT,
//          outcome,
//          limitProb,
//        });
//
//        console.log(
//          `Bet placed:`,
//          resultBet.outcome,
//          `M${Math.floor(resultBet.amount)}`,
//          `${roundProb(newestBet.probAfter) * 100}% => ${
//            roundProb(limitProb) * 100
//          }%\n`
//        );
//      }
//    }
//
//    lastBetId = newestBet.id;
//    lastProbability = newestBet.probAfter;
//  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
//const roundProb = (prob: number) => Math.round(prob * 100) / 100;

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

function toFullMarkets(markets: LiteMarket[]): FullMarket[] {
  let fullMarkets = [];
  let marketCount = 0;
  fullMarkets = markets.map(async (market: LiteMarket) => {
    console.log(`Retrieving full market data for market ${marketCount++}`);
    return await getFullMarket(market.id)
  });
  return fullMarkets;
}

function containsIneligibleSlug(market: FullMarket): boolean {
  let result: boolean = ineligibleGroupSlugs.some(slug => market?.groupSlugs?.includes(slug));
  return result
}

function marketsIHaveAlreadyBetOn(markets: LiteMarket[], bets: Bet[]): LiteMarket[] {
  let betContractIds: string[] = bets.map((bet: Bet) => bet.contractId);
  return markets.filter((market: LiteMarket) => betContractIds.includes(market.id));
}

function printFullMarket(market: FullMarket): void {
  console.log(`Question: ${market.question} | Volume: ${market.volume} | Probability: ${market.probability} | Created: ${new Date(market.createdTime)} | Close: ${new Date(market.closeTime)}`);
}

if (require.main === module) {
  main();
}
