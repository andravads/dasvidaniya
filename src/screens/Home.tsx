import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  ArrowRight,
  Sun,
  Sparkles,
  Check,
} from "lucide-react-native";
import {
  Badge,
  Button,
  Card,
  Empty,
  Label,
  Row,
  Title,
  styles,
  useColors,
  useWords,
} from "../components/UI";
import { TaskEditor } from "../components/TaskEditor";
import { supabase } from "../lib/backend";
import { TaskRow } from "../components/Tasks";
import { useItems, useStore } from "../state/Store";
import { dayInZone, domainLabels, RecordItem } from "../lib/domain";
export default function Home() {
  const router = useRouter(),
    c = useColors(),
    w = useWords();
  const { prefs, records, toggleHabit, status, session } = useStore();
  const tasks = useItems("task")
    .filter((r) => r.payload.status !== "done")
    .sort((a, b) => a.payload.due.localeCompare(b.payload.due));
  const habits = useItems("habit").filter((r) => r.payload.enabled);
  const [now, setNow] = useState(new Date()),
    [editor, setEditor] = useState(false),
    [edit, setEdit] = useState<RecordItem>();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const today = dayInZone(now, prefs.timezone);
  const completed = habits.filter((h) =>
    records.some(
      (r) =>
        !r.deleted &&
        r.kind === "completion" &&
        r.payload.habitId === h.id &&
        r.payload.day === today &&
        r.payload.done,
    ),
  ).length;
  return (
    <View style={styles.page}>
      <Row style={{ flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 250 }}>
          <Label small muted style={{ letterSpacing: 1.7 }}>
            YOUR DAY, MADE SIMPLE
          </Label>
          <Title>
            {w.welcome} {prefs.name}.
          </Title>
          <Label muted>{w.subtitle}</Label>
        </View>
        <Button
          onPress={() => {
            setEdit(undefined);
            setEditor(true);
          }}
        >
          {w.add}
        </Button>
      </Row>
      <Row style={{ flexWrap: "wrap" }}>
        <Row>
          <Sun size={16} color={c.green} />
          <Label small muted>
            {now.toLocaleDateString(
              prefs.language === "id" ? "id-ID" : "en-US",
              {
                timeZone: prefs.timezone,
                weekday: "long",
                month: "long",
                day: "numeric",
              },
            )}{" "}
            ·{" "}
            {now.toLocaleTimeString([], {
              timeZone: prefs.timezone,
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Label>
        </Row>
        <Badge>
          {prefs.timezone} · {session ? "CONNECTED ACCOUNT" : "LOCAL SANDBOX"}
        </Badge>
      </Row>
      <Card
        style={{
          backgroundColor: prefs.theme === "dark" ? "#24342a" : "#e4efd9",
          borderColor: prefs.theme === "dark" ? "#42523b" : "#bdcfa8",
        }}
      >
        <Row>
          <Badge>TODAY AT A GLANCE</Badge>
          <Sparkles size={20} color={c.green} />
        </Row>
        <Label style={{ fontSize: 20, fontWeight: "600", lineHeight: 29 }}>
          {tasks.filter((r) => r.payload.due <= today).length} tasks need
          attention
          {" · "}
          {habits.length - completed} routines left today.
        </Label>
        <Row style={{ flexWrap: "wrap" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plan with Homies"
            style={{ minHeight: 44, justifyContent: "center" }}
            onPress={() => router.push("/chat")}
          >
            <Row>
              <Label small style={{ color: c.green }}>
                Plan with Homies
              </Label>
              <ArrowRight size={16} color={c.green} />
            </Row>
          </Pressable>
        </Row>
      </Card>
      <View style={styles.grid}>
        <Card style={{ ...styles.grow, flex: 1.5 }}>
          <Row>
            <Label style={styles.heading}>{w.tasks}</Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See calendar"
              style={{ minHeight: 44, justifyContent: "center" }}
              onPress={() => router.push("/calendar")}
            >
              <Label small style={{ color: c.green }}>
                See calendar
              </Label>
            </Pressable>
          </Row>
          {!tasks.length ? (
            <Empty text="A clear slate. Add your first task to bring your day into focus." />
          ) : (
            tasks.slice(0, 5).map((r) => (
              <TaskRow
                key={r.id}
                record={r}
                onEdit={(r) => {
                  setEdit(r);
                  setEditor(true);
                }}
              />
            ))
          )}
        </Card>
        <Card style={styles.grow}>
          <Row>
            <Label style={styles.heading}>{w.habits}</Label>
            <Badge>{completed} done</Badge>
          </Row>
          {habits.map((h) => {
            const done = records.some(
              (r) =>
                !r.deleted &&
                r.kind === "completion" &&
                r.payload.habitId === h.id &&
                r.payload.day === today &&
                r.payload.done,
            );
            return (
              <Pressable
                key={h.id}
                accessibilityRole="checkbox"
                accessibilityLabel={h.payload.title}
                aria-checked={done}
                accessibilityState={{ checked: done }}
                onPress={() => toggleHabit(h.id, today)}
              >
                <Row style={{ paddingVertical: 8, minHeight: 48 }}>
                  <Label style={{ color: done ? c.green : c.text }}>
                    {h.payload.title}
                  </Label>
                  <View
                    style={{
                      width: 21,
                      height: 21,
                      borderWidth: 1,
                      borderColor: done ? c.green : c.border,
                      borderRadius: 7,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {done && <Check size={14} color={c.green} />}
                  </View>
                </Row>
              </Pressable>
            );
          })}
          <Label small muted>
            Gym target is editable. Recovery and rest count, too.
          </Label>
        </Card>
      </View>
      {!session && supabase && (
        <Card>
          <Row style={{ flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
              <Label style={styles.heading}>
                Your day, saved across devices
              </Label>
              <Label small muted>
                Sign in to sync your tasks and use your AI assistant.
              </Label>
            </View>
            <Button secondary onPress={() => router.push("/profile")}>
              Set up your account
            </Button>
          </Row>
        </Card>
      )}
      <Row style={{ flexWrap: "wrap" }}>
        <Label style={styles.heading}>Your workspaces</Label>
        <Label small muted>
          Different worlds. One home.
        </Label>
      </Row>
      <View style={styles.grid}>
        {prefs.widgets.map((domain, i) => (
          <Pressable
            key={domain}
            accessibilityRole="button"
            accessibilityLabel={"Open " + domainLabels[domain]}
            onPress={() =>
              router.push({ pathname: "/workspace", params: { domain } })
            }
            style={{ flex: 1, minWidth: 220 }}
          >
            <Card>
              <Row>
                <Label
                  style={{
                    fontSize: 22,
                    color: c.green,
                  }}
                >
                  0{i + 1}
                </Label>
                <ArrowUpRight size={17} color={c.muted} />
              </Row>
              <Label style={styles.heading}>{domainLabels[domain]}</Label>
              <Label small muted>
                {domain === "investments"
                  ? `${records.filter((r) => r.kind === "watch" && !r.deleted).length} watchlist interests · data not connected`
                  : domain === "tcg"
                    ? "Your collection, with verified variants"
                    : domain === "engineering"
                      ? "Tasks, notes & authorized documents"
                      : domain === "gainsip"
                        ? "From your first idea to your first order"
                        : domain === "content"
                          ? "Three accounts. A single creative flow."
                          : "Fitness, food, music & a little play."}
              </Label>
            </Card>
          </Pressable>
        ))}
      </View>
      <Label small muted>
        {status}.{" "}
        {session
          ? "Use Profile → Sync now to synchronize changes."
          : "Local records stay on this device. Sign in for a separate synchronized workspace."}
      </Label>
      <TaskEditor
        visible={editor}
        onClose={() => setEditor(false)}
        record={edit}
      />
    </View>
  );
}
