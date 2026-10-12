import { describe, it, expect } from "vitest";
import {
  initialRecords,
  defaults,
  localAssistant,
  taskSchema,
  conflicts,
  mergeRecords,
  dayInZone,
  zonedInstant,
  inQuietHours,
  habitStreak,
  actionSchema,
  validDay,
} from "../src/lib/domain";
const task = taskSchema.parse({
  title: "Engineering assessment",
  domain: "engineering",
  due: "2026-10-10",
  time: "09:00",
});
describe("shared domain workflows", () => {
  it("starts with interests and routine definitions, never invented holdings or financial data", () => {
    const r = initialRecords();
    expect(r.filter((x) => x.kind === "watch")).toHaveLength(10);
    expect(r.filter((x) => x.kind === "habit")).toHaveLength(6);
    expect(r.some((x) => ["campaign", "card", "task"].includes(x.kind))).toBe(
      false,
    );
    expect(
      r
        .filter((x) => x.kind === "watch")
        .every((x) => x.payload.verified === false),
    ).toBe(true);
  });
  it("creates a structured task from a local assistant command", () => {
    const result = localAssistant(
      "Add task: Practice piano tomorrow 19:00",
      [],
      defaults,
    );
    expect(result.actions[0]).toMatchObject({
      type: "create_task",
      task: { title: "Practice piano", time: "19:00", domain: "personal" },
    });
    expect(actionSchema.safeParse(result.actions[0]).success).toBe(true);
  });
  it("supports Indonesian local task commands", () => {
    expect(
      localAssistant("tambah tugas: Gainsip campaign besok 15:00", [], defaults)
        .actions[0],
    ).toMatchObject({
      type: "create_task",
      task: { domain: "gainsip", time: "15:00" },
    });
  });
  it("detects overlapping time blocks and permits adjacent ones", () => {
    const records = [
      {
        id: "one",
        kind: "task" as const,
        payload: task,
        updatedAt: "2026-10-09",
      },
    ];
    expect(conflicts({ ...task, time: "09:15" }, records)).toHaveLength(1);
    expect(conflicts({ ...task, time: "09:30" }, records)).toHaveLength(0);
    expect(conflicts(task, records, "one")).toHaveLength(0);
  });
  it("uses the configured timezone instead of host timezone", () => {
    expect(dayInZone(new Date("2026-10-09T18:30:00Z"), "Asia/Jakarta")).toBe(
      "2026-10-10",
    );
    expect(
      zonedInstant("2026-10-10", "09:00", "Asia/Jakarta").toISOString(),
    ).toBe("2026-10-10T02:00:00.000Z");
  });
  it("rejects nonexistent daylight saving wall times", () => {
    expect(() =>
      zonedInstant("2026-03-08", "02:30", "America/New_York"),
    ).toThrow();
  });
  it("handles overnight quiet hours and disabled windows", () => {
    expect(inQuietHours("23:00", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("06:30", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("12:00", "22:00", "07:00")).toBe(false);
    expect(inQuietHours("12:00", "12:00", "12:00")).toBe(false);
  });
  it("preserves newer tombstones during cloud merge", () => {
    const old = {
      id: "one",
      kind: "task" as const,
      payload: task,
      updatedAt: "2026-10-08T00:00:00Z",
    };
    const newer = { ...old, updatedAt: "2026-10-09T00:00:00Z", deleted: true };
    expect(mergeRecords([old], [newer])[0]).toEqual(newer);
  });
  it("tracks consecutive completions and breaks gaps", () => {
    const records = ["2026-10-08", "2026-10-09"].map((day) => ({
      id: day,
      kind: "completion" as const,
      payload: { habitId: "piano", day, done: true },
      updatedAt: day,
    }));
    expect(habitStreak(records, "piano", "2026-10-09")).toBe(2);
    expect(habitStreak(records, "piano", "2026-10-10")).toBe(2);
    expect(habitStreak(records, "piano", "2026-10-11")).toBe(0);
  });
  it("rejects unsupported external actions and invalid task values", () => {
    expect(
      actionSchema.safeParse({ type: "publish", account: "TikTok" }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ ...task, title: "", duration: -3 }).success,
    ).toBe(false);
    expect(taskSchema.safeParse({ ...task, time: "25:00" }).success).toBe(
      false,
    );
  });
  it("does not invent connected AI or market data in local mode", () => {
    const result = localAssistant("What happened to ANTM today?", [], defaults);
    expect(result.actions).toHaveLength(0);
    expect(result.text).toContain("No live market data");
  });
});

it("rejects calendar rollover dates and detects overnight conflicts", () => {
  expect(validDay("2026-02-31")).toBe(false);
  expect(taskSchema.safeParse({ ...task, due: "2026-02-31" }).success).toBe(
    false,
  );
  const r = {
    id: "overnight",
    kind: "task" as const,
    payload: { ...task, time: "23:45", duration: 60 },
    updatedAt: "2026-10-09T00:00:00Z",
  };
  expect(
    conflicts({ ...task, due: "2026-10-11", time: "00:10" }, [r]),
  ).toHaveLength(1);
});
