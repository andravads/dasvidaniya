import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Updates from "expo-updates";
import { Button, Busy, Card, Label, styles, useColors } from "./UI";
import { AppUpdateState, createAppUpdateController } from "../lib/appUpdates";

export function AppUpdates() {
  const web = Platform.OS === "web";
  const available =
    !web &&
    !__DEV__ &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    Updates.isEnabled;
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version;
  return (
    <Card>
      <Label style={styles.heading}>App updates</Label>
      {version ? (
        <Label small muted>
          {web ? "Website version" : "Installed version"} {version}
        </Label>
      ) : null}
      {available ? (
        <NativeAppUpdates />
      ) : (
        <Label muted>
          {web
            ? "The website updates automatically. Refresh this page after saving any unfinished work."
            : "Updates are unavailable in this version. Install the latest Homies OS app to receive updates."}
        </Label>
      )}
    </Card>
  );
}

function NativeAppUpdates() {
  const update = Updates.useUpdates();
  const c = useColors();
  const [state, setState] = useState<AppUpdateState>({ stage: "idle" });
  const controller = useRef<ReturnType<
    typeof createAppUpdateController
  > | null>(null);
  useEffect(() => {
    const actions = createAppUpdateController(Updates, setState);
    controller.current = actions;
    return () => {
      actions.dispose();
      controller.current = null;
    };
  }, []);

  const pending = update.isUpdatePending || state.stage === "ready";
  const restarting = update.isRestarting || state.stage === "restarting";
  const downloading = update.isDownloading || state.stage === "downloading";
  const checking =
    update.isStartupProcedureRunning ||
    update.isChecking ||
    state.stage === "checking";
  const busy = restarting || downloading || checking;
  const automaticError =
    !pending && !busy && state.stage === "idle"
      ? update.downloadError
        ? "Could not download the update. Check your connection and try again."
        : update.checkError
          ? "Could not check for updates. Check your connection and try again."
          : ""
      : "";
  const error = state.error ?? automaticError;
  const message = restarting
    ? "Restarting to apply the update…"
    : downloading
      ? "Downloading update…"
      : checking
        ? "Checking for updates…"
        : pending
          ? "An update is ready. Restart whenever you are ready to use it."
          : state.stage === "current"
            ? "No update is available right now."
            : "Homies checks for updates when you open it. Downloaded updates apply on your next app restart.";

  return (
    <>
      <View accessibilityLiveRegion="polite">
        <Label muted>{message}</Label>
      </View>
      {busy ? <Busy /> : null}
      {error ? (
        <View accessibilityRole="alert">
          <Label style={{ color: c.danger }}>{error}</Label>
        </View>
      ) : null}
      {pending ? (
        <>
          <Label small muted>
            Save any unfinished work before restarting. You can restart later.
          </Label>
          <Button
            disabled={busy}
            onPress={() => void controller.current?.restart(pending)}
          >
            Restart to update
          </Button>
        </>
      ) : (
        <Button
          disabled={busy}
          onPress={() => void controller.current?.check()}
        >
          Check for updates
        </Button>
      )}
    </>
  );
}
