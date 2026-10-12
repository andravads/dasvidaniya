import { createClient } from "npm:@supabase/supabase-js@2.99.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
export async function authenticate(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Authentication required");
  const url = Deno.env.get("SUPABASE_URL")!,
    anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Invalid or expired session");
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  return { user: data.user, admin, userClient };
}
export async function body(req: Request) {
  if (req.method !== "POST") throw new Error("Use POST");
  const raw = await req.text();
  if (raw.length > 100000) throw new Error("Request too large");
  return JSON.parse(raw);
}
export async function openai(path: string, init: RequestInit = {}) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OpenAI is not configured on the server");
  const response = await fetch("https://api.openai.com/v1/" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + key,
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    signal: AbortSignal.timeout(55000),
  });
  if (response.status === 404 && init.method === "DELETE")
    return { deleted: true };
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI ${response.status}: ${data.error?.message ?? "Request failed"}`,
    );
  }
  return response.json();
}
export async function serve(
  handler: (req: Request) => Promise<Response>,
  req: Request,
) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  try {
    return await handler(req);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unexpected server failure";
    return json(
      { error: message },
      /session|Authentication/.test(message) ? 401 : 400,
    );
  }
}
