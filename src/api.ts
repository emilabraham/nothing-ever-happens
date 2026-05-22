import "dotenv/config";

const yourKey = process.env.MANIFOLD_API_KEY;

const API_URL = "https://manifold.markets/api/v0";

export const getFullMarket = async (id: string) => {
  const market: FullMarket = await fetch(`${API_URL}/market/${id}`).then(
    (res) => res.json()
  );
  return market;
};

export const getMarkets = async (limit = 1000, before?: string) => {
  const markets: LiteMarket[] = await fetch(
    before
      ? `${API_URL}/markets?limit=${limit}&before=${before}`
      : `${API_URL}/markets?limit=${limit}`
  ).then((res) => res.json());

  return markets;
};

export const getAllMarkets = async () => {
  const allMarkets: LiteMarket[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const markets: LiteMarket[] = await getMarkets(1000, before);

    allMarkets.push(...markets);
    before = markets[markets.length - 1].id;
    console.log("Loaded", allMarkets.length, "markets", "before", before);

    if (markets.length < 1000) break;
  }

  return allMarkets;
};

export const getMarketBySlug = async (slug: string) => {
  const market: FullMarket = await fetch(`${API_URL}/slug/${slug}`).then(
    (res) => res.json()
  );
  return market;
};

interface BetQueryParams {
  userId?: string;
  username?: string;
  contractId?: string;
  contractSlug?: string;
  limit?: number;
  before?: string;
}

export const getBets = async (queryParams: BetQueryParams) => {
  const queryString = Object.keys(queryParams)
    .filter((key) => queryParams[key] !== undefined)
    .map((key) => key + "=" + queryParams[key])
    .join("&");

  const bets: Bet[] = await fetch(`${API_URL}/bets?${queryString}`).then(
    (res) => res.json()
  );
  return bets ?? [];
};

export const getUserBets = async (username: string) => {
  const allBets: Bet[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const bets: Bet[] = await getBets({ username, limit: 1000, before });

    allBets.push(...bets);
    before = bets[bets.length - 1].id;
    if (bets.length < 1000) break;
  }

  return allBets;
};

export const placeBet = async (bet: {
  contractId: string;
  outcome: "YES" | "NO";
  amount: number;
  limitProb?: number;
}) => {
  return fetch(`${API_URL}/bet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${yourKey}`,
    },
    body: JSON.stringify(bet),
  }).then((res) => res.json());
};

export const cancelBet = async (betId: string) => {
  return fetch(`${API_URL}/bet/cancel/${betId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${yourKey}`,
    },
  }).then((res) => res.json());
};

export const searchMarkets = async (
  //  term?: string,
  //  sort?: string,
  filter?: string,
  contractType?: string,
  //  topicSlug?: string,
  //  creatorId?: string,
  limit?: number,
  //  offset?: number,
  //  beforeTime?: number,
  //  liquidity?: number,
) => {
  let url = `${API_URL}/search-markets?`;
  if (contractType) url += `contractType=${contractType}`;
  if (filter) url += `&filter=${filter}`;
  if (limit) url += `&limit=${limit}`;
  const markets: LiteMarket[] = await fetch(url).then((res) => res.json());
  return markets;
};
