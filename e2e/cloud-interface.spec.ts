import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { crc32, deflateSync } from "node:zlib";

// High-entropy pixels exercise real photo-size pressure without user photos.
function detailedPNG() {
  const width = 512,
    height = 640,
    rows = Buffer.alloc(height * (width * 4 + 1));
  let seed = 123456789;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      for (let c = 0; c < 3; c++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        rows[offset + c] = seed & 255;
      }
      rows[offset + 3] = 255;
    }
  function chunk(name: string, data: Buffer) {
    const type = Buffer.from(name),
      length = Buffer.alloc(4),
      checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([length, type, data, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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

test("a delayed account caption cannot enter the local sandbox after logout", async ({
  page,
}) => {
  await mockCloud(page);
  const projectURL = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  let release!: () => void;
  let received!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestReceived = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route(projectURL + "/functions/v1/assistant", async (route) => {
    received();
    await pending;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Delayed private account caption" }),
    });
  });
  await page.goto("/profile");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "Content Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Write a draft manually", exact: true })
    .click();
  await page
    .getByLabel("Content topic", { exact: true })
    .fill("Private account topic");
  await page
    .getByRole("button", { name: "Generate AI caption", exact: true })
    .click();
  await requestReceived;
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("homies:v1:local")))
    .not.toBeNull();
  const responseReceived = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/functions/v1/assistant",
  );
  release();
  await (await responseReceived).finished();
  // Let the completed response reach the app before checking an absent record.
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("homies:v1:local") ?? "[]").some(
        (record: any) =>
          record.kind === "draft" &&
          record.payload.text === "Delayed private account caption",
      ),
    ),
  ).toBe(false);
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "Content Studio", exact: true })
    .click();
  await expect(
    page.getByLabel("Caption: Private account topic", { exact: true }),
  ).toHaveCount(0);
});

test("confirmation, resend and recovery links return to the app instead of localhost defaults", async ({
  page,
}) => {
  const projectURL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!projectURL) throw new Error("Public project URL is required");
  const requests: { url: string; body: any }[] = [];
  await page.route(projectURL + "/auth/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization,apikey,content-type,x-client-info",
        },
      });
    requests.push({ url: req.url(), body: req.postDataJSON() });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "33333333-3333-4333-8333-333333333333",
        email: "browser-test@example.com",
        identities: [],
      }),
    });
  });
  await page.goto("/profile");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Check your email to confirm your account.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await expect(
    page.getByText(/Check your email for a new confirmation link/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request password reset", exact: true })
    .click();
  await expect(
    page.getByText(/Open the reset link, then set your new password here/),
  ).toBeVisible();
  for (const routeName of ["signup", "resend", "recover"]) {
    const request = requests.find((r) =>
      new URL(r.url).pathname.endsWith("/" + routeName),
    );
    expect(request).toBeDefined();
    expect(new URL(request!.url).searchParams.get("redirect_to")).toBe(
      new URL("/profile", page.url()).toString(),
    );
    expect(request!.body.email).toBe("browser-test@example.com");
  }
});

test("photos become ordered carousel images and separate account captions", async ({
  page,
}, testInfo) => {
  const { token } = await mockCloud(page);
  const projectURL = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  let invocation: any;
  await page.route(projectURL + "/functions/v1/carousel", async (route) => {
    invocation = {
      body: route.request().postDataJSON(),
      authorization: route.request().headers()["authorization"],
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slides: [
          { headline: "Show up today", body: "A small step counts." },
          { headline: "Keep going", body: "Consistency starts here." },
        ],
        captions: [
          { account: "TikTok · Gym", text: "TikTok gym caption #gym" },
          {
            account: "Instagram · Gym",
            text: "Instagram gym caption #training",
          },
        ],
      }),
    });
  });
  await page.goto("/profile");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "Content Studio", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose carousel photos", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([
    {
      name: "first.png",
      mimeType: "image/png",
      buffer: detailedPNG(),
    },
    {
      name: "second.png",
      mimeType: "image/png",
      buffer: fs.readFileSync("assets/favicon.png"),
    },
  ]);
  await expect(page.getByText("Slide 2 of 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Move slide 2 earlier", exact: true })
    .click();
  const previews = page.getByText(/^Slide \d of 2$/);
  await expect(previews).toHaveCount(2);
  // Preserve the actual chosen order in both the API request and exported PNGs.
  const cards = page.getByLabel("Slide 1 preview").locator("..").locator("..");
  await expect(cards.getByText("second.png", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Prepare with AI", exact: true })
    .click();
  await expect(
    page.getByText(
      "Your carousel is ready. Review the text, then download it.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(invocation.authorization).toBe("Bearer " + token);
  expect(invocation.body.category).toBe("Gym");
  expect(invocation.body.images).toHaveLength(2);
  for (const [index, image] of invocation.body.images.entries()) {
    const bytes = Buffer.from(image.split(",")[1], "base64");
    expect(bytes.readUInt32BE(16)).toBe(index === 0 ? 512 : 256);
    expect(bytes.readUInt32BE(20)).toBe(index === 0 ? 640 : 320);
    expect(image.length).toBeLessThanOrEqual(450000);
  }
  await expect(
    page.getByLabel("TikTok · Gym post caption", { exact: true }),
  ).toHaveValue("TikTok gym caption #gym");
  await expect(
    page.getByLabel("Instagram · Gym post caption", { exact: true }),
  ).toHaveValue("Instagram gym caption #training");
  await page
    .getByLabel("Slide 1 headline", { exact: true })
    .fill("Edited headline");
  await page
    .getByRole("button", { name: "Save captions to my drafts", exact: true })
    .click();
  await expect(
    page.getByText(
      "Captions saved to your content drafts. Download the images separately.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save captions to my drafts", exact: true })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem(
              "homies:v1:33333333-3333-4333-8333-333333333333",
            ) ?? "[]",
          ).filter((r: any) => r.kind === "draft" && !r.deleted).length,
      ),
    )
    .toBe(2);
  const pendingDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download carousel & captions", exact: true })
    .click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe("homies-gym-carousel.zip");
  const archive = testInfo.outputPath("carousel.zip");
  await download.saveAs(archive);
  const inspected = execFileSync(
    "python",
    [
      "-c",
      "import sys,zipfile,struct; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.namelist()==['slide-01.png','slide-02.png','captions.txt']; assert struct.unpack('>II',z.read('slide-01.png')[16:24])==(1080,1350); assert 'Instagram gym caption' in z.read('captions.txt').decode(); open(sys.argv[2],'wb').write(z.read('slide-01.png')); print('valid carousel')",
      archive,
      testInfo.outputPath("slide-01.png"),
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  expect(inspected.trim()).toBe("valid carousel");
  await page.screenshot({
    path: testInfo.outputPath("carousel-review.png"),
    fullPage: true,
  });
  // Changing Gym to Work invalidates old AI output rather than mislabeling it.
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await expect(
    page.getByLabel("Instagram · Gym post caption", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prepare with AI", exact: true }),
  ).toBeVisible();
});
