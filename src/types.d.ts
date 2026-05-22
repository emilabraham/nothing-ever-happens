type LiteMarket = {
  // Unique identifer for this market
  id: string

  // Attributes about the creator
  creatorId: string
  creatorUsername: string
  creatorName: string
  creatorAvatarUrl?: string

  // Market atributes
  createdTime: number // When the market was created
  closeTime?: number // Min of creator's chosen date, and resolutionTime
  question: string

  // Note: This url always points to https://manifold.markets, regardless of what instance the api is running on.
  // This url includes the creator's username, but this doesn't need to be correct when constructing valid URLs.
  //   i.e. https://manifold.markets/Austin/test-market is the same as https://manifold.markets/foo/test-market
  url: string

  outcomeType: string // BINARY, FREE_RESPONSE, MULTIPLE_CHOICE, NUMERIC, PSEUDO_NUMERIC, BOUNTIED_QUESTION, POLL, or ...
  mechanism: string // dpm-2, cpmm-1, or cpmm-multi-1

  probability: number
  pool: { outcome: number } // For CPMM markets, the number of shares in the liquidity pool. For DPM markets, the amount of mana invested in each answer.
  p?: number // CPMM markets only, probability constant in y^p * n^(1-p) = k
  totalLiquidity?: number // CPMM markets only, the amount of mana deposited into the liquidity pool

  value?: number // PSEUDO_NUMERIC markets only, the current market value, which is mapped from probability using min, max, and isLogScale.
  min?: number // PSEUDO_NUMERIC markets only, the minimum resolvable value
  max?: number // PSEUDO_NUMERIC markets only, the maximum resolvable value
  isLogScale?: boolean // PSEUDO_NUMERIC markets only, if true `number = (max - min + 1)^probability + minstart - 1`, otherwise `number = min + (max - min) * probability`

  volume: number
  volume24Hours: number

  isResolved: boolean
  resolutionTime?: number
  resolution?: string
  resolutionProbability?: number // Used for BINARY markets resolved to MKT
  uniqueBettorCount: number

  lastUpdatedTime?: number
  lastBetTime?: number

  token?: 'MANA' | 'CASH' // mana or prizecash question
  siblingContractId?: string // id of the prizecash or mana version of this question that you get to by toggling.
}

// A complete market, along with bets, comments, and answers (for free response markets)
type FullMarket = LiteMarket & {
  bets: Bet[];
};

type Bet = {
  id: string;
  userId: string;
  contractId: string;
  createdTime: number;

  amount: number; // bet size; negative if SELL bet
  loanAmount?: number;
  outcome: string;
  shares: number; // dynamic parimutuel pool weight or fixed ; negative if SELL bet

  probBefore: number;
  probAfter: number;

  sale?: {
    amount: number; // amount user makes from sale
    betId: string; // id of bet being sold
    // TODO: add sale time?
  };

  isSold?: boolean; // true if this BUY bet has been sold
  isAnte?: boolean;
  isLiquidityProvision?: boolean;
  isRedemption?: boolean;

  userUsername: string;
} & Partial<LimitProps>;

type NumericBet = Bet & {
  value: number;
  allOutcomeShares: { [outcome: string]: number };
  allBetAmounts: { [outcome: string]: number };
};

// Binary market limit order.
type LimitBet = Bet & LimitProps;

type LimitProps = {
  orderAmount: number; // Amount of limit order.
  limitProb: number; // [0, 1]. Bet to this probability.
  isFilled: boolean; // Whether all of the bet amount has been filled.
  isCancelled: boolean; // Whether to prevent any further fills.
  // A record of each transaction that partially (or fully) fills the orderAmount.
  // I.e. A limit order could be filled by partially matching with several bets.
  // Non-limit orders can also be filled by matching with multiple limit orders.
  fills: fill[];
};

type fill = {
  // The id the bet matched against, or null if the bet was matched by the pool.
  matchedBetId: string | null;
  amount: number;
  shares: number;
  timestamp: number;
  // If the fill is a sale, it means the matching bet has shares of the same outcome.
  // I.e. -fill.shares === matchedBet.shares
  isSale?: boolean;
};
