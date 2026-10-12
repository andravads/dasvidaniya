import { it, expect } from "vitest";
import { unavailableMarket, unavailableCards } from "../src/lib/providers";
it("does not turn unavailable feeds into fabricated prices or ticker verification", async () => {
  expect(await unavailableMarket.quote("ANTM", "IDX")).toMatchObject({
    available: false,
  });
  expect(await unavailableMarket.verifyTicker("ANTM", "IDX")).toMatchObject({
    available: false,
  });
  expect(
    await unavailableMarket.tradingSessions("2026-10-09", "IDX"),
  ).toMatchObject({ available: false });
});
it("requires explicit variant confirmation without an authorized card catalog", async () => {
  expect(await unavailableCards.identifyCode("OP01-001")).toMatchObject({
    available: false,
  });
});
