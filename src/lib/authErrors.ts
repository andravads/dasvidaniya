const fallback = "Could not complete authentication. Please try again.";

export function formatAuthError(error: unknown): string {
  const detail =
    error !== null && typeof error === "object"
      ? (error as { code?: unknown; message?: unknown })
      : undefined;

  switch (detail?.code) {
    case "email_not_confirmed":
      return "Confirm your email before signing in with a password. Open the newest confirmation email or request another one.";
    case "invalid_credentials":
      return "The email or password was not accepted. Try an email sign-in link or reset your password.";
    case "email_address_not_authorized":
      return "Email delivery is restricted for this app. Contact the app owner to enable email delivery.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many email requests. Wait before trying again, and check your inbox and spam for the newest email.";
    case "signup_disabled":
      return "Account creation is unavailable. If you already have an account, use an email sign-in link or your existing password.";
  }

  const message = typeof error === "string" ? error : detail?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
