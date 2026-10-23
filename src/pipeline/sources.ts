export const SINCE = "2024-01-01";

export interface AppSource {
  key: string;
  name: string;
  playId: string;
  appleId: number;
  // Reviews to pull per Play Store pass. Groww gets the most because it is our product.
  play: { newestEn: number; helpfulEn: number; newestHi: number };
}

export const APPS: AppSource[] = [
  { key: "groww", name: "Groww", playId: "com.nextbillion.groww", appleId: 1404871703, play: { newestEn: 20000, helpfulEn: 3000, newestHi: 3000 } },
  { key: "indmoney", name: "INDmoney", playId: "in.indwealth", appleId: 1450178837, play: { newestEn: 5000, helpfulEn: 1000, newestHi: 1000 } },
  { key: "coin", name: "Zerodha Coin", playId: "com.zerodha.coin", appleId: 1392892554, play: { newestEn: 5000, helpfulEn: 1000, newestHi: 1000 } },
  { key: "etmoney", name: "ET Money", playId: "com.smartspends", appleId: 1212752482, play: { newestEn: 5000, helpfulEn: 1000, newestHi: 1000 } },
  { key: "paytmmoney", name: "Paytm Money", playId: "com.paytmmoney", appleId: 1344431352, play: { newestEn: 5000, helpfulEn: 1000, newestHi: 1000 } },
];

export const SUBREDDITS = [
  "IndiaInvestments",
  "mutualfunds",
  "personalfinanceindia",
  "IndianStockMarket",
  "StockMarketIndia",
  "FIREIndia",
];
