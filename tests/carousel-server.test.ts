import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
const runtime = vi.hoisted(() => ({ authenticate: vi.fn(), openai: vi.fn() }));
vi.mock("../supabase/functions/_shared/runtime.ts", () => ({
  ...runtime,
  json: (data: unknown) => new Response(JSON.stringify(data)),
  serve: (handler: (req: Request) => Promise<Response>, req: Request) =>
    handler(req),
}));
let handler: (req: Request) => Promise<Response>;
const settings: Record<string, string> = {
  AI_ALLOWED_MODELS: "gpt-4.1-mini",
  AI_DAILY_REQUEST_LIMIT: "20",
};
const user = { id: "authenticated-owner" };
const rpc = vi.fn(),
  update = vi.fn(),
  eq = vi.fn();
const admin = { rpc, from: vi.fn(() => ({ update })) };
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=";
const payload = {
  category: "Work",
  language: "English",
  context: "First work week",
  images: ["data:image/png;base64," + png],
  owner_id: "someone-else",
};
const plan = {
  slides: [{ headline: "One step at a time", body: "Keep learning." }],
  captions: [{ account: "TikTok · Working tips", text: "Work caption" }],
};
const request = () =>
  new Request("https://project.supabase.co/functions/v1/carousel", {
    method: "POST",
    body: JSON.stringify(payload),
  });
beforeAll(async () => {
  vi.stubGlobal("Deno", {
    serve: (fn: typeof handler) => {
      handler = fn;
    },
    env: { get: (key: string) => settings[key] },
  });
  // This Deno entry point is typechecked by check:server, separately from the
  // React Native compiler. Vitest replaces its runtime for these contract tests.
  const endpoint = "../supabase/functions/carousel/index.ts";
  await import(endpoint);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  runtime.authenticate.mockResolvedValue({ user, admin });
  rpc.mockResolvedValue({ data: "reservation", error: null });
  eq.mockReturnValue({ eq });
  update.mockReturnValue({ eq });
  runtime.openai.mockResolvedValue({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(plan) }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 30 },
  });
});
it("authenticates before reading photos or calling AI", async () => {
  runtime.authenticate.mockRejectedValueOnce(
    new Error("Authentication required"),
  );
  await expect(handler(request())).rejects.toThrow("Authentication required");
  expect(rpc).not.toHaveBeenCalled();
  expect(runtime.openai).not.toHaveBeenCalled();
});
it("reserves the authenticated owner's budget and keeps photos out of database writes", async () => {
  const response = await handler(request());
  expect(await response.json()).toEqual(plan);
  expect(rpc).toHaveBeenCalledWith("reserve_ai_request", {
    target_owner: user.id,
    daily_limit: 20,
    requested_model: "gpt-4.1-mini",
  });
  expect(eq).toHaveBeenCalledWith("owner_id", user.id);
  const provider = JSON.parse(runtime.openai.mock.calls[0][1].body);
  expect(provider.store).toBe(false);
  expect(provider.input[0].content[1].image_url).toBe(payload.images[0]);
  expect(JSON.stringify(update.mock.calls)).not.toContain(png);
});
it("does not call the provider when the shared daily budget is exhausted", async () => {
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "Daily limit reached" },
  });
  await expect(handler(request())).rejects.toThrow("Daily limit reached");
  expect(runtime.openai).not.toHaveBeenCalled();
});
it("rejects incomplete provider results and stores a generic failure without image content", async () => {
  runtime.openai.mockResolvedValueOnce({ status: "incomplete", output: [] });
  await expect(handler(request())).rejects.toThrow("could not finish");
  expect(update).toHaveBeenCalledWith({
    status: "failed",
    error: "Carousel preparation failed",
  });
  expect(JSON.stringify(update.mock.calls)).not.toContain(payload.context);
});
