import React from "react";
import { Pressable, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { useStore } from "../state/Store";
import { RecordItem, domainLabels, Domain } from "../lib/domain";
import { Badge, Label, Row, useColors } from "./UI";
export function TaskRow({
  record,
  onEdit,
}: {
  record: RecordItem;
  onEdit: (r: RecordItem) => void;
}) {
  const c = useColors(),
    { completeTask } = useStore();
  const t = record.payload;
  return (
    <Row
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: c.border,
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={"Complete " + t.title}
        aria-checked={t.status === "done"}
        accessibilityState={{ checked: t.status === "done" }}
        onPress={() => completeTask(record)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: t.status === "done" ? c.green : c.muted,
          backgroundColor: t.status === "done" ? c.green : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {t.status === "done" && <Check size={18} color={c.onAccent} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Edit " + t.title}
        onPress={() => onEdit(record)}
        style={{ flex: 1, gap: 4 }}
      >
        <Label
          style={{
            fontWeight: "500",
            textDecorationLine: t.status === "done" ? "line-through" : "none",
          }}
        >
          {t.title}
        </Label>
        <Label small muted>
          {t.due} · {t.time} · {domainLabels[t.domain as Domain]}
        </Label>
      </Pressable>
      <Badge color={t.priority === "high" ? "#efb58a" : c.green}>
        {t.priority}
      </Badge>
      <ChevronRight size={14} color={c.muted} />
    </Row>
  );
}
