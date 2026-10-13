import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { completeAuthCallback } from "./authCallback";
import { nativeAuthenticationRedirect } from "./authSession";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export function authenticationRedirect() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL("/profile", window.location.origin).toString();
  }
  // Expo Go owns exp:// links; installed Homies builds own homiesos:// links.
  return nativeAuthenticationRedirect(
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    () => Linking.createURL("profile"),
  );
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
  const auth = supabase.auth;
  let active = true;
  let handledUrl = "";
  const accept = async (url: string | null) => {
    if (!active || !url || url === handledUrl) return;
    handledUrl = url;
    try {
      await completeAuthCallback(url, authenticationRedirect(), auth);
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
  const refresh = (state: string | null) => {
    if (state === "active") auth.startAutoRefresh();
    else auth.stopAutoRefresh();
  };
  refresh(AppState.currentState);
  const lifecycle = AppState.addEventListener("change", refresh);
  return () => {
    active = false;
    subscription.remove();
    lifecycle.remove();
    auth.stopAutoRefresh();
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
