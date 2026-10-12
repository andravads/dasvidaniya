/** Provider contracts for authorized integrations. No scrapers or imaginary feeds. */
export type Availability<T> =
  | {
      available: true;
      data: T;
      source: string;
      observedAt: string;
      delayed: boolean;
    }
  | { available: false; reason: string };
export interface Quote {
  ticker: string;
  exchange: "IDX" | "US";
  currency: "IDR" | "USD";
  price: number;
}
export interface MarketDataProvider {
  id: string;
  verifyTicker(
    ticker: string,
    exchange: Quote["exchange"],
  ): Promise<Availability<{ name: string; ticker: string }>>;
  quote(
    ticker: string,
    exchange: Quote["exchange"],
  ): Promise<Availability<Quote>>;
  tradingSessions(
    day: string,
    exchange: Quote["exchange"],
  ): Promise<Availability<{ opensAt: string; closesAt: string }[]>>;
}
export interface CardVariant {
  code: string;
  name: string;
  set: string;
  language: string;
  artwork: string;
  rarity: string;
  promo?: string;
}
export interface CardDataProvider {
  id: string;
  identifyCode(code: string): Promise<Availability<CardVariant[]>>;
  price(
    variant: CardVariant,
    condition: string,
    grade: string,
  ): Promise<
    Availability<{
      price: number;
      currency: "JPY" | "USD" | "IDR";
      basis: "listing" | "completed_sale";
    }>
  >;
}
export const unavailableMarket: MarketDataProvider = {
  id: "unconfigured",
  async verifyTicker() {
    return {
      available: false,
      reason: "No licensed market provider configured",
    };
  },
  async quote() {
    return {
      available: false,
      reason: "No licensed market provider configured",
    };
  },
  async tradingSessions() {
    return {
      available: false,
      reason:
        "An exchange calendar provider is required; weekdays alone are insufficient",
    };
  },
};
export const unavailableCards: CardDataProvider = {
  id: "unconfigured",
  async identifyCode() {
    return {
      available: false,
      reason:
        "No authorized card catalog configured; confirm variants manually",
    };
  },
  async price() {
    return {
      available: false,
      reason: "No authorized card pricing provider configured",
    };
  },
};
