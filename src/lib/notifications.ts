import { Platform } from "react-native";
import { Preferences, Task, inQuietHours, zonedInstant } from "./domain";
let notificationsReady:
  Promise<typeof import("expo-notifications")> | undefined;
function notifications() {
  return (notificationsReady ??= import("expo-notifications").then(
    async (N) => {
      // Without a handler, the OS suppresses reminders while the app is open.
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === "android")
        await N.setNotificationChannelAsync("tasks", {
          name: "Tasks and routines",
          importance: N.AndroidImportance.DEFAULT,
        });
      return N;
    },
  ));
}
export async function requestNotifications() {
  if (Platform.OS === "web")
    throw new Error(
      "Background reminders require an Android/iOS development or production build. Web reminders are not implemented.",
    );
  const N = await notifications();
  const p = await N.requestPermissionsAsync();
  if (!p.granted)
    throw new Error(
      "Notification permission was not granted. Enable it in device settings.",
    );
  return true;
}
export async function scheduleReminder(
  id: string,
  task: Task,
  prefs: Preferences,
) {
  if (Platform.OS === "web") return;
  if (!prefs.notifications || !task.reminder || task.status === "done") return;
  const N = await notifications();
  const when = zonedInstant(task.due, task.time, prefs.timezone);
  if (
    when.getTime() <= Date.now() ||
    inQuietHours(task.time, prefs.quietStart, prefs.quietEnd)
  )
    return;
  await N.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: "Homies OS · " + task.title,
      body: "Your scheduled task is ready.",
      data: { taskId: id },
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: "tasks",
    },
  });
}
export async function cancelReminder(id: string) {
  if (Platform.OS !== "web") {
    const N = await notifications();
    await N.cancelScheduledNotificationAsync(id);
  }
}
export async function clearReminders() {
  if (Platform.OS !== "web") {
    const N = await notifications();
    await N.cancelAllScheduledNotificationsAsync();
  }
}
