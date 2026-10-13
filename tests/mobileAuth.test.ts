import { describe, expect, it, vi } from "vitest";
import { completeAuthCallback } from "../src/lib/authCallback";

const authClient = () => ({
  setSession: vi.fn().mockResolvedValue({ error: null }),
  exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
});

describe("mobile email callbacks", () => {
  it("restores a verified implicit session for sign-in, signup, and recovery links", async () => {
    for (const type of ["magiclink", "signup", "recovery"]) {
      const auth = authClient();
      expect(
        await completeAuthCallback(
          `homiesos://profile#access_token=test-access&refresh_token=test-refresh&type=${type}`,
          "homiesos://profile",
          auth,
        ),
      ).toBe(true);
      expect(auth.setSession).toHaveBeenCalledWith({
        access_token: "test-access",
        refresh_token: "test-refresh",
      });
    }
  });

  it("supports a same-device PKCE code exchange", async () => {
    const auth = authClient();
    await completeAuthCallback(
      "homiesos://profile?code=test-code",
      "homiesos://profile",
      auth,
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("uses the current Expo Go callback without accepting other tunnel hosts", async () => {
    const auth = authClient();
    const redirect = "exp://test.exp.direct/--/profile";
    expect(
      await completeAuthCallback(
        `${redirect}#access_token=a&refresh_token=b`,
        redirect,
        auth,
      ),
    ).toBe(true);
    expect(
      await completeAuthCallback(
        "exp://other.exp.direct/--/profile#access_token=a&refresh_token=b",
        redirect,
        auth,
      ),
    ).toBe(false);
    expect(auth.setSession).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated routes, external hosts, and ordinary app links", async () => {
    const auth = authClient();
    for (const url of [
      "https://example.com/profile#access_token=a&refresh_token=b",
      "homiesos://calendar#access_token=a&refresh_token=b",
      "homiesos://profile/other#access_token=a&refresh_token=b",
      "homiesos://profile",
      "not a URL",
    ])
      expect(await completeAuthCallback(url, "homiesos://profile", auth)).toBe(
        false,
      );
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("shows expired and incomplete link errors without attempting to store credentials", async () => {
    const auth = authClient();
    await expect(
      completeAuthCallback(
        "homiesos://profile#error=access_denied&error_description=Email+link+expired",
        "homiesos://profile",
        auth,
      ),
    ).rejects.toThrow("expired");
    await expect(
      completeAuthCallback(
        "homiesos://profile#access_token=a",
        "homiesos://profile",
        auth,
      ),
    ).rejects.toThrow("incomplete");
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("does not claim success if Supabase rejects the session", async () => {
    const auth = authClient();
    auth.setSession.mockResolvedValue({ error: { message: "Invalid token" } });
    await expect(
      completeAuthCallback(
        "homiesos://profile#access_token=a&refresh_token=b",
        "homiesos://profile",
        auth,
      ),
    ).rejects.toThrow("could not sign you in");
  });
});
