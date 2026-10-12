import React, { useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Text,
} from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  House,
  CalendarDays,
  Sparkles,
  Layers,
  UserRound,
  Command,
} from "lucide-react-native";
import { StoreProvider, useStore } from "../src/state/Store";
import {
  Badge,
  Label,
  Row,
  useColors,
  useWords,
  Busy,
  Button,
} from "../src/components/UI";
export { ErrorBoundary } from "expo-router";
function Shell() {
  const { width } = useWindowDimensions(),
    wide = width >= 980,
    c = useColors(),
    w = useWords(),
    path = usePathname(),
    router = useRouter(),
    { ready, prefs, error, clearError, session } = useStore();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [path]);
  const nav = [
    { route: "/", label: w.home, icon: House },
    { route: "/calendar", label: w.calendar, icon: CalendarDays },
    { route: "/chat", label: w.chat, icon: Sparkles },
    { route: "/workspace", label: w.workspace, icon: Layers },
    { route: "/profile", label: w.profile, icon: UserRound },
  ];
  const navigation = nav.map(({ route, label, icon: Icon }) => {
    const active = path === route;
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        aria-current={active ? "page" : undefined}
        accessibilityState={{ selected: active }}
        key={route}
        onPress={() => router.navigate(route as any)}
        style={{
          flex: wide ? undefined : 1,
          flexDirection: wide ? "row" : "column",
          alignItems: "center",
          gap: wide ? 12 : 4,
          padding: wide ? 14 : 9,
          borderRadius: 12,
          minHeight: wide ? 50 : 64,
          minWidth: 0,
          backgroundColor: active ? c.raised : "transparent",
        }}
      >
        <Icon size={wide ? 19 : 20} color={active ? c.green : c.muted} />
        <Text
          style={{
            fontSize: wide ? 15 : 11,
            fontWeight: active ? "700" : "500",
            color: active ? c.green : c.muted,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={prefs.theme === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1, flexDirection: "row" }}>
        {wide && (
          <View
            style={{
              width: 230,
              padding: 22,
              borderRightWidth: 1,
              borderColor: c.border,
              gap: 28,
            }}
          >
            <Row style={{ justifyContent: "flex-start", gap: 10 }}>
              <View
                style={{
                  backgroundColor: c.green,
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <Command size={22} color={c.bg} />
              </View>
              <View>
                <Label
                  style={{
                    fontSize: 21,
                    fontWeight: "800",
                    letterSpacing: -0.8,
                  }}
                >
                  homies
                </Label>
                <Label small muted>
                  Your day, in one place
                </Label>
              </View>
            </Row>
            <View style={{ gap: 5 }}>{navigation}</View>
            <View style={{ flex: 1 }} />
            <View style={{ gap: 10 }}>
              <Badge>{session ? "SIGNED IN" : "ON THIS DEVICE"}</Badge>
              <Label small muted>
                {session
                  ? session.user.email
                  : "Sign in to save across devices."}
              </Label>
              <Button
                accessibilityLabel="Open your account"
                secondary
                onPress={() => router.navigate("/profile")}
              >
                {session ? "Your account" : "Sign in"}
              </Button>
            </View>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {!wide && (
            <Row
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: c.border,
              }}
            >
              <Label style={{ fontWeight: "800", fontSize: 20 }}>
                homies os
              </Label>
              <Button
                accessibilityLabel="Open your account"
                secondary
                onPress={() => router.navigate("/profile")}
              >
                {session ? "Your account" : "Sign in"}
              </Button>
            </Row>
          )}
          {!!error && (
            <Pressable
              onPress={clearError}
              style={{ padding: 14, backgroundColor: c.raised }}
            >
              <Label small style={{ color: c.danger }}>
                {error} · Tap to dismiss
              </Label>
            </Pressable>
          )}
          <ScrollView
            ref={scroll}
            style={{ flex: 1, display: ready ? "flex" : "none" }}
            contentContainerStyle={{
              padding: wide ? 32 : 16,
              width: "100%",
              maxWidth: 1350,
              alignSelf: "center",
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Slot />
          </ScrollView>
          {!ready && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                gap: 15,
              }}
            >
              <Busy />
              <Label>Loading your workspace…</Label>
            </View>
          )}
          {!wide && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: c.panel,
                borderTopWidth: 1,
                borderColor: c.border,
                paddingBottom: 3,
              }}
            >
              {navigation}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
