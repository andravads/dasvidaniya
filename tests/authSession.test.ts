import { createClient, type Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createAuthSessionListener,
  nativeAuthenticationRedirect,
} from "../src/lib/authSession";

describe("auth startup ordering", () => {
  it("preserves a real Supabase sign-in when its initial storage read finishes late", async () => {
    const user = {
      id: "00000000-0000-0000-0000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    let stored: string | null = null;
    let delayNextRead = false;
    let releaseRead: (() => void) | undefined;
    let signalRead!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      signalRead = resolve;
    });
    let signalInitial!: () => void;
    const initialDelivered = new Promise<void>((resolve) => {
      signalInitial = resolve;
    });
    const client = createClient("https://example.com", "test-anon", {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async () => {
            const snapshot = stored;
            if (delayNextRead) {
              delayNextRead = false;
              signalRead();
              await new Promise<void>((resolve) => {
                releaseRead = resolve;
              });
            }
            return snapshot;
          },
          setItem: async (_key, value) => {
            stored = value;
          },
          removeItem: async () => {
            stored = null;
          },
        },
      },
      // A local response exercises the installed auth library without sending
      // an email, creating an account, or calling an external service.
      global: {
        fetch: async () =>
          new Response(JSON.stringify(user), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      },
    });
    await client.auth.getSession();
    delayNextRead = true;
    const state: { session: Session | null } = { session: null };
    const events: string[] = [];
    const listener = createAuthSessionListener((session: Session | null) => {
      state.session = session;
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      events.push(event);
      listener(event, session);
      if (event === "INITIAL_SESSION") signalInitial();
    });
    try {
      await readStarted;
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      const testToken = [
        encode({ alg: "HS256", typ: "JWT" }),
        encode({
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: user.id,
          aud: "authenticated",
        }),
        "test-signature",
      ].join(".");
      const { error } = await client.auth.setSession({
        access_token: testToken,
        refresh_token: "test-refresh",
      });
      expect(error).toBeNull();
      releaseRead!();
      await initialDelivered;
      expect(events).toEqual(["SIGNED_IN", "INITIAL_SESSION"]);
      expect(state.session?.user.id).toBe(user.id);
    } finally {
      releaseRead?.();
      data.subscription.unsubscribe();
      client.auth.stopAutoRefresh();
      client.realtime.disconnect();
    }
  });

  it("does not restore a signed-out account from a delayed startup event", () => {
    const update = vi.fn();
    const listener = createAuthSessionListener(update);
    listener("SIGNED_OUT", null);
    listener("INITIAL_SESSION", { id: "old-account" });
    expect(update).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("continues to apply token refreshes and user updates after startup", () => {
    const update = vi.fn();
    const listener = createAuthSessionListener(update);
    listener("INITIAL_SESSION", { token: "old" });
    listener("TOKEN_REFRESHED", { token: "new" });
    listener("USER_UPDATED", { token: "new", email: "updated@example.com" });
    expect(update).toHaveBeenLastCalledWith({
      token: "new",
      email: "updated@example.com",
    });
    expect(update).toHaveBeenCalledTimes(3);
  });
});

it("keeps installed dev/preview callbacks stable and uses the live URL only in Expo Go", () => {
  // expo-linking can produce this malformed URL for a dev client using LAN
  // Metro without Expo Go metadata. Installed auth must never depend on it.
  const metroUrl = vi.fn(() => "homiesos://192.168.1.1:8081profile");
  expect(nativeAuthenticationRedirect(false, metroUrl)).toBe(
    "homiesos://profile",
  );
  expect(metroUrl).not.toHaveBeenCalled();
  const goUrl = vi.fn(() => "exp://test.exp.direct/--/profile");
  expect(nativeAuthenticationRedirect(true, goUrl)).toBe(
    "exp://test.exp.direct/--/profile",
  );
  expect(goUrl).toHaveBeenCalledOnce();
});
