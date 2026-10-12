import { test, expect, Page } from "@playwright/test";

// Isolate browser integration from real user creation, provider charges and
// production writes. Database isolation is tested separately in PostgreSQL.
async function mockCloud(page: Page) {
  const projectURL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!projectURL)
    throw new Error(
      "Cloud browser checks require the configured public project URL",
    );
  const userID = "33333333-3333-4333-8333-333333333333";
  const user = {
    id: userID,
    aud: "authenticated",
    role: "authenticated",
    email: "browser-test@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const payload = Buffer.from(
    JSON.stringify({
      sub: userID,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    }),
  ).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.test-only-signature`;
  const task = {
    title: "Private cloud task",
    domain: "personal",
    priority: "medium",
    due: "2026-10-12",
    time: "14:00",
    duration: 30,
    status: "todo",
    recurrence: "none",
    reminder: false,
    description: "",
  };
  const remote = [
    {
      id: "cloud-task",
      kind: "task",
      payload: task,
      updated_at: new Date().toISOString(),
      deleted: false,
    },
  ];
  const requests: { path: string; authorization: string; body: any }[] = [];
  await page.route(projectURL + "/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Content-Type": "application/json",
    };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const data = req.postDataJSON();
    requests.push({
      path,
      authorization: req.headers()["authorization"] ?? "",
      body: data,
    });
    if (path === "/auth/v1/token")
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          access_token: token,
          refresh_token: "test-only-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          user,
        }),
      });
    if (path === "/auth/v1/user")
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(user),
      });
    if (path === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers });
    if (path === "/rest/v1/workspace_records")
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(remote),
      });
    if (path === "/rest/v1/rpc/merge_workspace_records")
      return route.fulfill({ status: 204, headers });
    if (path === "/functions/v1/assistant")
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          text: "Mock AI response for browser verification.",
          actions: [
            {
              type: "create_task",
              task: {
                ...task,
                title: "Task from cloud assistant",
                time: "16:00",
              },
            },
          ],
          citations: [],
        }),
      });
    return route.fulfill({
      status: 503,
      headers,
      body: JSON.stringify({ error: "Unexpected mocked cloud route: " + path }),
    });
  });
  return { requests, token };
}

test("sign-in opens a separate account workspace and cloud AI actions reach the calendar", async ({
  page,
}) => {
  const { requests, token } = await mockCloud(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill("Device-only task");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page
    .getByRole("button", { name: "Open your account", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Private cloud task", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Device-only task", exact: true }),
  ).toHaveCount(0);
  expect(
    requests
      .filter((r) => r.path === "/rest/v1/rpc/merge_workspace_records")
      .flatMap((r) => r.body.items)
      .some((r) => r.payload.title === "Device-only task"),
  ).toBe(false);
  await page.getByRole("link", { name: "AI Chat", exact: true }).click();
  await page
    .getByLabel("Message Homies", { exact: true })
    .fill("Create a task for my afternoon");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText(/Created task: Task from cloud assistant/),
  ).toBeVisible();
  const invocation = requests.find((r) => r.path === "/functions/v1/assistant");
  expect(invocation?.authorization).toBe("Bearer " + token);
  expect(invocation?.body.text).toBe("Create a task for my afternoon");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit Task from cloud assistant",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tasks", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit Task from cloud assistant",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Device-only task", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Private cloud task", exact: true }),
  ).toHaveCount(0);
});

test("a sign-in failure is clearly shown and account settings remain usable", async ({
  page,
}) => {
  const projectURL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!projectURL) throw new Error("Public project URL is required");
  await page.route(projectURL + "/auth/v1/token?**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: "invalid_credentials",
        msg: "Invalid login credentials",
      }),
    }),
  );
  await page.goto("/profile");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Invalid login credentials", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "browser-test@example.com",
  );
});
