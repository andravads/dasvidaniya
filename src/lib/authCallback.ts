// Native email callbacks carry session tokens. Keep them out of logs/storage
// beyond Supabase's configured secure session storage.
export function nativeAuthCallback(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "homiesos:" ||
    parsed.hostname !== "profile" ||
    (parsed.pathname && parsed.pathname !== "/")
  )
    return null;
  const params = new URLSearchParams(parsed.hash.slice(1));
  if (params.has("error"))
    throw new Error(
      "This email link has expired. Request a new email from your account page.",
    );
  const access_token = params.get("access_token"),
    refresh_token = params.get("refresh_token");
  if (!access_token && !refresh_token) return null;
  if (!access_token || !refresh_token)
    throw new Error("This email link is incomplete. Request a new email.");
  return { access_token, refresh_token };
}

type AuthClient = {
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ error: { message: string } | null }>;
  exchangeCodeForSession: (
    code: string,
  ) => Promise<{ error: { message: string } | null }>;
};

/** Accept auth credentials only on the callback generated for this app. */
export async function completeAuthCallback(
  incomingUrl: string,
  redirectUrl: string,
  auth: AuthClient,
): Promise<boolean> {
  let incoming: URL, expected: URL;
  try {
    incoming = new URL(incomingUrl);
    expected = new URL(redirectUrl);
  } catch {
    return false;
  }
  const path = (url: URL) => url.pathname.replace(/\/$/, "");
  if (
    incoming.protocol !== expected.protocol ||
    incoming.host !== expected.host ||
    path(incoming) !== path(expected) ||
    incoming.username ||
    incoming.password
  )
    return false;

  const params = new URLSearchParams(incoming.search);
  new URLSearchParams(incoming.hash.slice(1)).forEach((value, key) =>
    params.set(key, value),
  );
  if (params.has("error") || params.has("error_description"))
    throw new Error(
      "This email link has expired or could not be verified. Request a new email from your account page.",
    );

  const code = params.get("code");
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!code && !access_token && !refresh_token) return false;
  if (!code && (!access_token || !refresh_token))
    throw new Error("The email link is incomplete. Request a new one.");

  const { error } = code
    ? await auth.exchangeCodeForSession(code)
    : await auth.setSession({
        access_token: access_token!,
        refresh_token: refresh_token!,
      });
  if (error)
    throw new Error(
      "The email link could not sign you in. Request a new email and open it on this device.",
    );
  return true;
}
