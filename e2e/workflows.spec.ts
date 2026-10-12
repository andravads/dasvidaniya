import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Good to see you, Homie.")).toBeVisible();
});
test("AI local command creates a persistent task visible in the unified calendar", async ({
  page,
}) => {
  await page.getByRole("link", { name: "AI Chat", exact: true }).click();
  await page
    .getByLabel("Message Homies", { exact: true })
    .fill("Add task: Practice piano tomorrow 19:00");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Created task: Practice piano/)).toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Practice piano", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Calendar & tasks")).toBeVisible();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Practice piano", exact: true }),
  ).toBeVisible();
});
test("task form detects conflicts and supports task completion", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Engineering report");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Engineering report", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Conflicting meeting");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByText(/Calendar conflict with Engineering report/),
  ).toBeVisible();
  await page.getByLabel("Time (HH:mm)", { exact: true }).fill("10:00");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Complete Engineering report", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Engineering report", exact: true }),
  ).toHaveCount(0);
});
test("daily routines persist after reloading", async ({ page }) => {
  const habit = page.getByRole("checkbox", {
    name: "Piano practice",
    exact: true,
  });
  await habit.click();
  await expect(habit).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Piano practice", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});
test("Gainsip campaign is editable and creates a review in the calendar", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page.getByRole("button", { name: "Gainsip", exact: true }).click();
  await page
    .getByLabel("Products / services", { exact: true })
    .fill("User-provided product");
  await page
    .getByRole("button", { name: "Save business profile", exact: true })
    .click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("First customer experiment");
  await page
    .getByLabel("Hypothesis and success measure", { exact: true })
    .fill("Test a direct CTA; measure inquiries that convert");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await expect(
    page.getByText("First customer experiment", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add review to calendar", exact: true })
    .click();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByText("Review Gainsip campaign: First customer experiment", {
      exact: true,
    }),
  ).toBeVisible();
});
test("caption draft can be saved and scheduled without claiming publishing", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "Content Studio", exact: true })
    .click();
  await page
    .getByLabel("Content topic", { exact: true })
    .fill("Consistent gym routine");
  await page
    .getByLabel("Your caption or content idea", { exact: true })
    .fill("Small steps, consistent progress. Save this for your next workout.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to content calendar", exact: true })
    .click();
  await expect(
    page.getByText("Scheduled", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByText("Prepare / manually publish: Consistent gym routine", {
      exact: true,
    }),
  ).toBeVisible();
});
test("authorized TXT import returns a named document excerpt", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByLabel("Document revision", { exact: true })
    .fill("Test revision A");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload authorized document", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "authorized-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Test document only. Meeting minutes: tooling clarification is pending review. No repair limits supplied.",
    ),
  });
  await expect(
    page.getByText("authorized-note.txt", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Keyword search in local TXT documents", { exact: true })
    .fill("tooling");
  await page
    .getByRole("button", { name: "Search documents", exact: true })
    .click();
  await expect(
    page.getByText("authorized-note.txt · revision Test revision A", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/tooling clarification is pending review/),
  ).toBeVisible();
});
test("watchlists show unavailable quotes rather than invented financial values", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page.getByRole("button", { name: "Investments", exact: true }).click();
  await expect(page.getByText("ANTM", { exact: true })).toBeVisible();
  await expect(
    page.getByText("MARKET DATA NOT CONNECTED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unverified interest · quote unavailable"),
  ).toHaveCount(10);
});
test("collection requires variant confirmation and stores user-entered provenance", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "One Piece TCG", exact: true })
    .click();
  await page
    .getByLabel("Printed card code (e.g. OP01-001)", { exact: true })
    .fill("OP01-001");
  await page
    .getByLabel("Card / character name", { exact: true })
    .fill("User-confirmed card");
  await page
    .getByLabel("Variant / set / rarity / promo edition", { exact: true })
    .fill("User-confirmed base art");
  await page
    .getByLabel("Observed price per card (optional)", { exact: true })
    .fill("100");
  await page
    .getByLabel("Price source / listing versus completed sale", { exact: true })
    .fill("Manual test observation, not live data");
  await page
    .getByRole("button", { name: "Confirm variant & add card", exact: true })
    .click();
  await expect(
    page.getByText("JPY 100 · user-entered observation", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "One Piece TCG", exact: true })
    .click();
  await expect(
    page.getByText("JPY 100 · user-entered observation", { exact: true }),
  ).toBeVisible();
});
test("preferences change language and preserve theme settings", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Bahasa Indonesia", exact: true })
    .click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("link", { name: "Beranda", exact: true }).click();
  await expect(page.getByText("Selamat datang, Homie.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Selamat datang, Homie.")).toBeVisible();
});
test("signed-out account offers cloud sign-in and explains device-only records", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Existing device records are not uploaded automatically/),
  ).toBeVisible();
});

test("deleting a task requires an explicit second confirmation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill("Temporary task");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Temporary task", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm delete task", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm delete task", exact: true })
    .click();
  await expect(page.getByText("Temporary task", { exact: true })).toHaveCount(
    0,
  );
});
test("the quick task action stays inside the mobile viewport", async ({
  page,
}) => {
  const bounds = await page
    .getByRole("button", { name: "New task", exact: true })
    .boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test("account access is easy to find and advanced settings expand only when requested", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Open your account", exact: true })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  const advanced = page.getByRole("button", {
    name: "Advanced AI settings",
    exact: true,
  });
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByLabel("Requested AI model", { exact: true }),
  ).toHaveCount(0);
  await advanced.click();
  await expect(
    page.getByLabel("Requested AI model", { exact: true }),
  ).toBeVisible();
  await advanced.click();
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
});
test("date arrows keep the selected date field in sync and month dates can be opened", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page
    .getByRole("button", { name: "Search & filters", exact: true })
    .click();
  const date = page.getByLabel("Selected date (YYYY-MM-DD)", { exact: true });
  const original = await date.inputValue();
  await page.getByRole("button", { name: "Next date", exact: true }).click();
  await expect(date).not.toHaveValue(original);
  await page
    .getByRole("button", { name: "Previous date", exact: true })
    .click();
  await expect(date).toHaveValue(original);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const first = original.slice(0, 7) + "-01";
  await page
    .getByRole("button", { name: "View " + first, exact: true })
    .click();
  await expect(date).toHaveValue(first);
  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("navigation and primary screens fit a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const name of ["Home", "Calendar", "AI Chat", "Workspace", "Profile"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open your account", exact: true }),
    ).toBeVisible();
    const links = page.getByRole("link");
    for (const link of await links.all()) {
      const bounds = await link.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
