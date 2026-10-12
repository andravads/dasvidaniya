import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import {
  carouselZip,
  decodeBase64,
  wrapSlideText,
} from "../src/lib/carouselExport";
import {
  readCarouselBody,
  validateCarouselInput,
  validateCarouselPlan,
  maxRequestBytes,
} from "../supabase/functions/_shared/carousel";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=";
const input = {
  category: "Gym",
  language: "English",
  context: "",
  images: ["data:image/png;base64," + png],
};
const plan = {
  slides: [{ headline: "Back to the gym", body: "One session at a time." }],
  captions: [
    { account: "TikTok · Gym", text: "Today’s session." },
    { account: "Instagram · Gym", text: "Showing up today." },
  ],
};
describe("carousel safety and output validation", () => {
  it("accepts a local thumbnail and complete captions for the selected category", () => {
    expect(validateCarouselInput(input).images).toHaveLength(1);
    expect(validateCarouselPlan(plan, "Gym", 1)).toEqual(plan);
  });
  it("rejects remote URLs, unsafe image formats, malformed PNGs and oversized dimensions", () => {
    for (const image of [
      "https://example.com/private",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,iVBORw0KGgoAAAAA",
      "data:image/png;base64," + png.repeat(5000),
    ])
      expect(() =>
        validateCarouselInput({ ...input, images: [image] }),
      ).toThrow();
    const bytes = Buffer.from(png, "base64");
    bytes.writeUInt32BE(10000, 16);
    expect(() =>
      validateCarouselInput({
        ...input,
        images: ["data:image/png;base64," + bytes.toString("base64")],
      }),
    ).toThrow("small PNG");
  });
  it("rejects extra slides, wrong accounts and captions that exceed platform limits", () => {
    expect(() => validateCarouselPlan(plan, "Gym", 2)).toThrow();
    expect(() => validateCarouselPlan(plan, "Work", 1)).toThrow();
    expect(() =>
      validateCarouselPlan(
        { ...plan, captions: [plan.captions[0], plan.captions[0]] },
        "Gym",
        1,
      ),
    ).toThrow();
    expect(() =>
      validateCarouselPlan(
        { ...plan, slides: [{ headline: "x".repeat(65), body: "" }] },
        "Gym",
        1,
      ),
    ).toThrow();
    expect(() =>
      validateCarouselPlan(
        {
          ...plan,
          captions: [
            { ...plan.captions[0], text: "x".repeat(2201) },
            plan.captions[1],
          ],
        },
        "Gym",
        1,
      ),
    ).toThrow();
  });
  it("caps slide count and limits request streams even without content-length", async () => {
    expect(() =>
      validateCarouselInput({
        ...input,
        images: Array(11).fill(input.images[0]),
      }),
    ).toThrow();
    expect(() =>
      validateCarouselInput({ ...input, context: "x".repeat(1001) }),
    ).toThrow();
    await expect(
      readCarouselBody(
        new Request("https://example.com", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      ),
    ).resolves.toMatchObject({ category: "Gym" });
    await expect(
      readCarouselBody(
        new Request("https://example.com", {
          method: "POST",
          body: "x".repeat(maxRequestBytes + 1),
        }),
      ),
    ).rejects.toThrow("too large");
    await expect(
      readCarouselBody(new Request("https://example.com", { method: "GET" })),
    ).rejects.toThrow("POST");
  });
});
describe("portable image export", () => {
  it("creates an interoperable ZIP with matching checksums and ordered PNGs", () => {
    const pngBytes = decodeBase64(png);
    expect(Buffer.from(pngBytes)).toEqual(Buffer.from(png, "base64"));
    const archive = carouselZip([
      { name: "slide-01.png", bytes: pngBytes },
      { name: "slide-02.png", bytes: pngBytes },
      {
        name: "captions.txt",
        bytes: new TextEncoder().encode("Gym · caption\nKeep showing up."),
      },
    ]);
    const output = execFileSync(
      "python",
      [
        "-c",
        "import io,sys,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert z.namelist()==['slide-01.png','slide-02.png','captions.txt']; assert z.read('slide-01.png')[:8]==b'\\x89PNG\\r\\n\\x1a\\n'; print(z.read('captions.txt').decode())",
      ],
      { input: archive, encoding: "utf-8", timeout: 10000 },
    );
    expect(output).toContain("Keep showing up.");
    expect(() =>
      carouselZip([{ name: "../bad.png", bytes: pngBytes }]),
    ).toThrow();
    expect(() => decodeBase64("%%%=")).toThrow();
  });
  it("keeps long words within the image text panel without dropping words", () => {
    const text = "https://example.com/" + "w".repeat(80);
    const lines = wrapSlideText(text, 32);
    expect(lines.every((line) => line.length <= 32)).toBe(true);
    expect(lines.join("")).toEqual(text);
  });
});
