import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  invoke,
  listenForNativeAuthentication,
} from "../lib/backend";
import { createAuthSessionListener } from "../lib/authSession";
import {
  RecordItem,
  Kind,
  Preferences,
  defaults,
  initialRecords,
  uid,
  mergeRecords,
  Task,
  taskSchema,
  conflicts,
  actionSchema,
  AssistantAction,
  localAssistant,
  dayInZone,
  addDays,
  zonedInstant,
} from "../lib/domain";
import {
  cancelReminder,
  clearReminders,
  scheduleReminder,
} from "../lib/notifications";
type Context = {
  records: RecordItem[];
  prefs: Preferences;
  session: Session | null;
  ready: boolean;
  status: string;
  error: string;
  clearError: () => void;
  put: (kind: Kind, payload: any, id?: string) => string;
  remove: (id: string) => void;
  setPrefs: (p: Partial<Preferences>) => void;
  saveTask: (p: Task, id?: string, allowConflict?: boolean) => string;
  completeTask: (r: RecordItem) => void;
  toggleHabit: (id: string, day: string, minutes?: number) => void;
  sync: () => Promise<void>;
  chat: (text: string, engineering?: boolean) => Promise<void>;
  saveCaption: (
    topic: string,
    account: string,
    language: string,
    tone: string,
  ) => Promise<void>;
  resetLocal: () => Promise<void>;
};
const C = createContext<Context | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const current = useRef(records);
  current.current = records;
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Local · this device"),
    [error, setError] = useState("");
  const key = useRef("");
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const sessionId = useRef<string | undefined>(undefined);
  const prefs = {
    ...defaults,
    ...records.find((r) => r.kind === "preferences" && !r.deleted)?.payload,
  } as Preferences;
  useEffect(() => {
    let alive = true;
    const select = async (s: Session | null) => {
      const g = ++generation.current;
      setReady(false);
      setSession(s);
      await clearReminders().catch(() => {});
      if (!alive || g !== generation.current) return;
      const k = "homies:v1:" + (s?.user.id ?? "local");
      key.current = k;
      try {
        const data = await AsyncStorage.getItem(k);
        if (alive && g === generation.current) {
          let loaded: RecordItem[];
          if (data) loaded = JSON.parse(data);
          else if (s && supabase) {
            const remote: any[] = [];
            for (let from = 0; ; from += 1000) {
              const { data: page, error: remoteError } = await supabase
                .from("workspace_records")
                .select("id,kind,payload,updated_at,deleted")
                .order("id")
                .range(from, from + 999);
              if (remoteError) throw remoteError;
              remote.push(...page);
              if (page.length < 1000) break;
            }
            loaded = remote.length
              ? remote.map(
                  (r) =>
                    ({
                      id: r.id,
                      kind: r.kind,
                      payload: r.payload,
                      deleted: r.deleted,
                      updatedAt: new Date(r.updated_at).toISOString(),
                    }) as RecordItem,
                )
              : initialRecords();
          } else loaded = initialRecords();
          if (!alive || g !== generation.current) return;
          current.current = loaded;
          setRecords(loaded);
          setStatus(s ? "Cloud · sync pending" : "Local · this device");
          setReady(true);
        }
      } catch {
        if (alive && g === generation.current) {
          current.current = [];
          setRecords([]);
          setReady(true);
          setError(
            "Could not load workspace data. Check Supabase setup or device storage; sign out to use the local sandbox.",
          );
        }
      }
    };
    if (supabase) {
      let selected = false;
      const updateSession = (s: Session | null) => {
        if (!alive) return;
        // Refresh tokens and user details without reloading account records.
        setSession(s);
        if (!selected || s?.user.id !== sessionId.current) {
          selected = true;
          sessionId.current = s?.user.id;
          void select(s);
        }
      };
      const { data } = supabase.auth.onAuthStateChange(
        createAuthSessionListener(updateSession),
      );
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) setError(error.message);
          if (!selected) updateSession(data.session);
        })
        .catch((e: Error) => {
          if (!alive) return;
          setError(e.message);
          if (!selected) updateSession(null);
        });
      const stopAuthLinks = listenForNativeAuthentication(setError);
      return () => {
        alive = false;
        data.subscription.unsubscribe();
        stopAuthLinks();
      };
    }
    void select(null);
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (ready) {
      AsyncStorage.setItem(key.current, JSON.stringify(records)).catch(() =>
        setError(
          "Device storage failed. Export a backup; changes may not survive restart.",
        ),
      );
    }
  }, [records, ready]);
  const put = (kind: Kind, payload: any, id = uid()) => {
    const previous = current.current.find((r) => r.id === id);
    const timestamp = Math.max(
      Date.now(),
      previous ? Date.parse(previous.updatedAt) + 1 : 0,
    );
    const r = {
      id,
      kind,
      payload,
      updatedAt: new Date(timestamp).toISOString(),
    };
    const next = [...current.current.filter((x) => x.id !== id), r];
    current.current = next;
    setRecords(next);
    return id;
  };
  const remove = (id: string) => {
    const old = current.current.find((r) => r.id === id);
    if (!old) return;
    const next = current.current.map((r) =>
      r.id === id
        ? {
            ...r,
            deleted: true,
            updatedAt: new Date(
              Math.max(Date.now(), Date.parse(r.updatedAt) + 1),
            ).toISOString(),
          }
        : r,
    );
    current.current = next;
    setRecords(next);
    void cancelReminder(id).catch((e) => setError(e.message));
  };
  const setPrefs = (p: Partial<Preferences>) =>
    put("preferences", { ...prefs, ...p }, "preferences");
  const saveTask = (value: Task, id?: string, allowConflict = false) => {
    const task = taskSchema.parse(value);
    zonedInstant(task.due, task.time, prefs.timezone);
    if (!allowConflict) {
      const overlap = conflicts(task, current.current, id);
      if (overlap.length)
        throw new Error(
          "Calendar conflict with " +
            overlap.map((r) => r.payload.title).join(", ") +
            ". Choose another time.",
        );
    }
    const taskId = put("task", task, id);
    void cancelReminder(taskId)
      .then(() => scheduleReminder(taskId, task, prefs))
      .catch((e) => setError("Task saved; reminder failed: " + e.message));
    return taskId;
  };
  const completeTask = (r: RecordItem) => {
    const p = r.payload as Task;
    put("task", { ...p, status: p.status === "done" ? "todo" : "done" }, r.id);
    void cancelReminder(r.id).catch(() => {});
    if (p.status !== "done" && p.recurrence !== "none") {
      const due = addDays(p.due, p.recurrence === "daily" ? 1 : 7);
      const nextId = `${r.id.split("~")[0]}~${due}`;
      if (!current.current.some((x) => x.id === nextId))
        saveTask({ ...p, due, status: "todo" }, nextId, true);
    }
  };
  const toggleHabit = (id: string, day: string, minutes?: number) => {
    const recordId = `completion:${id}:${day}`;
    const old = current.current.find((r) => r.id === recordId);
    put(
      "completion",
      {
        habitId: id,
        day,
        done: minutes !== undefined ? true : !old?.payload.done,
        minutes: minutes ?? 0,
      },
      recordId,
    );
  };
  const sync = async () => {
    if (!supabase || !session || !ready) return;
    if (inFlight.current) {
      await inFlight.current;
      return sync();
    }
    let resolveFlight!: () => void;
    inFlight.current = new Promise<void>((resolve) => {
      resolveFlight = resolve;
    });
    const g = generation.current;
    setStatus("Syncing…");
    try {
      const items = current.current;
      const { error: writeError } = await supabase.rpc(
        "merge_workspace_records",
        {
          items: items.map((r) => ({
            id: r.id,
            kind: r.kind,
            payload: r.payload,
            updated_at: r.updatedAt,
            deleted: !!r.deleted,
          })),
        },
      );
      if (writeError) throw writeError;
      const data: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error: readError } = await supabase
          .from("workspace_records")
          .select("id,kind,payload,updated_at,deleted")
          .order("id")
          .range(from, from + 999);
        if (readError) throw readError;
        data.push(...page);
        if (page.length < 1000) break;
      }
      if (g === generation.current) {
        setRecords((old) =>
          mergeRecords(
            old,
            data.map(
              (r) =>
                ({
                  ...r,
                  updatedAt: new Date(r.updated_at).toISOString(),
                }) as RecordItem,
            ),
          ),
        );
        setStatus(
          "Cloud · synced " +
            new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
        );
      }
    } catch (e: any) {
      if (g === generation.current) {
        setStatus("Cloud · sync failed");
        setError(e.message);
      }
      throw e;
    } finally {
      inFlight.current = null;
      resolveFlight();
    }
  };
  useEffect(() => {
    if (!session || !ready) return;
    void sync().catch(() => {});
    const timer = setInterval(() => void sync().catch(() => {}), 30000);
    return () => clearInterval(timer);
  }, [session?.user.id, ready]);
  // Reschedule on startup and whenever tasks or reminder preferences change. Identifiers prevent duplicate alerts.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const reconcile = async () => {
      await clearReminders();
      if (cancelled || !prefs.notifications) return;
      for (const r of records) {
        if (cancelled) return;
        if (r.kind === "task" && !r.deleted)
          await scheduleReminder(r.id, r.payload, prefs);
      }
    };
    void reconcile().catch((e) =>
      setError("Reminder setup failed: " + e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    records,
    prefs.notifications,
    prefs.timezone,
    prefs.quietStart,
    prefs.quietEnd,
  ]);
  const apply = (raw: unknown) => {
    const action = actionSchema.parse(raw);
    if (action.type === "create_task") {
      const id = saveTask(action.task);
      put("audit", {
        action: "create_task",
        recordId: id,
        source: "assistant",
      });
      return "Created task: " + action.task.title;
    }
    if (action.type === "reschedule_task") {
      const record = current.current.find(
        (r) => !r.deleted && r.kind === "task" && r.id === action.id,
      );
      if (!record) throw new Error("Task not found");
      saveTask(
        { ...record.payload, due: action.due, time: action.time },
        record.id,
      );
      put("audit", {
        action: "reschedule_task",
        recordId: record.id,
        source: "assistant",
      });
      return "Rescheduled: " + record.payload.title;
    }
    const task = taskSchema.parse({
      title: "Create / publish: " + action.title,
      domain: "content",
      due: action.due,
      time: "18:00",
    });
    if (conflicts(task, current.current).length)
      throw new Error(
        "Caption schedule conflicts with your calendar. Save manually at another time.",
      );
    const id = put("draft", {
      title: action.title,
      text: action.text,
      account: action.account,
      due: action.due,
      status: "Draft",
      metrics: {},
    });
    saveTask(task);
    put("audit", { action: "save_caption", recordId: id, source: "assistant" });
    return "Saved caption and calendar task. External publishing has not occurred.";
  };
  const chat = async (text: string, engineering = false) => {
    if (!text.trim()) return;
    const g = generation.current;
    put("message", { role: "user", text, engineering });
    try {
      let response: {
        text: string;
        actions: AssistantAction[];
        citations?: any[];
      };
      if (session && supabase) {
        await sync();
        if (g !== generation.current) return;
        response = await invoke("assistant", {
          text,
          engineering,
          model: prefs.model,
          language: prefs.language,
          timezone: prefs.timezone,
          context: current.current
            .filter(
              (r) =>
                !r.deleted &&
                [
                  "task",
                  "campaign",
                  "draft",
                  "habit",
                  "watch",
                  "card",
                ].includes(r.kind),
            )
            .filter((r) =>
              engineering
                ? r.kind === "task" && r.payload.domain === "engineering"
                : r.payload.domain !== "engineering",
            )
            .map((r) => ({ id: r.id, kind: r.kind, payload: r.payload }))
            .slice(0, 60),
          history: current.current
            .filter(
              (r) =>
                r.kind === "message" &&
                !r.deleted &&
                !!r.payload.engineering === engineering,
            )
            .slice(-8)
            .map((r) => ({ role: r.payload.role, text: r.payload.text })),
        });
      } else response = localAssistant(text, current.current, prefs);
      if (g !== generation.current) return;
      const outcomes = [];
      for (const action of response.actions ?? []) {
        try {
          outcomes.push(apply(action));
        } catch (e: any) {
          outcomes.push("Action not performed: " + e.message);
        }
      }
      put("message", {
        role: "assistant",
        text:
          response.text + (outcomes.length ? "\n\n" + outcomes.join("\n") : ""),
        citations: response.citations ?? [],
        engineering,
      });
    } catch (e: any) {
      if (g === generation.current) {
        put("message", {
          role: "assistant",
          text: "Request failed: " + e.message,
          engineering,
        });
        throw e;
      }
    }
  };
  const saveCaption = async (
    topic: string,
    account: string,
    language: string,
    tone: string,
  ) => {
    if (!session)
      throw new Error(
        "Sign in and configure OpenAI to generate a caption. You can save your own draft below.",
      );
    const response = await invoke("assistant", {
      mode: "caption",
      text: topic,
      account,
      language,
      tone,
      timezone: prefs.timezone,
      model: prefs.model,
    });
    put("draft", {
      title: topic,
      text: response.text,
      account,
      status: "Draft",
      due: dayInZone(new Date(), prefs.timezone),
      metrics: {},
    });
  };
  const resetLocal = async () => {
    if (session)
      throw new Error(
        "Local reset only applies to the local sandbox. Cloud deletion requires the account deletion endpoint.",
      );
    await clearReminders();
    await AsyncStorage.removeItem(key.current);
    setRecords(initialRecords());
  };
  return (
    <C.Provider
      value={{
        records,
        prefs,
        session,
        ready,
        status,
        error,
        clearError: () => setError(""),
        put,
        remove,
        setPrefs,
        saveTask,
        completeTask,
        toggleHabit,
        sync,
        chat,
        saveCaption,
        resetLocal,
      }}
    >
      {children}
    </C.Provider>
  );
}
export function useStore() {
  const value = useContext(C);
  if (!value) throw new Error("Missing store");
  return value;
}
export function useItems(kind: Kind) {
  return useStore().records.filter((r) => r.kind === kind && !r.deleted);
}
