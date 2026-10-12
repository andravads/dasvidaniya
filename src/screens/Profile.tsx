import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Switch, Platform } from "react-native";
import {
  Badge,
  Button,
  Card,
  Choice,
  Dialog,
  Disclosure,
  Field,
  Label,
  Row,
  Title,
  styles,
  useColors,
  Busy,
} from "../components/UI";
import { useItems, useStore } from "../state/Store";
import { defaults, domains, domainLabels } from "../lib/domain";
import { supabase, invoke, authenticationRedirect } from "../lib/backend";
import { requestNotifications } from "../lib/notifications";
import { exportJson } from "../lib/export";
export default function Profile() {
  const { prefs, setPrefs, records, session, status, sync, resetLocal } =
      useStore(),
    c = useColors();
  const [newPassword, setNewPassword] = useState("");
  const [quietStart, setQuietStart] = useState(prefs.quietStart),
    [quietEnd, setQuietEnd] = useState(prefs.quietEnd);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [messageError, setMessageError] = useState(false),
    [busy, setBusy] = useState(false),
    [zone, setZone] = useState(prefs.timezone),
    [confirm, setConfirm] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const audit = useItems("audit");
  const run = async (fn: () => Promise<any>, success = "Saved") => {
    setBusy(true);
    setMessage("");
    setMessageError(false);
    try {
      const result = await fn();
      setMessage(typeof result === "string" ? result : success);
    } catch (e: any) {
      setMessageError(true);
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.page}>
      <View>
        <Label small muted>
          YOUR ACCOUNT & SETTINGS
        </Label>
        <Title>Profile & preferences</Title>
        <Label muted>
          Sign in, choose your preferences, and keep your day in sync.
        </Label>
      </View>
      <View style={styles.grid}>
        <Card style={styles.grow}>
          <Row>
            <Label style={styles.heading}>Your account</Label>
            <Badge>{session ? "SIGNED IN" : "LOCAL SANDBOX"}</Badge>
          </Row>
          {session ? (
            <>
              <Label>{session.user.email}</Label>
              <Label small muted>
                {status}
              </Label>
              <Field
                label="New password (signed-in account)"
                value={newPassword}
                onChangeText={setNewPassword}
                secure
              />
              <Button
                secondary
                disabled={newPassword.length < 8 || busy}
                onPress={() =>
                  void run(async () => {
                    const { error } = await supabase!.auth.updateUser({
                      password: newPassword,
                    });
                    if (error) throw error;
                    setNewPassword("");
                  }, "Password updated")
                }
              >
                Update password
              </Button>
              <Button
                secondary
                onPress={() => void run(sync, "Synchronization finished")}
              >
                Sync now
              </Button>
              <Button
                secondary
                onPress={() =>
                  void run(async () => {
                    const { error } = await supabase!.auth.signOut();
                    if (error) throw error;
                  }, "Signed out")
                }
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Label small muted>
                Sign in to save across devices and use AI. Existing device
                records are not uploaded automatically.
              </Label>
              {supabase ? (
                <>
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                  <Field
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    autoComplete="current-password"
                    secure
                  />
                  <Button
                    disabled={busy || !email || password.length < 8}
                    onPress={() =>
                      void run(async () => {
                        const { error } =
                          await supabase!.auth.signInWithPassword({
                            email,
                            password,
                          });
                        if (error) throw error;
                        setPassword("");
                      }, "Signed in")
                    }
                  >
                    Sign in
                  </Button>
                  <Button
                    secondary
                    disabled={busy || !email || password.length < 8}
                    onPress={() =>
                      void run(async () => {
                        const { data, error } = await supabase!.auth.signUp({
                          email: email.trim(),
                          password,
                          options: {
                            emailRedirectTo: authenticationRedirect(),
                          },
                        });
                        if (error) throw error;
                        setPassword("");
                        return data.session
                          ? "Account created"
                          : "Check your email to confirm your account.";
                      }, "Account created. If email confirmation is enabled, confirm before signing in.")
                    }
                  >
                    Create account
                  </Button>
                  <Button
                    secondary
                    disabled={!email.trim() || busy}
                    onPress={() =>
                      void run(async () => {
                        const { error } = await supabase!.auth.resend({
                          type: "signup",
                          email: email.trim(),
                          options: {
                            emailRedirectTo: authenticationRedirect(),
                          },
                        });
                        if (error) throw error;
                      }, "Check your email for a new confirmation link. Use the newest email.")
                    }
                  >
                    Resend confirmation email
                  </Button>
                  <Button
                    secondary
                    disabled={!email || busy}
                    onPress={() =>
                      void run(async () => {
                        const { error } =
                          await supabase!.auth.resetPasswordForEmail(
                            email.trim(),
                            {
                              redirectTo: authenticationRedirect(),
                            },
                          );
                        if (error) throw error;
                      }, "Check your email. Open the reset link, then set your new password here.")
                    }
                  >
                    Request password reset
                  </Button>
                </>
              ) : (
                <Label small muted>
                  Cloud sign-in is not available in this version.
                </Label>
              )}
            </>
          )}
          {busy && <Busy />}
          {!!message && (
            <Label small style={{ color: messageError ? c.danger : c.green }}>
              {message}
            </Label>
          )}
        </Card>
        <Card style={styles.grow}>
          <Label style={styles.heading}>Personalize your day</Label>
          <Field
            label="Display name"
            value={prefs.name}
            onChangeText={(name) => setPrefs({ name: name.slice(0, 60) })}
          />
          <Label small muted>
            Interface language
          </Label>
          <Choice
            options={["en", "id"]}
            labels={{ en: "English", id: "Bahasa Indonesia" }}
            value={prefs.language}
            onChange={(v) => setPrefs({ language: v as "en" | "id" })}
          />
          <Label small muted>
            Appearance
          </Label>
          <Choice
            options={["dark", "light"]}
            labels={{ dark: "Dark", light: "Light" }}
            value={prefs.theme}
            onChange={(v) => setPrefs({ theme: v as "dark" | "light" })}
          />
          <Field label="Timezone" value={zone} onChangeText={setZone} />
          <Button
            secondary
            onPress={() => {
              try {
                new Intl.DateTimeFormat("en", { timeZone: zone }).format();
                setPrefs({ timezone: zone });
                setMessageError(false);
                setMessage("Timezone saved");
              } catch {
                setMessageError(true);
                setMessage(
                  "Use a valid timezone such as Asia/Jakarta or America/New_York.",
                );
              }
            }}
          >
            Save timezone
          </Button>
        </Card>
      </View>
      <Disclosure title="Home shortcuts">
        <View style={styles.grid}>
          {domains.map((d) => (
            <Row key={d} style={{ minWidth: 220, flex: 1 }}>
              <Label>{domainLabels[d]}</Label>
              <Switch
                accessibilityLabel={"Show " + domainLabels[d]}
                value={prefs.widgets.includes(d)}
                onValueChange={(on) =>
                  setPrefs({
                    widgets: on
                      ? [...prefs.widgets, d]
                      : prefs.widgets.filter((v) => v !== d),
                  })
                }
              />
            </Row>
          ))}
        </View>
      </Disclosure>
      <Disclosure title="Reminders & quiet hours">
        <Row>
          <Label>Phone reminders</Label>
          <Switch
            accessibilityLabel="Enable notifications"
            value={prefs.notifications}
            disabled={Platform.OS === "web"}
            onValueChange={(on) =>
              void run(
                async () => {
                  if (on) await requestNotifications();
                  setPrefs({ notifications: on });
                },
                on
                  ? "Notification permission granted"
                  : "Notifications disabled",
              )
            }
          />
        </Row>
        <Field
          label="Quiet hours start (HH:mm)"
          value={quietStart}
          onChangeText={setQuietStart}
        />
        <Field
          label="Quiet hours end (HH:mm)"
          value={quietEnd}
          onChangeText={setQuietEnd}
        />
        <Button
          secondary
          onPress={() => {
            if (
              [quietStart, quietEnd].every((v) =>
                /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
              )
            ) {
              setPrefs({ quietStart, quietEnd });
              setMessageError(false);
              setMessage("Quiet hours saved");
            } else {
              setMessageError(true);
              setMessage("Enter valid HH:mm quiet hours");
            }
          }}
        >
          Save quiet hours
        </Button>
        <Label small muted>
          Reminders are available in the Android/iPhone app. This browser
          version does not send background notifications. Quiet hours pause
          reminders so they do not disturb you.
        </Label>
      </Disclosure>
      <Disclosure title="Advanced AI settings">
        <Field
          label="Requested AI model"
          value={prefs.model}
          onChangeText={(model) => setPrefs({ model })}
        />
        <Label small muted>
          Your account has a daily AI request limit, normally 20 requests. The
          model must be enabled for your account by the app administrator.
        </Label>
        {[
          "Supabase: " +
            (supabase ? "configured for sign-in and sync" : "not configured"),
          "AI replies require sign-in and an available AI service.",
          "IDX / US market provider: unavailable",
          "SNKRDUNK / card catalog / OCR: unavailable",
          "TikTok / Instagram publishing: unavailable",
          "Google Calendar OAuth: unavailable",
        ].map((line) => (
          <Label key={line} small muted>
            {line}
          </Label>
        ))}
      </Disclosure>
      <Disclosure title="Data controls">
        <Label small muted>
          Backups contain your records, including private work notes and
          conversations. Store and share them carefully. Cloud documents are not
          included in the JSON export.
        </Label>
        <Button
          secondary
          onPress={() => void run(() => exportJson(records), "Backup exported")}
        >
          Export account records
        </Button>
        <Button
          secondary
          onPress={() => {
            setConfirm(true);
            setConfirmation("");
          }}
        >
          {session
            ? "Delete cloud account and documents"
            : "Reset local sandbox"}
        </Button>
      </Disclosure>
      <Disclosure title="Action history">
        {audit.length ? (
          audit
            .slice()
            .reverse()
            .slice(0, 30)
            .map((r) => (
              <Label small key={r.id}>
                {r.payload.action} · {r.payload.source} ·{" "}
                {new Date(r.updatedAt).toLocaleString()}
              </Label>
            ))
        ) : (
          <Label small muted>
            No assistant actions yet.
          </Label>
        )}
      </Disclosure>
      <Dialog
        visible={confirm}
        title={session ? "Delete account" : "Reset local data"}
        onClose={() => setConfirm(false)}
      >
        <Label>
          This permanently deletes{" "}
          {session
            ? "your account, private uploaded documents and cloud records"
            : "tasks, notes, history and other sandbox records on this device"}
          . Export a backup first.
        </Label>
        <Field
          label="Type DELETE to confirm"
          value={confirmation}
          onChangeText={setConfirmation}
        />
        <Button
          disabled={confirmation !== "DELETE" || busy}
          onPress={() =>
            void run(async () => {
              if (session) {
                await invoke("account", { confirmation: "DELETE" });
                await AsyncStorage.removeItem("homies:v1:" + session.user.id);
                await supabase!.auth.signOut();
              } else await resetLocal();
              setConfirm(false);
            }, "Data deleted")
          }
        >
          Permanently delete
        </Button>
      </Dialog>
    </View>
  );
}
