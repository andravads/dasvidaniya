import { it, expect } from "vitest";
import { nativeAuthCallback } from "../src/lib/authCallback";
it("accepts only the app's account callback and requires both session tokens", () => {
  expect(
    nativeAuthCallback(
      "homiesos://profile#access_token=test-access&refresh_token=test-refresh",
    ),
  ).toEqual({ access_token: "test-access", refresh_token: "test-refresh" });
  expect(
    nativeAuthCallback(
      "https://example.com/profile#access_token=test&refresh_token=test",
    ),
  ).toBeNull();
  expect(
    nativeAuthCallback(
      "homiesos://workspace#access_token=test&refresh_token=test",
    ),
  ).toBeNull();
  expect(nativeAuthCallback("homiesos://profile")).toBeNull();
  expect(() =>
    nativeAuthCallback("homiesos://profile#access_token=test"),
  ).toThrow("incomplete");
  expect(() =>
    nativeAuthCallback(
      "homiesos://profile#error=expired&error_description=private-data",
    ),
  ).toThrow("expired");
});
