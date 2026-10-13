export type AppUpdateState = {
  stage:
    | "idle"
    | "checking"
    | "downloading"
    | "ready"
    | "current"
    | "restarting"
    | "error";
  error?: string;
};

export type AppUpdateClient = {
  checkForUpdateAsync: () => Promise<{
    isAvailable: boolean;
    isRollBackToEmbedded?: boolean;
  }>;
  fetchUpdateAsync: () => Promise<{
    isNew: boolean;
    isRollBackToEmbedded?: boolean;
  }>;
  reloadAsync: () => Promise<void>;
};

export function createAppUpdateController(
  client: AppUpdateClient,
  onChange: (state: AppUpdateState) => void,
) {
  let busy = false;
  let disposed = false;
  const emit = (state: AppUpdateState) => {
    if (!disposed) onChange(state);
  };

  return {
    async check(): Promise<void> {
      if (disposed || busy) return;
      busy = true;
      let phase = "check";
      try {
        emit({ stage: "checking" });
        const available = await client.checkForUpdateAsync();
        if (disposed) return;
        if (!available.isAvailable && !available.isRollBackToEmbedded) {
          emit({ stage: "current" });
          return;
        }
        phase = "download";
        emit({ stage: "downloading" });
        const fetched = await client.fetchUpdateAsync();
        if (disposed) return;
        emit({
          stage:
            fetched.isNew || fetched.isRollBackToEmbedded ? "ready" : "current",
        });
      } catch {
        emit({
          stage: "error",
          error: `Could not ${phase} the update. Check your connection and try again.`,
        });
      } finally {
        busy = false;
      }
    },
    async restart(isReady: boolean): Promise<void> {
      if (disposed || busy || !isReady) return;
      busy = true;
      emit({ stage: "restarting" });
      try {
        // The app lifecycle replaces this controller after a successful reload.
        await client.reloadAsync();
      } catch {
        busy = false;
        emit({
          stage: "ready",
          error: "Could not restart. Try again when you are ready.",
        });
      }
    },
    dispose(): void {
      disposed = true;
    },
  };
}
