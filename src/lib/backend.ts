import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { nativeAuthCallback } from "./authCallback";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export function authenticationRedirect() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL("/profile", window.location.origin).toString();
  }
  return Linking.createURL("profile", { scheme: "homiesos" });
}
const authStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web",
        },
      })
    : null;
export function listenForNativeAuthentication(
  onError: (message: string) => void,
) {
  if (Platform.OS === "web" || !supabase) return () => {};
  let active = true;
  const accept = async (url: string | null) => {
    if (!active || !url) return;
    try {
      const tokens = nativeAuthCallback(url);
      if (!tokens || !active) return;
      const { error } = await supabase!.auth.setSession(tokens);
      if (error)
        throw new Error(
          "The email link could not sign you in. Request a new email.",
        );
    } catch (e) {
      if (active)
        onError(
          e instanceof Error ? e.message : "Could not open the email link.",
        );
    }
  };
  const subscription = Linking.addEventListener("url", ({ url }) => {
    void accept(url);
  });
  void Linking.getInitialURL()
    .then(accept)
    .catch(() => {
      if (active) onError("Could not open the email link.");
    });
  return () => {
    active = false;
    subscription.remove();
  };
}
export async function invoke(name: string, body: Record<string, unknown>) {
  if (!supabase)
    throw new Error(
      "Cloud services are not configured. See Profile → Connections.",
    );
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      message = (await (error as any).context.json()).error ?? message;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
