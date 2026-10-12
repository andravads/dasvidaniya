import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  Badge,
  Button,
  Card,
  Choice,
  Disclosure,
  Empty,
  Field,
  Label,
  Row,
  Title,
  styles,
  useColors,
} from "../components/UI";
import { TaskEditor } from "../components/TaskEditor";
import { TaskRow } from "../components/Tasks";
import { useItems, useStore } from "../state/Store";
import {
  dayInZone,
  addDays,
  domains,
  domainLabels,
  RecordItem,
  validDay,
} from "../lib/domain";
export default function Calendar() {
  const c = useColors(),
    { prefs, remove } = useStore();
  const [day, setDay] = useState(dayInZone(new Date(), prefs.timezone)),
    [dateInput, setDateInput] = useState(day),
    [dateError, setDateError] = useState(""),
    [view, setView] = useState("Day"),
    [domain, setDomain] = useState("all"),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState(false),
    [edit, setEdit] = useState<RecordItem>();
  const tasks = useItems("task")
    .filter(
      (r) =>
        (domain === "all" || r.payload.domain === domain) &&
        r.payload.title.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      (a.payload.due + a.payload.time).localeCompare(
        b.payload.due + b.payload.time,
      ),
    );
  const selected = tasks.filter(
    (r) =>
      view === "Tasks" ||
      (view === "Priority" &&
        r.payload.priority === "high" &&
        r.payload.status !== "done") ||
      (view === "Day" && r.payload.due === day) ||
      (view === "Week" &&
        r.payload.due >= day &&
        r.payload.due <= addDays(day, 6)) ||
      (view === "Month" && r.payload.due.slice(0, 7) === day.slice(0, 7)),
  );
  const selectDay = (value: string) => {
    setDay(value);
    setDateInput(value);
    setDateError("");
  };
  const firstOfMonth = day.slice(0, 7) + "-01";
  const monthOffset = new Date(firstOfMonth + "T12:00:00Z").getUTCDay();
  const monthLength = new Date(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0),
  ).getUTCDate();
  const monthRows = Math.ceil((monthOffset + monthLength) / 7);
  return (
    <View style={styles.page}>
      <Row style={{ flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Label small muted>
            ONE PLAN, ALL YOUR WORLDS
          </Label>
          <Title>Calendar & tasks</Title>
          <Label muted>Recorded commitments in {prefs.timezone}.</Label>
        </View>
        <Button
          onPress={() => {
            setEdit(undefined);
            setEditor(true);
          }}
        >
          New task
        </Button>
      </Row>
      <Choice
        options={["Day", "Week", "Month", "Tasks", "Priority"]}
        value={view}
        onChange={setView}
      />
      <Card>
        <Row>
          <Button
            secondary
            accessibilityLabel="Previous date"
            onPress={() => selectDay(addDays(day, -(view === "Week" ? 7 : 1)))}
            icon={<ChevronLeft size={16} color={c.text} />}
          />
          <Label style={{ fontWeight: "600", flex: 1, textAlign: "center" }}>
            {day}
          </Label>
          <Button
            secondary
            accessibilityLabel="Next date"
            onPress={() => selectDay(addDays(day, view === "Week" ? 7 : 1))}
            icon={<ChevronRight size={16} color={c.text} />}
          />
        </Row>
        <Button
          secondary
          onPress={() => selectDay(dayInZone(new Date(), prefs.timezone))}
        >
          Today
        </Button>
      </Card>
      <Disclosure title="Search & filters">
        <Field
          label="Selected date (YYYY-MM-DD)"
          value={dateInput}
          onChangeText={setDateInput}
        />
        <Button
          secondary
          onPress={() => {
            if (validDay(dateInput)) {
              selectDay(dateInput);
            } else
              setDateError(
                "Enter an actual calendar date in YYYY-MM-DD format",
              );
          }}
        >
          Go to date
        </Button>
        {!!dateError && <Label>{dateError}</Label>}
        <Field label="Search tasks" value={search} onChangeText={setSearch} />
        <Choice
          options={["all", ...domains]}
          labels={{ all: "All workspaces", ...domainLabels }}
          value={domain}
          onChange={setDomain}
        />
      </Disclosure>
      {view === "Month" && (
        <Card>
          <Row style={{ gap: 4 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <Label
                key={label}
                small
                muted
                style={{ flex: 1, textAlign: "center", fontSize: 11 }}
              >
                {label}
              </Label>
            ))}
          </Row>
          {Array.from({ length: monthRows }, (_, week) => (
            <Row key={week} style={{ gap: 4 }}>
              {Array.from({ length: 7 }, (_, weekday) => {
                const date = week * 7 + weekday - monthOffset + 1;
                if (date < 1 || date > monthLength)
                  return <View key={weekday} style={{ flex: 1 }} />;
                const d = day.slice(0, 7) + "-" + String(date).padStart(2, "0");
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityLabel={"View " + d}
                    aria-pressed={d === day}
                    accessibilityState={{ selected: d === day }}
                    onPress={() => {
                      selectDay(d);
                      setView("Day");
                    }}
                    style={{
                      flex: 1,
                      minHeight: 52,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      backgroundColor: d === day ? c.green : c.raised,
                    }}
                  >
                    <Label
                      small
                      style={{ color: d === day ? c.onAccent : c.text }}
                    >
                      {date}
                    </Label>
                    <Label
                      small
                      style={{ color: d === day ? c.onAccent : c.green }}
                    >
                      {tasks.filter((t) => t.payload.due === d).length || "·"}
                    </Label>
                  </Pressable>
                );
              })}
            </Row>
          ))}
          <Label small muted>
            Month date grid · tap a date to view its agenda.
          </Label>
        </Card>
      )}
      <Card>
        <Row>
          <Label style={styles.heading}>
            {view === "Priority"
              ? "High priority"
              : view === "Week"
                ? "Seven-day agenda"
                : view === "Tasks"
                  ? "All tasks"
                  : "Your agenda"}
          </Label>
          <Badge>{selected.length} tasks</Badge>
        </Row>
        {!selected.length ? (
          <Empty text="Nothing scheduled here yet. Add a task or choose another date." />
        ) : (
          selected.map((r) => (
            <View key={r.id}>
              <TaskRow
                record={r}
                onEdit={(r) => {
                  setEdit(r);
                  setEditor(true);
                }}
              />
              <Row>
                <Label small muted>
                  {r.payload.duration} min ·{" "}
                  {r.payload.recurrence === "none"
                    ? "One time"
                    : r.payload.recurrence + " recurrence"}{" "}
                  · {r.payload.status}
                </Label>
                <Button
                  secondary
                  onPress={() => {
                    setEdit(r);
                    setEditor(true);
                  }}
                >
                  Edit
                </Button>
              </Row>
            </View>
          ))
        )}
      </Card>
      <TaskEditor
        visible={editor}
        record={edit}
        day={day}
        onClose={() => setEditor(false)}
      />
    </View>
  );
}
