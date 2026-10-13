import { describe, expect, it, vi } from "vitest";
import {
  createAppUpdateController,
  type AppUpdateClient,
  type AppUpdateState,
} from "../src/lib/appUpdates";

function setup() {
  const client = {
    checkForUpdateAsync: vi
      .fn<AppUpdateClient["checkForUpdateAsync"]>()
      .mockResolvedValue({ isAvailable: true }),
    fetchUpdateAsync: vi
      .fn<AppUpdateClient["fetchUpdateAsync"]>()
      .mockResolvedValue({ isNew: true }),
    reloadAsync: vi.fn<AppUpdateClient["reloadAsync"]>().mockResolvedValue(),
  };
  const onChange = vi.fn<(state: AppUpdateState) => void>();
  const controller = createAppUpdateController(client, onChange);
  const states = () => onChange.mock.calls.map(([state]) => state);
  return { client, controller, onChange, states };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("manual app updates", () => {
  it("checks without downloading or restarting when no update is available", async () => {
    const { client, controller, states } = setup();
    client.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    await controller.check();
    expect(states()).toEqual([{ stage: "checking" }, { stage: "current" }]);
    expect(client.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(client.reloadAsync).not.toHaveBeenCalled();
  });

  it("downloads an available update but waits for an explicit restart", async () => {
    const { client, controller, states } = setup();
    await controller.check();
    expect(states()).toEqual([
      { stage: "checking" },
      { stage: "downloading" },
      { stage: "ready" },
    ]);
    expect(client.fetchUpdateAsync).toHaveBeenCalledOnce();
    expect(client.reloadAsync).not.toHaveBeenCalled();
    await controller.restart(false);
    expect(client.reloadAsync).not.toHaveBeenCalled();
    await controller.restart(true);
    expect(client.reloadAsync).toHaveBeenCalledOnce();
    expect(states().at(-1)).toEqual({ stage: "restarting" });
    // A successful reload leaves state to the new app lifecycle.
    await controller.check();
    await controller.restart(true);
    expect(client.checkForUpdateAsync).toHaveBeenCalledOnce();
    expect(client.reloadAsync).toHaveBeenCalledOnce();
  });

  it("does not offer a restart when the download returns no new update", async () => {
    const { client, controller, states } = setup();
    client.fetchUpdateAsync.mockResolvedValue({ isNew: false });
    await controller.check();
    expect(states().at(-1)).toEqual({ stage: "current" });
    expect(client.reloadAsync).not.toHaveBeenCalled();
  });

  it.each(["check", "download"] as const)(
    "shows a plain %s failure and permits a fresh check",
    async (phase) => {
      const { client, controller, states } = setup();
      const failure = new Error(
        "Internal native updater implementation detail",
      );
      if (phase === "check")
        client.checkForUpdateAsync.mockRejectedValueOnce(failure);
      else client.fetchUpdateAsync.mockRejectedValueOnce(failure);
      await controller.check();
      expect(states().at(-1)).toEqual({
        stage: "error",
        error: `Could not ${phase} the update. Check your connection and try again.`,
      });
      expect(client.reloadAsync).not.toHaveBeenCalled();
      await controller.check();
      expect(states().at(-3)).toEqual({ stage: "checking" });
      expect(states().at(-1)).toEqual({ stage: "ready" });
      expect(client.checkForUpdateAsync).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps a downloaded update ready after a restart failure so it can retry", async () => {
    const { client, controller, states } = setup();
    client.reloadAsync.mockRejectedValueOnce(
      new Error("Native reload failure"),
    );
    await controller.check();
    await controller.restart(true);
    expect(states().at(-1)).toEqual({
      stage: "ready",
      error: "Could not restart. Try again when you are ready.",
    });
    await controller.restart(true);
    expect(client.reloadAsync).toHaveBeenCalledTimes(2);
    expect(states().at(-1)).toEqual({ stage: "restarting" });
  });

  it("deduplicates checks and blocks restarting while checking or downloading", async () => {
    const { client, controller, states } = setup();
    const check = deferred<{ isAvailable: boolean }>();
    const fetch = deferred<{ isNew: boolean }>();
    const fetchStarted = deferred<void>();
    client.checkForUpdateAsync.mockReturnValue(check.promise);
    client.fetchUpdateAsync.mockImplementation(() => {
      fetchStarted.resolve();
      return fetch.promise;
    });
    const pending = controller.check();
    await controller.check();
    await controller.restart(true);
    expect(client.checkForUpdateAsync).toHaveBeenCalledOnce();
    expect(client.reloadAsync).not.toHaveBeenCalled();
    check.resolve({ isAvailable: true });
    await fetchStarted.promise;
    await controller.check();
    await controller.restart(true);
    expect(client.checkForUpdateAsync).toHaveBeenCalledOnce();
    expect(client.fetchUpdateAsync).toHaveBeenCalledOnce();
    expect(client.reloadAsync).not.toHaveBeenCalled();
    fetch.resolve({ isNew: true });
    await pending;
    expect(states()).toEqual([
      { stage: "checking" },
      { stage: "downloading" },
      { stage: "ready" },
    ]);
  });

  it("does not fetch or emit a late result when disposed during a check", async () => {
    const { client, controller, onChange, states } = setup();
    const check = deferred<{ isAvailable: boolean }>();
    client.checkForUpdateAsync.mockReturnValue(check.promise);
    const pending = controller.check();
    controller.dispose();
    check.resolve({ isAvailable: true });
    await pending;
    await controller.check();
    await controller.restart(true);
    expect(states()).toEqual([{ stage: "checking" }]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(client.checkForUpdateAsync).toHaveBeenCalledOnce();
    expect(client.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(client.reloadAsync).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a late download %s after disposal",
    async (outcome) => {
      const { client, controller, states } = setup();
      const fetch = deferred<{ isNew: boolean }>();
      const fetchStarted = deferred<void>();
      client.fetchUpdateAsync.mockImplementation(() => {
        fetchStarted.resolve();
        return fetch.promise;
      });
      const pending = controller.check();
      await fetchStarted.promise;
      controller.dispose();
      if (outcome === "resolve") fetch.resolve({ isNew: true });
      else fetch.reject(new Error("Late native failure"));
      await pending;
      await controller.restart(true);
      expect(states()).toEqual([
        { stage: "checking" },
        { stage: "downloading" },
      ]);
      expect(client.reloadAsync).not.toHaveBeenCalled();
    },
  );

  it("suppresses a late restart failure after disposal", async () => {
    const { client, controller, states } = setup();
    const reload = deferred<void>();
    client.reloadAsync.mockReturnValue(reload.promise);
    const pending = controller.restart(true);
    controller.dispose();
    reload.reject(new Error("Late reload failure"));
    await pending;
    expect(states()).toEqual([{ stage: "restarting" }]);
  });

  it("downloads a rollback directive and offers only a manual restart", async () => {
    const { client, controller, states } = setup();
    client.checkForUpdateAsync.mockResolvedValue({
      isAvailable: false,
      isRollBackToEmbedded: true,
    });
    client.fetchUpdateAsync.mockResolvedValue({
      isNew: false,
      isRollBackToEmbedded: true,
    });
    await controller.check();
    expect(states()).toEqual([
      { stage: "checking" },
      { stage: "downloading" },
      { stage: "ready" },
    ]);
    expect(client.fetchUpdateAsync).toHaveBeenCalledOnce();
    expect(client.reloadAsync).not.toHaveBeenCalled();
    await controller.restart(true);
    expect(client.reloadAsync).toHaveBeenCalledOnce();
  });
});
