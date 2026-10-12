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
