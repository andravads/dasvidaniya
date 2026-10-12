import React, { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useStore } from "../state/Store";
import {
  RecordItem,
  Task,
  domains,
  domainLabels,
  dayInZone,
} from "../lib/domain";
import { Button, Choice, Dialog, Field, Label, Row, useColors } from "./UI";
export function TaskEditor({
  visible,
  onClose,
  record,
  domain = "personal",
  day,
}: {
  visible: boolean;
  onClose: () => void;
  record?: RecordItem;
  domain?: string;
  day?: string;
}) {
  const { prefs, saveTask, remove } = useStore();
  const c = useColors();
  const [task, setTask] = useState<Task>({} as Task),
    [error, setError] = useState(""),
    [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => {
    setTask(
      record?.payload ?? {
        title: "",
        description: "",
        domain,
        priority: "medium",
        due: day ?? dayInZone(new Date(), prefs.timezone),
        time: "09:00",
        duration: 30,
        status: "todo",
        recurrence: "none",
        reminder: false,
      },
    );
    setError("");
    setDeleteConfirm(false);
  }, [visible, record?.id]);
  const edit = (p: Partial<Task>) => setTask((t) => ({ ...t, ...p }));
  return (
    <Dialog
      visible={visible}
      title={record ? "Edit task" : "Create a task"}
      onClose={onClose}
    >
      <Field
        label="Task title"
        value={task.title ?? ""}
        onChangeText={(title) => edit({ title })}
      />
      <Field
        label="Description / document references"
        value={task.description ?? ""}
        onChangeText={(description) => edit({ description })}
        multiline
      />
      <Label small muted>
        Workspace
      </Label>
      <Choice
        options={domains}
        labels={domainLabels}
        value={task.domain}
        onChange={(v) => edit({ domain: v as Task["domain"] })}
      />
      <Label small muted>
        Priority
      </Label>
      <Choice
        options={["high", "medium", "low"]}
        value={task.priority}
        onChange={(v) => edit({ priority: v as Task["priority"] })}
      />
      <Field
        label="Due date (YYYY-MM-DD)"
        value={task.due ?? ""}
        onChangeText={(due) => edit({ due })}
      />
      <Field
        label="Time (HH:mm)"
        value={task.time ?? ""}
        onChangeText={(time) => edit({ time })}
      />
      <Field
        label="Duration in minutes"
        value={String(task.duration ?? 30)}
        keyboardType="numeric"
        onChangeText={(v) => edit({ duration: Number(v) })}
      />
      <Label small muted>
        Status
      </Label>
      <Choice
        options={["todo", "doing", "done"]}
        value={task.status}
        onChange={(v) => edit({ status: v as Task["status"] })}
      />
      <Label small muted>
        Recurrence
      </Label>
      <Choice
        options={["none", "daily", "weekly"]}
        value={task.recurrence}
        onChange={(v) => edit({ recurrence: v as Task["recurrence"] })}
      />
      <Row>
        <Label>Schedule reminder</Label>
        <Switch
          accessibilityLabel="Schedule reminder"
          value={task.reminder}
          onValueChange={(reminder) => edit({ reminder })}
          trackColor={{ true: c.green }}
        />
      </Row>
      <Label small muted>
        Times use {prefs.timezone}. Recurring tasks create the next occurrence
        when completed. Enable notifications in Profile for reminders.
      </Label>
      {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
      <Button
        onPress={() => {
          try {
            saveTask(task, record?.id);
            onClose();
          } catch (e: any) {
            setError(e.message);
          }
        }}
      >
        Save task
      </Button>
      {record && (
        <Button
          secondary
          onPress={() => {
            if (deleteConfirm) {
              remove(record.id);
              onClose();
              setDeleteConfirm(false);
            } else setDeleteConfirm(true);
          }}
        >
          {deleteConfirm ? "Confirm delete task" : "Delete task"}
        </Button>
      )}
    </Dialog>
  );
}
