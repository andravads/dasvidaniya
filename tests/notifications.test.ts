import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { defaults, taskSchema } from "../src/lib/domain";

const native = vi.hoisted(() => ({ OS: "android" }));
const api = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(null),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue("task-1"),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(null),
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(null),
}));
vi.mock("react-native", () => ({ Platform: native }));
vi.mock("expo-notifications", () => ({
  ...api,
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T06:00:00Z"));
  native.OS = "android";
  api.requestPermissionsAsync.mockResolvedValue({ granted: true });
});
afterEach(() => vi.useRealTimers());

describe("native local reminders", () => {
  it("creates the Android channel before requesting permission and shows foreground alerts", async () => {
    const { requestNotifications } = await import("../src/lib/notifications");
    await expect(requestNotifications()).resolves.toBe(true);
    expect(api.setNotificationChannelAsync).toHaveBeenCalledWith("tasks", {
      name: "Tasks and routines",
      importance: 3,
    });
    expect(
      api.setNotificationChannelAsync.mock.invocationCallOrder[0],
    ).toBeLessThan(api.requestPermissionsAsync.mock.invocationCallOrder[0]);
    const handler = api.setNotificationHandler.mock.calls[0][0];
    await expect(handler.handleNotification()).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it("reports denied permission without claiming reminders are enabled", async () => {
    api.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const { requestNotifications } = await import("../src/lib/notifications");
    await expect(requestNotifications()).rejects.toThrow("not granted");
    expect(api.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules a requested task at the user's timezone and retains its cancellation identifier", async () => {
    const { scheduleReminder, cancelReminder } =
      await import("../src/lib/notifications");
    const task = taskSchema.parse({
      title: "Phone reminder test",
      domain: "personal",
      due: "2026-10-14",
      time: "09:00",
      reminder: true,
    });
    await scheduleReminder("task-1", task, {
      ...defaults,
      notifications: true,
    });
    expect(api.setNotificationChannelAsync).toHaveBeenCalledWith("tasks", {
      name: "Tasks and routines",
      importance: 3,
    });
    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "task-1",
      content: {
        title: "Homies OS · Phone reminder test",
        body: "Your scheduled task is ready.",
        data: { taskId: "task-1" },
      },
      trigger: {
        type: "date",
        date: new Date("2026-10-14T02:00:00Z"),
        channelId: "tasks",
      },
    });
    await cancelReminder("task-1");
    expect(api.cancelScheduledNotificationAsync).toHaveBeenCalledWith("task-1");
    expect(api.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it("suppresses past, quiet-hour, completed and unrequested task reminders", async () => {
    const { scheduleReminder } = await import("../src/lib/notifications");
    const prefs = { ...defaults, notifications: true };
    const task = taskSchema.parse({
      due: "2026-10-14",
      title: "Task",
      domain: "personal",
      reminder: true,
    });
    await scheduleReminder("past", { ...task, due: "2026-10-12" }, prefs);
    await scheduleReminder("quiet", { ...task, time: "23:00" }, prefs);
    await scheduleReminder("done", { ...task, status: "done" }, prefs);
    await scheduleReminder(
      "no-task-consent",
      { ...task, reminder: false },
      prefs,
    );
    await scheduleReminder("notifications-disabled", task, {
      ...prefs,
      notifications: false,
    });
    expect(api.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("keeps web reminders explicitly unavailable and never loads the native notification handler", async () => {
    native.OS = "web";
    const { requestNotifications, clearReminders, cancelReminder } =
      await import("../src/lib/notifications");
    await expect(requestNotifications()).rejects.toThrow(
      "Web reminders are not implemented",
    );
    await clearReminders();
    await cancelReminder("task-1");
    expect(api.setNotificationHandler).not.toHaveBeenCalled();
    expect(api.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});
