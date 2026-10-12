import { z } from "zod";
export const domains = [
  "engineering",
  "gainsip",
  "content",
  "investments",
  "tcg",
  "personal",
] as const;
export type Domain = (typeof domains)[number];
export const domainLabels: Record<Domain, string> = {
  engineering: "Engineering",
  gainsip: "Gainsip",
  content: "Content Studio",
  investments: "Investments",
  tcg: "One Piece TCG",
  personal: "Daily routines",
};
export type Kind =
  | "task"
  | "event"
  | "habit"
  | "completion"
  | "campaign"
  | "draft"
  | "watch"
  | "card"
  | "message"
  | "note"
  | "audit"
  | "preferences";
export interface RecordItem {
  id: string;
  kind: Kind;
  payload: any;
  updatedAt: string;
  deleted?: boolean;
}
export function validDay(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v
  );
}
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).default(""),
  domain: z.enum(domains),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(validDay, "Invalid date"),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  duration: z.number().int().min(5).max(1440).default(30),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
  reminder: z.boolean().default(false),
});
export type Task = z.infer<typeof taskSchema>;
export interface Preferences {
  name: string;
  language: "en" | "id";
  timezone: string;
  theme: "dark" | "light";
  widgets: Domain[];
  quietStart: string;
  quietEnd: string;
  notifications: boolean;
  model: string;
  dailyBudget: number;
}
export const defaults: Preferences = {
  name: "Homie",
  language: "en",
  timezone: "Asia/Jakarta",
  theme: "dark",
  widgets: [...domains],
  quietStart: "22:00",
  quietEnd: "07:00",
  notifications: false,
  model: "gpt-4.1-mini",
  dailyBudget: 20,
};
export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
export function dayInZone(date = new Date(), zone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function zonedInstant(day: string, time: string, zone: string) {
  const naive = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(naive)) throw new Error("Invalid date or time");
  let candidate = naive;
  for (let n = 0; n < 3; n++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const get = (k: string) => parts.find((p) => p.type === k)!.value;
    const wall = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    candidate += naive - wall;
  }
  // Detect nonexistent wall times on DST changes rather than silently shifting a commitment.
  const actual = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(candidate));
  if (actual !== time || dayInZone(new Date(candidate), zone) !== day)
    throw new Error("This local time does not exist in the selected timezone");
  return new Date(candidate);
}
export function mergeRecords(local: RecordItem[], remote: RecordItem[]) {
  const map = new Map<string, RecordItem>();
  for (const r of [...remote, ...local]) {
    const old = map.get(r.id);
    if (!old || Date.parse(r.updatedAt) > Date.parse(old.updatedAt))
      map.set(r.id, r);
  }
  return [...map.values()];
}
export function conflicts(task: Task, records: RecordItem[], except?: string) {
  const start = Date.parse(task.due + "T" + task.time + ":00Z");
  return records
    .filter(
      (r) =>
        !r.deleted &&
        r.id !== except &&
        (r.kind === "task" || r.kind === "event") &&
        r.payload.status !== "done",
    )
    .filter((r) => {
      const p = r.payload;
      const other = Date.parse(p.due + "T" + p.time + ":00Z");
      return (
        start < other + p.duration * 60000 &&
        other < start + task.duration * 60000
      );
    });
}
export function inQuietHours(time: string, start: string, end: string) {
  return start === end
    ? false
    : start < end
      ? time >= start && time < end
      : time >= start || time < end;
}
export function habitStreak(
  completions: RecordItem[],
  habitId: string,
  today: string,
) {
  let n = 0;
  let day = today;
  const has = (d: string) =>
    completions.some(
      (r) =>
        !r.deleted &&
        r.payload.habitId === habitId &&
        r.payload.day === d &&
        r.payload.done,
    );
  if (!has(day)) day = addDays(day, -1);
  while (has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
export function initialRecords(): RecordItem[] {
  const now = new Date().toISOString();
  const item = (id: string, kind: Kind, payload: any) => ({
    id,
    kind,
    payload,
    updatedAt: now,
  });
  return [
    item("preferences", "preferences", defaults),
    ...[
      { id: "gym", title: "Gym / recovery", target: 120, unit: "minutes" },
      { id: "cooking", title: "Cook one dish", target: 1, unit: "dish" },
      { id: "piano", title: "Piano practice", target: 30, unit: "minutes" },
      {
        id: "wuwa",
        title: "Wuthering Waves dailies",
        target: 1,
        unit: "check",
      },
      { id: "arknights", title: "Arknights dailies", target: 1, unit: "check" },
      {
        id: "endfield",
        title: "Arknights: Endfield dailies",
        target: 1,
        unit: "check",
      },
    ].map((h) => item(h.id, "habit", { ...h, enabled: true })),
    ...["ANTM", "ASGR", "AADI", "PTPS", "ADMR"].map((t) =>
      item(`IDX-${t}`, "watch", {
        ticker: t,
        exchange: "IDX",
        verified: false,
      }),
    ),
    ...["NVDA", "AMD", "TSM", "ASML", "AVGO"].map((t) =>
      item(`US-${t}`, "watch", { ticker: t, exchange: "US", verified: false }),
    ),
  ];
}
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_task"), task: taskSchema }),
  z.object({
    type: z.literal("reschedule_task"),
    id: z.string(),
    due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
  z.object({
    type: z.literal("save_caption"),
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(6000),
    account: z.enum([
      "TikTok · Working tips",
      "TikTok · Gym",
      "Instagram · Gym",
    ]),
    due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);
export type AssistantAction = z.infer<typeof actionSchema>;
export function localAssistant(
  input: string,
  records: RecordItem[],
  prefs: Preferences,
): { text: string; actions: AssistantAction[] } {
  const today = dayInZone(new Date(), prefs.timezone);
  const lower = input.toLowerCase();
  const tasks = records.filter(
    (r) => !r.deleted && r.kind === "task" && r.payload.status !== "done",
  );
  const match = input.match(
    /^(?:add task|create task|remind me to|tambah tugas|ingatkan saya)\s*:?\s*(.+)/i,
  );
  if (match) {
    let title = match[1];
    const tomorrow = /\b(tomorrow|besok)\b/i.test(title);
    const date = title.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    const time = title.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] ?? "09:00";
    title = title
      .replace(
        /\b(tomorrow|besok|today|hari ini|\d{4}-\d{2}-\d{2}|(?:at\s+)?\d{2}:\d{2})\b/gi,
        "",
      )
      .trim();
    const domain: Domain = /engineering|engine|audit|cfm|ge90/i.test(title)
      ? "engineering"
      : /gainsip|campaign/i.test(title)
        ? "gainsip"
        : /post|caption|content/i.test(title)
          ? "content"
          : "personal";
    const parsed = taskSchema.safeParse({
      title,
      domain,
      due: date ?? (tomorrow ? addDays(today, 1) : today),
      time,
      reminder: /^(remind me|ingatkan saya)/i.test(input),
    });
    if (!parsed.success)
      return {
        text: "Please provide a task title and a valid date.",
        actions: [],
      };
    return {
      text: "Local command: creating the recorded task. Reminders require enabling notifications in Profile.",
      actions: [{ type: "create_task", task: parsed.data }],
    };
  }
  if (/priorit|plan|rencana|engineering/.test(lower)) {
    const list = tasks
      .filter(
        (r) =>
          !lower.includes("engineering") || r.payload.domain === "engineering",
      )
      .sort(
        (a, b) =>
          ({ high: 0, medium: 1, low: 2 })[a.payload.priority as "high"] -
          { high: 0, medium: 1, low: 2 }[b.payload.priority as "high"],
      );
    return {
      text: `Recorded tasks (${list.length}):\n${
        list
          .slice(0, 8)
          .map(
            (r) =>
              `• ${r.payload.title} — ${r.payload.due}, ${r.payload.priority}`,
          )
          .join("\n") || "No outstanding tasks."
      }\n\nSuggestion: tackle high-priority deadlines first, then reserve time for your routines. This is a local planning rule, not an AI-generated briefing.`,
      actions: [],
    };
  }
  return {
    text:
      prefs.language === "id"
        ? "Asisten lokal tersedia. Coba “tambah tugas: latihan piano besok 19:00” atau “prioritas hari ini”. AI, pencarian dokumen, dan generator caption memerlukan konfigurasi Supabase + OpenAI."
        : "Local assistant available. Try “add task: Practice piano tomorrow 19:00” or “What should I prioritize today?” Connect Supabase + OpenAI for AI responses, grounded document questions and caption generation. No live market data is connected.",
    actions: [],
  };
}
