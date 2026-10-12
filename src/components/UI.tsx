import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ViewStyle,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInputProps,
} from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useStore } from "../state/Store";
export const palette = {
  dark: {
    bg: "#0d1312",
    panel: "#151e1b",
    raised: "#1c2823",
    border: "#2a3830",
    text: "#eef3e8",
    muted: "#9aaba1",
    green: "#c7ef9a",
    onAccent: "#0d1312",
    danger: "#f7a99b",
  },
  light: {
    bg: "#f5f6ef",
    panel: "#ffffff",
    raised: "#eaf0e5",
    border: "#d7dfd2",
    text: "#18251d",
    muted: "#5b6c60",
    green: "#40751e",
    onAccent: "#ffffff",
    danger: "#b74131",
  },
};
export function useColors() {
  const { prefs } = useStore();
  return palette[prefs.theme];
}
export function Label({
  children,
  muted = false,
  small = false,
  style = {},
}: {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
  style?: any;
}) {
  const c = useColors();
  return (
    <Text
      style={[
        {
          flexShrink: 1,
          color: muted ? c.muted : c.text,
          fontSize: small ? 13 : 16,
          lineHeight: small ? 20 : 25,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Label
      style={{
        fontSize: 30,
        lineHeight: 38,
        fontWeight: "700",
        letterSpacing: -1,
      }}
    >
      {children}
    </Label>
  );
}
export function Card({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.panel,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 18,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  testID,
  accessibilityLabel,
}: {
  children?: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: secondary ? c.raised : c.green,
        borderRadius: 12,
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {icon}
      {children != null && (
        <Text
          style={{
            color: secondary ? c.text : c.onAccent,
            fontWeight: "700",
            fontSize: 14,
            flexShrink: 1,
            textAlign: "center",
          }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secure = false,
  keyboardType = "default",
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoComplete?: TextInputProps["autoComplete"];
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Label small muted>
        {label}
      </Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        secureTextEntry={secure}
        multiline={multiline}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize={
          secure || keyboardType === "email-address" ? "none" : "sentences"
        }
        style={{
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 10,
          color: c.text,
          padding: 12,
          fontSize: 16,
          minHeight: multiline ? 100 : 48,
          textAlignVertical: multiline ? "top" : "auto",
        }}
      />
    </View>
  );
}
export function Choice({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  labels?: Partial<Record<string, string>>;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      {options.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityLabel={labels?.[v] ?? v}
          aria-pressed={v === value}
          accessibilityState={{ selected: v === value }}
          onPress={() => onChange(v)}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 9,
            backgroundColor: v === value ? c.green : c.raised,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: v === value ? c.onAccent : c.text,
            }}
          >
            {labels?.[v] ?? v}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: c.raised,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.4,
          color: color ?? c.green,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <Label muted style={{ paddingVertical: 16 }}>
      {text}
    </Label>
  );
}
export function Row({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Dialog({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const c = useColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0009",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 540,
            maxHeight: "90%",
            backgroundColor: c.panel,
            borderRadius: 22,
            padding: 22,
          }}
        >
          <Row>
            <Label style={{ fontWeight: "700", fontSize: 22 }}>{title}</Label>
            <Button secondary onPress={onClose}>
              Close
            </Button>
          </Row>
          <ScrollView
            style={{ marginTop: 20 }}
            contentContainerStyle={{ gap: 15, paddingBottom: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Busy() {
  const c = useColors();
  return <ActivityIndicator color={c.green} />;
}
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const c = useColors();
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        aria-expanded={open}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Row>
          <Label style={styles.heading}>{title}</Label>
          <Icon size={20} color={c.muted} />
        </Row>
      </Pressable>
      {open && <View style={{ gap: 14 }}>{children}</View>}
    </Card>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <Label small muted>
        {children}
      </Label>
    </Card>
  );
}
export const styles = StyleSheet.create({
  page: { gap: 22, paddingBottom: 30 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  grow: { flex: 1, minWidth: 260 },
  heading: { fontSize: 18, fontWeight: "600" },
  section: { fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
});
export function useWords() {
  const { prefs } = useStore();
  return prefs.language === "id"
    ? {
        home: "Beranda",
        calendar: "Kalender",
        chat: "Asisten",
        workspace: "Ruang kerja",
        profile: "Profil",
        today: "Hari ini",
        tasks: "Tugas prioritas",
        habits: "Rutinitas harian",
        add: "Tambah tugas",
        welcome: "Selamat datang,",
        subtitle: "Satu ruang untuk semua aktivitas Anda.",
      }
    : {
        home: "Home",
        calendar: "Calendar",
        chat: "AI Chat",
        workspace: "Workspace",
        profile: "Profile",
        today: "Today",
        tasks: "Priority tasks",
        habits: "Daily routines",
        add: "New task",
        welcome: "Good to see you,",
        subtitle: "A little clarity. A lot of possibilities.",
      };
}
