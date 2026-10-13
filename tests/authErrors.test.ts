import { describe, expect, it } from "vitest";
import { formatAuthError } from "../src/lib/authErrors";

describe("authentication error guidance", () => {
  it.each([
    ["email_not_confirmed", /Confirm your email.*newest confirmation email/],
    ["invalid_credentials", /email or password.*sign-in link.*reset/],
    ["email_address_not_authorized", /delivery is restricted.*app owner/],
    ["over_email_send_rate_limit", /Wait.*inbox and spam.*newest email/],
    ["over_request_rate_limit", /Wait.*inbox and spam.*newest email/],
    [
      "signup_disabled",
      /creation is unavailable.*sign-in link.*existing password/,
    ],
  ])(
    "gives actionable guidance for %s without repeating account details",
    (code, guidance) => {
      const message = formatAuthError({
        code,
        message: "private-person@example.com: provider account details",
      });
      expect(message).toMatch(guidance);
      expect(message).not.toContain("private-person@example.com");
      expect(message).not.toContain("provider account details");
    },
  );

  it("uses error codes instead of requiring a particular provider message", () => {
    expect(formatAuthError({ code: "email_not_confirmed" })).toMatch(
      /Confirm your email/,
    );
  });

  it("preserves an unknown provider error so failures remain diagnosable", () => {
    expect(
      formatAuthError({
        code: "unexpected_error",
        message: "Network request failed",
      }),
    ).toBe("Network request failed");
    expect(formatAuthError(new Error("Device storage is unavailable"))).toBe(
      "Device storage is unavailable",
    );
    expect(formatAuthError("Connection interrupted")).toBe(
      "Connection interrupted",
    );
  });

  it.each([
    undefined,
    null,
    {},
    { code: "unexpected_error" },
    { code: "toString", message: 12 },
    { message: null },
    { message: "" },
    { message: "   " },
    "",
    42,
  ])("handles a missing error message safely (%j)", (error) => {
    expect(formatAuthError(error)).toBe(
      "Could not complete authentication. Please try again.",
    );
  });
});
