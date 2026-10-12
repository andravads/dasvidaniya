import React, { useState } from "react";
import { View, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Sparkles, ArrowUp } from "lucide-react-native";
import {
  Badge,
  Button,
  Card,
  Choice,
  Empty,
  Field,
  Label,
  Row,
  Title,
  styles,
  useColors,
  Busy,
} from "../components/UI";
import { useItems, useStore } from "../state/Store";
export default function Chat() {
  const router = useRouter();
  const { chat, session } = useStore(),
    c = useColors();
  const [text, setText] = useState(""),
    [mode, setMode] = useState("Personal"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const conversation = useItems("message").filter(
    (r) => !!r.payload.engineering === (mode === "Engineering"),
  );
  const messages = conversation.filter((r) =>
    r.payload.text.toLowerCase().includes(search.toLowerCase()),
  );
  const send = async () => {
    if (!text.trim()) return;
    const input = text;
    setText("");
    setBusy(true);
    setError("");
    try {
      await chat(input, mode === "Engineering");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.page}>
      <Row>
        <View style={{ flex: 1 }}>
          <Label small muted>
            A THINKING PARTNER FOR YOUR DAY
          </Label>
          <Title>Your AI assistant</Title>
          <Label muted>Ask a question, plan your day, or add a task.</Label>
        </View>
        <Sparkles size={28} color={c.green} />
      </Row>
      <Row style={{ flexWrap: "wrap" }}>
        <Choice
          options={["Personal", "Engineering"]}
          value={mode}
          onChange={setMode}
        />
        <Badge>{session ? "SIGNED IN" : "ON THIS DEVICE"}</Badge>
      </Row>
      <Card>
        <Label small muted>
          {mode === "Engineering"
            ? "Engineering questions use only files you explicitly authorized and indexed. Questions typed here are sent to configured OpenAI when signed in. Never include company information you lack authorization to share. Answers require approved documentation and engineering review."
            : session
              ? "Ask about your day or request a task. Your engineering records stay separate from personal chat."
              : "Try a task command below. Sign in for full AI conversations. Your engineering records stay separate from personal chat."}
        </Label>
        <Row style={{ flexWrap: "wrap" }}>
          {[
            "What should I prioritize today?",
            "Add task: Practice piano tomorrow 19:00",
          ].map((q) => (
            <Button key={q} secondary onPress={() => setText(q)}>
              {q}
            </Button>
          ))}
        </Row>
      </Card>
      {!session && (
        <Button secondary onPress={() => router.push("/profile")}>
          Sign in to use AI
        </Button>
      )}
      {conversation.length > 0 && (
        <Field
          label="Search conversation history"
          value={search}
          onChangeText={setSearch}
        />
      )}
      {!messages.length && (
        <Empty text="Your conversation starts here. Ask about your day, or add a task." />
      )}
      {messages.map((r) => (
        <Card
          key={r.id}
          style={{
            marginLeft: r.payload.role === "user" ? 40 : 0,
            marginRight: r.payload.role === "assistant" ? 40 : 0,
            backgroundColor: r.payload.role === "user" ? c.raised : c.panel,
          }}
        >
          <Row>
            <Badge>{r.payload.role === "user" ? "YOU" : "HOMIES"}</Badge>
            <Label small muted>
              {new Date(r.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Label>
          </Row>
          <Label>{r.payload.text}</Label>
          {r.payload.citations?.map((cite: any, i: number) => (
            <Label small muted key={i}>
              Source: {cite.filename ?? "Document"} · {cite.file_id ?? ""}
            </Label>
          ))}
        </Card>
      ))}
      {busy && <Busy />}
      {!!error && <Label style={{ color: c.danger }}>{error}</Label>}
      <Card>
        <Field
          label="Message Homies"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="What’s on your mind?"
        />
        <Row>
          <Label small muted style={{ flex: 1 }}>
            {session
              ? "Your assistant uses the records in your account."
              : "Local commands work on this device."}
          </Label>
          <Button
            disabled={busy || !text.trim()}
            onPress={() => void send()}
            icon={<ArrowUp size={16} color={c.bg} />}
          >
            Send
          </Button>
        </Row>
      </Card>
    </View>
  );
}
