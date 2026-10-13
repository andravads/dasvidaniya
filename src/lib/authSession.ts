/** A delayed initial storage snapshot must not replace a newer auth event. */
export function createAuthSessionListener<T>(
  updateSession: (session: T) => void,
) {
  let receivedLiveEvent = false;
  return (event: string, session: T) => {
    if (event === "INITIAL_SESSION" && receivedLiveEvent) return;
    if (event !== "INITIAL_SESSION") receivedLiveEvent = true;
    updateSession(session);
  };
}

/** Installed apps own the stable scheme even while loading from Metro. */
export function nativeAuthenticationRedirect(
  isExpoGo: boolean,
  createExpoGoUrl: () => string,
) {
  return isExpoGo ? createExpoGoUrl() : "homiesos://profile";
}
